import { useEffect, useRef, useCallback } from "react";

/**
 * 알림 스케줄러 훅
 * - 30초 간격으로 오늘 날짜의 미완료 + alarm_hour 설정된 task를 검사
 * - 설정 시각이 지나면 onFire(task) 호출 (같은 task/날짜/시각당 1회)
 * - 발화 기록은 localStorage에 저장해 새로고침해도 중복 알림 방지
 */

const FIRED_KEY = "work_alarm_fired_v1";

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

export function useAlarms(tasks, onFire) {
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const check = useCallback(() => {
    const now = new Date();
    const todayK = dk(now);
    const fired = loadFired();
    let changed = false;

    for (const t of tasksRef.current) {
      if (t.done || t.alarm_hour == null) continue;
      if (t.date_key !== todayK) continue;
      if (now.getHours() < t.alarm_hour) continue;
      const key = `${t.id}:${t.date_key}:${t.alarm_hour}`;
      if (fired[key]) continue;
      fired[key] = t.date_key;
      changed = true;
      onFireRef.current(t);
    }

    if (changed) saveFired(fired);
  }, []);

  // 주기 체크 (탭이 열려있는 동안)
  useEffect(() => {
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, [check]);

  // tasks 로드/변경 즉시 체크 — 앱을 늦게 열어도 지난 알림이 바로 뜬다 (fired 기록으로 중복 방지)
  useEffect(() => {
    check();
  }, [tasks, check]);
}
