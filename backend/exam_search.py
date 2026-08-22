"""학생 본인의 고사문제지에 대한 개인 검색.

공지 인덱스(faiss_index)와 **절대 합치지 않습니다.** 공지는 누구나 볼 수 있는
자료지만 시험지는 본인 계정으로만 접근 가능한 자료라, 같은 인덱스에 넣으면 한
학생의 시험지가 다른 학생의 검색 결과로 나갑니다.

학생 한 명의 시험지는 많아야 수십 건이라 FAISS 인덱스를 따로 만들 필요가 없습니다.
질의 시점에 그 학생의 행만 임베딩해 브루트포스 코사인 유사도를 계산합니다.
인덱스 파일도, 사용자별 인덱스 수명 관리도 없어 유출 경로 자체가 생기지 않습니다.
"""

import logging
import math
import re
from typing import Optional

logger = logging.getLogger(__name__)

# 시험지는 공지보다 짧고 문항 단위로 끊기므로 공지(700자)보다 작게 자릅니다.
CHUNK_SIZE = 400
CHUNK_OVERLAP = 60
MAX_RESULTS = 4

TOKEN_PATTERN = re.compile(r"[가-힣A-Za-z0-9]{2,}")

# "시험에 나왔어?", "기출", "중간고사" 등 개인 시험지를 찾는 신호.
EXAM_INTENT_PATTERN = re.compile(
    r"기출|시험|고사|중간고사|기말고사|출제|문제지|나온\s*적|나왔"
)


def looks_like_exam_question(question: str) -> bool:
    """공지가 아니라 본인 시험지를 찾는 질문인지 판단합니다.

    빗나가도 손해가 적습니다. 시험지 검색은 그 학생 자신의 자료에만 닿고,
    결과가 비면 평소처럼 공지 답변으로 진행됩니다.
    """
    return bool(EXAM_INTENT_PATTERN.search(question))


def chunk_exam_text(text: str) -> list[str]:
    """문단 경계를 우선 살려 자릅니다. 문항이 중간에 잘리면 검색이 나빠집니다."""
    cleaned = re.sub(r"[ \t]+", " ", text or "").strip()
    if not cleaned:
        return []
    if len(cleaned) <= CHUNK_SIZE:
        return [cleaned]

    chunks, start = [], 0
    while start < len(cleaned):
        end = min(start + CHUNK_SIZE, len(cleaned))
        if end < len(cleaned):
            window = cleaned[start:end]
            # 문단 → 줄 → 문장 순으로 자를 곳을 찾습니다.
            for separator in ("\n\n", "\n", ". ", ""):
                if not separator:
                    break
                cut = window.rfind(separator)
                if cut > CHUNK_SIZE // 2:
                    end = start + cut + len(separator)
                    break
        chunks.append(cleaned[start:end].strip())
        if end >= len(cleaned):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return [chunk for chunk in chunks if chunk]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if not norm_a or not norm_b:
        return 0.0
    return dot / (norm_a * norm_b)


def _keyword_overlap(question: str, text: str) -> float:
    terms = set(TOKEN_PATTERN.findall(question.lower()))
    if not terms:
        return 0.0
    haystack = text.lower()
    return sum(term in haystack for term in terms) / len(terms)


class ExamSearcher:
    """한 학생의 시험지 안에서만 검색합니다."""

    def __init__(self, embeddings):
        self.embeddings = embeddings

    def search(self, question: str, papers: list[dict], limit: int = MAX_RESULTS) -> list[dict]:
        """papers는 그 학생 소유임이 호출부에서 이미 확인된 행이어야 합니다.

        반환: [{subject_name, exam_div_name, sch_year, smt_rcd, snippet, score}]
        """
        candidates = []
        for paper in papers:
            for chunk in chunk_exam_text(paper.get("content_text") or ""):
                candidates.append((paper, chunk))
        if not candidates:
            return []

        try:
            vectors = self.embeddings.embed_documents([chunk for _, chunk in candidates])
            query_vector = self.embeddings.embed_query(question)
        except Exception as error:
            # 임베딩이 실패해도 키워드 점수로 답할 수 있게 합니다.
            logger.warning("시험지 임베딩 실패, 키워드로 대체합니다: %s", type(error).__name__)
            vectors, query_vector = None, None

        scored = []
        for index, (paper, chunk) in enumerate(candidates):
            keyword = _keyword_overlap(question, f"{paper.get('subject_name', '')} {chunk}")
            if vectors is not None:
                similarity = _cosine(query_vector, vectors[index])
                score = 0.8 * similarity + 0.2 * keyword
            else:
                score = keyword
            scored.append((score, paper, chunk))

        scored.sort(key=lambda item: item[0], reverse=True)

        results, seen = [], set()
        for score, paper, chunk in scored:
            if score <= 0:
                continue
            # 같은 시험지에서 여러 조각이 올라오면 가장 좋은 것만 남깁니다.
            key = (paper.get("subject_no"), paper.get("exam_div"))
            if key in seen:
                continue
            seen.add(key)
            results.append(
                {
                    "subject_name": paper.get("subject_name"),
                    "subject_no": paper.get("subject_no"),
                    "sch_year": paper.get("sch_year"),
                    "smt_rcd": paper.get("smt_rcd"),
                    "exam_div_name": paper.get("exam_div_name"),
                    "professor": paper.get("professor"),
                    "snippet": chunk,
                    "score": round(score, 4),
                }
            )
            if len(results) >= limit:
                break
        return results


def format_exam_context(results: list[dict]) -> str:
    """공지 컨텍스트와 구분되도록 별도 표기로 감쌉니다."""
    blocks = []
    for index, item in enumerate(results, start=1):
        header = (
            f"[내 시험지 {index}] {item['subject_name']} "
            f"{item['sch_year']}학년도 {item['smt_rcd']}학기 {item['exam_div_name']}"
        )
        if item.get("professor"):
            header += f" · {item['professor']}"
        blocks.append(f"{header}\n{item['snippet']}")
    return "\n\n---\n\n".join(blocks)
