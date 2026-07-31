import { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const dk = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// 26.08.05 형태의 짧은 표기 (N일 뒤 미리보기용)
const shortK = (d) =>
  `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
const addDays = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

export default function CalendarModal({
  show,
  onClose,
  selectedKey,
  onPick,
  calYear,
  calMonth,
  setCalYear,
  setCalMonth,
  markedDates = new Set(),
}) {
  const todayK = useMemo(() => dk(new Date()), []);
  const [offsetInput, setOffsetInput] = useState("");
  // 입력 중에는 placeholder "0"을 숨긴다 — 가운데 정렬이라 커서와 겹쳐 보인다.
  const [offsetFocused, setOffsetFocused] = useState(false);
  // 날짜 클릭은 "선택"까지만 하고, 확인을 눌러야 확정된다.
  const [draft, setDraft] = useState(selectedKey);

  useEffect(() => {
    if (!show) return;
    setDraft(selectedKey);
    setOffsetInput("");
    setOffsetFocused(false);
  }, [show, selectedKey]);

  if (!show) return null;

  const first = new Date(calYear, calMonth, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevDays = new Date(calYear, calMonth, 0).getDate();

  const cells = [];
  for (let i = startDay - 1; i >= 0; i--)
    cells.push({ d: prevDays - i, key: dk(new Date(calYear, calMonth - 1, prevDays - i)), other: true });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ d, key: dk(new Date(calYear, calMonth, d)), other: false });
  const rem = (startDay + daysInMonth) % 7 === 0 ? 0 : 7 - ((startDay + daysInMonth) % 7);
  for (let d = 1; d <= rem; d++)
    cells.push({ d, key: dk(new Date(calYear, calMonth + 1, d)), other: true });

  const prev = () => {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
    else setCalMonth(calMonth - 1);
  };
  const next = () => {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
    else setCalMonth(calMonth + 1);
  };

  // 선택한 날짜가 보이도록 달력 월도 같이 맞춘다.
  const choose = (key) => {
    setDraft(key);
    const [y, m] = key.split("-").map(Number);
    setCalYear(y);
    setCalMonth(m - 1);
  };

  const quickPick = (offset) => choose(dk(addDays(offset)));

  const offsetDate = offsetInput === "" ? null : addDays(Number(offsetInput));
  const pickOffset = () => offsetDate && choose(dk(offsetDate));

  const confirm = () => draft && onPick(draft);

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>날짜 선택</div>
          <button onClick={onClose} style={closeBtn}><X size={20} /></button>
        </div>

        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={prev} style={navBtn}><ChevronLeft size={16} /></button>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{calYear}년 {calMonth + 1}월</div>
          <button onClick={next} style={navBtn}><ChevronRight size={16} /></button>
        </div>

        {/* Calendar grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center", marginBottom: 14 }}>
          {DAYS.map((d) => (
            <div key={d} style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", padding: "6px 0" }}>{d}</div>
          ))}
          {cells.map((c, i) => {
            const isToday = c.key === todayK;
            const isSel = c.key === draft;
            const marked = markedDates.has(c.key);
            return (
              <div
                key={i}
                onClick={() => choose(c.key)}
                onDoubleClick={() => onPick(c.key)}
                style={{
                  position: "relative",
                  width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%", fontSize: 13, fontWeight: 500, cursor: "pointer", margin: "0 auto",
                  color: isSel ? "#fff" : c.other ? "var(--ink3)" : "var(--ink)",
                  border: isToday && !isSel ? "2px solid var(--ink)" : "2px solid transparent",
                  background: isSel ? "var(--ink)" : "transparent",
                }}
              >
                {c.d}
                {marked && (
                  <span style={{
                    position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)",
                    width: 4, height: 4, borderRadius: "50%",
                    background: isSel ? "#fff" : "var(--ink2)",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* N일 뒤 — 오늘 기준으로 일수를 더한 날짜를 고른다 */}
        <div style={offsetRow}>
          <input
            type="text"
            inputMode="numeric"
            value={offsetInput}
            onChange={(e) => setOffsetInput(e.target.value.replace(/\D/g, "").slice(0, 3))}
            onKeyDown={(e) => e.key === "Enter" && pickOffset()}
            onFocus={() => setOffsetFocused(true)}
            onBlur={() => setOffsetFocused(false)}
            placeholder={offsetFocused ? "" : "0"}
            aria-label="며칠 뒤"
            style={offsetField}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink2)" }}>일 뒤</span>
          <span style={{ flex: 1, borderTop: "1px dashed var(--bd)" }} />
          <button
            onClick={pickOffset}
            disabled={!offsetDate}
            style={{
              ...offsetPickBtn,
              color: offsetDate ? "var(--ink)" : "var(--ink3)",
              cursor: offsetDate ? "pointer" : "default",
            }}
          >
            {offsetDate ? shortK(offsetDate) : "--.--.--"}
          </button>
        </div>

        {/* Quick buttons */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["오늘", 0], ["내일", 1], ["모레", 2], ["다음주", 7]].map(([label, offset]) => {
            const on = draft === dk(addDays(offset));
            return (
              <button
                key={offset}
                onClick={() => quickPick(offset)}
                style={{
                  ...quickBtn,
                  borderColor: on ? "var(--ink)" : "var(--bd)",
                  color: on ? "var(--ink)" : "var(--ink2)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Confirm — 날짜 클릭은 선택만 하고, 여기서 확정한다 */}
        <button
          onClick={confirm}
          disabled={!draft}
          style={{ ...confirmBtn, opacity: draft ? 1 : 0.45, cursor: draft ? "pointer" : "default" }}
        >
          {draft ? `${draft.slice(5, 7)}월 ${draft.slice(8, 10)}일로 설정` : "날짜를 선택하세요"}
        </button>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
};
const modal = {
  background: "var(--sf)", borderRadius: 18, padding: 24, width: 320,
  maxWidth: "90vw", boxShadow: "0 12px 40px rgba(0,0,0,.15)",
};
const closeBtn = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--ink3)", padding: "0 4px", display: "flex", alignItems: "center",
};
const navBtn = {
  background: "var(--sf2)", border: "1px solid var(--bd)", borderRadius: 8,
  width: 32, height: 32, fontSize: 16, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const offsetRow = {
  display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
};
const offsetField = {
  width: 44, padding: "7px 6px", border: "1px solid var(--bd)", borderRadius: 8,
  fontSize: 13, fontWeight: 600, background: "var(--sf)", color: "var(--ink)",
  textAlign: "center", fontFamily: "inherit", outline: "none",
};
const offsetPickBtn = {
  padding: "7px 10px", border: "1px solid var(--bd)", borderRadius: 8,
  fontSize: 12, fontWeight: 700, background: "var(--sf)",
  fontFamily: "inherit", fontVariantNumeric: "tabular-nums",
};
const quickBtn = {
  flex: 1, padding: "8px 4px", border: "1px solid var(--bd)", borderRadius: 8,
  fontSize: 12, fontWeight: 600, background: "var(--sf)", cursor: "pointer",
  textAlign: "center", color: "var(--ink2)", fontFamily: "inherit", minWidth: 60,
};
const confirmBtn = {
  width: "100%", marginTop: 12, padding: "11px 0", border: "none", borderRadius: 10,
  background: "var(--ink)", color: "#fff", fontSize: 13, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
};
