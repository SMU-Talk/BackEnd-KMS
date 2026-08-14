import { useState } from "react";

const emptySignup = { studentId: "", nickname: "", password: "", passwordConfirm: "" };

export default function LoginPage({ onLogin, onSignup }) {
  const [mode, setMode] = useState("login");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(emptySignup);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin({ studentId: studentId.trim(), password });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async (event) => {
    event.preventDefault();
    setError("");
    if (signup.password !== signup.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      await onSignup({
        studentId: signup.studentId.trim(),
        nickname: signup.nickname.trim(),
        password: signup.password,
      });
      setSignup(emptySignup);
      setNotice("가입이 완료되었습니다. 로그인해 주세요.");
      setMode("login");
    } catch (signupError) {
      setError(signupError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark">🎓</span><strong>Uni<br /><em>Notice AI</em></strong><p>학교 공지를 AI가<br />빠르게 찾아드립니다.</p></div>

        {mode === "login" ? (
          <form className="login-form" onSubmit={submitLogin}>
            <h1>로그인</h1>
            <p>학번과 비밀번호를 입력해 주세요.</p>
            <label>학번<input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="학번 입력" autoComplete="username" /></label>
            <label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호 입력" autoComplete="current-password" /></label>
            {notice && <div className="form-notice" role="status">{notice}</div>}
            {error && <div className="form-error" role="alert">{error}</div>}
            <button disabled={loading}>{loading ? "로그인 중..." : "로그인"}</button>
            <small>
              아직 계정이 없으신가요?{" "}
              <button type="button" className="link-button" onClick={() => switchMode("signup")}>회원가입</button>
            </small>
          </form>
        ) : (
          <form className="login-form" onSubmit={submitSignup}>
            <h1>회원가입</h1>
            <p>학번으로 계정을 만들어 주세요.</p>
            <label>학번<input value={signup.studentId} onChange={(event) => setSignup({ ...signup, studentId: event.target.value })} placeholder="학번 입력 (8~10자리 숫자)" autoComplete="username" /></label>
            <label>닉네임<input value={signup.nickname} onChange={(event) => setSignup({ ...signup, nickname: event.target.value })} placeholder="닉네임 입력" autoComplete="nickname" /></label>
            <label>비밀번호<input type="password" value={signup.password} onChange={(event) => setSignup({ ...signup, password: event.target.value })} placeholder="영문+숫자 8자 이상" autoComplete="new-password" /></label>
            <label>비밀번호 확인<input type="password" value={signup.passwordConfirm} onChange={(event) => setSignup({ ...signup, passwordConfirm: event.target.value })} placeholder="비밀번호 재입력" autoComplete="new-password" /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button disabled={loading}>{loading ? "가입 중..." : "회원가입"}</button>
            <small>
              이미 계정이 있으신가요?{" "}
              <button type="button" className="link-button" onClick={() => switchMode("login")}>로그인</button>
            </small>
          </form>
        )}
      </section>
    </main>
  );
}
