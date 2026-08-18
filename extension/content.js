// 이 스크립트는 smul.smu.ac.kr 페이지 컨텍스트 안에서만 실행됩니다.
// list.do / dtlList.do 호출은 같은 origin이므로 브라우저가 HttpOnly 세션 쿠키를
// 자동으로 실어 보냅니다 — 이 스크립트는 그 쿠키 값을 절대 읽거나 다른 곳으로 보내지 않습니다.
// SMU-Talk 서버와의 통신은 background.js만 담당합니다 (권한 분리).

(function () {
  function findFromPage(name) {
    const input = document.querySelector(`input[name="${name}"], input[id="${name}"]`);
    if (input && input.value) return input.value;
    if (window[name] != null) return String(window[name]);
    try {
      if (top && top[name] != null) return String(top[name]);
    } catch (error) {
      // 다른 origin의 프레임이면 접근이 막힐 수 있음 — 무시하고 다음 방법 시도
    }
    return null;
  }

  async function getStudentIdentity() {
    const stored = await chrome.storage.local.get(["smulStudentNo", "smulStudentName"]);
    const stdNo = findFromPage("strStdNo") || stored.smulStudentNo;
    const stdNm = findFromPage("strStdNm") || stored.smulStudentName;
    if (!stdNo || !stdNm) {
      throw new Error(
        "MISSING_IDENTITY: 학번/이름을 페이지에서 자동으로 찾지 못했습니다. " +
          "팝업의 설정에서 학번과 이름을 한 번 입력해 두면 이후 자동으로 사용됩니다."
      );
    }
    return { stdNo, stdNm };
  }

  function buildForm(pairs) {
    return pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  }

  async function postDo(path, formPairs) {
    const response = await fetch(`${SMUL_ORIGIN}${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: buildForm(formPairs),
    });
    if (!response.ok) throw new Error(`통합정보시스템 응답 오류 (HTTP ${response.status})`);
    return response.json();
  }

  function fetchListDo(stdNo, stdNm) {
    return postDo("/UgdAllRecSch/list.do", [
      ["_AUTH_MENU_KEY", "ugdSAllRecSch-STD"],
      ["@d1#strStdNo", stdNo],
      ["@d1#strStdNm", stdNm],
      ["@d1#strOrgClsRcd", "CMN005.0020"],
      ["@d#", "@d1#"],
      ["@d1#", "dmParam"],
      ["@d1#tp", "dm"],
    ]);
  }

  function fetchDtlListDo(stdNo, schYear, smtRcd, sesRcd) {
    return postDo("/UgdAllRecSch/dtlList.do", [
      ["_AUTH_MENU_KEY", "ugdSAllRecSch-STD"],
      ["@d1#strSchYear", schYear],
      ["@d1#strSmtRcd", smtRcd],
      ["@d1#strSesRcd", sesRcd],
      ["@d1#strStdNo", stdNo],
      ["@d#", "@d1#"],
      ["@d1#", "dmDtlParam"],
      ["@d1#tp", "dm"],
    ]);
  }

  function normalizeSubject(raw) {
    return {
      subject_no: String(raw.SBJ_NO ?? ""),
      subject_name: String(raw.SBJ_KOR_NM ?? ""),
      grade: raw.GP != null ? String(raw.GP) : null,
      kind_code: raw.KIND_RCD != null ? String(raw.KIND_RCD) : null,
    };
  }

  function normalizeSummary(dmStdInfo) {
    return {
      total_applied_credit: dmStdInfo.strTotAplyCdt != null ? String(dmStdInfo.strTotAplyCdt) : null,
      total_gpa: dmStdInfo.strTotGpAvg != null ? String(dmStdInfo.strTotGpAvg) : null,
      major_gpa: dmStdInfo.strMjrGpAvg != null ? String(dmStdInfo.strMjrGpAvg) : null,
      total_earned_credit: dmStdInfo.strTotGetCdt != null ? String(dmStdInfo.strTotGetCdt) : null,
      total_grade_points: dmStdInfo.strTotGp != null ? String(dmStdInfo.strTotGp) : null,
      total_registered_credit: dmStdInfo.strTotSugangCdt != null ? String(dmStdInfo.strTotSugangCdt) : null,
    };
  }

  // 확인됨: 페이지의 ugdSAllRecSch 모듈 소스(dsSmtRecList 컬럼 정의, j() 핸들러의
  // getCellValue(g, "grdSmtRecList", "SMT_RCD", A) 호출)에서 필드명이 SMT_RCD로 확정되었습니다.
  // 나머지 후보는 학교가 필드명을 바꾸는 경우를 대비한 방어적 폴백입니다.
  const SMT_RCD_CANDIDATE_KEYS = ["SMT_RCD", "SMT_CD", "SMT_RCD_CD"];

  function findSmtRcd(row) {
    for (const key of SMT_RCD_CANDIDATE_KEYS) {
      if (row[key] != null) return String(row[key]);
    }
    return null;
  }

  async function aggregateGrades() {
    const { stdNo, stdNm } = await getStudentIdentity();
    const listResult = await fetchListDo(stdNo, stdNm);
    const summary = normalizeSummary(listResult.dmStdInfo || {});
    const semesterRows = listResult.dsSmtRecList || [];

    const semesters = [];
    for (const row of semesterRows) {
      const semester = {
        sch_year: String(row.SCH_YEAR ?? ""),
        semester_code: String(row.SES_RCD ?? ""),
        semester_name: row.SMT_NM != null ? String(row.SMT_NM) : null,
        applied_credit: row.APLY_CDT != null ? String(row.APLY_CDT) : null,
        gpa: row.GP_AVG != null ? String(row.GP_AVG) : null,
        subjects: [],
      };

      const smtRcd = findSmtRcd(row);
      if (!smtRcd) {
        console.warn(
          "[SMU-Talk] 학기 상세 조회를 건너뜁니다 — strSmtRcd 필드를 찾지 못했습니다:",
          row.SCH_YEAR,
          row.SMT_NM
        );
      } else {
        try {
          const detail = await fetchDtlListDo(stdNo, row.SCH_YEAR, smtRcd, row.SES_RCD);
          semester.subjects = (detail.dsSbjGetRecList || []).map(normalizeSubject);
        } catch (error) {
          console.warn("[SMU-Talk] 학기 상세 조회 실패:", row.SCH_YEAR, row.SMT_NM, error);
        }
      }

      semesters.push(semester);
    }

    return { summary, semesters };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "FETCH_GRADES") return undefined;
    aggregateGrades()
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true; // 비동기 응답을 위해 메시지 채널을 열어둠
  });
})();
