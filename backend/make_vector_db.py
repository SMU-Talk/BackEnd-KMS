"""Build the local FAISS index after removing common PII from source documents.

Two things here matter more than they look:

1. The title and date are prepended to *every* chunk, not just the first one.
   Building one big "[제목] ... [본문] ..." string and then splitting it left
   chunks 2..n with no idea which notice they belonged to, so the paragraph that
   actually holds the deadline was embedded without its own title.

2. Whitespace is normalised before splitting. The crawler breaks body.txt at
   mid-sentence points ("독서퀴즈대회\n'\n를 시행합니다\n."), which made the
   splitter cut on those bogus newlines and produced fragmented chunks.

Usage:
    .\.venv\Scripts\python.exe make_vector_db.py [--out faiss_index_v2]
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "crawled_notices"

CHUNK_SIZE = 700
CHUNK_OVERLAP = 100

# Mask student IDs, Korean mobile numbers, and email addresses before embedding or persisting the index.
PII_PATTERNS = (
    (re.compile(r"(?<!\d)20\d{8}(?!\d)"), "[학번 마스킹]"),
    (re.compile(r"\b01[016789]-?\d{3,4}-?\d{4}\b"), "[전화번호 마스킹]"),
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[이메일 마스킹]"),
)

# The crawler emits a newline per layout box, so a single sentence arrives split
# across several lines. Collapse those, but keep real paragraph breaks.
PARAGRAPH_BREAK = re.compile(r"\n\s*\n+")
SOFT_BREAK = re.compile(r"[ \t]*\n[ \t]*")


def mask_pii(text: str) -> str:
    for pattern, replacement in PII_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def normalize_body(text: str) -> str:
    paragraphs = PARAGRAPH_BREAK.split(text)
    cleaned = []
    for paragraph in paragraphs:
        joined = SOFT_BREAK.sub(" ", paragraph).strip()
        joined = re.sub(r"[ \t]{2,}", " ", joined)
        if joined:
            cleaned.append(joined)
    return "\n\n".join(cleaned)


def load_documents() -> list[Document]:
    documents = []
    for root, _, files in os.walk(DATA_DIR):
        if not {"metadata.json", "body.txt"}.issubset(files):
            continue
        directory = Path(root)
        try:
            meta = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
            raw_body = (directory / "body.txt").read_text(encoding="utf-8")
        except (OSError, json.JSONDecodeError, UnicodeDecodeError) as error:
            print(f"건너뜀: {root} ({error})")
            continue

        body = mask_pii(normalize_body(raw_body))
        if not body.strip():
            continue

        title = meta.get("title", directory.name)
        published = meta.get("date", "날짜 미상")
        detail = meta.get("detail_metadata") or {}
        documents.append(
            Document(
                page_content=body,
                metadata={
                    "title": title,
                    "date": published,
                    "url": meta.get("url"),
                    "source": str(directory),
                    # Carried so retrieval can honour a department/tag filter.
                    "source_name": meta.get("source_name", ""),
                    "source_scope": meta.get("source_scope", ""),
                    "search_tag": str(detail.get("검색어", "")),
                    "writer": meta.get("writer", ""),
                },
            )
        )
    return documents


def build_chunks(documents: list[Document]) -> list[Document]:
    """Split the body, then put the title/date back on top of every chunk."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", ".", " ", ""],
    )
    chunks = []
    for document in documents:
        metadata = document.metadata
        header = f"[제목] {metadata['title']}\n[작성일] {metadata['date']}"
        if metadata.get("source_name"):
            header += f"\n[게시처] {metadata['source_name']}"
        if metadata.get("search_tag"):
            header += f"\n[분류] {metadata['search_tag']}"

        pieces = splitter.split_text(document.page_content)
        for index, piece in enumerate(pieces):
            chunks.append(
                Document(
                    page_content=f"{header}\n[본문] {piece}",
                    metadata={**metadata, "chunk_index": index, "chunk_total": len(pieces)},
                )
            )
    return chunks


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="faiss_index_v2")
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    # Torch defaults to a conservative thread count here and only saturated ~4 of
    # 16 cores, which put a full rebuild at 5+ hours. Pin it to the real core count.
    threads = os.cpu_count() or 4
    os.environ.setdefault("OMP_NUM_THREADS", str(threads))
    os.environ.setdefault("MKL_NUM_THREADS", str(threads))
    import torch

    torch.set_num_threads(threads)
    print(f"torch 스레드 {torch.get_num_threads()}개 사용", flush=True)

    documents = load_documents()
    if not documents:
        raise RuntimeError("색인할 공지 문서를 찾지 못했습니다.")
    print(f"문서 {len(documents)}개 로드 완료", flush=True)

    chunks = build_chunks(documents)
    print(f"청크 {len(chunks)}개 생성 (chunk_size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP})", flush=True)

    embeddings = HuggingFaceEmbeddings(
        model_name=os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3"),
        encode_kwargs={"batch_size": args.batch_size, "normalize_embeddings": True},
    )

    started = time.time()
    store = None
    # Batched so progress is visible and a failure does not lose the whole run.
    step = 128
    for offset in range(0, len(chunks), step):
        batch = chunks[offset : offset + step]
        if store is None:
            store = FAISS.from_documents(batch, embeddings)
        else:
            store.add_documents(batch)
        done = min(offset + step, len(chunks))
        elapsed = time.time() - started
        rate = done / elapsed if elapsed else 0
        remaining = (len(chunks) - done) / rate if rate else 0
        print(
            f"  {done}/{len(chunks)} 청크 ({done / len(chunks):.1%}) "
            f"· {rate:.0f}청크/초 · 남은 예상 {remaining / 60:.1f}분",
            flush=True,
        )

    output_path = BASE_DIR / args.out
    store.save_local(str(output_path))
    print(f"완료: {len(documents)}개 문서, {len(chunks)}개 청크를 {args.out}에 색인했습니다.")
    print(f"소요 시간 {(time.time() - started) / 60:.1f}분")


if __name__ == "__main__":
    main()
