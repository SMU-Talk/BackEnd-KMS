"""챗봇 프롬프트에서 고사문제지 조회 조건을 뽑아냅니다.

"2025년 2학기 알고리즘 중간고사 문제 받아줘" → {2025, "2", "알고리즘", 중간}

LLM을 부르지 않고 정규식으로 처리합니다. 뽑아낼 값이 네 개뿐이고 표현이 정형적이라
호출 비용과 지연을 들일 이유가 없습니다. 놓치면 사용자에게 되물으면 됩니다.
"""

import re
from datetime import date
from typing import Optional

from exam_client import EXAM_DIV_FINAL, EXAM_DIV_MID

YEAR_RE = re.compile(r"(20\d{2})\s*(?:학년도|년도|년)?")
SEMESTER_RE = re.compile(r"(?:제\s*)?([12])\s*학기")
# "25-2" 같은 축약 표기.
SHORT_TERM_RE = re.compile(r"(?<!\d)(\d{2})\s*[-–]\s*([12])(?!\d)")

MID_RE = re.compile(r"중간")
FINAL_RE = re.compile(r"기말")

# 과목명 추출에서 걷어낼 말들. 남은 덩어리를 과목명으로 봅니다.
#
# 두 가지를 조심해야 합니다.
#   1. 정규식 대안은 최장이 아니라 최좌선 우선입니다. "다운|다운로드" 순서면
#      "다운로드"에서 "로드"가 과목명에 남습니다. 긴 표현을 앞에 둡니다.
#   2. 한 글자 단어를 무조건 지우면 과목명이 훼손됩니다. "운영체제"의 "제",
#      "의료정보학"의 "의"가 그렇습니다. 앞뒤에 한글이 붙어 있지 않을 때만 지웁니다.
NOISE_RE = re.compile(
    r"20\d{2}\s*(?:학년도|년도|년)?|(?:제\s*)?[12]\s*학기|\d{2}\s*[-–]\s*[12]|"
    r"중간고사|기말고사|중간|기말|고사|시험|문제지|문제|기출|"
    r"가져와줘|가져와|받아줘|보여줘|다운로드|다운|알려줘|해줘|"
    r"(?<![가-힣])(?:나의|저의|내|제|줘|좀)(?![가-힣])|"
    # 조사 "의"는 낱말 끝에서만 지웁니다("알고리즘의" → "알고리즘").
    r"의(?![가-힣])"
)


def _current_term() -> tuple[str, str]:
    """연도·학기가 생략됐을 때 쓸 현재 학기. 3~8월이 1학기입니다."""
    today = date.today()
    if today.month <= 2:
        return str(today.year - 1), "2"
    if today.month <= 8:
        return str(today.year), "1"
    return str(today.year), "2"


def parse_exam_request(prompt: str) -> dict:
    """조회 조건을 뽑아냅니다.

    반환: {sch_year, semester, subject_name, exam_div, missing}
    missing에는 추측으로 채운 항목이 담기므로, 호출부가 사용자에게 확인할 수 있습니다.
    """
    text = prompt.strip()
    missing = []

    year = None
    semester = None

    short = SHORT_TERM_RE.search(text)
    if short:
        year = str(2000 + int(short.group(1)))
        semester = short.group(2)

    if year is None:
        match = YEAR_RE.search(text)
        if match:
            year = match.group(1)
    if semester is None:
        match = SEMESTER_RE.search(text)
        if match:
            semester = match.group(1)

    default_year, default_semester = _current_term()
    if year is None:
        year = default_year
        missing.append("학년도")
    if semester is None:
        semester = default_semester
        missing.append("학기")

    exam_div = None
    if MID_RE.search(text):
        exam_div = EXAM_DIV_MID
    elif FINAL_RE.search(text):
        exam_div = EXAM_DIV_FINAL

    subject = NOISE_RE.sub(" ", text)
    subject = re.sub(r"[^\w가-힣\s]", " ", subject)
    subject = re.sub(r"\s+", " ", subject).strip()
    if not subject:
        missing.append("교과목명")

    return {
        "sch_year": year,
        "semester": semester,
        "subject_name": subject,
        "exam_div": exam_div,
        "missing": missing,
    }
