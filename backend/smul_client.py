"""Server-side client for 통합정보시스템(smul.smu.ac.kr) 학점 조회.

Logs in through the SSO host on the student's behalf, then calls the same
list.do / dtlList.do endpoints the portal's own UI uses.

The password is only ever held in the arguments of these functions for the
duration of one request -- nothing here logs, returns, or persists it, and the
caller is responsible for keeping it out of storage.

Two values were observed from a single student's live session and may not hold
for every account: ORG_CLS_RCD (학생 유형 코드) and the response key names below.
If a different student gets an empty result, those are the first things to check.
"""

import logging
import os
import re
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import quote, urljoin

import httpx

logger = logging.getLogger(__name__)

SMUL_ORIGIN = "https://smul.smu.ac.kr"
PORTAL_ENTRY_URL = f"{SMUL_ORIGIN}/index.do"
AUTH_MENU_KEY = "ugdSAllRecSch-STD"
ORG_CLS_RCD = "CMN005.0020"
REQUEST_TIMEOUT = 20.0

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
}

AJAX_HEADERS = {
    "Accept": "*/*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": PORTAL_ENTRY_URL,
}


class SmulLoginError(Exception):
    """Login was rejected or blocked (wrong credentials, OTP required, lockout)."""


class SmulFetchError(Exception):
    """Logged in, but the grade endpoints did not return what we expected."""


