"""통합정보시스템 고사문제지 조회 클라이언트.

smul_client.py의 SSO 로그인과 요청 헬퍼를 재사용합니다. eXBuilder6(Clipsoft)
기반이라 모든 요청이 같은 규약을 씁니다. 데이터셋 한 블록은 이렇게 인코딩됩니다:

    @dN#<필드> = <값>     # 필드들
    @d#  = @dN#          # 이 블록을 목록에 등록 (블록마다 한 번씩 반복)
    @dN# = <데이터셋 이름>
    @dN#tp = dm | ds     # dm=맵(단일 행), ds=데이터셋(행 목록)

조회는 세 단계입니다.

1. 목록  : 학년도·학기·과목명으로 수강 과목과 중간/기말 등록 여부를 받는다.
2. 팝업  : 그 행을 그대로 되돌려보내면 내용 텍스트(CTNT)와 첨부파일 번호를 준다.
3. 첨부  : 첨부파일 번호로 실제 경로(FILE_PATH + SAVE_FILE_NM)와 파일명을 받는다.

다운로드는 브라우저와 동일하게 checkFileExist.do → download.do 2단계이고,
파일 ID가 아니라 filePath + fileNm 쌍으로 식별합니다.

비밀번호는 호출 인자로만 존재하며 저장·로깅하지 않습니다 -- smul_client.py와 동일합니다.
"""

import logging
import re
from typing import Optional
from urllib.parse import unquote

import httpx

from smul_client import (
    AJAX_HEADERS,
    BROWSER_HEADERS,
    ORG_CLS_RCD,
    REQUEST_TIMEOUT,
    SMUL_ORIGIN,
    SmulFetchError,
    SmulLoginError,
    _encode_form,
    _post_do,
    login,
)

logger = logging.getLogger(__name__)

EXAM_AUTH_MENU_KEY = "ucsSExamStud-STUD"
SEOUL_CAMPUS = "CMN001.0001"

FILE_LIST_PATH = "/CmnFile/list.do"
FILE_CHECK_PATH = "/CmnFile/checkFileExist.do"
FILE_DOWNLOAD_PATH = "/CmnFile/download.do"

# 화면 스크립트(ucsPExamIpt.clx.js)와 실제 응답에서 확인된 값.
EXAM_DIV_MID = "UCS019.0001"  # 중간고사
EXAM_DIV_FINAL = "UCS019.0002"  # 기말고사
EXAM_DIV_NAMES = {EXAM_DIV_MID: "중간고사", EXAM_DIV_FINAL: "기말고사"}
SEMESTER_CODES = {"1": "CMN002.0010", "2": "CMN002.0020"}

# 실제 조회로 확인된 경로. 후보를 여럿 두는 구조는 남겨 두었는데, 학교가 화면을
# 개편하면 경로가 바뀌기 때문입니다. 확인된 경로를 맨 앞에 두면 평소에는 한 번에
# 맞고, 바뀌었을 때만 나머지를 시도합니다.
#
# 팝업은 /UcsPExamIpt(실패) → /UcsExamIpt(ERRCODE=CMN003, "등록된 자료만 조회 가능")
# → /UcsExamIptPopup(성공) 순으로 확인됐습니다.
EXAM_LIST_PATH_CANDIDATES = ("/UcsExamStud/list.do", "/UcsSExamStud/list.do")
EXAM_DETAIL_PATH_CANDIDATES = (
    "/UcsExamIptPopup/list.do",
    "/UcsPExamIpt/list.do",
    "/UcsExamIpt/list.do",
)
_resolved_paths: dict[str, str] = {}

SEMESTER_RE = re.compile(r"([12])")

# 팝업이 되돌려받는 행에 함께 실리는 감사 컬럼. 브라우저는 빈 값으로 보냅니다.
_AUDIT_FIELDS = (
    "CRT_USER_ID",
    "CRT_PGM_ID",
    "CRT_IP_MAC",
    "UPD_USER_ID",
    "UPD_PGM_ID",
    "UPD_IP_MAC",
)
# 서버가 원본 키를 대조하는 데 쓰는 컬럼.
_ORIGIN_FIELDS = ("SCH_YEAR", "SMT_RCD", "SES_RCD", "SBJ_NO", "DIVCLS")


