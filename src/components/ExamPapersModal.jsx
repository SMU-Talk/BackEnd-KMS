import { useEffect, useMemo, useState } from "react";
import { downloadExamAttachment, syncExamPapers } from "../services/api";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, index) => String(CURRENT_YEAR - index));

const EXAM_DIVISIONS = [
  { id: "", label: "중간·기말 모두" },
  { id: "UCS019.0001", label: "중간고사" },
  { id: "UCS019.0002", label: "기말고사" },
];

function defaultSemester() {
  const month = new Date().getMonth() + 1;
  return month >= 3 && month <= 8 ? "1" : "2";
}

/** 통합정보시스템 비밀번호를 받는 입력. 값은 상태에만 있고 저장하지 않습니다. */
function PortalCredentials({ studentId, onStudentIdChange, password, onPasswordChange }) {
  return (
    <div className="exam-credentials">
      <input
        type="text"
        placeholder="통합정보시스템 학번"
        autoComplete="username"
        value={studentId}
        onChange={(event) => onStudentIdChange(event.target.value)}
      />
      <input
        type="password"
        placeholder="통합정보시스템 비밀번호"
        autoComplete="current-password"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
      />
    </div>
  );
}

export default function ExamPapersModal({ onClose, defaultStudentId = "" }) {
  const [papers, setPapers] = useState([]);
  const [schYear, setSchYear] = useState(String(CURRENT_YEAR));
  const [semester, setSemester] = useState(defaultSemester);
  const [subjectName, setSubjectName] = useState("");
  const [examDiv, setExamDiv] = useState("");

  const [studentId, setStudentId] = useState(defaultStudentId);
  const [password, setPassword] = useState("");

  const [syncing, setSyncing] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState("");
  // 완료 알림. { kind: "sync" | "download", text }
  const [notice, setNotice] = useState(null);

  // 열 때는 비어 있고, 이번에 조회한 것만 보여 줍니다. 이전 조회분을 불러오지 않는
  // 이유는 검색을 반복할수록 목록이 계속 쌓여 보이기 때문입니다. 서버에는 남아 있어
  // 챗봇의 시험지 검색에는 계속 쓰입니다.

  // 알림은 잠시 뒤 스스로 사라지게 해서 목록을 계속 가리지 않도록 합니다.
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const attachmentCount = useMemo(
    () => papers.reduce((total, paper) => total + (paper.attachments?.length || 0), 0),
    [papers]
  );

  const handleSync = async () => {
    if (syncing || !studentId.trim() || !password) return;
    setSyncing(true);
    setError("");
    setNotice(null);
    try {
      const result = await syncExamPapers({
        studentId: studentId.trim(),
        password,
        schYear,
        semester,
        subjectName: subjectName.trim(),
        examDiv: examDiv || null,
      });
      // 비밀번호는 요청이 끝나면 바로 지웁니다. 서버도 저장하지 않습니다.
      setPassword("");
      setPapers(result.papers || []);
      setNotice({
        kind: "sync",
        text: result.papersSynced
          ? `시험지 ${result.papersSynced}건을 가져왔어요.`
          : "조건에 맞는 시험지가 없어요. 학년도·학기나 교과목명을 바꿔 보세요.",
      });
    } catch (caught) {
      setError(caught.message || "가져오지 못했습니다.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDownload = async (attachment) => {
    if (downloadingId) return;
    // 조회할 때 서버가 파일을 받아 두므로 보통은 자격증명이 필요 없습니다. 저장된
    // 사본이 없는 경우에만 서버가 알려 주고, 그때 입력값이 있으면 그대로 쓰입니다.
    setDownloadingId(attachment.id);
    setError("");
    setNotice(null);
    try {
      const savedName = await downloadExamAttachment({
        attachmentId: attachment.id,
        fileName: attachment.fileName,
        studentId: studentId.trim(),
        password,
      });
      setNotice({ kind: "download", text: `${savedName} 다운로드가 완료됐어요.` });
    } catch (caught) {
      setError(caught.message || "첨부파일을 내려받지 못했습니다.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="campus-map-overlay" onClick={onClose}>
      <div className="exam-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <b>📄 고사문제지 조회</b>
          <button onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <section className="exam-search">
          <div className="exam-search-row">
            <select value={schYear} onChange={(event) => setSchYear(event.target.value)}>
              {YEARS.map((year) => (
                <option value={year} key={year}>
                  {year}학년도
                </option>
              ))}
            </select>
            <select value={semester} onChange={(event) => setSemester(event.target.value)}>
              <option value="1">1학기</option>
              <option value="2">2학기</option>
            </select>
            <select value={examDiv} onChange={(event) => setExamDiv(event.target.value)}>
              {EXAM_DIVISIONS.map((division) => (
                <option value={division.id} key={division.id || "all"}>
                  {division.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="교과목명 (예: 알고리즘)"
              value={subjectName}
              onChange={(event) => setSubjectName(event.target.value)}
            />
          </div>

          <PortalCredentials
            studentId={studentId}
            onStudentIdChange={setStudentId}
            password={password}
            onPasswordChange={setPassword}
          />

          <button
            className="exam-sync-button"
            onClick={handleSync}
            disabled={syncing || !studentId.trim() || !password}
          >
            {syncing ? "가져오는 중..." : "시험지 가져오기"}
          </button>
          <p className="exam-note">
            비밀번호는 요청을 처리하는 동안에만 쓰고 저장하지 않습니다. 가져온 시험지는
            본인에게만 보이며, 챗봇 질문("알고리즘 시험에 뭐 나왔어?")에도 활용됩니다.
          </p>
        </section>

        {notice && <p className={`exam-notice ${notice.kind}`}>✅ {notice.text}</p>}
        {error && <p className="exam-error">{error}</p>}

        <section className="exam-list">
          <h2>
            조회 결과 {papers.length}건
            {attachmentCount > 0 && <small> · 첨부파일 {attachmentCount}개</small>}
          </h2>
          {!papers.length && (
            <p className="exam-empty">
              위에서 학년도·학기와 교과목명을 정해 조회해 보세요.
            </p>
          )}
          {papers.map((paper) => (
            <article className="exam-item" key={paper.id}>
              <div className="exam-item-head">
                <b>{paper.subjectName}</b>
                <span className="exam-item-tag">{paper.examDivName}</span>
              </div>
              <small>
                {paper.schYear}학년도 {paper.semester}학기 · {paper.subjectNo}-{paper.divcls}
                {paper.professor ? ` · ${paper.professor}` : ""}
              </small>
              {/* 첨부파일이 없는 시험지는 이 텍스트가 문제 전문입니다. */}
              {paper.contentText && <pre className="exam-content">{paper.contentText}</pre>}
              {paper.attachments?.map((attachment) => (
                <button
                  className="exam-download-button"
                  key={attachment.id}
                  onClick={() => handleDownload(attachment)}
                  disabled={downloadingId !== null}
                >
                  {downloadingId === attachment.id ? "내려받는 중..." : "⬇"} {attachment.fileName}
                  {attachment.fileSize ? (
                    <em>{Math.round(Number(attachment.fileSize) / 1024).toLocaleString()}KB</em>
                  ) : null}
                </button>
              ))}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
