"""고사문제지 조회를 실제로 한 번 돌려 보는 수동 확인 스크립트.

목록·팝업 요청의 전체 URL을 캡처하지 못해 후보 경로를 두고 첫 사용 시 찾도록
구현했습니다. 이 스크립트는 그 탐색이 실제로 성공하는지, 어떤 경로가 맞았는지를
확인하기 위한 것입니다. UI를 붙이기 전에 여기서 먼저 통과해야 합니다.

비밀번호는 입력한 값이 화면에도 셸 기록에도 남지 않습니다(별표만 표시). 명령줄
인자로 비밀번호를 받지 않는 것도 같은 이유입니다.

사용법 (backend/ 에서, 백엔드가 떠 있는 상태로):
    PowerShell : .\\.venv\\Scripts\\python.exe try_exam_sync.py
    cmd        : .venv\\Scripts\\python.exe try_exam_sync.py
"""

import getpass
import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api"


def read_password(prompt: str) -> str:
    """비밀번호를 받되 입력 중임을 별표로 보여 줍니다.

    getpass는 아무것도 표시하지 않아 멈춘 것처럼 보입니다. Windows 콘솔에서는
    msvcrt로 한 글자씩 받아 별표를 찍고, 그 외 환경에서는 getpass로 물러섭니다.
    어느 쪽이든 입력한 값 자체는 화면에 남지 않습니다.
    """
    try:
        import msvcrt
    except ImportError:
        return getpass.getpass(prompt)

    sys.stdout.write(prompt)
    sys.stdout.flush()
    buffer: list[str] = []
    while True:
        char = msvcrt.getwch()
        if char in ("\r", "\n"):
            sys.stdout.write("\n")
            sys.stdout.flush()
            return "".join(buffer)
        if char == "\x03":  # Ctrl+C
            sys.stdout.write("\n")
            raise KeyboardInterrupt
        if char == "\x08":  # Backspace
            if buffer:
                buffer.pop()
                sys.stdout.write("\b \b")
                sys.stdout.flush()
            continue
        if char == "\x00" or char == "\xe0":  # 기능키는 두 글자로 오므로 버립니다.
            msvcrt.getwch()
            continue
        buffer.append(char)
        sys.stdout.write("*")
        sys.stdout.flush()


def post(path: str, payload: dict, token: str | None = None) -> tuple[int, dict]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", "replace")
        try:
            return error.code, json.loads(body)
        except ValueError:
            return error.code, {"detail": body[:300]}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")

    print("=" * 68)
    print("고사문제지 조회 확인")
    print("=" * 68)
    print("비밀번호는 화면에 표시되지 않고 어디에도 저장되지 않습니다.\n")

    print("[1/3] 챗봇 앱 로그인")
    app_id = input("  앱 학번: ").strip()
    app_password = read_password("  앱 비밀번호: ")
    code, body = post("/login", {"id": app_id, "password": app_password})
    if code != 200:
        print(f"  실패 (HTTP {code}): {body.get('detail')}")
        return
    token = body.get("token")
    if not token:
        print("  로그인 응답에 토큰이 없습니다.")
        return
    print(f"  로그인 성공: {body['user'].get('nickname')}\n")

    print("[2/3] 조회 조건")
    sch_year = input("  학년도 [2025]: ").strip() or "2025"
    semester = input("  학기 [2]: ").strip() or "2"
    subject = input("  교과목명 (비우면 전체): ").strip()

    print("\n[3/3] 통합정보시스템 자격증명")
    print("  (성적 연동과 동일하게, 이 요청을 처리하는 동안만 쓰고 저장하지 않습니다)")
    smul_id = input(f"  통합정보시스템 학번 [{app_id}]: ").strip() or app_id
    smul_password = read_password("  통합정보시스템 비밀번호: ")

    print("\n조회 중... (로그인 + 과목별 상세 조회라 1~2분 걸릴 수 있습니다)")
    code, body = post(
        "/exams/sync",
        {
            "studentId": smul_id,
            "password": smul_password,
            "schYear": sch_year,
            "semester": semester,
            "subjectName": subject,
        },
        token,
    )

    print("\n" + "=" * 68)
    if code in (200, 201):
        print(f"성공: 시험지 {body.get('papersSynced')}건을 저장했습니다.")
    else:
        print(f"실패 (HTTP {code})")
        print(f"  {body.get('detail')}")
        print("\n경로 탐색이 실패했다면 위 메시지에 시도한 후보가 들어 있습니다.")
        print("맞는 경로를 알아내면 exam_client.py의 *_PATH_CANDIDATES 를 그 값으로 고정하세요.")
    print("=" * 68)

    if code not in (200, 201):
        return

    code, body = post_get("/exams", token)
    if code == 200:
        papers = body.get("papers", [])
        print(f"\n저장된 시험지 {len(papers)}건:")
        for paper in papers[:20]:
            attachment = f", 첨부 {paper['attachmentCount']}개" if paper["attachmentCount"] else ""
            content = "내용 있음" if paper["hasContent"] else "내용 없음"
            # 학수번호-분반과 교수명이 없으면 같은 과목의 다른 강좌가 중복으로 보입니다.
            print(
                f"  [{paper['id']:>3}] {paper['schYear']}-{paper['semester']} "
                f"{paper['subjectNo']}-{paper['divcls']} {paper['subjectName']} "
                f"({paper.get('professor') or '교수 미상'}) "
                f"{paper['examDivName']} ({content}{attachment})"
            )
        if len(papers) > 20:
            print(f"  ... 외 {len(papers) - 20}건")
        print("\n다음 확인:")
        print("  - 서버 로그(uvicorn.log)에서 '경로를 ... 로 확인했습니다' 줄을 찾아 경로를 고정")
        print("  - 챗봇에 '알고리즘 시험에 뭐 나왔어?' 같은 질문으로 개인 검색 확인")


def post_get(path: str, token: str) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"{BASE}{path}", headers={"Authorization": f"Bearer {token}"}, method="GET"
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return error.code, {"detail": error.read().decode("utf-8", "replace")[:300]}


if __name__ == "__main__":
    main()
