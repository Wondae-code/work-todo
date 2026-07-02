import { useEffect, useRef, useCallback } from "react";

/**
 * 알림 스케줄러 훅 (업무·프로젝트 공용)
 * - items: { key, text, hour, dateKey, done } 목록
 *   key: 발화 식별자(중복 방지), hour: 0~23, dateKey: 'YYYY-MM-DD'
 * - 30초 간격 + items 변경 즉시, 오늘 날짜의 미완료 항목 중
 *   설정 시각이 지난 것을 onFire(item)로 알림 (같은 key당 1회)
 * - 발화 기록은 localStorage에 저장해 새로고침해도 중복 알림 방지
 */

const FIRED_KEY = "work_alarm_fired_v1";

/* 알림 시각 라벨 — 0~23시 → "AM 9시" 형식 */
export const fmtAlarm = (h) => `${h < 12 ? "AM" : "PM"} ${h % 12 === 0 ? 12 : h % 12}시`;

const dk = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function loadFired() {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFired(map) {
  // 7일 지난 기록은 정리 ('YYYY-MM-DD' 문자열 비교)
  const cutoff = dk(new Date(Date.now() - 7 * 864e5));
  const pruned = {};
  for (const [k, dateKey] of Object.entries(map)) {
    if (dateKey >= cutoff) pruned[k] = dateKey;
  }
  localStorage.setItem(FIRED_KEY, JSON.stringify(pruned));
}

export function useAlarms(items, onFire) {
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const check = useCallback(() => {
    const now = new Date();
    const todayK = dk(now);
    const fired = loadFired();
    let changed = false;

    for (const it of itemsRef.current) {
      if (it.done || it.hour == null || !it.dateKey) continue;
      if (it.dateKey !== todayK) continue;
      if (now.getHours() < it.hour) continue;
      if (fired[it.key]) continue;
      fired[it.key] = it.dateKey;
      changed = true;
      onFireRef.current(it);
    }

    if (changed) saveFired(fired);
  }, []);

  // 주기 체크 (탭이 열려있는 동안)
  useEffect(() => {
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, [check]);

  // items 로드/변경 즉시 체크 — 앱을 늦게 열어도 지난 알림이 바로 뜬다 (fired 기록으로 중복 방지)
  useEffect(() => {
    check();
  }, [items, check]);
}