def _text(value) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _encode_datasets(blocks: list[tuple[str, str, dict[str, str]]]) -> list[tuple[str, str]]:
    """[(데이터셋 이름, 타입, 값)] → 요청 본문 쌍 목록.

    값이 없는 필드도 빈 문자열로 실어야 서버가 받습니다.
    """
    pairs: list[tuple[str, str]] = [("_AUTH_MENU_KEY", EXAM_AUTH_MENU_KEY)]
    for index, (name, kind, values) in enumerate(blocks, start=1):
        prefix = f"@d{index}#"
        pairs.extend((f"{prefix}{key}", "" if value is None else str(value)) for key, value in values.items())
        pairs.append(("@d#", prefix))
        pairs.append((prefix, name))
        pairs.append((f"{prefix}tp", kind))
    return pairs


def normalize_semester(value: object) -> Optional[str]:
    """'2학기' / '2' / '제2학기' → '2'"""
    match = SEMESTER_RE.search(str(value or ""))
    return match.group(1) if match else None


def semester_code(semester: str) -> str:
    code = SEMESTER_CODES.get(semester)
    if not code:
        raise SmulFetchError(f"지원하지 않는 학기입니다: {semester}")
    return code


async def _post_first_working(
    client: httpx.AsyncClient, key: str, candidates: tuple[str, ...], pairs: list[tuple[str, str]]
) -> dict:
    """후보 경로를 차례로 시도해 처음 성공한 것을 기억합니다."""
    known = _resolved_paths.get(key)
    if known:
        return await _post_do(client, known, pairs)

    last_error: Optional[Exception] = None
    for path in candidates:
        try:
            payload = await _post_do(client, path, pairs)
        except Exception as error:
            last_error = error
            continue
        _resolved_paths[key] = path
        logger.info("%s 경로를 %s 로 확인했습니다.", key, path)
        return payload
    raise SmulFetchError(
        f"{key} 요청 경로를 찾지 못했습니다(시도: {', '.join(candidates)}). "
        f"마지막 오류: {last_error}"
    )


async def _fetch_list(
    client: httpx.AsyncClient,
    student_id: str,
    sch_year: str,
    semester: str,
    subject_name: str = "",
) -> list[dict]:
    """고사문제 목록. 화면의 조회 버튼과 같은 요청입니다."""
    values = {
        "strCampusRcd": SEOUL_CAMPUS,
        "strOrgClsRcd": ORG_CLS_RCD,
        "strUpDeptCd": "",
        "strDeptCd": "",
        "strUnderYn": "",
        "strSchYear": sch_year,
        "strSmtRcd": semester_code(semester),
        "strSesRcd": "",
        "strCmpDivGrp": "",
        "strStdNo": student_id,
        "strElseCampusRcd": "",
        "strElseCampusNm": "",
        "strSbjKorNm": subject_name,
    }
    payload = await _post_first_working(
        client,
        "고사문제 목록",
        EXAM_LIST_PATH_CANDIDATES,
        _encode_datasets([("dmParam", "dm", values)]),
    )
    rows = payload.get("dsUcsChrgSbj") or []
    if not isinstance(rows, list):
        raise SmulFetchError("고사문제 목록 응답을 해석하지 못했습니다.")
    return rows


async def _fetch_detail(client: httpx.AsyncClient, row: dict, exam_div: str) -> dict:
    """팝업(고사문제등록) 데이터.

    브라우저는 목록에서 고른 행을 dsUcsChrgSbj 데이터셋으로 그대로 되돌려보내면서
    TEST_RCD(중간/기말)만 덧붙입니다. 그래서 행을 재구성하지 않고 그대로 씁니다.
    """
    payload_row = {key: "" if value is None else value for key, value in row.items()}
    payload_row["TEST_RCD"] = exam_div
    for field in _AUDIT_FIELDS:
        payload_row.setdefault(field, "")
    for field in _ORIGIN_FIELDS:
        payload_row[f"{field}_origin"] = row.get(field, "")
    payload_row["sts"] = "i"

    return await _post_first_working(
        client,
        "고사문제 상세",
        EXAM_DETAIL_PATH_CANDIDATES,
        _encode_datasets(
            [
                ("dsUcsChrgSbj", "ds", payload_row),
                ("dmParam", "dm", {"strStaffNo": "", "strUserDivRcd": ""}),
            ]
        ),
    )


