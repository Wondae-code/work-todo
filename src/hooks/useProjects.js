import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * 프로젝트(Gantt) 관리 훅 — Supabase 전용
 * 로그인 사용자만 사용.
 */

/* ── Row ↔ App 객체 변환 ── */

function rowToProject(row, subs = []) {
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    pal: row.pal,
    start: row.start_date,
    end: row.end_date,
    sort_order: row.sort_order,
    subs: subs
      .filter((s) => s.project_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        sid: s.id,
        text: s.text,
        done: s.done,
        done_at: s.done_at || null,
        deadline: s.deadline || null,
        alarm_hour: s.alarm_hour ?? null,
      })),
  };
}

export function useProjects(userId) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Fetch ── */

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: rows }, { data: subs }] = await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("project_subs").select("*").order("sort_order"),
    ]);
    if (rows) {
      setProjects(rows.map((r) => rowToProject(r, subs || [])));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ── Project CRUD ── */

  const addProject = useCallback(
    async ({ text, pal = "biz_slate", start, end }) => {
      if (!userId) return;
      const order = projects.length;
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: userId,
          text,
          pal,
          start_date: start,
          end_date: end,
          sort_order: order,
        })
        .select()
        .single();
      if (!error && data) {
        setProjects((prev) => [...prev, rowToProject(data, [])]);
      }
    },
    [userId, projects.length]
  );

  const updateProject = useCallback(
    async (id, updates) => {
      // 낙관적 업데이트
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
      if (!userId) return;
      const { subs, ...rest } = updates;
      // 앱 필드명 → DB 필드명
      const dbUpdates = {};
      if (rest.text !== undefined) dbUpdates.text = rest.text;
      if (rest.done !== undefined) dbUpdates.done = rest.done;
      if (rest.pal !== undefined) dbUpdates.pal = rest.pal;
      if (rest.start !== undefined) dbUpdates.start_date = rest.start;
      if (rest.end !== undefined) dbUpdates.end_date = rest.end;
      if (rest.sort_order !== undefined) dbUpdates.sort_order = rest.sort_order;
      if (Object.keys(dbUpdates).length) {
        await supabase.from("projects").update(dbUpdates).eq("id", id);
      }
    },
    [userId]
  );

  const deleteProject = useCallback(
    async (id) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (userId) {
        await supabase.from("projects").delete().eq("id", id);
      }
    },
    [userId]
  );

  const reorderProjects = useCallback(
    async (newOrderIds) => {
      // 낙관적: 배열 순서 재배치 + sort_order 업데이트
      setProjects((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        return newOrderIds
          .map((id, i) => {
            const p = byId.get(id);
            return p ? { ...p, sort_order: i } : null;
          })
          .filter(Boolean);
      });
      if (!userId) return;
      // 개별 update
      await Promise.all(
        newOrderIds.map((id, i) =>
          supabase.from("projects").update({ sort_order: i }).eq("id", id)
        )
      );
    },
    [userId]
  );

  /* ── Subtask CRUD ── */

  const addSub = useCallback(
    async (projectId, text) => {
      if (!userId) return;
      const order = projects.find((p) => p.id === projectId)?.subs?.length ?? 0;
      const { data, error } = await supabase
        .from("project_subs")
        .insert({ project_id: projectId, text, sort_order: order })
        .select()
        .single();
      if (!error && data) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  subs: [
                    ...p.subs,
                    {
                      sid: data.id,
                      text: data.text,
                      done: data.done,
                      done_at: data.done_at || null,
                      deadline: data.deadline || null,
                      alarm_hour: data.alarm_hour ?? null,
                    },
                  ],
                }
              : p
          )
        );
      }
    },
    [userId, projects]
  );

  const updateSub = useCallback(
    async (projectId, sid, updates) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                subs: p.subs.map((s) =>
                  s.sid === sid ? { ...s, ...updates } : s
                ),
              }
            : p
        )
      );
      if (userId) {
        await supabase.from("project_subs").update(updates).eq("id", sid);
      }
    },
    [userId]
  );

  const deleteSub = useCallback(
    async (projectId, sid) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, subs: p.subs.filter((s) => s.sid !== sid) }
            : p
        )
      );
      if (userId) {
        await supabase.from("project_subs").delete().eq("id", sid);
      }
    },
    [userId]
  );

  const reorderSubs = useCallback(
    async (projectId, newOrderSids) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          const bySid = new Map(p.subs.map((s) => [s.sid, s]));
          return {
            ...p,
            subs: newOrderSids
              .map((sid) => bySid.get(sid))
              .filter(Boolean),
          };
        })
      );
      if (!userId) return;
      await Promise.all(
        newOrderSids.map((sid, i) =>
          supabase.from("project_subs").update({ sort_order: i }).eq("id", sid)
        )
      );
    },
    [userId]
  );

  return {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    reorderProjects,
    addSub,
    updateSub,
    deleteSub,
    reorderSubs,
    refetch: fetchAll,
  };
}
