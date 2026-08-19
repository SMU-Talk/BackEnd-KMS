"""Notice retrieval pipeline, shared by the API and the offline evaluator.

Kept separate from main.py so eval/run_eval.py measures the code that actually
serves requests, instead of a copy that drifts away from it.

The pipeline is: candidate generation (dense, optionally fused with BM25) ->
optional cross-encoder rerank -> metadata-aware scoring -> top N chunks.
Every stage is switchable through RetrievalConfig so a change can be A/B'd
against the golden set before it ships.
"""

from __future__ import annotations

import logging
import math
import os
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Iterable, Optional, Sequence

logger = logging.getLogger(__name__)

# Korean/alphanumeric runs of 2+ chars. Good enough for title matching and BM25
# without dragging in a morphological analyzer (konlpy needs a JVM).
TOKEN_PATTERN = re.compile(r"[가-힣A-Za-z0-9]{2,}")

# "2025학년도 2학기", "25-1", "2026-1학기" -- the phrases that decide whether an
# old notice is still the answer.
YEAR_PATTERN = re.compile(r"(20\d{2}|(?<!\d)\d{2}(?=\s*[-–]\s*[12]))\s*학?년?도?")
SEMESTER_PATTERN = re.compile(r"(?:제\s*)?([12])\s*학기|(?<=[-–])\s*([12])(?!\d)")


@dataclass
class RetrievalConfig:
    """Legacy defaults reproduce the original main.py behaviour exactly."""

    candidates: int = 12
    results: int = 4
    recency_weight: float = 0.15
    keyword_weight: float = 0.05
    recency_mode: str = "exp"  # "exp" (legacy) | "semester"
    use_bm25: bool = False
    bm25_candidates: int = 30
    rrf_k: int = 60
    use_reranker: bool = False
    rerank_pool: int = 50
    use_metadata_filter: bool = False
    metadata_boost: float = 0.10

    @classmethod
    def from_env(cls) -> "RetrievalConfig":
        """Defaults are the settings that measured no worse than the old pipeline.

        BM25 is off by default on purpose: fusing it in dropped hit@served from
        75.0% to 61.4% on the golden set at the same served-chunk count, because
        keyword hits displaced correct dense hits at the top. It stays available
        behind the flag so the fix to the tokenizer can be re-measured before it
        is switched on. Same for the reranker, which is accurate but costs
        seconds per query on CPU. See backend/eval/README.md.
        """

        def flag(name: str, default: str) -> bool:
            return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}

        return cls(
            candidates=int(os.getenv("RETRIEVAL_CANDIDATES", "60")),
            results=int(os.getenv("RETRIEVAL_RESULTS", "6")),
            recency_weight=float(os.getenv("RETRIEVAL_RECENCY_WEIGHT", "0.12")),
            keyword_weight=float(os.getenv("RETRIEVAL_KEYWORD_WEIGHT", "0.08")),
            recency_mode=os.getenv("RETRIEVAL_RECENCY_MODE", "semester"),
            use_bm25=flag("RETRIEVAL_USE_BM25", "false"),
            use_reranker=flag("RETRIEVAL_USE_RERANKER", "false"),
            use_metadata_filter=flag("RETRIEVAL_USE_METADATA_FILTER", "true"),
        )


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())


# Korean glues numbers to the noun that follows ("2026학년도", "1학기"), so a
# whole-token index can't match a query saying "2026" against a title saying
# "2026학년도" -- exactly the numeric matching BM25 was added for. Keep the whole
# token and add its digit/hangul parts alongside it.
SUBTOKEN_PATTERN = re.compile(r"\d+|[가-힣]+|[a-z]+")


def tokenize_expanded(text: str) -> list[str]:
    tokens = []
    for token in TOKEN_PATTERN.findall(text.lower()):
        tokens.append(token)
        parts = SUBTOKEN_PATTERN.findall(token)
        if len(parts) > 1:
            tokens.extend(part for part in parts if len(part) >= 2)
    return tokens


def parse_notice_date(value: object) -> Optional[date]:
    if not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def academic_term(value: object) -> Optional[tuple[int, int]]:
    """(year, semester) a notice belongs to, inferred from its publication date.

    March-August is semester 1, September-February is semester 2 -- and a notice
    published in Jan/Feb belongs to the academic year that started the previous
    March.
    """
    published = parse_notice_date(value)
    if not published:
        return None
    if published.month <= 2:
        return (published.year - 1, 2)
    if published.month <= 8:
        return (published.year, 1)
    return (published.year, 2)