async def _fetch_attachments(client: httpx.AsyncClient, attc_file_no: str) -> list[dict]:
    """첨부파일 번호로 실제 경로와 파일명을 얻습니다.

    다운로드가 요구하는 filePath는 FILE_PATH와 SAVE_FILE_NM(UUID)을 이어 붙인 값이고,
    fileNm은 사용자에게 보이는 원래 파일명(FILE_NM)입니다.
    """
    if not attc_file_no:
        return []
    values = {
        "strAttcFileNo": attc_file_no,
        "strUserDefinePgmId": "",
        "strFileStatRcd": "",
        "strUserDefineGlobalFilePath": "",
    }
    try:
        payload = await _post_do(
            client, FILE_LIST_PATH, _encode_datasets([("dmParam", "dm", values)])
        )
    except SmulFetchError as error:
        logger.info("첨부파일 목록 조회 실패(첨부 없음으로 처리): %s", error)
        return []

    attachments = []
    for item in payload.get("dsFile") or []:
        directory = _text(item.get("FILE_PATH"))
        saved_name = _text(item.get("SAVE_FILE_NM"))
        display_name = _text(item.get("FILE_NM"))
        if not directory or not saved_name or not display_name:
            continue
        attachments.append(
            {
                "file_path": f"{directory.rstrip('/')}/{saved_name}",
                "file_name": display_name,
                "file_size": _text(item.get("FILE_SIZE")),
            }
        )
    return attachments


def extract_attachment_text(content: bytes, file_name: str) -> str:
    """첨부파일에서 검색 가능한 텍스트를 뽑습니다.

    포털이 주는 CTNT 필드는 "중간고사" 한 줄인 경우가 대부분이고 실제 문제는 첨부
    파일 안에 있습니다. 그 안을 읽지 않으면 "다익스트라 나온 적 있어?" 같은 질문에
    답할 수 없습니다. 파일 자체는 저장하지 않고 텍스트만 남깁니다.
    """
    suffix = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""

    if suffix == "pdf" or content.startswith(b"%PDF"):
        try:
            from io import BytesIO

            from pypdf import PdfReader

            reader = PdfReader(BytesIO(content))
            pages = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(text.strip() for text in pages if text.strip())
        except Exception as error:
            logger.warning("PDF 텍스트 추출 실패 (%s): %s", file_name, type(error).__name__)
            return ""

    if suffix in ("txt", "csv", "md"):
        for encoding in ("utf-8", "cp949", "euc-kr"):
            try:
                return content.decode(encoding).strip()
            except UnicodeDecodeError:
                continue
        logger.warning("텍스트 파일 디코딩 실패: %s", file_name)
        return ""

    # hwp/hwpx/docx 등은 별도 파서가 필요해 지금은 건너뜁니다.
    logger.info("텍스트 추출을 지원하지 않는 형식입니다: %s", file_name)
    return ""


def _normalize_paper(row: dict, problems: list[dict], exam_div: str, attachments: list[dict]) -> dict:
    contents = [_text(problem.get("CTNT")) for problem in problems]
    return {
        "sch_year": _text(row.get("SCH_YEAR")) or "",
        "smt_rcd": _text(row.get("SMT_RCD_ABBR")) or "",
        "subject_no": _text(row.get("SBJ_NO")) or "",
        "subject_name": _text(row.get("SBJ_NM")) or "",
        "divcls": _text(row.get("DIVCLS")) or "",
        "professor": _text(row.get("REP_STAFF_NM")),
        "cmp_div_name": _text(row.get("CMP_DIV_NM")),
        "exam_div": exam_div,
        "exam_div_name": EXAM_DIV_NAMES.get(exam_div, exam_div),
        "content_text": "\n".join(text for text in contents if text),
        "attachments": attachments,
    }


def _registered_divisions(row: dict, exam_div: Optional[str]) -> list[str]:
    """등록된 고사만 조회합니다. MID_INPUT_YN / FAL_INPUT_YN이 등록 여부입니다."""
    wanted = [exam_div] if exam_div else [EXAM_DIV_MID, EXAM_DIV_FINAL]
    available = []
    for division in wanted:
        flag = "MID_INPUT_YN" if division == EXAM_DIV_MID else "FAL_INPUT_YN"
        if str(row.get(flag, "")).upper() == "Y":
            available.append(division)
    return available


