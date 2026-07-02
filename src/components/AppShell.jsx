import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  Menu,
  X,
  Download,
  Upload,
  LogOut,
  Bell,
  Trash2,
} from "lucide-react";
import WorkTodo from "./WorkTodo";
import ProjectTimeline from "./ProjectTimeline";
import { useProjects } from "../hooks/useProjects";
import { useAlarms, fmtAlarm } from "../hooks/useAlarms";

const TAB_STORAGE_KEY = "app-shell-active-tab";
const NOTIF_HISTORY_KEY = "work_alarm_history_v1";

/* ── 알림함 이력 (localStorage, 최근 50건) ── */
function loadNotifHistory() {
  try {
    const raw = localStorage.getItem(NOTIF_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/* 알림 발생 시각 라벨 — "방금 전" / "n분 전" / "n시간 전" / "M/D" */
function fmtAgo(at) {
  const diff = Date.now() - at;
  if (diff < 60e3) return "방금 전";
  if (diff < 3600e3) return `${Math.floor(diff / 60e3)}분 전`;
  if (diff < 86400e3) return `${Math.floor(diff / 3600e3)}시간 전`;
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* 상단 네비 우측 아이콘 버튼 (알림/메뉴 공용) */
const navIconBtnS = {
  position: "relative",
  background: "none",
  border: "1px solid rgba(255,255,255,.25)",
  borderRadius: 8,
  padding: "6px 8px",
  cursor: "pointer",
  color: "rgba(255,255,255,.85)",
  display: "flex",
  alignItems: "center",
};

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

  /* ── 알림함 + 발화 엔진 (탭 어디서든 동작하도록 셸 레벨에 둔다) ── */
  const [notifs, setNotifs] = useState(loadNotifHistory);
  const [notifOpen, setNotifOpen] = useState(false);
  const [popups, setPopups] = useState([]); // 화면 상단에 잠깐 뜨는 팝업

  useEffect(() => {
    localStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(notifs));
  }, [notifs]);

  /* 설정 시각 도달 시: 알림함 적재 + 인앱 팝업 + (권한 있으면) OS 알림.
     Notification API는 브라우저를 통해 OS 알림 센터로 전달된다 —
     탭이 백그라운드여도 뜨지만, 브라우저가 완전히 종료되면 오지 않는다. */
  useAlarms(tasks, useCallback((t) => {
    const item = {
      id: `${t.id}:${t.date_key}:${t.alarm_hour}`,
      text: t.text, hour: t.alarm_hour, at: Date.now(), read: false,
    };
    setNotifs((prev) => [item, ...prev.filter((n) => n.id !== item.id)].slice(0, 50));
    setPopups((prev) => [...prev, item]);
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification("업무 알림", {
        body: `${fmtAlarm(t.alarm_hour)} · ${t.text}`,
        tag: `work-todo-alarm-${item.id}`, // 같은 알림 중복 배너 방지
      });
      n.onclick = () => { window.focus(); n.close(); };
    }
  }, []));

  const unreadCount = notifs.filter((n) => !n.read).length;

  const toggleNotifs = () => {
    setNotifOpen((v) => {
      // 열 때 모두 읽음 처리
      if (!v) setNotifs((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
      return !v;
    });
  };

  const dismissPopup = (id) => setPopups((prev) => prev.filter((p) => p.id !== id));

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
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* 알림함 */}
          <div style={{ position: "relative" }}>
            <button onClick={toggleNotifs} aria-label="알림" style={navIconBtnS}>
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: "absolute", top: -5, right: -5,
                  minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8,
                  background: "var(--red, #E5484D)", color: "#fff",
                  fontSize: 10, fontWeight: 700, lineHeight: "16px", textAlign: "center",
                  boxSizing: "border-box",
                }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>
            {notifOpen && (
              <>
                <div onClick={() => setNotifOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 6, zIndex: 999,
                  background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 12,
                  boxShadow: "0 4px 16px rgba(0,0,0,.18)", overflow: "hidden",
                  width: 320, maxWidth: "calc(100vw - 24px)",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", borderBottom: "1px solid var(--bd)",
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>알림</span>
                    {notifs.length > 0 && (
                      <button onClick={() => setNotifs([])} style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 600, color: "var(--ink3)", fontFamily: "inherit",
                      }}><Trash2 size={12} />비우기</button>
                    )}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {notifs.length === 0 && (
                      <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "var(--ink3)" }}>
                        알림이 없어요
                      </div>
                    )}
                    {notifs.map((n) => (
                      <div key={n.id} onClick={() => { switchTab("todo"); setNotifOpen(false); }} style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        padding: "12px 16px", cursor: "pointer",
                        borderBottom: "1px solid var(--bd)",
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          background: "var(--amber-bg)", color: "var(--amber)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}><Bell size={13} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", wordBreak: "break-word" }}>{n.text}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)", marginTop: 2 }}>
                            {fmtAlarm(n.hour)} 알림 · {fmtAgo(n.at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 메뉴 (로그인 시) */}
          {user && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuOpen((v) => !v)} aria-label="메뉴" style={navIconBtnS}>
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
        </div>
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

      {/* 알림 도착 팝업 (상단 중앙 스택) */}
      {popups.length > 0 && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 1001, display: "flex", flexDirection: "column", gap: 8,
          width: "min(400px, calc(100vw - 32px))",
        }}>
          {popups.map((a) => (
            <div key={a.id} onClick={() => { switchTab("todo"); dismissPopup(a.id); }} style={{
              background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 14,
              padding: "14px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.18)",
              display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "var(--amber-bg)", color: "var(--amber)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Bell size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", marginBottom: 2 }}>
                  {fmtAlarm(a.hour)} 업무 알림
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-word" }}>{a.text}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); dismissPopup(a.id); }} style={{
                background: "none", border: "none", cursor: "pointer", color: "var(--ink3)",
                padding: 2, display: "flex", alignItems: "center", flexShrink: 0,
              }}><X size={16} /></button>
            </div>
          ))}
        </div>
      )}

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
              spellCheck={false}
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