class _FormCollector(HTMLParser):
    """Collects every form on a page with its action, method and input values."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.forms: list[dict] = []
        self._current: Optional[dict] = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "form":
            self._current = {
                "name": attributes.get("id") or attributes.get("name"),
                "action": attributes.get("action"),
                "method": (attributes.get("method") or "get").lower(),
                "fields": {},
                "has_visible_input": False,
            }
            self.forms.append(self._current)
        elif tag == "input" and self._current is not None:
            if (attributes.get("type") or "text").lower() != "hidden":
                self._current["has_visible_input"] = True
            name = attributes.get("name")
            if name:
                self._current["fields"][name] = attributes.get("value") or ""

    def handle_endtag(self, tag):
        if tag == "form":
            self._current = None


def _collect_forms(html: str) -> list[dict]:
    collector = _FormCollector()
    collector.feed(html)
    return collector.forms


def _find_form(forms: list[dict], name: str) -> Optional[dict]:
    return next((form for form in forms if form["name"] == name), None)


def _encode_form(pairs: list[tuple[str, str]]) -> str:
    return "&".join(f"{quote(key, safe='')}={quote(value, safe='')}" for key, value in pairs)


async def _follow_auto_submit_forms(
    client: httpx.AsyncClient, response: httpx.Response, max_hops: int = 5
) -> httpx.Response:
    """Submits the JS-driven relay forms the SSO uses to hand a token to smul.

    httpx follows HTTP redirects, but the SSO hands off with pages whose only
    content is a hidden form plus a `submit()` call, so those hops have to be
    walked by hand or the portal never sees a logged-in user.
    """
    for hop in range(max_hops):
        if ".submit()" not in response.text:
            return response
        # Only all-hidden forms are relay forms. Anything with a visible field is a
        # real page the user would have filled in, and must not be auto-submitted.
        form = next(
            (
                item
                for item in _collect_forms(response.text)
                if item["action"] and not item["has_visible_input"] and item["fields"]
            ),
            None,
        )
        if form is None:
            return response

        target = urljoin(str(response.url), form["action"])
        logger.info(
            "SSO relay hop %d: %s form=%s fields=%s",
            hop + 1,
            target,
            form["name"],
            sorted(form["fields"]),
        )
        method = "POST" if form["method"] == "post" else "GET"
        response = await client.request(
            method,
            target,
            data=form["fields"] if method == "POST" else None,
            params=form["fields"] if method == "GET" else None,
            headers={"Referer": str(response.url)},
        )
    return response


# 로그인 실패 페이지가 자바스크립트 alert/변수로 사유를 담아 내려주는 형태들.
_FAILURE_MESSAGE_PATTERNS = (
    re.compile(r"alert\(\s*[\"']([^\"']{4,200})[\"']\s*\)"),
    re.compile(r"(?:errMsg|errorMsg|resultMsg|msg)\s*=\s*[\"']([^\"']{4,200})[\"']"),
)
# 실제로 OTP 단계에 들어갔을 때만 나타나는 신호. `input_motp_rdo` 문자열 자체는
# 로그인 전 페이지의 스크립트에도 늘 들어 있어서 판별 근거가 되지 못한다.
_OTP_CHALLENGE_PATTERNS = (
    re.compile(r"인증번호를\s*입력"),
    re.compile(r"2\s*차\s*인증"),
    re.compile(r"OTP\s*인증"),
)


SCRIPT_BLOCK_RE = re.compile(r"<script\b.*?</script>", re.IGNORECASE | re.DOTALL)


def _decode_js_escapes(text: str) -> str:
    """\\uXXXX 로 인코딩된 한글 메시지를 사람이 읽을 수 있게 되돌린다."""
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), text)


def _visible_markup(html: str) -> str:
    """<script> 블록을 걷어낸 마크업.

    이 페이지는 OTP 관련 문구와 요소 id를 전부 스크립트 안에 유니코드 이스케이프로
    담고 있다("인증번호를 입력"조차 \\uXXXX 형태로 들어 있다). 그래서 원문을 그대로
    검색하면 로그인 전 페이지도 OTP 화면으로 오인된다. 실제로 OTP 단계에 들어갔다면
    스크립트가 아니라 화면 마크업에 문구가 나타난다.
    """
    return SCRIPT_BLOCK_RE.sub(" ", html)


def _describe_login_failure(html: str) -> str:
    """로그인 실패 페이지에서 실제 사유를 뽑아낸다.

    예전에는 `input_motp_rdo` 문자열이 보이면 무조건 "OTP 계정"이라고 단정했는데,
    그 문자열은 로그인 전 SSO 페이지의 스크립트에도 항상 들어 있다. 그래서 비밀번호
    오류든 폼 구조 변경이든 모든 실패가 OTP로 잘못 보고되어 원인 파악을 막았다.
    """
    visible = _decode_js_escapes(_visible_markup(html))

    for pattern in _OTP_CHALLENGE_PATTERNS:
        if pattern.search(visible):
            return (
                "추가 인증(OTP)이 필요한 계정으로 보입니다. "
                "통합정보시스템에서 직접 확인해 주세요."
            )

    # 오류 메시지는 스크립트의 alert()로 오는 경우가 많으므로 원문에서 찾는다.
    for pattern in _FAILURE_MESSAGE_PATTERNS:
        match = pattern.search(_decode_js_escapes(html))
        if match:
            message = match.group(1).strip()
            logger.warning("SSO 로그인 실패 메시지: %s", message)
            return f"학교 시스템이 로그인을 거부했습니다: {message}"

    logger.warning(
        "SSO 로그인 실패 사유를 찾지 못했습니다. 응답 길이=%d, 폼=%s",
        len(html),
        [form["name"] for form in _collect_forms(html)],
    )
    return "학번 또는 비밀번호가 올바르지 않습니다."


async def login(client: httpx.AsyncClient, student_id: str, password: str) -> None:
    """Completes SSO login so that `client`'s cookie jar holds a portal session."""
    entry = await client.get(PORTAL_ENTRY_URL)
    login_form = _find_form(_collect_forms(entry.text), "loginFrm")

    if not login_form or not login_form["action"]:
        raise SmulLoginError("학교 로그인 페이지 구조가 바뀌었습니다. 관리자에게 문의해 주세요.")

    payload = dict(login_form["fields"])
    payload["user_id"] = student_id
    payload["user_password"] = password
    payload["user_timezone_offset"] = "-540"  # KST, matching what the browser sends

    response = await client.post(
        urljoin(str(entry.url), login_form["action"]),
        data=payload,
        headers={"Referer": str(entry.url)},
    )

    # A rejected login re-renders the SSO form, so the password field is the signal.
    if 'name="user_password"' in response.text:
        raise SmulLoginError(_describe_login_failure(response.text))

    response = await _follow_auto_submit_forms(client, response)

    # The relay above is what actually creates the smul session. Confirm it landed
    # before calling the grade endpoints, which otherwise fail with a vague
    # "사용자 세션이 존재 하지 않습니다".
    settled = await client.get(PORTAL_ENTRY_URL)
    if 'name="user_password"' in settled.text:
        logger.warning(
            "SSO 로그인 후에도 포털 세션이 없습니다. 최종 URL=%s, 폼=%s",
            settled.url,
            [form["name"] for form in _collect_forms(settled.text)],
        )
        raise SmulLoginError("학교 시스템 로그인은 됐지만 포털 세션이 만들어지지 않았습니다.")


