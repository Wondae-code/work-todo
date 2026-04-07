import { useMemo } from "react";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const dk = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CalendarModal({
  show,
  onClose,
  selectedKey,
  onPick,
  calYear,
  calMonth,
  setCalYear,
  setCalMonth,
}) {
  const todayK = useMemo(() => dk(new Date()), []);

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

  const quickPick = (offset) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    onPick(dk(d));
  };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>날짜 선택</div>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={prev} style={navBtn}>‹</button>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{calYear}년 {calMonth + 1}월</div>
          <button onClick={next} style={navBtn}>›</button>
        </div>

        {/* Calendar grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center", marginBottom: 14 }}>
          {DAYS.map((d) => (
            <div key={d} style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", padding: "6px 0" }}>{d}</div>
          ))}
          {cells.map((c, i) => {
            const isToday = c.key === todayK;
            const isSel = c.key === selectedKey;
            return (
              <div
                key={i}
                onClick={() => onPick(c.key)}
                style={{
                  width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%", fontSize: 13, fontWeight: 500, cursor: "pointer", margin: "0 auto",
                  color: isSel ? "#fff" : c.other ? "var(--ink3)" : "var(--ink)",
                  border: isToday && !isSel ? "2px solid var(--ink)" : "2px solid transparent",
                  background: isSel ? "var(--ink)" : "transparent",
                }}
              >
                {c.d}
              </div>
            );
          })}
        </div>

        {/* Quick buttons */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["오늘", 0], ["내일", 1], ["모레", 2], ["다음주", 7]].map(([label, offset]) => (
            <button key={offset} onClick={() => quickPick(offset)} style={quickBtn}>{label}</button>
          ))}
        </div>
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
  background: "none", border: "none", fontSize: 22, cursor: "pointer",
  color: "var(--ink3)", padding: "0 4px",
};
const navBtn = {
  background: "var(--sf2)", border: "1px solid var(--bd)", borderRadius: 8,
  width: 32, height: 32, fontSize: 16, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const quickBtn = {
  flex: 1, padding: "8px 4px", border: "1px solid var(--bd)", borderRadius: 8,
  fontSize: 12, fontWeight: 600, background: "var(--sf)", cursor: "pointer",
  textAlign: "center", color: "var(--ink2)", fontFamily: "inherit", minWidth: 60,
};
