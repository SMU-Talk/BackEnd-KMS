import { useEffect, useMemo, useState } from "react";
import {
  CREDIT_REQUIREMENTS,
  LIBERAL_ARTS_BY_YEAR,
  LIBERAL_ARTS_EXCEPTIONS,
  GRADUATION_RULE_ARTICLES,
  PRE_2013_TOTAL_CREDIT,
} from "../data/graduationRequirements";

const STORAGE_KEY = "gradChecklistState";

const TRACKS = [
  { id: "single", label: "단일전공" },
  { id: "multi", label: "다전공" },
  { id: "minor", label: "부전공" },
];

const defaultState = {
  collapsed: false,
  majorKey: "",
  yearId: LIBERAL_ARTS_BY_YEAR[0].id,
  isPre2013: false,
  track: "single",
  credits: { liberalArts: "", majorA: "", majorB: "", elective: "" },
  basicsChecked: {},
  backboneChecked: false,
  balanceChecked: false,
  articlesChecked: {},
  gpa: "",
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const saved = JSON.parse(raw);
    return { ...defaultState, ...saved, credits: { ...defaultState.credits, ...saved.credits } };
  } catch {
    return defaultState;
  }
}

const majorKeyOf = (item) => `${item.department}__${item.major}`;
const toNumber = (value) => Number(value) || 0;

function CreditInput({ label, value, onChange, required, done }) {
  const ok = required === 0 || done >= required;
  return (
    <label className="grad-credit-input">
      <span>{label}</span>
      <input type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0" />
      <em className={ok ? "ok" : "pending"}>{ok ? "충족" : `${required - done}학점 부족`}</em>
    </label>
  );
}

