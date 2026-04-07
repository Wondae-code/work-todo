import { useState } from "react";

export default function Auth({ onMagicLink, onSignIn, onSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("magic"); // 'magic' | 'login' | 'signup'
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    let result;
    if (mode === "magic") {
      result = await onMagicLink(email);
      if (!result.error) setMessage("로그인 링크를 이메일로 보냈어요. 메일함을 확인하세요!");
    } else if (mode === "login") {
      result = await onSignIn(email, password);
    } else {
      result = await onSignUp(email, password);
      if (!result.error) setMessage("확인 이메일을 보냈어요. 메일함을 확인하세요!");
    }

    if (result.error) setError(result.error.message);
    setSubmitting(false);
  };

  return (
    <div style={backdrop}>
      <div style={card}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, letterSpacing: -0.5 }}>업무 할일</h1>
        <p style={{ color: "var(--ink2)", fontSize: 14, marginBottom: 28 }}>
          로그인하면 어디서든 할 일을 동기화할 수 있어요
        </p>

        {/* Mode tabs */}
        <div style={{ display: "flex", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden", marginBottom: 20 }}>
          {[
            ["magic", "매직 링크"],
            ["login", "로그인"],
            ["signup", "회원가입"],
          ].map(([m, l]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setMessage(null); }}
              style={{
                flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                background: mode === m ? "var(--ink)" : "var(--sf)",
                color: mode === m ? "#fff" : "var(--ink2)",
                transition: "all .15s",
              }}
            >
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelS}>이메일</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputS}
          />

          {mode !== "magic" && (
            <>
              <label style={{ ...labelS, marginTop: 12 }}>비밀번호</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                style={inputS}
              />
            </>
          )}

          <button type="submit" disabled={submitting} style={btnS}>
            {submitting
              ? "처리 중..."
              : mode === "magic"
                ? "로그인 링크 보내기"
                : mode === "login"
                  ? "로그인"
                  : "회원가입"}
          </button>
        </form>

        {error && <div style={errS}>{error}</div>}
        {message && <div style={msgS}>{message}</div>}

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink3)", marginTop: 20 }}>
          매직 링크: 비밀번호 없이 이메일 링크로 로그인
        </p>
      </div>
    </div>
  );
}

/* ── Styles ── */
const backdrop = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  padding: 20, background: "var(--bg)",
};
const card = {
  background: "var(--sf)", borderRadius: 20, padding: "36px 32px", width: 380,
  maxWidth: "100%", boxShadow: "0 4px 24px rgba(0,0,0,.06)", border: "1px solid var(--bd)",
};
const labelS = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink2)", marginBottom: 6 };
const inputS = {
  width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--bd)",
  fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const btnS = {
  width: "100%", padding: "12px 0", marginTop: 20, borderRadius: 10, border: "none",
  background: "var(--ink)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit",
};
const errS = { marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "var(--red-bg)", color: "var(--red)", fontSize: 13, fontWeight: 500 };
const msgS = { marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "var(--green-bg)", color: "var(--green)", fontSize: 13, fontWeight: 500 };