async def fetch_exam_papers(
    student_id: str,
    password: str,
    sch_year: str,
    semester: str,
    subject_name: str = "",
    exam_div: Optional[str] = None,
    extract_text: bool = True,
) -> list[dict]:
    """로그인 후 조건에 맞는 고사문제지를 모두 가져옵니다.

    첨부파일이 있으면 내용 텍스트와 파일 정보를 함께, 없으면 텍스트만 담습니다.
    extract_text가 켜져 있으면 첨부 본문까지 읽어 검색용 텍스트로 넘깁니다(파일은
    저장하지 않습니다). 조회가 느려지는 대신 실제 문제로 검색할 수 있게 됩니다.
    """
    async with httpx.AsyncClient(
        follow_redirects=True, timeout=REQUEST_TIMEOUT, headers=BROWSER_HEADERS
    ) as client:
        await login(client, student_id, password)

        rows = await _fetch_list(client, student_id, sch_year, semester, subject_name)
        papers = []
        for row in rows:
            if not _text(row.get("SBJ_NO")):
                continue
            for division in _registered_divisions(row, exam_div):
                try:
                    detail = await _fetch_detail(client, row, division)
                except SmulFetchError as error:
                    # 한 과목이 막혀도 나머지는 계속 가져옵니다.
                    logger.warning("고사문제 상세 실패 (%s/%s): %s", row.get("SBJ_NO"), division, error)
                    continue

                problems = detail.get("dsUcsExamPrbl") or []
                attachments = []
                for problem in problems:
                    attachments.extend(
                        await _fetch_attachments(client, _text(problem.get("ATTC_FILE_NO")) or "")
                    )

                # 첨부를 여기서 한 번 받아 둡니다. 포털의 CTNT는 "중간고사" 한 줄인
                # 경우가 대부분이라 본문 추출이 필요하고, 이왕 받은 바이트를 같이
                # 넘겨 두면 나중에 내려받을 때 로그인을 다시 하지 않아도 됩니다.
                if extract_text:
                    for attachment in attachments:
                        try:
                            content, _ = await _download_with_session(
                                client, attachment["file_path"], attachment["file_name"]
                            )
                        except SmulFetchError as error:
                            logger.warning(
                                "첨부 다운로드 실패 (%s): %s", attachment["file_name"], error
                            )
                            continue
                        attachment["content"] = content
                        attachment["extracted_text"] = extract_attachment_text(
                            content, attachment["file_name"]
                        )

                paper = _normalize_paper(row, problems, division, attachments)
                if paper["content_text"] or paper["attachments"]:
                    papers.append(paper)
        return papers


async def _download_with_session(
    client: httpx.AsyncClient, file_path: str, file_name: str
) -> tuple[bytes, str]:
    """이미 로그인된 세션으로 첨부파일을 받습니다.

    브라우저와 같은 2단계입니다: checkFileExist.do로 존재를 확인한 뒤 download.do.
    """
    body = _encode_form(
        _encode_datasets(
            [
                (
                    "dmParamDown",
                    "dm",
                    {
                        "filePath": file_path,
                        "fileNm": file_name,
                        "strUserDefineGlobalFilePath": "",
                    },
                )
            ]
        )
    )

    check = await client.post(f"{SMUL_ORIGIN}{FILE_CHECK_PATH}", content=body, headers=AJAX_HEADERS)
    if check.status_code != 200:
        raise SmulFetchError(f"첨부파일 확인에 실패했습니다 (HTTP {check.status_code})")

    response = await client.post(
        f"{SMUL_ORIGIN}{FILE_DOWNLOAD_PATH}",
        content=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": f"{SMUL_ORIGIN}/index.do",
            "Origin": SMUL_ORIGIN,
        },
    )
    if response.status_code != 200 or not response.content:
        raise SmulFetchError(f"첨부파일을 내려받지 못했습니다 (HTTP {response.status_code})")

    # 파일 대신 오류 페이지가 오는 경우를 걸러냅니다.
    if response.headers.get("content-type", "").startswith("text/html"):
        raise SmulFetchError("첨부파일 대신 오류 페이지가 반환됐습니다. 세션이 만료되었을 수 있습니다.")

    resolved = file_name
    match = re.search(
        r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", response.headers.get("content-disposition", "")
    )
    if match:
        resolved = unquote(match.group(1))
    return response.content, resolved


async def download_attachment(
    student_id: str, password: str, file_path: str, file_name: str
) -> tuple[bytes, str]:
    """로그인한 뒤 첨부파일 바이트와 파일명을 반환합니다."""
    async with httpx.AsyncClient(
        follow_redirects=True, timeout=REQUEST_TIMEOUT, headers=BROWSER_HEADERS
    ) as client:
        await login(client, student_id, password)
        return await _download_with_session(client, file_path, file_name)


__all__ = [
    "EXAM_DIV_FINAL",
    "EXAM_DIV_MID",
    "EXAM_DIV_NAMES",
    "SmulFetchError",
    "SmulLoginError",
    "download_attachment",
    "fetch_exam_papers",
    "normalize_semester",
]