export default function GraduationChecklist() {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const update = (patch) => setState((current) => ({ ...current, ...patch }));
  const updateCredit = (key, value) => update({ credits: { ...state.credits, [key]: value } });

  const groupedMajors = useMemo(() => {
    const map = new Map();
    for (const item of CREDIT_REQUIREMENTS) {
      if (!map.has(item.department)) map.set(item.department, []);
      map.get(item.department).push(item);
    }
    return map;
  }, []);

  const selectedMajor = useMemo(
    () => CREDIT_REQUIREMENTS.find((item) => majorKeyOf(item) === state.majorKey) || null,
    [state.majorKey]
  );

  const selectedYear = LIBERAL_ARTS_BY_YEAR.find((year) => year.id === state.yearId) || LIBERAL_ARTS_BY_YEAR[0];

  const trackRequirement = useMemo(() => {
    if (!selectedMajor) return null;
    if (state.track === "single") {
      if (selectedMajor.singleMerged) {
        return { aLabel: null, aRequired: 0, bLabel: "전공", bRequired: selectedMajor.singleElective };
      }
      return { aLabel: "전공심화", aRequired: selectedMajor.singleAdvanced, bLabel: "전공선택", bRequired: selectedMajor.singleElective };
    }
    if (state.track === "multi") {
      return {
        aLabel: "1전공",
        aRequired: selectedMajor.multiPrimary,
        bLabel: "다전공",
        bRequired: selectedMajor.multiSecondary,
        note: selectedMajor.multiNote,
      };
    }
    return { aLabel: "1전공", aRequired: selectedMajor.minorPrimary, bLabel: "부전공", bRequired: selectedMajor.minorSecondary };
  }, [selectedMajor, state.track]);

  const totalRequired = state.isPre2013 ? PRE_2013_TOTAL_CREDIT : selectedMajor?.total || 0;
  const liberalArtsRequired = selectedYear.total;
  const majorRequired = trackRequirement ? trackRequirement.aRequired + trackRequirement.bRequired : 0;
  const electiveRequired = Math.max(totalRequired - liberalArtsRequired - majorRequired, 0);

  const liberalArtsDone = toNumber(state.credits.liberalArts);
  const majorADone = toNumber(state.credits.majorA);
  const majorBDone = toNumber(state.credits.majorB);
  const electiveDone = toNumber(state.credits.elective);
  const totalDone = liberalArtsDone + majorADone + majorBDone + electiveDone;

  const unmetItems = [];
  if (selectedMajor && trackRequirement) {
    if (liberalArtsDone < liberalArtsRequired) unmetItems.push(`교양 ${liberalArtsRequired - liberalArtsDone}학점 부족`);
    if (trackRequirement.aLabel && majorADone < trackRequirement.aRequired) {
      unmetItems.push(`${trackRequirement.aLabel} ${trackRequirement.aRequired - majorADone}학점 부족`);
    }
    if (majorBDone < trackRequirement.bRequired) {
      unmetItems.push(`${trackRequirement.bLabel} ${trackRequirement.bRequired - majorBDone}학점 부족`);
    }
    if (totalDone < totalRequired) unmetItems.push(`총 이수학점 ${totalRequired - totalDone}학점 부족`);
    selectedYear.basics.forEach((item) => {
      if (item.requirement !== "해당 없음" && !state.basicsChecked[item.name]) unmetItems.push(`${item.name} 미이수`);
    });
    if (!state.backboneChecked) unmetItems.push("상명핵심역량교양 미충족");
    if (!state.balanceChecked) unmetItems.push("균형교양 미충족");
    GRADUATION_RULE_ARTICLES.forEach((article) => {
      if (article.id === "gpa") {
        if (!(Number(state.gpa) >= article.minGpa)) unmetItems.push("평점평균 요건 미충족");
      } else if (!state.articlesChecked[article.id]) {
        unmetItems.push(`${article.label} 미충족`);
      }
    });
  }

  if (state.collapsed) {
    return (
      <aside className="grad-panel collapsed">
        <button className="grad-panel-toggle" onClick={() => update({ collapsed: false })}>🎓 졸업요건</button>
      </aside>
    );
  }

  return (
    <aside className="grad-panel">
      <header className="grad-panel-header">
        <b>🎓 졸업요건 체크리스트</b>
        <button onClick={() => update({ collapsed: true })} aria-label="패널 접기">✕</button>
      </header>
      <div className="grad-panel-body">
        <section>
          <h2>1. 학과 / 전공 선택</h2>
          <select value={state.majorKey} onChange={(event) => update({ majorKey: event.target.value })}>
            <option value="">학과/전공을 선택하세요</option>
            {[...groupedMajors.entries()].map(([department, items]) => (
              <optgroup label={department} key={department}>
                {items.map((item) => (
                  <option value={majorKeyOf(item)} key={majorKeyOf(item)}>
                    {item.group ? `${item.group} · ${item.major}` : item.major}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </section>

        {selectedMajor && trackRequirement && (
          <>
            <div className={`grad-summary ${unmetItems.length === 0 ? "ok" : "pending"}`}>
              {unmetItems.length === 0 ? "🎉 입력한 기준으로는 졸업요건을 모두 충족했어요" : `아직 ${unmetItems.length}개 항목이 남았어요`}
            </div>

            <section>
              <h2>2. 입학년도 / 전공 유형</h2>
              <label className="grad-checkbox">
                <input type="checkbox" checked={state.isPre2013} onChange={(event) => update({ isPre2013: event.target.checked })} />
                2013학번 이전 입학 (졸업이수학점 {PRE_2013_TOTAL_CREDIT}학점 적용)
              </label>
              {!state.isPre2013 && (
                <select value={state.yearId} onChange={(event) => update({ yearId: event.target.value })}>
                  {LIBERAL_ARTS_BY_YEAR.map((year) => (
                    <option value={year.id} key={year.id}>{year.label}</option>
                  ))}
                </select>
              )}
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
            </section>

            <section>
              <h2>3. 이수 학점 입력</h2>
              <CreditInput
                label={`교양 (${liberalArtsRequired}학점)`}
                value={state.credits.liberalArts}
                onChange={(value) => updateCredit("liberalArts", value)}
                required={liberalArtsRequired}
                done={liberalArtsDone}
              />
              {trackRequirement.aLabel && (
                <CreditInput
                  label={`${trackRequirement.aLabel} (${trackRequirement.aRequired}학점)`}
                  value={state.credits.majorA}
                  onChange={(value) => updateCredit("majorA", value)}
                  required={trackRequirement.aRequired}
                  done={majorADone}
                />
              )}
              <CreditInput
                label={`${trackRequirement.bLabel} (${trackRequirement.bRequired}학점)`}
                value={state.credits.majorB}
                onChange={(value) => updateCredit("majorB", value)}
                required={trackRequirement.bRequired}
                done={majorBDone}
              />
              {trackRequirement.note && <p className="grad-note">참고: {trackRequirement.note}</p>}
              <CreditInput
                label={`자유선택 등 기타 (${electiveRequired}학점 권장)`}
                value={state.credits.elective}
                onChange={(value) => updateCredit("elective", value)}
                required={electiveRequired}
                done={electiveDone}
              />
              <div className="grad-total">
                총 이수학점 <b>{totalDone}</b> / {totalRequired}
                {totalDone >= totalRequired ? <span className="ok"> 충족</span> : <span className="pending"> {totalRequired - totalDone}학점 부족</span>}
              </div>
            </section>

            <section>
              <h2>4. 교양 세부 이수기준 ({selectedYear.label})</h2>
              {selectedYear.basics.map((item) => (
                <label className="grad-checkbox" key={item.name}>
                  <input
                    type="checkbox"
                    checked={!!state.basicsChecked[item.name]}
                    onChange={(event) => update({ basicsChecked: { ...state.basicsChecked, [item.name]: event.target.checked } })}
                  />
                  {item.name} <small>({item.requirement})</small>
                </label>
              ))}
              <label className="grad-checkbox">
                <input type="checkbox" checked={state.backboneChecked} onChange={(event) => update({ backboneChecked: event.target.checked })} />
                {selectedYear.backbone}
              </label>
              <label className="grad-checkbox">
                <input type="checkbox" checked={state.balanceChecked} onChange={(event) => update({ balanceChecked: event.target.checked })} />
                {selectedYear.balance}
              </label>
              <p className="grad-note">{selectedYear.breadth}</p>
              <details className="grad-exceptions">
                <summary>이수기준 예외자 보기</summary>
                <ul>{LIBERAL_ARTS_EXCEPTIONS.map((line) => <li key={line}>{line}</li>)}</ul>
              </details>
            </section>

            <section>
              <h2>5. 졸업요건 (학칙 제79조)</h2>
              {GRADUATION_RULE_ARTICLES.map((article) => (
                <div className="grad-article" key={article.id}>
                  {article.id === "gpa" ? (
                    <label className="grad-checkbox">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="4.5"
                        placeholder="평점평균"
                        value={state.gpa}
                        onChange={(event) => update({ gpa: event.target.value })}
                      />
                      {article.label}
                      {state.gpa !== "" && (
                        Number(state.gpa) >= article.minGpa
                          ? <span className="ok"> 충족</span>
                          : <span className="pending"> 미충족</span>
                      )}
                    </label>
                  ) : (
                    <label className="grad-checkbox">
                      <input
                        type="checkbox"
                        checked={!!state.articlesChecked[article.id]}
                        onChange={(event) => update({ articlesChecked: { ...state.articlesChecked, [article.id]: event.target.checked } })}
                      />
                      {article.label}
                    </label>
                  )}
                  <small>{article.detail}</small>
                </div>
              ))}
            </section>

            <p className="grad-disclaimer">
              학교 성적·수강내역 API가 아직 없어 입력값은 이 브라우저에만 저장되고 서버로 전송되지 않습니다.
              참고용 계산이니 정확한 판정은 반드시 학과 사무실·학사종합정보시스템으로 확인하세요.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
