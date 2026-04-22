import { useState, useEffect, useRef } from "react";

const dk = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addD = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const tod = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function AddProjectModal({ show, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState(dk(tod()));
  const [end, setEnd] = useState(dk(addD(tod(), 14)));
  const nameRef = useRef(null);

  useEffect(() => {
    if (show) {
      setName("");
      setStart(dk(tod()));
      setEnd(dk(addD(tod(), 14)));
      requestAnimationFrame(() => nameRef.current?.focus());
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onClose]);

  if (!show) return null;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let s = start;
    let e = end;
    if (s > e) {
      // swap
      [s, e] = [e, s];
    }
    /* pal is assigned randomly by the caller — modal stays color-agnostic. */
    onSubmit({ text: trimmed, start: s, end: e });
    onClose();
  };

  return (
    <div
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
      style={overlay}
    >
      <div style={modal}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>새 프로젝트 추가</h3>

        <Field label="프로젝트명">
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && submit()}
            placeholder="예: 헤라쉴드 신규 디자인"
            style={inputS}
          />
        </Field>

        <div style={{ display: "flex", gap: 10 }}>
          <Field label="시작일" style={{ flex: 1 }}>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inputS} />
          </Field>
          <Field label="마감일" style={{ flex: 1 }}>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={inputS} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={cancelBtn}>취소</button>
          <button onClick={submit} style={confirmBtn}>추가하기</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink2)", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const overlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.22)",
  zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
};
const modal = {
  background: "var(--sf)", borderRadius: 20, padding: 28, width: "100%",
  maxWidth: 420, boxShadow: "0 10px 36px rgba(0,0,0,.15)",
};
const inputS = {
  width: "100%", fontFamily: "inherit", fontSize: 14, padding: "9px 12px",
  border: "1.5px solid var(--bd2)", borderRadius: 8, background: "var(--bg)",
  color: "var(--ink)", outline: "none",
};
const cancelBtn = {
  flex: 1, fontFamily: "inherit", fontSize: 14, fontWeight: 600, padding: 11,
  border: "1.5px solid var(--bd)", borderRadius: 10, background: "none",
  color: "var(--ink2)", cursor: "pointer",
};
const confirmBtn = {
  flex: 2, fontFamily: "inherit", fontSize: 14, fontWeight: 600, padding: 11,
  border: "none", borderRadius: 10, background: "var(--ink)", color: "#fff",
  cursor: "pointer",
};