async def _post_do(client: httpx.AsyncClient, path: str, pairs: list[tuple[str, str]]) -> dict:
    response = await client.post(
        f"{SMUL_ORIGIN}{path}",
        content=_encode_form(pairs),
        headers=AJAX_HEADERS,
    )
    if response.status_code != 200:
        raise SmulFetchError(f"통합정보시스템 응답 오류 (HTTP {response.status_code})")
    try:
        payload = response.json()
    except ValueError:
        raise SmulFetchError("성적 조회 응답을 해석하지 못했습니다. 세션이 만료되었을 수 있습니다.") from None

    # The portal reports application-level failures (권한 없음, 잘못된 파라미터 등) in a
    # 200 response body rather than an HTTP status, so this has to be checked explicitly.
    error = payload.get("ERRMSGINFO")
    if isinstance(error, dict) and error.get("ERRCODE") not in (None, "", "0"):
        logger.warning(
            "%s 거부됨 -- ERRCODE=%s STATUSCODE=%s ERRMSG=%s",
            path,
            error.get("ERRCODE"),
            error.get("STATUSCODE"),
            error.get("ERRMSG"),
        )
        raise SmulFetchError(f"통합정보시스템이 요청을 거부했습니다: {error.get('ERRMSG') or '사유 미상'}")
    return payload


async def _fetch_semester_list(client: httpx.AsyncClient, student_id: str, student_name: str) -> dict:
    return await _post_do(
        client,
        "/UgdAllRecSch/list.do",
        [
            ("_AUTH_MENU_KEY", AUTH_MENU_KEY),
            ("@d1#strStdNo", student_id),
            ("@d1#strStdNm", student_name),
            ("@d1#strOrgClsRcd", ORG_CLS_RCD),
            ("@d#", "@d1#"),
            ("@d1#", "dmParam"),
            ("@d1#tp", "dm"),
        ],
    )


async def _fetch_semester_detail(
    client: httpx.AsyncClient, student_id: str, sch_year: str, smt_rcd: str, ses_rcd: str
) -> dict:
    return await _post_do(
        client,
        "/UgdAllRecSch/dtlList.do",
        [
            ("_AUTH_MENU_KEY", AUTH_MENU_KEY),
            ("@d1#strSchYear", sch_year),
            ("@d1#strSmtRcd", smt_rcd),
            ("@d1#strSesRcd", ses_rcd),
            ("@d1#strStdNo", student_id),
            ("@d#", "@d1#"),
            ("@d1#", "dmDtlParam"),
            ("@d1#tp", "dm"),
        ],
    )


def describe_shape(payload, depth: int = 0) -> str:
    """Key names only -- never values, which carry the student's personal data.

    Used to calibrate the field mapping below against a real response without
    putting anyone's grades in a log file.
    """
    indent = "  " * depth
    if isinstance(payload, dict):
        if depth >= 2:
            return f"{{{', '.join(list(payload)[:20])}}}"
        lines = []
        for key, value in list(payload.items())[:30]:
            lines.append(f"{indent}{key}: {describe_shape(value, depth + 1)}")
        return "\n" + "\n".join(lines)
    if isinstance(payload, list):
        if not payload:
            return "[] (비어 있음)"
        return f"[{len(payload)}개] 첫 항목 -> {describe_shape(payload[0], depth + 1)}"
    return type(payload).__name__


def _log_semester_codes(rows: list) -> None:
    """Dumps the code columns of 학기 rows so the identity fields can be mapped.

    Only values that look like classification codes (CMN...) or years are logged --
    never 성적/평점, which are the student's personal data.
    """
    if not rows:
        logger.warning("dsSmtRecList 가 비어 있습니다.")
        return
    logger.warning("dsSmtRecList 컬럼 목록: %s", sorted(rows[0]))
    for index, row in enumerate(rows):
        codes = {
            key: value
            for key, value in row.items()
            if isinstance(value, str) and (value.startswith("CMN") or key == "SCH_YEAR")
        }
        logger.warning("  행 %d: %s", index, codes)


def _log_subject_columns(rows: list) -> None:
    """Dumps one 과목 row so 이수구분/등급/취득학점 columns can be identified.

    This does print one course's own values -- there is no way to find which column
    holds "1전선" without seeing a value. Only the first row is logged.
    """
    if not rows:
        logger.warning("dsSbjGetRecList 가 비어 있습니다.")
        return
    logger.warning("dsSbjGetRecList 컬럼 목록: %s", sorted(rows[0]))
    logger.warning("dsSbjGetRecList 첫 행: %s", rows[0])


