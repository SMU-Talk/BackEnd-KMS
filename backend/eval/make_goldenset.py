"""Builds a retrieval golden set from the crawled notices.

For each sampled notice we ask the LLM to write the question a student would
actually type when looking for it. The notice's own URL is the ground truth, so
Recall@k / MRR can be measured without any human labelling.

The generated question must not copy the title verbatim -- otherwise keyword
matching wins by construction and the numbers say nothing about the retriever.

Usage (from backend/):
    .\.venv\Scripts\python.exe eval\make_goldenset.py [--size 60]
"""

import argparse
import json
import os
import random
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR.parent / "crawled_notices"
OUTPUT_PATH = Path(__file__).resolve().parent / "goldenset.json"

MIN_BODY_CHARS = 400
QUESTION_MODEL = "gpt-4o-mini"

# candidates.json은 저장소에 커밋되므로, 인덱싱 경로와 같은 기준으로 PII를 지웁니다.
# 공지 본문에는 담당자 이메일과 학번이 그대로 들어 있는 경우가 많습니다.
PII_PATTERNS = (
    (re.compile(r"(?<!\d)20\d{8}(?!\d)"), "[학번 마스킹]"),
    (re.compile(r"\b01[016789]-?\d{3,4}-?\d{4}\b"), "[전화번호 마스킹]"),
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[이메일 마스킹]"),
)


def mask_pii(text: str) -> str:
    for pattern, replacement in PII_PATTERNS:
        text = pattern.sub(replacement, text)
    return text

INSTRUCTION = """다음은 상명대학교 공지사항입니다. 이 공지를 찾으려는 학생이 챗봇에 입력할 법한
질문을 딱 한 개만 만들어 주세요.

규칙:
- 제목을 그대로 베끼지 마세요. 학생이 실제로 쓸 법한 자연스러운 구어체 질문으로 쓰세요.
- 이 공지가 답이 되도록 충분히 구체적이어야 합니다. (다른 공지로도 답할 수 있는 막연한 질문 금지)
- 한 문장, 40자 내외로 쓰세요.
- 질문만 출력하세요. 따옴표나 설명을 붙이지 마세요."""


def normalize(text: str) -> str:
    """The crawler breaks lines mid-sentence, so collapse whitespace first."""
    return re.sub(r"\s+", " ", text).strip()


def load_notices() -> list[dict]:
    notices = []
    for root, _, files in os.walk(DATA_DIR):
        if not {"metadata.json", "body.txt"}.issubset(files):
            continue
        directory = Path(root)
        try:
            meta = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
            body = normalize((directory / "body.txt").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            continue
        # 길이 판정은 마스킹 '전' 원문으로 합니다. 마스킹은 이메일을 짧은 표식으로
        # 바꾸므로, 마스킹 후 길이로 거르면 경계에 있던 공지가 표본에서 빠지면서
        # 같은 시드인데도 표본이 달라집니다.
        if len(body) < MIN_BODY_CHARS or not meta.get("url") or not meta.get("title"):
            continue
        notices.append(
            {
                "title": meta["title"],
                "url": meta["url"],
                "date": meta.get("date", ""),
                "scope": meta.get("source_scope", ""),
                "source_name": meta.get("source_name", ""),
                "body": mask_pii(body[:1500]),
            }
        )
    return notices


def sample_stratified(notices: list[dict], size: int, seed: int = 20260818) -> list[dict]:
    """Half from 통합공지, half from 학과별 공지, biased toward recent notices."""
    random.seed(seed)
    integrated = sorted(
        [n for n in notices if n["scope"] == "integrated"], key=lambda n: n["date"], reverse=True
    )
    departmental = sorted(
        [n for n in notices if n["scope"] != "integrated"], key=lambda n: n["date"], reverse=True
    )
    # Draw from the most recent 40% so the set reflects what students actually ask about.
    def draw(pool: list[dict], count: int) -> list[dict]:
        window = pool[: max(count, int(len(pool) * 0.4))]
        return random.sample(window, min(count, len(window)))

    half = size // 2
    return draw(integrated, half) + draw(departmental, size - half)


def make_question(client: OpenAI, notice: dict) -> dict | None:
    content = f"[제목] {notice['title']}\n[작성일] {notice['date']}\n[본문] {notice['body']}"
    try:
        response = client.chat.completions.create(
            model=QUESTION_MODEL,
            temperature=0.7,
            messages=[
                {"role": "system", "content": INSTRUCTION},
                {"role": "user", "content": content},
            ],
        )
    except Exception as error:
        print(f"  건너뜀 ({type(error).__name__}): {notice['title'][:40]}", file=sys.stderr)
        return None

    question = (response.choices[0].message.content or "").strip().strip('"')
    if not question or len(question) < 6:
        return None
    return {
        "question": question,
        "answer_url": notice["url"],
        "answer_title": notice["title"],
        "answer_date": notice["date"],
        "scope": notice["scope"],
        "source_name": notice["source_name"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--size", type=int, default=60)
    parser.add_argument(
        "--dump",
        action="store_true",
        help="LLM을 쓰지 않고 표본 공지만 candidates.json으로 내보냅니다 (질문은 사람이 작성).",
    )
    args = parser.parse_args()

    if args.dump:
        notices = load_notices()
        print(f"본문 {MIN_BODY_CHARS}자 이상 공지 {len(notices)}개 발견")
        sampled = sample_stratified(notices, args.size)
        for item in sampled:
            item["body"] = item["body"][:600]
        path = OUTPUT_PATH.with_name("candidates.json")
        path.write_text(json.dumps(sampled, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"표본 {len(sampled)}개를 {path.name}에 저장했습니다.")
        return

    load_dotenv(BASE_DIR / ".env")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("backend/.env에 OPENAI_API_KEY가 필요합니다.")

    notices = load_notices()
    print(f"본문 {MIN_BODY_CHARS}자 이상 공지 {len(notices)}개 발견")
    sampled = sample_stratified(notices, args.size)
    print(f"{len(sampled)}개 표본으로 질문 생성 중...")

    client = OpenAI(api_key=api_key)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda n: make_question(client, n), sampled))

    goldenset = [item for item in results if item]
    OUTPUT_PATH.write_text(
        json.dumps(goldenset, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"골든셋 {len(goldenset)}개를 {OUTPUT_PATH.name}에 저장했습니다.")
    for item in goldenset[:3]:
        print(f"  Q: {item['question']}\n     → {item['answer_title'][:50]}")


if __name__ == "__main__":
    main()
