import { useEffect, useState } from "react";
import { ClipboardList, LayoutDashboard } from "lucide-react";
import WorkTodo from "./WorkTodo";
import ProjectTimeline from "./ProjectTimeline";
import { useProjects } from "../hooks/useProjects";

const TAB_STORAGE_KEY = "app-shell-active-tab";

export default function AppShell({ user, onSignOut, tasks, taskActions, tasksLoading }) {
  const [tab, setTab] = useState(() => {
    const saved = window.localStorage.getItem(TAB_STORAGE_KEY);
    return saved === "gantt" || saved === "todo" ? saved : "todo";
  }); // 'todo' | 'gantt'
  const { projects, loading: projLoading, ...projActions } = useProjects(user?.id ?? null);

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, tab);
  }, [tab]);

  const switchTab = (t) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <>
      <nav className="tab-nav">
        <div className="tab-nav-title">업무 관리</div>
        <button
          className={`tab-nav-btn${tab === "todo" ? " active" : ""}`}
          onClick={() => switchTab("todo")}
        >
          <ClipboardList size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} />
          업무 할일
        </button>
        <button
          className={`tab-nav-btn${tab === "gantt" ? " active" : ""}`}
          onClick={() => switchTab("gantt")}
        >
          <LayoutDashboard size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} />
          프로젝트
        </button>
      </nav>

      <div className={`tab-panel${tab === "todo" ? " active" : ""}`}>
        {tab === "todo" && (
          <WorkTodo
            user={user}
            onSignOut={onSignOut}
            tasks={tasks}
            taskActions={taskActions}
            loading={tasksLoading}
          />
        )}
      </div>

      <div className={`tab-panel${tab === "gantt" ? " active" : ""}`}>
        {tab === "gantt" && (
          <ProjectTimeline
            projects={projects}
            actions={projActions}
            loading={projLoading}
          />
        )}
      </div>
    </>
  );
}