def _text(value) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_summary(raw: dict) -> dict:
    return {
        "total_applied_credit": _text(raw.get("strTotAplyCdt")),
        "total_gpa": _text(raw.get("strTotGpAvg")),
        "major_gpa": _text(raw.get("strMjrGpAvg")),
        "total_earned_credit": _text(raw.get("strTotGetCdt")),
        "total_grade_points": _text(raw.get("strTotGp")),
        "total_registered_credit": _text(raw.get("strTotSugangCdt")),
    }


# 이수구분(교필/교선/1전심/1전선/연선/일선...)과 등급(A+/B0/F/P...)이 어느 컬럼에 오는지
# 문서화된 곳이 없어서, 컬럼 이름 대신 값의 형태로 찾는다. KIND_RCD는 이수구분이 아니라
# 별개의 분류 코드(UCS015.xxxx)였다.
KIND_VALUE_RE = re.compile(r"^\d?[가-힣]{1,3}[필선심]$")
GRADE_VALUE_RE = re.compile(r"^(?:[ABCD][+0]?|F|P|NP|S|U)$")


def _find_by_pattern(raw: dict, pattern: re.Pattern, preferred_keys: tuple[str, ...]) -> Optional[str]:
    for key in preferred_keys:
        value = _text(raw.get(key))
        if value and pattern.match(value):
            return value
    for value in raw.values():
        text = _text(value)
        if text and pattern.match(text):
            return text
    return None


def _normalize_subject(raw: dict) -> dict:
    return {
        "subject_no": _text(raw.get("SBJ_NO")) or "",
        "subject_name": _text(raw.get("SBJ_KOR_NM")) or "",
        "grade": _find_by_pattern(raw, GRADE_VALUE_RE, ("GRD_NM", "GRD_RCD", "GRADE", "SCR_GRD")),
        "kind_code": _find_by_pattern(raw, KIND_VALUE_RE, ("CPT_DIV_NM", "ISU_GBN", "KIND_NM", "CPT_NM")),
        "credit": _text(raw.get("CDT")),
        # 평점(학점 x 등급값). 등급 컬럼을 못 찾았을 때 이수 여부 판단에 쓴다.
        "grade_points": _text(raw.get("GP")),
    }


async def fetch_grades(student_id: str, student_name: str, password: str) -> dict:
    """Logs in and returns {"summary": ..., "semesters": [...]} for one student."""
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=REQUEST_TIMEOUT,
        headers=BROWSER_HEADERS,
    ) as client:
        await login(client, student_id, password)

        listing = await _fetch_semester_list(client, student_id, student_name)
        if "dmStdInfo" not in listing and "dsSmtRecList" not in listing:
            logger.warning("list.do 응답 구조 (키 이름만):%s", describe_shape(listing))
            raise SmulFetchError(
                "성적 정보를 찾지 못했습니다. 서버 콘솔에 출력된 응답 구조를 확인해 주세요."
            )

        if os.getenv("SMUL_DEBUG"):
            _log_semester_codes(listing.get("dsSmtRecList") or [])

        summary = _normalize_summary(listing.get("dmStdInfo") or {})

        semesters = []
        for row in listing.get("dsSmtRecList") or []:
            sch_year = _text(row.get("SCH_YEAR")) or ""
            ses_rcd = _text(row.get("SES_RCD")) or ""
            smt_rcd = _text(row.get("SMT_RCD"))

            subjects = []
            if smt_rcd and sch_year:
                detail = await _fetch_semester_detail(client, student_id, sch_year, smt_rcd, ses_rcd)
                rows = detail.get("dsSbjGetRecList") or []
                if os.getenv("SMUL_DEBUG") and not semesters:
                    _log_subject_columns(rows)
                subjects = [_normalize_subject(item) for item in rows]

            semesters.append(
                {
                    "sch_year": sch_year,
                    # SMT_RCD is what distinguishes 1학기/2학기/계절수업; SES_RCD is the
                    # 정규/계절 flag and is the same on every row, so keying on it would
                    # collapse a whole year into one semester.
                    "semester_code": smt_rcd or ses_rcd,
                    "semester_name": _text(row.get("SMT_NM")),
                    "applied_credit": _text(row.get("APLY_CDT")),
                    # 졸업요건은 신청학점이 아니라 취득학점으로 따진다.
                    "earned_credit": _text(row.get("GET_CDT")),
                    "gpa": _text(row.get("GP_AVG")),
                    "subjects": subjects,
                }
            )

        return {"summary": summary, "semesters": semesters}
