"""End-to-end check that a follow-up question gets resolved against earlier turns.

Asks a specific question, then a follow-up that only makes sense in context
("그거 언제까지야?"). Without rewriting, the second retrieval has nothing to go on
and comes back with unrelated notices.

Usage (backend must be running):
    .\.venv\Scripts\python.exe eval\smoke_multiturn.py
"""

import json
import sys
import urllib.request

BASE = "http://127.0.0.1:8000/api"


def ask(prompt: str, conversation_id: str | None = None) -> dict:
    payload = {"prompt": prompt, "tag": []}
    if conversation_id:
        payload["conversation_id"] = conversation_id
    request = urllib.request.Request(
        f"{BASE}/chat",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def show(label: str, prompt: str, result: dict) -> None:
    print(f"\n{'=' * 70}\n{label}: {prompt}\n{'=' * 70}")
    print(result["answer"][:400])
    print("\n인용 공지:")
    for citation in result["citations"][:4]:
        print(f"  - ({citation['date']}) {citation['title'][:60]}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")

    first_prompt = "융합경영학과 졸업논문 신청 안내해줘"
    first = ask(first_prompt)
    show("1번째 질문", first_prompt, first)

    follow_up = "그거 언제까지 내야 해?"
    second = ask(follow_up, first["conversationId"])
    show("후속 질문(대명사만 있음)", follow_up, second)

    print(f"\n{'=' * 70}")
    print("후속 질문의 인용이 졸업논문 관련이면 재작성이 동작한 것입니다.")
    related = sum("졸업" in c["title"] or "논문" in c["title"] for c in second["citations"])
    print(f"인용 {len(second['citations'])}건 중 졸업/논문 관련 {related}건")


if __name__ == "__main__":
    main()
