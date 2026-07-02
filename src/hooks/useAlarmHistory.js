import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * 알림함 이력 훅
 * - 로그인 시: Supabase alarm_history 테이블 (기기 간 동기화, user_id+fired_key unique로 중복 방지)
 * - 비로그인 시: localStorage 폴백
 * - notif 형태: { key, text, hour, at(ms), read }
 */

const LOCAL_KEY = "work_alarm_history_v1";
const MAX_ITEMS = 50;

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    // 구버전 항목은 id 필드를 key로 사용했음
    return JSON.parse(raw).map((n) => ({ ...n, key: n.key ?? n.id }));
  } catch {
    return [];
  }
}

function rowToNotif(row) {
  return {
    key: row.fired_key,
    text: row.text,
    hour: row.alarm_hour,
    at: row.created_at ? Date.parse(row.created_at) : 0,
    read: row.read,
  };
}

export function useAlarmHistory(userId) {
  const [notifs, setNotifs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  /* ── Fetch ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        setNotifs(loadLocal());
        setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("alarm_history")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS);
      if (!cancelled) {
        if (data) setNotifs(data.map(rowToNotif));
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  /* ── localStorage 동기화 (비로그인) ── */
  useEffect(() => {
    if (!userId && loaded) localStorage.setItem(LOCAL_KEY, JSON.stringify(notifs));
  }, [notifs, userId, loaded]);

  /* ── 추가 (발화 시) ── */
  const addNotif = useCallback(
    async ({ key, text, hour }) => {
      const item = { key, text, hour, at: Date.now(), read: false };
      setNotifs((prev) => [item, ...prev.filter((n) => n.key !== key)].slice(0, MAX_ITEMS));
      if (userId) {
        // unique(user_id, fired_key) — 다른 기기에서 이미 기록했으면 조용히 무시
        await supabase.from("alarm_history").insert({
          user_id: userId, fired_key: key, text, alarm_hour: hour,
        });
      }
    },
    [userId]
  );

  /* ── 모두 읽음 ── */
  const markAllRead = useCallback(async () => {
    setNotifs((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
    if (userId) {
      await supabase.from("alarm_history")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);
    }
  }, [userId]);

  /* ── 비우기 ── */
  const clearAll = useCallback(async () => {
    setNotifs([]);
    if (userId) {
      await supabase.from("alarm_history").delete().eq("user_id", userId);
    }
  }, [userId]);

  return { notifs, loaded, addNotif, markAllRead, clearAll };
}
