import { useState, useEffect, useRef } from "react";
import { X, BellOff, Bell } from "lucide-react";

/**
 * 알림 시간 설정 모달 — iOS 스타일 롤링 휠 (스펙 참고 이미지의 롤링패널 방식)
 * - 오전/오후 + 1~12시 두 개의 스크롤 휠, 1시간 단위, 디폴트 AM 9시
 * - "확인"으로 적용, "알림 없음"으로 해제
 * - onPick(hour24 | null)
 */

const ITEM_H = 40;   // 휠 한 칸 높이
const PAD_ROWS = 2;  // 중앙 정렬용 위아래 여백 칸 수 (5칸 중 가운데)

function Wheel({ items, value, onChange, width = 104 }) {
  const ref = useRef();
  const timer = useRef();

  /* 열릴 때 선택값이 중앙에 오도록 스크롤 */
  useEffect(() => {
    const idx = items.findIndex((it) => it.v === value);
    if (ref.current && idx >= 0) ref.current.scrollTop = idx * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(ref.current.scrollTop / ITEM_H)));
      if (items[idx].v !== value) onChange(items[idx].v);
    }, 80);
  };

  return (
    <div style={{ position: "relative", width, height: ITEM_H * (PAD_ROWS * 2 + 1) }}>
      {/* 중앙 하이라이트 밴드 */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: ITEM_H * PAD_ROWS, height: ITEM_H,
        background: "var(--sf2)", borderRadius: 10, pointerEvents: "none",
      }} />
      <div
        ref={ref}
        onScroll={onScroll}
        className="alarm-wheel"
        style={{
          position: "absolute", inset: 0, overflowY: "auto",
          scrollSnapType: "y mandatory", padding: `${ITEM_H * PAD_ROWS}px 0`,
        }}
      >
        {items.map((it) => (
          <div
            key={it.v}
            onClick={() => onChange(it.v)}
            style={{
              height: ITEM_H, display: "flex", alignItems: "center", justifyContent: "center",
              scrollSnapAlign: "center", cursor: "pointer",
              fontSize: it.v === value ? 17 : 15,
              fontWeight: it.v === value ? 700 : 500,
              color: it.v === value ? "var(--ink)" : "var(--ink3)",
              transition: "color .1s, font-size .1s",
            }}
          >{it.label}</div>
        ))}
      </div>
      {/* 위아래 페이드 */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: 0, height: ITEM_H,
        background: "linear-gradient(var(--sf), transparent)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: ITEM_H,
        background: "linear-gradient(transparent, var(--sf))", pointerEvents: "none",
      }} />
    </div>
  );
}

const AMPM_ITEMS = [
  { v: "AM", label: "오전" },
  { v: "PM", label: "오후" },
];
const HOUR_ITEMS = Array.from({ length: 12 }, (_, i) => ({ v: i + 1, label: `${i + 1}시` }));

export default function AlarmModal({ show, onClose, alarmHour, onPick }) {
  // alarmHour: 0~23 또는 null (미설정 시 디폴트 AM 9시)
  const [ampm, setAmpm] = useState("AM");
  const [hour12, setHour12] = useState(9);

  useEffect(() => {
    if (!show) return;
    const h = alarmHour == null ? 9 : alarmHour;
    setAmpm(alarmHour == null || alarmHour < 12 ? "AM" : "PM");
    setHour12(h % 12 === 0 ? 12 : h % 12);
  }, [show, alarmHour]);

  if (!show) return null;

  const to24 = () => (ampm === "AM" ? hour12 % 12 : (hour12 % 12) + 12);

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>알림 설정</div>
          <button onClick={onClose} style={closeBtn}><X size={20} /></button>
        </div>

        {/* Rolling wheels */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          <Wheel items={AMPM_ITEMS} value={ampm} onChange={setAmpm} />
          <Wheel items={HOUR_ITEMS} value={hour12} onChange={setHour12} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onPick(null)} style={{
            flex: 1, padding: "11px 0", border: "1px solid var(--bd)", borderRadius: 10,
            fontSize: 13, fontWeight: 600, background: "var(--sf)", cursor: "pointer",
            color: "var(--ink3)", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}><BellOff size={14} />알림 없음</button>
          <button onClick={() => onPick(to24())} style={{
            flex: 1.4, padding: "11px 0", border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 700, background: "var(--ink)", color: "#fff",
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}><Bell size={14} />{ampm === "AM" ? "오전" : "오후"} {hour12}시 알림</button>
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
  background: "none", border: "none", cursor: "pointer",
  color: "var(--ink3)", padding: "0 4px", display: "flex", alignItems: "center",
};
