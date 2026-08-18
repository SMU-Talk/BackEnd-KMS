import { useEffect, useMemo, useState } from "react";
import { TRACK_RULES, MANUAL_REQUIREMENTS, GRAD_STATE_STORAGE_KEY } from "../data/graduationRules";
import { getGrades, syncGradesFromPortal } from "../services/api";
import { auditGraduation, isSeasonal } from "../utils/graduationAudit";

const STORAGE_KEY = GRAD_STATE_STORAGE_KEY;

const TRACKS = [
  { id: "single", label: "단일전공" },
  { id: "multi", label: "다전공" },
  { id: "minor", label: "부전공" },
];

// 학번/이름만 이 브라우저에 기억합니다. 비밀번호는 저장하지 않습니다.
const defaultState = {
  collapsed: false,
  track: "single",
  smulStudentId: "",
  smulStudentName: "",
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
  } catch {
    return defaultState;
  }
}

// 2013학번 이전 입학자는 졸업이수학점이 140학점입니다.
function isPre2013(studentId) {
  const year = Number(String(studentId).slice(0, 4));
  return Number.isFinite(year) && year > 1900 && year < 2013;
}

function CreditRow({ label, done, required, short, met, indent }) {
  return (
    <div className={`grad-req-row${indent ? " indent" : ""}`}>
      <span className="grad-req-label">{label}</span>
      <span className="grad-req-value">
        <b>{done}</b> / {required}학점
      </span>
      <em className={met ? "ok" : "pending"}>{met ? "충족" : `${short}학점 부족`}</em>
    </div>
  );
}

