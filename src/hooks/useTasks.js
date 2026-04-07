import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * 할일 관리 훅 — Supabase 연동
 * - 로그인 시: Supabase에서 fetch/sync
 * - 비로그인 시: localStorage 폴백
 */

const LOCAL_KEY = "work_v9_local";

/* ── helpers ── */
const dk = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = () => dk(new Date());

function defaultTasks() {
  const k = todayKey();
  return [
    { id: -1, text: "헤라실드 광고지 디자인", done: false, priority: 1, type: "project", subs: [], date_key: k },
    { id: -2, text: "벨라비타 주력제안서 작성", done: false, priority: 2, type: "project", subs: [], date_key: k },
    { id: -3, text: "상품개별제안서 폼 작성", done: false, priority: 2, type: "quick", subs: [], date_key: k },
  ];
}

/* ── Task 형변환 (Supabase row ↔ 앱 객체) ── */

function rowToTask(row, subtasks = []) {
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    priority: row.priority,
    type: row.type,
    date_key: row.date_key,
    subs: subtasks
      .filter((s) => s.task_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ sid: s.id, text: s.text, done: s.done })),
  };
}

/* ── Hook ── */

export function useTasks(userId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Fetch ── */

  const fetchAll = useCallback(async () => {
    if (!userId) {
      // 비로그인: localStorage
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        setTasks(raw ? JSON.parse(raw) : defaultTasks());
      } catch {
        setTasks(defaultTasks());
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ data: rows }, { data: subs }] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("subtasks").select("*").order("sort_order"),
    ]);

    if (rows) {
      setTasks(rows.map((r) => rowToTask(r, subs || [])));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ── localStorage 동기화 (비로그인) ── */

  useEffect(() => {
    if (!userId) localStorage.setItem(LOCAL_KEY, JSON.stringify(tasks));
  }, [tasks, userId]);

  /* ── CRUD ── */

  const addTask = useCallback(
    async ({ text, priority = 2, type = "quick", date_key }) => {
      const key = date_key || todayKey();

      if (!userId) {
        // 로컬 전용
        setTasks((prev) => [
          ...prev,
          { id: Date.now(), text, done: false, priority, type, date_key: key, subs: [] },
        ]);
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert({ user_id: userId, text, priority, type, date_key: key })
        .select()
        .single();

      if (!error && data) {
        setTasks((prev) => [...prev, { ...rowToTask(data), subs: [] }]);
      }
    },
    [userId]
  );

  const updateTask = useCallback(
    async (id, updates) => {
      // 낙관적 업데이트
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );

      if (userId) {
        // DB 업데이트 (subs 제외)
        const { subs, ...dbUpdates } = updates;
        if (Object.keys(dbUpdates).length) {
          await supabase.from("tasks").update(dbUpdates).eq("id", id);
        }
      }
    },
    [userId]
  );

  const deleteTask = useCallback(
    async (id) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (userId) {
        await supabase.from("tasks").delete().eq("id", id);
      }
    },
    [userId]
  );

  const clearDone = useCallback(
    async (dateKey) => {
      const toDelete = tasks.filter((t) => t.date_key === dateKey && t.done);
      setTasks((prev) => prev.filter((t) => !(t.date_key === dateKey && t.done)));
      if (userId) {
        const ids = toDelete.map((t) => t.id);
        if (ids.length) await supabase.from("tasks").delete().in("id", ids);
      }
    },
    [tasks, userId]
  );

  /* ── Subtask CRUD ── */

  const addSub = useCallback(
    async (taskId, text) => {
      if (!userId) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, subs: [...t.subs, { sid: Date.now(), text, done: false }] }
              : t
          )
        );
        return;
      }

      const order = (tasks.find((t) => t.id === taskId)?.subs?.length ?? 0);
      const { data, error } = await supabase
        .from("subtasks")
        .insert({ task_id: taskId, text, sort_order: order })
        .select()
        .single();

      if (!error && data) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, subs: [...t.subs, { sid: data.id, text: data.text, done: data.done }] }
              : t
          )
        );
      }
    },
    [tasks, userId]
  );

  const updateSub = useCallback(
    async (taskId, sid, updates) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, subs: t.subs.map((s) => (s.sid === sid ? { ...s, ...updates } : s)) }
            : t
        )
      );
      if (userId) {
        await supabase.from("subtasks").update(updates).eq("id", sid);
      }
    },
    [userId]
  );

  const deleteSub = useCallback(
    async (taskId, sid) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, subs: t.subs.filter((s) => s.sid !== sid) } : t
        )
      );
      if (userId) {
        await supabase.from("subtasks").delete().eq("id", sid);
      }
    },
    [userId]
  );

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    clearDone,
    addSub,
    updateSub,
    deleteSub,
    refetch: fetchAll,
  };
}
