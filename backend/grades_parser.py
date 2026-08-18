"""Best-effort parser for text pasted from the 통합정보시스템 전체성적조회 page.

The student copies the "전체성적내역" and "학기별성적" blocks from the page and pastes
them as plain text. Browsers don't preserve the original grid layout on copy, so this
works off loose label/number matching rather than fixed column positions. It has not
been calibrated against a real paste yet -- if a field comes back empty or a semester
row is missing, that's the first place to look.

Deliberately out of scope: per-subject detail. The 학기별 성적 상세 grid only ever shows
one (currently selected) semester at a time, so a single paste can't unambiguously say
which semester a copied subject list belongs to.
"""

import re
from typing import Optional

SEMESTER_ROW_RE = re.compile(
    r"(?P<year>(?:19|20)\d{2})\D{0,10}?(?P<term>[가-힣0-9]{1,6}학기)\s+"
    r"(?P<aply>\d+(?:\.\d+)?)\s+"
    r"(?P<get>\d+(?:\.\d+)?)\s+"
    r"(?P<gp>\d+(?:\.\d+)?)\s+"
    r"(?P<gpavg>\d+(?:\.\d+)?)\s+"
    r"(?P<pct>\d+(?:\.\d+)?)"
)


def _find_number(text: str, label_pattern: str) -> Optional[str]:
    match = re.search(rf"{label_pattern}\s*[:\-]?\s*([\d,]+(?:\.\d+)?)", text)
    if not match:
        return None
    return match.group(1).replace(",", "")


def _parse_summary(text: str) -> dict:
    boundary = re.search(r"학년도", text)
    summary_text = text[: boundary.start()] if boundary else text
    return {
        "total_applied_credit": _find_number(summary_text, r"신청학점"),
        "total_earned_credit": _find_number(summary_text, r"취득학점"),
        "total_grade_points": _find_number(summary_text, r"평점계"),
        "total_gpa": _find_number(summary_text, r"(?<!전공)평점평균"),
        "major_gpa": _find_number(summary_text, r"전공평점평균"),
        "total_registered_credit": None,
    }


def _parse_semesters(text: str) -> list[dict]:
    header_index = text.find("학년도")
    if header_index == -1:
        return []
    detail_index = text.find("학수번호")
    region = text[header_index:detail_index] if detail_index != -1 else text[header_index:]

    semesters = []
    for match in SEMESTER_ROW_RE.finditer(region):
        semesters.append(
            {
                "sch_year": match.group("year"),
                "semester_code": match.group("term"),
                "semester_name": match.group("term"),
                "applied_credit": match.group("aply"),
                "gpa": match.group("gpavg"),
                "subjects": [],
            }
        )
    return semesters


def parse_pasted_grades(raw_text: str) -> dict:
    text = raw_text.strip()
    return {
        "summary": _parse_summary(text),
        "semesters": _parse_semesters(text),
    }
