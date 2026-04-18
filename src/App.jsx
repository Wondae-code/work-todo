import { useAuth } from "./hooks/useAuth";
import { useTasks } from "./hooks/useTasks";
import Auth from "./components/Auth";
import AppShell from "./components/AppShell";
import "./app.css";

export default function App() {
  const { user, loading: authLoading, signInWithMagicLink, signUp, signIn, signOut } = useAuth();
  const { tasks, loading: tasksLoading, ...taskActions } = useTasks(user?.id ?? null);

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
