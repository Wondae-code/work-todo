import { useState, useEffect, useRef, useCallback } from "react";
import { Check as CheckIcon, X, Plus, ChevronLeft, ChevronRight, Calendar, Trash2, LogOut, Download, Upload, Menu } from "lucide-react";
import CalendarModal from "./CalendarModal";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const dk = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseKey = (k) => { const p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
const diffDays = (a, b) => Math.round((a - b) / 864e5);
const fmtDate = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/* ── Primitives ── */

function Check({ checked, size = 22, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${checked ? "var(--ink)" : "var(--bd2)"}`,
      background: checked ? "var(--ink)" : "transparent",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, transition: "all .15s",
    }}>
      {checked && <CheckIcon size={size * 0.55} color="#fff" strokeWidth={3} />}
    </div>
  );
}

const BADGE_COLORS = {
  p1: { bg: "var(--red-bg)", color: "var(--red)" },
  p2: { bg: "var(--amber-bg)", color: "var(--amber)" },
  p3: { bg: "var(--sf2)", color: "var(--ink3)" },
  proj: { bg: "var(--blue-bg)", color: "var(--blue)" },
  quick: { bg: "var(--green-bg)", color: "var(--green)" },
  prog: { bg: "var(--sf2)", color: "var(--ink3)" },
  progDone: { bg: "var(--blue-bg)", color: "var(--blue)" },
};

function Badge({ label, variant, onClick }) {
  const c = BADGE_COLORS[variant] || BADGE_COLORS.p3;
  return (
    <span onClick={onClick} style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      cursor: onClick ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap",
      background: c.bg, color: c.color,
    }}>{label}</span>
  );
}

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

/* ── SubList ── */

function SubList({ subs, taskId, onToggle, onEdit, onDel, onAdd, onOpenSubCal }) {
  const ref = useRef();
  const doAdd = () => {
    if (ref.current?.value.trim()) { onAdd(taskId, ref.current.value.trim()); ref.current.value = ""; }
  };
  const fmtDoneAt = (d) => {
    if (!d) return "";
    const p = d.split("-");
    return `${p[1]}/${p[2]}`;
  };
  return (
    <div style={{ padding: "0 16px 12px 16px" }}>
      {subs.map((s) => (
        <div key={s.sid} className="sub-row" style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0" }}>
          <div style={{ paddingTop: 2, flexShrink: 0 }}>
            <Check checked={s.done} size={17} onClick={() => onToggle(taskId, s.sid)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              rows={1}
              value={s.text}
              onChange={(e) => onEdit(taskId, s.sid, { text: e.target.value })}
              onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
              style={{
                width: "100%", fontSize: 14, border: "none", background: "transparent",
                fontFamily: "inherit", color: "var(--ink)", outline: "none",
                resize: "none", overflow: "hidden", wordBreak: "break-word", lineHeight: 1.5,
                ...(s.done ? { color: "var(--ink2)" } : {}),
              }}
            />
            {s.done && s.done_at && (
              <button onClick={() => onOpenSubCal(taskId, s.sid, s.done_at)} style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                fontSize: 11, color: "var(--ink3)", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 3, marginTop: 2,
              }}><Calendar size={10} />{fmtDoneAt(s.done_at)} 완료</button>
            )}
          </div>
          <button className="sub-del-btn" onClick={() => onDel(taskId, s.sid)} style={{
            background: "none", border: "none", color: "var(--ink3)", cursor: "pointer",
            padding: "0 4px", opacity: 0, transition: "opacity .15s", display: "flex", alignItems: "center",
          }}><X size={14} /></button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <input ref={ref} placeholder="단계 추가..." onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && doAdd()} style={subInputS} />
        <button onClick={doAdd} style={{ ...subBtnS, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={14} /></button>
      </div>
    </div>
  );
}

/* ── Card ── */

function Card({ task: t, isMobile, onToggle, onUpdate, onDel, onOpenCal, onToggleSub, onEditSub, onDelSub, onAddSub, onOpenSubCal }) {
  const isProj = t.type === "project";
  const priV = t.priority === 1 ? "p1" : t.priority === 2 ? "p2" : "p3";
  const subsDone = (t.subs || []).filter((s) => s.done).length;
  const subsTotal = (t.subs || []).length;
  const allSubDone = subsTotal > 0 && subsDone === subsTotal;

  return (
    <div className="task-card" style={{
      background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 14, marginBottom: 8,
      opacity: t.done ? 0.5 : 1, transition: "box-shadow .15s",
    }}>
      {/* Row 1: check + title + delete */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px 0 16px" }}>
        <div style={{ paddingTop: 1, flexShrink: 0 }}><Check checked={t.done} onClick={() => onToggle(t.id)} /></div>
        <textarea
          rows={1}
          value={t.text}
          onChange={(e) => onUpdate(t.id, { text: e.target.value })}
          onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
          ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
          style={{
            flex: 1, minWidth: 0, fontSize: 16, fontWeight: 500, lineHeight: 1.5, border: "none",
            background: "transparent", resize: "none", fontFamily: "inherit", color: "var(--ink)",
            outline: "none", overflow: "hidden", wordBreak: "break-word",
            ...(t.done ? { color: "var(--ink2)" } : {}),
          }}
        />
        <button onClick={() => onDel(t.id)} style={{
          flexShrink: 0, border: "1px solid var(--red-bg)", background: "var(--red-bg)", borderRadius: 8,
          padding: "3px 8px", color: "var(--red)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}><X size={14} /></button>
      </div>
      {/* Row 2: badges + actions */}
      <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", padding: "8px 16px 14px 16px" }}>
        <Badge
          label={t.priority === 1 ? "높음" : t.priority === 2 ? "중간" : "낮음"}
          variant={priV}
          onClick={() => onUpdate(t.id, { priority: (t.priority % 3) + 1 })}
        />
        <Badge label={isProj ? "업무" : "빠른 업무"} variant={isProj ? "proj" : "quick"} />
        {isProj && subsTotal > 0 && (
          <Badge label={`${subsDone}/${subsTotal} 완료`} variant={allSubDone ? "progDone" : "prog"} />
        )}
        <button onClick={() => onOpenCal(t.id)} style={{
          border: "1px solid var(--bd)", background: "var(--sf)", borderRadius: 8,
          padding: "3px 10px", fontSize: 11, fontWeight: 600, color: "var(--ink2)",
          cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center",
        }}><Calendar size={12} style={{ marginRight: 4 }} />날짜 수정</button>
      </div>
      {isProj && (
        <SubList subs={t.subs || []} taskId={t.id}
          onToggle={onToggleSub} onEdit={onEditSub} onDel={onDelSub} onAdd={onAddSub} onOpenSubCal={onOpenSubCal} />
      )}
    </div>
  );
}

/* ── Main ── */

export default function WorkTodo({ user, onSignOut, tasks, taskActions, loading }) {
  const { addTask, updateTask, deleteTask, clearDone, addSub, updateSub, deleteSub, exportTasks, importTasks } = taskActions;

  const [curDate, setCurDate] = useState(today);
  const [filter, setFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [addType, setAddType] = useState("quick");
  const [addPri, setAddPri] = useState(2);
  /* Default add-target follows the currently viewed date so navigating to
     another day lets you add tasks to THAT day without reopening the
     calendar. User can still override via the calendar button. */
  const [addDate, setAddDate] = useState(dk(today()));
  useEffect(() => { setAddDate(dk(curDate)); }, [curDate]);
  const [toast, setToast] = useState({ msg: "", visible: false });
  const [calOpen, setCalOpen] = useState(false);
  const [calMode, setCalMode] = useState("edit"); // "edit" | "add" | "sub"
  const [calTaskId, setCalTaskId] = useState(null);
  const [calSubId, setCalSubId] = useState(null);
  const [calYear, setCalYear] = useState(today().getFullYear());
  const [calMonth, setCalMonth] = useState(today().getMonth());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const addRef = useRef();
  const fileRef = useRef();
  const toastTimer = useRef();

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") setCalOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

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

  /* ── Derived state ── */
  const key = dk(curDate);
  const td = today();
  const diff = diffDays(curDate, td);
  const dayTasks = tasks.filter((t) => t.date_key === key);
  const doneCount = dayTasks.filter((t) => t.done).length;
  const pct = dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0;

  const visible = dayTasks.filter((t) => filter === "all" || t.type === filter);
  const sortFn = (a, b) => (sortAsc ? a.priority - b.priority : b.priority - a.priority);
  const active = visible.filter((t) => !t.done);
  const done = visible.filter((t) => t.done);
  const projActive = active.filter((t) => t.type === "project").sort(sortFn);
  const quickActive = active.filter((t) => t.type === "quick").sort(sortFn);

  /* ── Handlers ── */
  const handleToggle = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (t) updateTask(id, { done: !t.done });
  };

  const handleAdd = () => {
    const text = addRef.current?.value.trim();
    if (!text) return;
    addTask({ text, priority: addPri, type: addType, date_key: addDate });
    addRef.current.value = "";
  };

  const handleToggleSub = (tid, sid) => {
    const s = tasks.find((t) => t.id === tid)?.subs?.find((x) => x.sid === sid);
    if (s) {
      const newDone = !s.done;
      updateSub(tid, sid, { done: newDone, done_at: newDone ? dk(today()) : null });
    }
  };

  const openCal = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const d = parseKey(t.date_key);
    setCalMode("edit");
    setCalTaskId(id);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setCalOpen(true);
  };

  const openAddCal = () => {
    const d = parseKey(addDate);
    setCalMode("add");
    setCalTaskId(null);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setCalOpen(true);
  };

  const openSubCal = (tid, sid, doneAt) => {
    const d = doneAt ? parseKey(doneAt) : today();
    setCalMode("sub");
    setCalTaskId(tid);
    setCalSubId(sid);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setCalOpen(true);
  };

  const pickDate = (k) => {
    if (calMode === "add") {
      setAddDate(k);
      setCalOpen(false);
      return;
    }
    if (calMode === "sub") {
      updateSub(calTaskId, calSubId, { done_at: k });
      setCalOpen(false);
      return;
    }
    if (calTaskId == null) return;
    updateTask(calTaskId, { date_key: k });
    setCalOpen(false);
    const d = diffDays(parseKey(k), td);
    if (d === 0) flash("오늘로 이동했어요");
    else if (d === 1) flash("내일로 이동했어요");
    else if (d > 1) flash(`${d}일 후로 이동했어요`);
    else flash(`${Math.abs(d)}일 전으로 이동했어요`);
  };

  const selectedKey = calMode === "add" ? addDate
    : calMode === "sub" ? (tasks.find((x) => x.id === calTaskId)?.subs?.find((s) => s.sid === calSubId)?.done_at || "")
    : (calTaskId != null ? tasks.find((x) => x.id === calTaskId)?.date_key : "");

  const cardProps = {
    isMobile, onToggle: handleToggle, onUpdate: updateTask, onDel: deleteTask,
    onOpenCal: openCal, onToggleSub: handleToggleSub, onEditSub: updateSub,
    onDelSub: deleteSub, onAddSub: addSub, onOpenSubCal: openSubCal,
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "var(--ink3)", fontSize: 16 }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "28px 16px 80px" : "36px 20px 80px" }}>

        {/* Hamburger menu */}
        {user && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10, position: "relative" }}>
            <button onClick={() => setMenuOpen((v) => !v)} style={{
              background: "none", border: "1px solid var(--bd)", borderRadius: 8,
              padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center",
              color: "var(--ink2)",
            }}><Menu size={18} /></button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 999,
                  background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 12,
                  boxShadow: "0 4px 16px rgba(0,0,0,.1)", overflow: "hidden", minWidth: 160,
                }}>
                  {[
                    { icon: <Download size={14} />, label: "내보내기", action: () => { exportTasks(); setMenuOpen(false); } },
                    { icon: <Upload size={14} />, label: "불러오기", action: () => { setImportOpen(true); setMenuOpen(false); } },
                    { icon: <LogOut size={14} />, label: "로그아웃", action: () => { onSignOut(); setMenuOpen(false); } },
                  ].map((item) => (
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

        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: -0.5 }}>업무 할일</div>
          <div style={{ fontSize: isMobile ? 26 : 36, fontWeight: 800, letterSpacing: -1 }}>
            {doneCount}
            <span style={{ color: "var(--ink3)", fontWeight: 500, fontSize: isMobile ? 16 : 20, marginLeft: 2 }}>
              /{dayTasks.length}
            </span>
          </div>
        </div>

        {/* Date nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setCurDate((d) => new Date(d.getTime() - 864e5))} style={dateNavBtnS}><ChevronLeft size={18} /></button>
          <div>
            <span style={{ fontSize: 17, fontWeight: 600, margin: "0 4px" }}>{fmtDate(curDate)}</span>
            <span style={{
              fontSize: 12, fontWeight: 600, borderRadius: 20, padding: "2px 10px",
              background: diff === 0 ? "var(--ink)" : diff > 0 ? "var(--blue-bg)" : "var(--sf2)",
              color: diff === 0 ? "#fff" : diff > 0 ? "var(--blue)" : "var(--ink3)",
            }}>{diff === 0 ? "오늘" : diff > 0 ? `+${diff}일` : `${diff}일`}</span>
          </div>
          {diff !== 0 && (
            <button onClick={() => setCurDate(today())} style={{ ...dateNavBtnS, width: "auto", padding: "0 14px", fontSize: 13, fontWeight: 600 }}>오늘</button>
          )}
          <button onClick={() => setCurDate((d) => new Date(d.getTime() + 864e5))} style={dateNavBtnS}><ChevronRight size={18} /></button>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 6, background: "var(--sf2)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "var(--ink)", borderRadius: 6, transition: "width .3s", width: pct + "%" }} />
          </div>
          <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 5 }}>
            {dayTasks.length ? `${pct}% 완료 (${doneCount}/${dayTasks.length})` : "할 일이 없어요"}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          {[["all", "전체 보기"], ["project", "업무"], ["quick", "빠른 업무"]].map(([f, l]) => (
            <div key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              background: filter === f ? "var(--ink)" : "var(--sf)",
              color: filter === f ? "#fff" : "var(--ink2)",
              border: `1px solid ${filter === f ? "var(--ink)" : "var(--bd)"}`,
            }}>{l}</div>
          ))}
        </div>

        {/* Add box */}
        <div style={{
          background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 14,
          padding: isMobile ? 12 : "14px 16px", marginBottom: 22,
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {/* Row 1: type, priority, date */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", border: "1px solid var(--bd)", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
              {["quick", "project"].map((tp) => (
                <button key={tp} onClick={() => setAddType(tp)} style={{
                  padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  background: addType === tp ? "var(--ink)" : "var(--sf)",
                  color: addType === tp ? "#fff" : "var(--ink2)",
                }}>{tp === "quick" ? "빠른" : "업무"}</button>
              ))}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", marginLeft: "auto" }}>우선순위</span>
            <select value={addPri} onChange={(e) => setAddPri(+e.target.value)} style={{
              border: "1px solid var(--bd)", borderRadius: 8, padding: "6px 8px", fontSize: 13,
              fontFamily: "inherit", background: "var(--sf)", cursor: "pointer", outline: "none",
            }}>
              <option value={1}>높음</option>
              <option value={2}>중간</option>
              <option value={3}>낮음</option>
            </select>
            <button onClick={openAddCal} style={{
              border: "1px solid var(--bd)", borderRadius: 8,
              padding: "6px 12px", cursor: "pointer",
              background: "var(--sf)", color: "var(--ink2)",
              display: "flex", alignItems: "center",
            }}><Calendar size={13} /></button>
          </div>
          {/* Row 2: input, add button */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input ref={addRef} placeholder="할 일 입력..." onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleAdd()} style={{
              flex: 1, border: "1px solid var(--bd)", borderRadius: 8,
              padding: "8px 12px", fontSize: 15, fontFamily: "inherit", outline: "none",
            }} />
            <button onClick={handleAdd} style={{
              background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10,
              width: 36, height: 36, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><Plus size={20} /></button>
          </div>
        </div>

        {/* Task list */}
        {!visible.length && <Empty text="이 날짜에 할 일이 없어요" />}

        {filter !== "quick" && projActive.length > 0 && (
          <>
            <SectionHeader color="var(--blue)" label="업무" right={
              <div onClick={() => setSortAsc((s) => !s)} style={{
                padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: "pointer", background: "var(--sf)", color: "var(--ink2)", border: "1px solid var(--bd)", whiteSpace: "nowrap",
              }}>{sortAsc ? "우선순위 ↑" : "우선순위 ↓"}</div>
            } />
            {projActive.map((t) => <Card key={t.id} task={t} {...cardProps} />)}
          </>
        )}

        {filter !== "project" && quickActive.length > 0 && (
          <>
            <SectionHeader color="var(--green)" label="빠른 업무" />
            {quickActive.map((t) => <Card key={t.id} task={t} {...cardProps} />)}
          </>
        )}

        {done.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 10px", color: "var(--ink3)", fontSize: 13, fontWeight: 600 }}>
              <span style={{ flex: 1, height: 1, background: "var(--bd)" }} />완료 {done.length}건<span style={{ flex: 1, height: 1, background: "var(--bd)" }} />
            </div>
            {done.map((t) => <Card key={t.id} task={t} {...cardProps} />)}
            <button onClick={() => clearDone(key)} style={{
              display: "flex", alignItems: "center", justifyContent: "center", margin: "16px auto 0",
              background: "none", border: "1px solid var(--bd)", borderRadius: 8, padding: "8px 20px",
              fontSize: 13, fontWeight: 600, color: "var(--ink3)", cursor: "pointer", fontFamily: "inherit",
            }}><Trash2 size={13} style={{ marginRight: 4 }} />완료 항목 삭제</button>
          </>
        )}

        {visible.length > 0 && !projActive.length && !quickActive.length && !done.length && (
          <Empty text="필터에 해당하는 할 일이 없어요" />
        )}
      </div>

      <Toast msg={toast.msg} visible={toast.visible} />
      <CalendarModal
        show={calOpen} onClose={() => setCalOpen(false)} selectedKey={selectedKey}
        onPick={pickDate} calYear={calYear} calMonth={calMonth}
        setCalYear={setCalYear} setCalMonth={setCalMonth}
      />

      {/* Import modal */}
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

function SectionHeader({ color, label, right }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink3)", letterSpacing: 0.5, margin: "18px 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />{label}
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ textAlign: "center", padding: "40px 0", color: "var(--ink3)", fontSize: 15 }}>{text}</div>;
}

/* ── Shared styles ── */
const dateNavBtnS = {
  background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 8, width: 36, height: 36,
  fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink2)",
};
const hoverBtnS = {
  opacity: 0, border: "1px solid var(--bd)", background: "var(--sf)", borderRadius: 8,
  padding: "3px 10px", fontSize: 11, fontWeight: 600, color: "var(--ink2)",
  cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
};
const subInputS = {
  flex: 1, border: "1px solid var(--bd)", borderRadius: 8, padding: "5px 10px",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};
const subBtnS = {
  background: "var(--sf2)", border: "1px solid var(--bd)", borderRadius: 8,
  padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", color: "var(--ink2)",
};
