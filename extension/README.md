# SMU-Talk 학점 동기화 확장 프로그램

smul.smu.ac.kr(통합정보시스템)에서 본인 학점을 읽어와 SMU-Talk에 동기화합니다.

## 보안 구조 (중요)

- `content.js`는 **smul.smu.ac.kr 페이지 안에서만** 실행됩니다. `list.do`/`dtlList.do` 호출은 같은 origin이라
  브라우저가 세션 쿠키(HttpOnly `JSESSIONID` 포함)를 자동으로 실어 보냅니다. 이 스크립트는 그 쿠키 값을
  읽거나 저장하거나 어디로도 전송하지 않습니다.
- `background.js`만 SMU-Talk 백엔드와 통신하고, SMU-Talk 토큰(학번 세션이 아닌 별도 발급 토큰)만 보관합니다.
- 두 컨텍스트가 분리되어 있어, 학교 세션과 SMU-Talk 토큰이 같은 코드에서 만나지 않습니다.

## 설치 (개발용, unpacked)

1. `chrome://extensions` 접속
2. 우측 상단 "개발자 모드" 켜기
3. "압축해제된 확장 프로그램을 로드합니다" 클릭 → 이 `extension/` 폴더 선택

## 배포 전 확인할 것

- `config.js`의 `SMU_TALK_API_BASE`를 운영 서버 주소로 변경
- `manifest.json`의 `host_permissions`에 운영 서버 origin 추가 (현재는 `http://localhost:8000/*`만 있음)

## 사용 방법

1. SMU-Talk 웹사이트에 로그인 → 졸업요건 패널의 "학점 연동하기" 버튼으로 8자리 코드 발급 (5분간 유효)
2. 확장 프로그램 팝업에서 그 코드 입력 → "연동하기"
3. smul.smu.ac.kr에 로그인한 탭을 열어둔 상태에서 팝업의 "지금 동기화" 클릭
4. 자동 동기화는 없습니다 — 학점이 바뀔 때마다 수동으로 버튼을 눌러야 합니다 (의도된 설계: 매크로처럼 학교
   시스템에 주기적으로 요청을 보내지 않기 위함).

## 알려진 한계 / 확인 필요 사항

- **학번/이름 자동 감지**: `list.do` 호출에는 학번(`strStdNo`)과 이름(`strStdNm`)이 필요합니다.
  `content.js`는 페이지의 `input[name="strStdNo"]` 또는 전역 변수 `window.strStdNo` 등에서 이 값을
  자동으로 찾으려 시도하지만, smul.smu.ac.kr의 실제 DOM 구조를 직접 확인하지 못한 상태로 작성되었습니다
  (디컴파일된 소스에서도 `b.Auth.getUserInfo(g, "USER_ID")`라는 프레임워크 API 호출로만 확인되고,
  이게 어떤 DOM 요소에 실제로 반영되는지는 확인되지 않았습니다). 자동 감지가 실패하면 에러 메시지가 뜹니다 —
  이 경우 팝업의 "학번/이름 직접 입력"에 값을 넣어두면 그걸 대신 씁니다. 근본적으로 고치려면 DevTools
  Elements 탭에서 학번/이름이 실제로 어디에 렌더링되는지 확인한 뒤 `findFromPage()`를 그에 맞게 수정하세요.
- **학기 상세 조회 필드명(`strSmtRcd`)**: 페이지의 `ugdSAllRecSch` 모듈 소스(디컴파일된 JS)에서
  `dsSmtRecList`의 컬럼이 `SMT_RCD`로 확정되었습니다. `content.js`의 `SMT_RCD_CANDIDATE_KEYS`는
  이제 확인된 값이 1순위이고, 나머지는 학교가 필드명을 바꾸는 경우를 대비한 폴백입니다.
- **응답 포맷 미검증**: `content.js`는 `list.do`/`dtlList.do` 응답을 `response.json()`으로 파싱하고,
  최상위 키가 DataMap/DataSet 이름(`dmStdInfo`, `dsSmtRecList`, `dsSbjGetRecList`)과 같다고 가정합니다.
  요청 바디는 `cpr` 프레임워크 고유 직렬화(`@d1#필드명=값`)를 쓰는 게 확인됐지만, **응답도 같은 방식인지는
  실제로 확장 프로그램을 로드해서 동기화해보기 전까지 확실하지 않습니다.** 처음 테스트할 때 팝업에서
  "동기화" 실패 메시지가 뜨거나 콘솔에 파싱 에러가 보이면, DevTools Network 탭에서 `list.do` 요청의
  Response 탭(Preview 말고 raw Response)을 열어 실제 키 이름을 확인한 뒤 `normalizeSummary()` /
  `aggregateGrades()`의 필드 접근 경로를 그에 맞게 고치세요.
- **`strOrgClsRcd` 하드코딩**: `content.js`의 `fetchListDo()`는 이 값을 `"CMN005.0020"`으로 고정해뒀는데,
  이건 특정 학생 한 명의 실제 요청에서 관찰된 값입니다. 페이지 소스상 이 값은 학생 유형(일반/편입/대학원 등)에
  따라 달라질 수 있어, 다른 유형의 학생에게는 안 맞을 수 있습니다. 확장 프로그램을 여러 학생이 쓰게 되면
  `findFromPage("strOrgClsRcd")`처럼 페이지에서 직접 읽어오도록 바꾸는 게 안전합니다.
- 아이콘 파일은 포함하지 않았습니다 (브라우저 기본 아이콘 사용). 필요하면 `manifest.json`에 `icons` 필드를
  추가하고 `icons/` 폴더에 PNG를 넣으세요.
