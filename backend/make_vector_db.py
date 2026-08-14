"""Build the local FAISS index after removing common PII from source documents."""
import json
import os
import re
from pathlib import Path

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "crawled_notices"

# Mask student IDs, Korean mobile numbers, and email addresses before embedding or persisting the index.
PII_PATTERNS = (
    (re.compile(r"(?<!\d)20\d{8}(?!\d)"), "[학번 마스킹]"),
    (re.compile(r"\b01[016789]-?\d{3,4}-?\d{4}\b"), "[전화번호 마스킹]"),
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[이메일 마스킹]"),
)


def mask_pii(text: str) -> str:
    for pattern, replacement in PII_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


docs = []
for root, _, files in os.walk(DATA_DIR):
    if not {"metadata.json", "body.txt"}.issubset(files):
        continue
    try:
        directory = Path(root)
        meta = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
        body = mask_pii((directory / "body.txt").read_text(encoding="utf-8"))
        title = meta.get("title", directory.name)
        date = meta.get("date", "날짜 미상")
        docs.append(Document(
            page_content=f"[제목]: {title}\n[작성일]: {date}\n[본문]: {body}",
            metadata={"title": title, "date": date, "url": meta.get("url"), "source": str(directory)},
        ))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as error:
        print(f"건너뜀: {root} ({error})")

if not docs:
    raise RuntimeError("색인할 공지 문서를 찾지 못했습니다.")

splits = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50).split_documents(docs)
embeddings = HuggingFaceEmbeddings(model_name=os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3"))
FAISS.from_documents(splits, embeddings).save_local(str(BASE_DIR / "faiss_index"))
print(f"{len(docs)}개 문서, {len(splits)}개 청크를 색인했습니다.")