def requested_term(question: str) -> Optional[tuple[int, int]]:
    """The year/semester the student explicitly asked about, if any."""
    year_match = YEAR_PATTERN.search(question)
    semester_match = SEMESTER_PATTERN.search(question)
    if not year_match:
        return None
    raw_year = year_match.group(1)
    year = int(raw_year) if len(raw_year) == 4 else 2000 + int(raw_year)
    if not 2000 <= year <= 2100:
        return None
    if not semester_match:
        return (year, 0)  # year only -- semester unconstrained
    semester = int(semester_match.group(1) or semester_match.group(2))
    return (year, semester)


def recency_score(value: object, mode: str, today: Optional[date] = None) -> float:
    """0..1 freshness. 'semester' decays per academic term, not per year.

    The legacy exp(-age/365) still scores a two-year-old notice at 0.14, which
    is far too generous for 학사 공지 where last semester's version is simply
    the wrong answer.
    """
    published = parse_notice_date(value)
    if not published:
        return 0.0
    today = today or date.today()
    age_in_days = max((today - published).days, 0)
    if mode == "exp":
        return math.exp(-age_in_days / 365)
    # One semester ~ 182 days; halve the score each term.
    return 0.5 ** (age_in_days / 182)


def keyword_score(question: str, document) -> float:
    terms = set(tokenize(question))
    if not terms:
        return 0.0
    title = str(document.metadata.get("title", "")).lower()
    return sum(term in title for term in terms) / len(terms)


def term_score(question: str, document) -> float:
    """Penalises notices from a different semester than the one asked about."""
    wanted = requested_term(question)
    if not wanted:
        return 0.0
    actual = academic_term(document.metadata.get("date"))
    if not actual:
        return 0.0
    if wanted[1] == 0:
        return 1.0 if actual[0] == wanted[0] else -1.0
    return 1.0 if actual == wanted else -1.0


def metadata_score(document, departments: Sequence[str], tags: Sequence[str]) -> float:
    """Rewards notices from the department/tag the student filtered on."""
    if not departments and not tags:
        return 0.0
    metadata = document.metadata
    haystack = " ".join(
        str(metadata.get(key, "")) for key in ("source_name", "title", "search_tag")
    ).lower()
    hits = 0
    total = 0
    for value in departments:
        total += 1
        if value and value.lower() in haystack:
            hits += 1
    for value in tags:
        total += 1
        if value and value.lower() in haystack:
            hits += 1
    return hits / total if total else 0.0


def reciprocal_rank_fusion(
    rankings: Iterable[Sequence[str]], k: int = 60
) -> dict[str, float]:
    """RRF over ranked id lists. Scale-free, so dense and BM25 can be combined
    without normalising their incomparable score ranges."""
    fused: dict[str, float] = {}
    for ranking in rankings:
        for rank, key in enumerate(ranking):
            fused[key] = fused.get(key, 0.0) + 1.0 / (k + rank + 1)
    return fused