export default function GraduationChecklist() {
  const [state, setState] = useState(loadState);
  const [grades, setGrades] = useState({ summary: null, semesters: [], syncedAt: null });
  const [smulPassword, setSmulPassword] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const reloadGrades = () => {
    getGrades()
      .then((data) =>
        setGrades({ summary: data.summary, semesters: data.semesters || [], syncedAt: data.syncedAt })
      )
      .catch(() => {});
  };

  useEffect(reloadGrades, []);

  const update = (patch) => setState((current) => ({ ...current, ...patch }));

  const handlePortalSync = async () => {
    setSyncLoading(true);
    setSyncError("");
    try {
      await syncGradesFromPortal({
        studentId: state.smulStudentId.trim(),
        studentName: state.smulStudentName.trim(),
        password: smulPassword,
      });
      setSmulPassword("");
      reloadGrades();
    } catch (error) {
      setSyncError(error.message || "동기화하지 못했습니다.");
    } finally {
      setSyncLoading(false);
    }
  };

  const hasGrades = grades.semesters.length > 0;

  const audit = useMemo(
    () =>
      hasGrades
        ? auditGraduation(grades, { track: state.track, isPre2013: isPre2013(state.smulStudentId) })
        : null,
    [hasGrades, grades, state.track, state.smulStudentId]
  );

  // 연계·부전공 학점이 잡히는데 단일전공으로 보고 있으면 전공 유형을 잘못 고른 것입니다.
  const trackHint =
    audit && state.track === "single" && audit.totals.secondaryMajor > 0
      ? `연계/부전공 이수구분 학점이 ${audit.totals.secondaryMajor}학점 있습니다. 다전공 또는 부전공을 선택하세요.`
      : "";

  if (state.collapsed) {
    return (
      <aside className="grad-panel collapsed">
        <button className="grad-panel-toggle" onClick={() => update({ collapsed: false })}>
          🎓 졸업요건
        </button>
      </aside>
    );
  }

  return (
    <aside className="grad-panel">
      <header className="grad-panel-header">
        <b>🎓 졸업요건 체크리스트</b>
        <button onClick={() => update({ collapsed: true })} aria-label="패널 접기">
          ✕
        </button>
      </header>

      <div className="grad-panel-body">
        <section className="grad-sync">
          <h2>{hasGrades ? "성적 다시 가져오기" : "통합정보시스템 로그인"}</h2>
          <p className="grad-note">
            통합정보시스템(smul.smu.ac.kr) 계정으로 로그인하면 전체성적조회 내용을 그대로 가져와
            졸업요건을 계산합니다.
          </p>
          <input
            type="text"
            placeholder="학번"
            autoComplete="username"
            value={state.smulStudentId}
            onChange={(event) => update({ smulStudentId: event.target.value })}
          />
          <input
            type="text"
            placeholder="이름"
            value={state.smulStudentName}
            onChange={(event) => update({ smulStudentName: event.target.value })}
          />
          <input
            type="password"
            placeholder="통합정보시스템 비밀번호"
            autoComplete="current-password"
            value={smulPassword}
            onChange={(event) => setSmulPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !syncLoading) handlePortalSync();
            }}
          />
          <button
            onClick={handlePortalSync}
            disabled={
              syncLoading || !state.smulStudentId.trim() || !state.smulStudentName.trim() || !smulPassword
            }
          >
            {syncLoading ? "가져오는 중..." : "학점 가져오기"}
          </button>
          {syncError && <p className="grad-sync-error">{syncError}</p>}
          <p className="grad-note">
            비밀번호는 이 요청을 처리하는 동안에만 쓰고 저장하지 않습니다. 가져올 때마다 다시 입력해야
            합니다. 학번과 이름만 이 브라우저에 기억됩니다.
          </p>
        </section>

        {audit && (
          <>
            <div className={`grad-summary ${audit.allMet ? "ok" : "pending"}`}>
              {audit.allMet
                ? "🎉 학점 요건은 모두 충족했어요"
                : `졸업까지 ${audit.remainingCredits}학점 남았어요`}
            </div>

            <section>
              <h2>전공 유형</h2>
              <div className="grad-track-buttons">
                {TRACKS.map((track) => (
                  <button
                    key={track.id}
                    className={state.track === track.id ? "active" : ""}
                    onClick={() => update({ track: track.id })}
                  >
                    {track.label}
                  </button>
                ))}
              </div>
              <p className="grad-note">{TRACK_RULES[state.track].description}</p>
              {trackHint && <p className="grad-sync-error">{trackHint}</p>}
            </section>

            <section>
              <h2>이수학점 (취득학점 기준)</h2>
              {audit.requirements.map((item) => (
                <div key={item.id}>
                  <CreditRow {...item} />
                  {item.sub && <CreditRow {...item.sub} indent />}
                </div>
              ))}
              {audit.totals.freeElective > 0 && (
                <p className="grad-note">
                  자유선택 등 기타 {audit.totals.freeElective}학점은 총 이수학점에만 반영됩니다.
                </p>
              )}
              {audit.unlistedCredits !== 0 && (
                <p className="grad-note">
                  총 이수학점은 시스템의 취득학점({audit.totalDone}학점)을 그대로 썼습니다. 과목별
                  합계({audit.subjectTotal}학점)와 {Math.abs(audit.unlistedCredits)}학점 차이가 나는데,
                  편입·교환 인정학점처럼 과목 목록에 안 나오는 학점일 수 있습니다.
                </p>
              )}
              <p className="grad-note">
                재수강 과목은 한 번만 셌고, 학점을 받지 못한 과목(F·NP 등)은 제외했습니다.
              </p>
            </section>

            <section>
              <h2>그 밖의 요건</h2>
              <div className="grad-req-row">
                <span className="grad-req-label">{audit.gpaCheck.label}</span>
                <span className="grad-req-value">
                  <b>{audit.gpaCheck.value ?? "-"}</b>
                </span>
                <em className={audit.gpaCheck.met ? "ok" : "pending"}>
                  {audit.gpaCheck.met ? "충족" : "미충족"}
                </em>
              </div>
              <div className="grad-req-row">
                <span className="grad-req-label">{audit.semesterCheck.label}</span>
                <span className="grad-req-value">
                  <b>{audit.semesterCheck.value}</b> / {audit.semesterCheck.required}학기
                </span>
                <em className={audit.semesterCheck.met ? "ok" : "pending"}>
                  {audit.semesterCheck.met ? "충족" : `${audit.semesterCheck.required - audit.semesterCheck.value}학기 부족`}
                </em>
              </div>
              <p className="grad-note">계절수업은 등록학기에 포함하지 않았습니다.</p>
            </section>

            <section>
              <h2>직접 확인해야 하는 항목</h2>
              <p className="grad-note">
                성적 데이터만으로는 판정할 수 없어 학과 사무실이나 통합정보시스템에서 확인해야 합니다.
              </p>
              <ul className="grad-manual-list">
                {MANUAL_REQUIREMENTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                <li>조기졸업·학석사연계과정 해당자는 기준이 다릅니다 (6학기, 평점 4.0)</li>
              </ul>
            </section>

            <section>
              <h2>학기별 취득학점</h2>
              <ul className="grad-semester-list">
                {grades.semesters.map((semester) => (
                  <li key={`${semester.schYear}-${semester.semesterCode}`}>
                    <span>
                      {semester.schYear} {semester.semesterName}
                      {isSeasonal(semester) && <small className="grad-auto-tag"> 계절</small>}
                    </span>
                    <span>
                      취득 {semester.earnedCredit ?? "-"}학점 · 평점 {semester.gpa ?? "-"}
                    </span>
                  </li>
                ))}
              </ul>
              {grades.syncedAt && (
                <p className="grad-note">{new Date(grades.syncedAt).toLocaleString("ko-KR")} 기준</p>
              )}
            </section>

            <p className="grad-disclaimer">
              참고용 계산입니다. 정확한 졸업 판정은 반드시 학과 사무실과 통합정보시스템
              [학생기본]-[졸업]-[졸업기준학점조회]로 확인하세요.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
