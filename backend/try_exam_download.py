"""저장된 고사문제지 첨부파일을 실제로 내려받아 보는 확인 스크립트.

서버는 파일을 보관하지 않고 요청 시점에 포털에서 받아 전달합니다. 그래서 통합정보
시스템 비밀번호를 다시 받습니다 -- 교수님 저작물을 우리 서버에 쌓아두지 않기 위한
설계이고, 성적 연동과 같은 원칙입니다.

비밀번호는 입력한 값이 화면에도 셸 기록에도 남지 않습니다(별표만 표시).

사용법 (backend/ 에서, 백엔드가 떠 있는 상태로):
    PowerShell : .\\.venv\\Scripts\\python.exe try_exam_download.py
    cmd        : .venv\\Scripts\\python.exe try_exam_download.py
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

from try_exam_sync import BASE, post, post_get, read_password

# 받은 파일이 진짜 그 형식인지 확인하는 매직 넘버. 오류 페이지를 파일로 착각하지
# 않기 위한 검사입니다.
MAGIC_NUMBERS = {
    b"%PDF": "PDF",
    b"PK\x03\x04": "ZIP/HWPX/DOCX",
    b"\xd0\xcf\x11\xe0": "HWP/DOC (OLE)",
    b"<!DO": "HTML (오류 페이지일 수 있음)",
    b"<htm": "HTML (오류 페이지일 수 있음)",
}

OUTPUT_DIR = Path(__file__).resolve().parent / "downloads"


def detect_kind(content: bytes) -> str:
    for magic, name in MAGIC_NUMBERS.items():
        if content.startswith(magic):
            return name
    # 텍스트 파일이면 디코딩이 된다.
    for encoding in ("utf-8", "cp949"):
        try:
            content[:400].decode(encoding)
            return f"텍스트 ({encoding})"
        except UnicodeDecodeError:
            continue
    return "알 수 없음"


def download(attachment_id: int, payload: dict, token: str) -> tuple[int, bytes, str]:
    request = urllib.request.Request(
        f"{BASE}/exams/attachments/{attachment_id}/download",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            disposition = response.headers.get("Content-Disposition", "")
            return response.status, response.read(), disposition
    except urllib.error.HTTPError as error:
        return error.code, error.read(), ""


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")

    print("=" * 68)
    print("고사문제지 첨부파일 다운로드 확인")
    print("=" * 68)

    print("\n[1/3] 챗봇 앱 로그인")
    app_id = input("  앱 학번: ").strip()
    app_password = read_password("  앱 비밀번호: ")
    code, body = post("/login", {"id": app_id, "password": app_password})
    if code != 200:
        print(f"  실패 (HTTP {code}): {body.get('detail')}")
        return
    token = body["token"]
    print(f"  로그인 성공: {body['user'].get('nickname')}")

    print("\n[2/3] 첨부파일이 있는 시험지")
    code, body = post_get("/exams", token)
    if code != 200:
        print(f"  목록 조회 실패 (HTTP {code}): {body.get('detail')}")
        return

    choices = []
    for paper in body.get("papers", []):
        for attachment in paper.get("attachments", []):
            choices.append((attachment, paper))

    if not choices:
        print("  첨부파일이 있는 시험지가 없습니다. 먼저 try_exam_sync.py 를 실행하세요.")
        return

    for index, (attachment, paper) in enumerate(choices, start=1):
        size = attachment.get("fileSize")
        size_text = f"{int(size) / 1024:.0f}KB" if size else "크기 미상"
        print(
            f"  {index:>2}. {paper['subjectNo']}-{paper['divcls']} {paper['subjectName']} "
            f"({paper.get('professor') or '교수 미상'}) {paper['examDivName']}"
        )
        print(f"      {attachment['fileName']} ({size_text})")

    raw = input(f"\n  받을 번호 (1-{len(choices)}, 비우면 1): ").strip() or "1"
    if not raw.isdigit() or not 1 <= int(raw) <= len(choices):
        print("  번호가 올바르지 않습니다.")
        return
    attachment, paper = choices[int(raw) - 1]

    print("\n[3/3] 통합정보시스템 자격증명")
    print("  (서버가 파일을 보관하지 않아 받을 때마다 필요합니다)")
    smul_id = input(f"  학번 [{app_id}]: ").strip() or app_id
    smul_password = read_password("  비밀번호: ")

    print(f"\n내려받는 중... ({attachment['fileName']})")
    code, content, disposition = download(
        attachment["id"], {"studentId": smul_id, "password": smul_password}, token
    )

    print("\n" + "=" * 68)
    if code != 200:
        print(f"실패 (HTTP {code})")
        try:
            print(f"  {json.loads(content).get('detail')}")
        except Exception:
            print(f"  {content[:300]!r}")
        print("=" * 68)
        return

    OUTPUT_DIR.mkdir(exist_ok=True)
    # 파일명에 경로 구분자가 들어와도 다른 디렉터리에 쓰지 않도록 이름만 취합니다.
    safe_name = Path(attachment["fileName"]).name or f"attachment_{attachment['id']}"
    target = OUTPUT_DIR / safe_name
    target.write_bytes(content)

    kind = detect_kind(content)
    expected = attachment.get("fileSize")
    print(f"성공: {len(content):,} 바이트 ({len(content) / 1024:.0f}KB)")
    print(f"  형식 판정: {kind}")
    if expected:
        match = "일치" if int(expected) == len(content) else f"불일치 (목록상 {int(expected):,})"
        print(f"  크기 대조: {match}")
    print(f"  저장 위치: {target}")
    if "HTML" in kind:
        print("\n  ⚠️ HTML이 왔습니다. 파일이 아니라 오류 페이지일 수 있으니 열어서 확인하세요.")
    print("=" * 68)


if __name__ == "__main__":
    main()
