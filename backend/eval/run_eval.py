"""Measures retrieval quality against the hand-labelled golden set.

The metric that matters is hit@results: whether the notice that actually
answers the question is among the chunks handed to the LLM. Recall@10/@20 show
the ceiling -- if the answer is not in the candidate pool at all, no amount of
prompt work will fix the answer.

Usage (from backend/):
    .\.venv\Scripts\python.exe eval\run_eval.py --config legacy
    .\.venv\Scripts\python.exe eval\run_eval.py --config improved --index faiss_index_v2
"""

import argparse
import json
import os
import sys
import time
from dataclasses import replace
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from langchain_community.vectorstores import FAISS  # noqa: E402
from langchain_huggingface import HuggingFaceEmbeddings  # noqa: E402

from retrieval import RetrievalConfig, Retriever  # noqa: E402

EVAL_DIR = Path(__file__).resolve().parent

CONFIGS = {
    # Exactly what main.py did before this work: 12 candidates, 0.80/0.15/0.05.
    "legacy": RetrievalConfig(),
    "wider": RetrievalConfig(candidates=60),
    "semester": RetrievalConfig(candidates=60, recency_mode="semester"),
    "bm25": RetrievalConfig(candidates=60, recency_mode="semester", use_bm25=True),
    "improved": RetrievalConfig(
        candidates=60,
        results=6,
        recency_weight=0.12,
        keyword_weight=0.08,
        recency_mode="semester",
        use_bm25=True,
        use_metadata_filter=True,
    ),
    # improved에서 BM25만 뺀 설정. 하이브리드의 순수 기여분을 분리해 봅니다.
    "improved_nobm25": RetrievalConfig(
        candidates=60,
        results=6,
        recency_weight=0.12,
        keyword_weight=0.08,
        recency_mode="semester",
        use_bm25=False,
        use_metadata_filter=True,
    ),
    # BM25 없이 리랭커만: 하이브리드가 상위권을 망치는지 분리해서 보기 위한 설정.
    "reranked_dense": RetrievalConfig(
        candidates=60,
        results=6,
        recency_weight=0.12,
        keyword_weight=0.08,
        recency_mode="semester",
        use_bm25=False,
        use_metadata_filter=True,
        use_reranker=True,
    ),
    "reranked": RetrievalConfig(
        candidates=60,
        results=6,
        recency_weight=0.12,
        keyword_weight=0.08,
        recency_mode="semester",
        use_bm25=True,
        use_metadata_filter=True,
        use_reranker=True,
    ),
}


def dedupe_urls(documents) -> list[str]:
    seen, urls = set(), []
    for document in documents:
        url = document.metadata.get("url")
        if url and url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config",
        default="legacy",
        help="쉼표로 여러 개 지정하면 모델을 한 번만 올리고 순서대로 비교합니다.",
    )
    parser.add_argument("--index", default="faiss_index")
    parser.add_argument("--depth", type=int, default=20, help="Recall 계산용 최대 깊이")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    names = [name.strip() for name in args.config.split(",") if name.strip()]
    unknown = [name for name in names if name not in CONFIGS]
    if unknown:
        raise SystemExit(f"알 수 없는 설정: {unknown} (가능: {sorted(CONFIGS)})")

    goldenset = json.loads((EVAL_DIR / "goldenset.json").read_text(encoding="utf-8"))
    index_path = BACKEND_DIR / args.index
    if not index_path.exists():
        raise SystemExit(f"인덱스를 찾을 수 없습니다: {index_path}")

    print(f"인덱스: {args.index} / 설정: {', '.join(names)} / 질문 {len(goldenset)}개")
    embeddings = HuggingFaceEmbeddings(model_name=os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3"))
    vectorstore = FAISS.load_local(
        str(index_path), embeddings, allow_dangerous_deserialization=True
    )

    summary = []
    for name in names:
        config = CONFIGS[name]
        served_results = config.results
        # Retrieve deeper than we serve so Recall@10/@20 can be measured too.
        retriever = Retriever(vectorstore, replace(config, results=args.depth))

        hits_served = 0
        recall_at = {1: 0, 4: 0, 10: 0, args.depth: 0}
        reciprocal_ranks = []
        misses = []
        started = time.time()

        for item in goldenset:
            departments = [item["source_name"]] if item["scope"] != "integrated" else []
            documents = retriever.search(item["question"], departments=departments)
            urls = dedupe_urls(documents)
            target = item["answer_url"]

            rank = urls.index(target) + 1 if target in urls else None
            reciprocal_ranks.append(1.0 / rank if rank else 0.0)
            for k in recall_at:
                if rank and rank <= k:
                    recall_at[k] += 1
            # What the LLM would actually see: citations from the top `served_results` chunks.
            if target in dedupe_urls(documents[:served_results]):
                hits_served += 1
            elif args.verbose:
                misses.append((item["question"], item["answer_title"], rank))

        total = len(goldenset)
        elapsed = time.time() - started
        mrr = sum(reciprocal_ranks) / total
        print(f"\n=== {name} ({elapsed:.1f}초, 질문당 {elapsed / total:.2f}초) ===")
        print(f"hit@served({served_results}청크)  {hits_served / total:6.1%}  ({hits_served}/{total})")
        for k in sorted(recall_at):
            print(f"Recall@{k:<3}                {recall_at[k] / total:6.1%}  ({recall_at[k]}/{total})")
        print(f"MRR@{args.depth:<4}                {mrr:6.3f}")

        summary.append(
            {
                "config": name,
                "hit": hits_served / total,
                "recall10": recall_at[10] / total,
                "recall_depth": recall_at[args.depth] / total,
                "mrr": mrr,
                "sec": elapsed / total,
            }
        )

        if args.verbose and misses:
            print(f"  --- 상위 {served_results}개에 못 든 질문 {len(misses)}개 ---")
            for question, title, rank in misses:
                position = f"{rank}위" if rank else "미검색"
                print(f"    [{position}] {question}\n             정답: {title[:60]}")

    if len(summary) > 1:
        print(f"\n=== 요약 (인덱스 {args.index}) ===")
        print(f"{'설정':<12} {'hit@served':>11} {'Recall@10':>10} {'MRR':>7} {'초/질문':>8}")
        for row in summary:
            print(
                f"{row['config']:<12} {row['hit']:>10.1%} {row['recall10']:>10.1%} "
                f"{row['mrr']:>7.3f} {row['sec']:>8.2f}"
            )


if __name__ == "__main__":
    main()