class Retriever:
    """Holds the vector store plus the optional BM25 index and reranker."""

    def __init__(self, vectorstore, config: Optional[RetrievalConfig] = None):
        self.vectorstore = vectorstore
        self.config = config or RetrievalConfig()
        self._bm25 = None
        self._bm25_keys: list[str] = []
        self._bm25_docs: list = []
        self._reranker = None
        if self.config.use_bm25:
            self._build_bm25()
        if self.config.use_reranker:
            self._load_reranker()

    # ------------------------------------------------------------------ setup

    def _build_bm25(self) -> None:
        try:
            from rank_bm25 import BM25Okapi
        except ImportError:
            logger.warning("rank_bm25가 없어 BM25 하이브리드를 건너뜁니다.")
            self.config.use_bm25 = False
            return
        docs = list(self.vectorstore.docstore._dict.items())
        self._bm25_keys = [key for key, _ in docs]
        self._bm25_docs = [doc for _, doc in docs]
        corpus = [tokenize_expanded(doc.page_content) for doc in self._bm25_docs]
        self._bm25 = BM25Okapi(corpus)
        logger.info("BM25 인덱스 구축 완료: %d청크", len(corpus))

    def _load_reranker(self) -> None:
        model_name = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-base")
        try:
            from sentence_transformers import CrossEncoder

            self._reranker = CrossEncoder(model_name, max_length=512)
            logger.info("리랭커 로드 완료: %s", model_name)
        except Exception as error:
            logger.warning("리랭커를 불러오지 못해 건너뜁니다: %s", type(error).__name__)
            self.config.use_reranker = False

    # -------------------------------------------------------------- retrieval

    def _dense_candidates(self, question: str, k: int) -> list[tuple[str, object, float]]:
        pairs = self.vectorstore.similarity_search_with_relevance_scores(question, k=k)
        results = []
        for doc, score in pairs:
            key = self._doc_key(doc)
            results.append((key, doc, score))
        return results

    def _bm25_candidates(self, question: str, k: int) -> list[tuple[str, object, float]]:
        if not self._bm25:
            return []
        scores = self._bm25.get_scores(tokenize_expanded(question))
        top = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
        return [(self._bm25_keys[i], self._bm25_docs[i], float(scores[i])) for i in top]

    @staticmethod
    def _doc_key(doc) -> str:
        metadata = doc.metadata
        return f"{metadata.get('url') or metadata.get('title')}|{hash(doc.page_content) & 0xFFFFFFFF}"

    def search(
        self,
        question: str,
        departments: Sequence[str] = (),
        tags: Sequence[str] = (),
    ) -> list:
        config = self.config
        pool_size = max(config.candidates, config.rerank_pool if config.use_reranker else 0)

        dense = self._dense_candidates(question, pool_size)
        documents = {key: doc for key, doc, _ in dense}
        relevance = {key: score for key, _, score in dense}

        if config.use_bm25:
            sparse = self._bm25_candidates(question, config.bm25_candidates)
            for key, doc, _ in sparse:
                documents.setdefault(key, doc)
            fused = reciprocal_rank_fusion(
                [[key for key, _, _ in dense], [key for key, _, _ in sparse]], config.rrf_k
            )
            # RRF replaces the dense score as the base relevance signal.
            base = fused
        else:
            base = relevance

        if not documents:
            return []

        candidate_keys = sorted(base, key=lambda key: base[key], reverse=True)[:pool_size]

        if config.use_reranker and self._reranker is not None:
            # Use the reranker's own scores, not rank positions. Rank-derived
            # scores sit 1/pool apart (0.017 for a 60-candidate pool), so the
            # recency/keyword/term adjustments below -- worth up to 0.40 -- would
            # completely reorder the reranker's output instead of nudging it.
            candidate_keys, base = self._rerank(question, candidate_keys, documents)

        base_values = [base[key] for key in candidate_keys]
        span = (max(base_values) - min(base_values)) or 1.0
        low = min(base_values)
        relevance_weight = 1 - config.recency_weight - config.keyword_weight

        def total_score(key: str) -> float:
            doc = documents[key]
            # Normalising to 0..1 keeps the weights meaningful; raw dense scores
            # and RRF scores live on completely different scales.
            normalized = (base[key] - low) / span
            score = (
                relevance_weight * normalized
                + config.recency_weight * recency_score(doc.metadata.get("date"), config.recency_mode)
                + config.keyword_weight * keyword_score(question, doc)
            )
            if config.recency_mode == "semester":
                score += 0.10 * term_score(question, doc)
            if config.use_metadata_filter:
                score += config.metadata_boost * metadata_score(doc, departments, tags)
            return score

        ranked = sorted(candidate_keys, key=total_score, reverse=True)
        return [documents[key] for key in ranked[: config.results]]

    def _rerank(
        self, question: str, keys: list[str], documents: dict
    ) -> tuple[list[str], dict[str, float]]:
        """Returns the reranked keys and the cross-encoder score for each."""
        pairs = [(question, documents[key].page_content) for key in keys]
        try:
            scores = self._reranker.predict(pairs)
        except Exception as error:
            logger.warning("리랭킹 실패, 원래 순서를 유지합니다: %s", type(error).__name__)
            return keys, {key: 1.0 - index / len(keys) for index, key in enumerate(keys)}
        scored = {key: float(score) for key, score in zip(keys, scores)}
        order = sorted(keys, key=lambda key: scored[key], reverse=True)
        return order, scored


def unique_citations(documents) -> list[dict]:
    citations, seen = [], set()
    for document in documents:
        metadata = document.metadata
        key = metadata.get("url") or metadata.get("title")
        if not key or key in seen:
            continue
        citations.append(
            {
                "title": metadata.get("title", "학교 공지"),
                "url": metadata.get("url"),
                "date": metadata.get("date"),
            }
        )
        seen.add(key)
    return citations


def format_context(documents) -> str:
    """Numbered, delimited blocks so the model can tell the notices apart.

    Concatenating raw chunks lets the model blend a deadline from one notice
    into the title of another; the numbering also gives it a way to say which
    notice a claim came from.
    """
    blocks = []
    for index, document in enumerate(documents, start=1):
        metadata = document.metadata
        header = f"[문서 {index}] {metadata.get('title', '학교 공지')}"
        published = metadata.get("date")
        if published:
            header += f" (작성일 {published})"
        source = metadata.get("source_name")
        if source:
            header += f" · {source}"
        blocks.append(f"{header}\n{document.page_content}")
    return "\n\n---\n\n".join(blocks)
