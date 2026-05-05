import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  Menu,
  X,
  Download,
  Upload,
  LogOut,
} from "lucide-react";
import WorkTodo from "./WorkTodo";
import ProjectTimeline from "./ProjectTimeline";
import { useProjects } from "../hooks/useProjects";

const TAB_STORAGE_KEY = "app-shell-active-tab";

function Toast({ msg, visible }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, left: "50%",
      transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
      background: "var(--ink)", color: "#fff", padding: "10px 24px", borderRadius: 12,
      fontSize: 14, fontWeight: 600, opacity: visible ? 1 : 0,
      transition: "all .3s", pointerEvents: "none", zIndex: 1000, whiteSpace: "nowrap",
    }}>{msg}</div>
  );
}

export default function AppShell({ user, onSignOut, tasks, taskActions, tasksLoading }) {
  const [tab, setTab] = useState(() => {
    const saved = window.localStorage.getItem(TAB_STORAGE_KEY);
    return saved === "gantt" || saved === "todo" ? saved : "todo";
  }); // 'todo' | 'gantt'
  const { projects, loading: projLoading, ...projActions } = useProjects(user?.id ?? null);
  const { exportTasks, importTasks } = taskActions;

  const [menuOpen, setMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [toast, setToast] = useState({ msg: "", visible: false });
  const fileRef = useRef();
  const toastTimer = useRef();

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, tab);
  }, [tab]);

  const switchTab = (t) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const flash = useCallback((msg) => {
    setToast({ msg, visible: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2000);
  }, []);

  const handleImportFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const result = await importTasks(ev.target.result);
      if (result.error) flash(result.error);
      else flash(`${result.count}개 할일을 불러왔어요`);
      setImportOpen(false);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [importTasks, flash]);

  const handleImportText = useCallback(async () => {
    if (!importText.trim()) return;
    const result = await importTasks(importText);
    if (result.error) flash(result.error);
    else flash(`${result.count}개 할일을 불러왔어요`);
    setImportText("");
    setImportOpen(false);
  }, [importText, importTasks, flash]);

  const menuItems = [
    { icon: <Download size={14} />, label: "내보내기", action: () => { exportTasks(); setMenuOpen(false); } },
    { icon: <Upload size={14} />, label: "불러오기", action: () => { setImportOpen(true); setMenuOpen(false); } },
    { icon: <LogOut size={14} />, label: "로그아웃", action: () => { onSignOut(); setMenuOpen(false); } },
  ];

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
        {user && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", position: "relative" }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="메뉴"
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,.25)",
                borderRadius: 8,
                padding: "6px 8px",
                cursor: "pointer",
                color: "rgba(255,255,255,.85)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Menu size={18} />
            </button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 6, zIndex: 999,
                  background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 12,
                  boxShadow: "0 4px 16px rgba(0,0,0,.18)", overflow: "hidden", minWidth: 160,
                }}>
                  {menuItems.map((item) => (
                    <button key={item.label} onClick={item.action} style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "10px 16px", border: "none", background: "none",
                      fontSize: 13, fontWeight: 600, color: "var(--ink2)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}>{item.icon}{item.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </nav>

      <div className={`tab-panel${tab === "todo" ? " active" : ""}`}>
        {tab === "todo" && (
          <WorkTodo
            user={user}
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

      <Toast msg={toast.msg} visible={toast.visible} />

      {importOpen && (
        <div onClick={(e) => e.target === e.currentTarget && setImportOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
        }}>
          <div style={{
            background: "var(--sf)", borderRadius: 18, padding: 24, width: 420,
            maxWidth: "90vw", boxShadow: "0 12px 40px rgba(0,0,0,.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>불러오기</div>
              <button onClick={() => setImportOpen(false)} style={{
                background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", display: "flex", alignItems: "center",
              }}><X size={20} /></button>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="JSON 문자열을 붙여넣기..."
              style={{
                width: "100%", height: 160, border: "1px solid var(--bd)", borderRadius: 10,
                padding: 12, fontSize: 13, fontFamily: "inherit", resize: "vertical",
                outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => fileRef.current?.click()} style={{
                border: "1px solid var(--bd)", background: "var(--sf)", borderRadius: 8,
                padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "var(--ink2)",
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center",
              }}><Upload size={13} style={{ marginRight: 4 }} />파일 선택</button>
              <input ref={fileRef} type="file" accept=".json" onChange={handleImportFile} style={{ display: "none" }} />
              <button onClick={handleImportText} style={{
                border: "none", background: "var(--ink)", borderRadius: 8,
                padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#fff",
                cursor: "pointer", fontFamily: "inherit",
              }}>불러오기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
