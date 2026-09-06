"""Merges the hand-authored questions with the sampled notice metadata.

Matching is by notice URL, not by position in candidates.json. An earlier
position-keyed version silently mispaired 29 of 44 questions when the sample
shifted, and a golden set that grades answers against the wrong notice is worse
than no golden set at all -- it produces confident, meaningless numbers.

Run after `make_goldenset.py --dump` has written candidates.json.
"""

import json
import sys
from pathlib import Path

from authored_questions import QUESTIONS

EVAL_DIR = Path(__file__).resolve().parent


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    candidates = json.loads((EVAL_DIR / "candidates.json").read_text(encoding="utf-8"))
    by_url = {notice["url"]: notice for notice in candidates}

    goldenset, missing = [], []
    for url, question in QUESTIONS.items():
        notice = by_url.get(url)
        if notice is None:
            missing.append(question)
            continue
        goldenset.append(
            {
                "question": question,
                "answer_url": url,
                "answer_title": notice["title"],
                "answer_date": notice["date"],
                "scope": notice["scope"],
                "source_name": notice["source_name"],
            }
        )

    if missing:
        print(f"경고: 현재 표본에 없는 공지의 질문 {len(missing)}개를 건너뜁니다.", file=sys.stderr)
        for question in missing[:5]:
            print(f"  - {question}", file=sys.stderr)
        print("  표본을 다시 뽑았다면 그 질문들은 채점에서 빠집니다.", file=sys.stderr)

    output = EVAL_DIR / "goldenset.json"
    output.write_text(json.dumps(goldenset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"골든셋 {len(goldenset)}개를 {output.name}에 저장했습니다.")

    departmental = sum(1 for item in goldenset if item["scope"] != "integrated")
    print(f"  통합공지 {len(goldenset) - departmental}개 / 학과별 공지 {departmental}개")
    print(f"  정답 공지 고유 URL {len({item['answer_url'] for item in goldenset})}개")


if __name__ == "__main__":
    main()
