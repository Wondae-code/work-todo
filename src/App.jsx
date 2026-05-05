import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useTasks } from "./hooks/useTasks";
import Auth from "./components/Auth";
import AppShell from "./components/AppShell";
import ProjectTimeline from "./components/ProjectTimeline";
import { createMockProjects } from "./test-fixtures/mockProjects";
import "./app.css";

/* Isolated test page for the timeline. Activate with ?test=timeline.
   Bypasses auth + Supabase so the chart can be exercised in isolation. */
function TimelineTestPage() {
  const [projects, setProjects] = useState(createMockProjects);
  const noop = () => {};
  const updateProject = (id, updates) =>
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  const updateSub = (pid, sid, updates) =>
    setProjects((prev) =>
      prev.map((p) =>
        p.id === pid
          ? { ...p, subs: p.subs.map((s) => (s.sid === sid ? { ...s, ...updates } : s)) }
          : p
      )
    );
  return (
    <>
      <div style={{
        position: "sticky", top: 0, zIndex: 1000,
        height: 75, boxSizing: "border-box",
        padding: "10px 24px",
        background: "#FEF3C7",
        borderBottom: "1px solid #E0B43A",
        fontSize: 12, fontWeight: 700, color: "#7A4800",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>🟡 TIMELINE TEST MODE — 라벨 jitter 재현용 (가짜 데이터, Supabase 미접속)</span>
        <span style={{ fontWeight: 500, opacity: 0.8 }}>
          정상 앱 → URL에서 <code>?test=timeline</code> 제거
        </span>
      </div>
      <ProjectTimeline
        projects={projects}
        actions={{
          addProject: noop,
          updateProject,
          deleteProject: noop,
          reorderProjects: noop,
          addSub: noop,
          updateSub,
          deleteSub: noop,
          reorderSubs: noop,
        }}
        loading={false}
      />
    </>
  );
}

export default function App() {
  /* Test-mode shortcut — reads at module init so navigation requires reload. */
  const isTimelineTest =
    new URLSearchParams(window.location.search).get("test") === "timeline";

  const { user, loading: authLoading, signInWithMagicLink, signUp, signIn, signOut } = useAuth();
  const { tasks, loading: tasksLoading, ...taskActions } = useTasks(user?.id ?? null);

  if (isTimelineTest) {
    return <TimelineTestPage />;
  }

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)",
      }}>
        <p style={{ color: "var(--ink3)", fontSize: 16 }}>로딩 중...</p>
      </div>
    );
  }

  // 비로그인 → Auth 페이지
  if (!user) {
    return (
      <Auth
        onMagicLink={signInWithMagicLink}
        onSignIn={signIn}
        onSignUp={signUp}
      />
    );
  }

  // 로그인 → 메인 앱 (탭 네비 + 패널)
  return (
    <AppShell
      user={user}
      onSignOut={signOut}
      tasks={tasks}
      taskActions={taskActions}
      tasksLoading={tasksLoading}
    />
  );
}
