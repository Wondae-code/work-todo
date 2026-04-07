import { useState, useEffect, useRef, useCallback } from "react";
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
      {checked && <span style={{ color: "#fff", fontSize: size * 0.59, fontWeight: 700, lineHeight: 1 }}>✓</span>}
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

function SubList({ subs, taskId, onToggle, onEdit, onDel, onAdd }) {
  const ref = useRef();
  const doAdd = () => {
    if (ref.current?.value.trim()) { onAdd(taskId, ref.current.value.trim()); ref.current.value = ""; }
  };
  return (
    <div style={{ padding: "0 16px 12px 50px" }}>
      {subs.map((s) => (
        <div key={s.sid} className="sub-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
          <Check checked={s.done} size={17} onClick={() => onToggle(taskId, s.sid)} />
          <input
            value={s.text}
            onChange={(e) => onEdit(taskId, s.sid, { text: e.target.value })}
            style={{
              flex: 1, fontSize: 14, border: "none", background: "transparent",
              fontFamily: "inherit", color: "var(--ink)", outline: "none",
              ...(s.done ? { textDecoration: "line-through", color: "var(--ink3)" } : {}),
            }}
          />
          <button className="sub-del-btn" onClick={() => onDel(taskId, s.sid)} style={{
            background: "none", border: "none", color: "var(--ink3)", cursor: "pointer",
            fontSize: 16, padding: "0 4px", opacity: 0, transition: "opacity .15s",
          }}>×</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <input ref={ref} placeholder="단계 추가..." onKeyDown={(e) => e.key === "Enter" && doAdd()} style={subInputS} />
        <button onClick={doAdd} style={subBtnS}>+ 추가</button>
      </div>
    </div>
  );
}

/* ── Card ── */

function Card({ task: t, isMobile, onToggle, onUpdate, onDel, onOpenCal, onToggleSub, onEditSub, onDelSub, onAddSub }) {
  const isProj = t.type === "project";
  const priV = t.priority === 1 ? "p1" : t.priority === 2 ? "p2" : "p3";
  const subsDone = (t.subs || []).filter((s) => s.done).length;
  const subsTotal = (t.subs || []).length;
  const allSubDone = subsTotal > 0 && subsDone === subsTotal;

  return (
    <div className="task-card" style={{
      background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 14, marginBottom: 8,
      borderLeft: `4px solid ${isProj ? "var(--blue)" : "var(--green)"}`,
      opacity: t.done ? 0.5 : 1, transition: "box-shadow .15s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", flexWrap: "wrap" }}>
        <Check checked={t.done} onClick={() => onToggle(t.id)} />
        <textarea
          rows={1}
          value={t.text}
          onChange={(e) => onUpdate(t.id, { text: e.target.value })}
          onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
          style={{
            flex: 1, minWidth: 0, fontSize: 16, fontWeight: 500, lineHeight: 1.5, border: "none",
            background: "transparent", resize: "none", fontFamily: "inherit", color: "var(--ink)",
            outline: "none", overflow: "hidden", wordBreak: "break-word",
            ...(t.done ? { textDecoration: "line-through", color: "var(--ink3)" } : {}),
          }}
        />
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0, flexWrap: "wrap", ...(isMobile ? { order: 3, width: "100%", paddingLeft: 34 } : {}) }}>
          <Badge
            label={`우선순위 ${t.priority}`}
            variant={priV}
            onClick={() => onUpdate(t.id, { priority: (t.priority % 3) + 1 })}
          />
          <Badge label={isProj ? "프로젝트" : "빠른 업무"} variant={isProj ? "proj" : "quick"} />
          {isProj && subsTotal > 0 && (
            <Badge label={`${subsDone}/${subsTotal} 완료`} variant={allSubDone ? "progDone" : "prog"} />
          )}
          <button className="hover-btn" onClick={() => onOpenCal(t.id)} style={{ ...hoverBtnS, ...(isMobile ? { opacity: 1 } : {}) }}>날짜 수정</button>
          <button className="hover-btn" onClick={() => onDel(t.id)} style={{ ...hoverBtnS, ...(isMobile ? { opacity: 1 } : {}) }}>×</button>
        </div>
        {!isMobile && <>
          <button className="hover-btn" onClick={() => onOpenCal(t.id)} style={hoverBtnS}>날짜 수정</button>
          <button className="hover-btn" onClick={() => onDel(t.id)} style={hoverBtnS}>×</button>
        </>}
      </div>
      {isProj && (
        <SubList subs={t.subs || []} taskId={t.id}
          onToggle={onToggleSub} onEdit={onEditSub} onDel={onDelSub} onAdd={onAddSub} />
      )}
    </div>
  );
}

/* ── Main ── */

export default function WorkTodo({ user, onSignOut, tasks, taskActions, loading }) {
  const { addTask, updateTask, deleteTask, clearDone, addSub, updateSub, deleteSub } = taskActions;

  const [curDate, setCurDate] = useState(today);
  const [filter, setFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [addType, setAddType] = useState("quick");
  const [addPri, setAddPri] = useState(2);
  const [toast, setToast] = useState({ msg: "", visible: false });
  const [calOpen, setCalOpen] = useState(false);
  const [calTaskId, setCalTaskId] = useState(null);
  const [calYear, setCalYear] = useState(today().getFullYear());
  const [calMonth, setCalMonth] = useState(today().getMonth());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const addRef = useRef();
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
    addTask({ text, priority: addPri, type: addType, date_key: key });
    addRef.current.value = "";
  };

  const handleToggleSub = (tid, sid) => {
    const s = tasks.find((t) => t.id === tid)?.subs?.find((x) => x.sid === sid);
    if (s) updateSub(tid, sid, { done: !s.done });
  };

  const openCal = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const d = parseKey(t.date_key);
    setCalTaskId(id);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setCalOpen(true);
  };

  const pickDate = (k) => {
    if (calTaskId == null) return;
    updateTask(calTaskId, { date_key: k });
    setCalOpen(false);
    const d = diffDays(parseKey(k), td);
    if (d === 0) flash("오늘로 이동했어요");
    else if (d === 1) flash("내일로 이동했어요");
    else if (d > 1) flash(`${d}일 후로 이동했어요`);
    else flash(`${Math.abs(d)}일 전으로 이동했어요`);
  };

  const selectedKey = calTaskId != null ? tasks.find((x) => x.id === calTaskId)?.date_key : "";

  const cardProps = {
    isMobile, onToggle: handleToggle, onUpdate: updateTask, onDel: deleteTask,
    onOpenCal: openCal, onToggleSub: handleToggleSub, onEditSub: updateSub,
    onDelSub: deleteSub, onAddSub: addSub,
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
      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "28px 14px 80px" : "36px 20px 80px" }}>

        {/* Logout */}
        {user && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button onClick={onSignOut} style={{
              background: "none", border: "1px solid var(--bd)", borderRadius: 8,
              padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "var(--ink3)",
              cursor: "pointer", fontFamily: "inherit",
            }}>로그아웃</button>
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 800, letterSpacing: -0.5 }}>업무 할일</div>
          <div style={{ fontSize: isMobile ? 26 : 36, fontWeight: 800, letterSpacing: -1 }}>
            {doneCount}
            <span style={{ color: "var(--ink3)", fontWeight: 500, fontSize: isMobile ? 16 : 20, marginLeft: 2 }}>
              /{dayTasks.length}
            </span>
          </div>
        </div>

        {/* Date nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setCurDate((d) => new Date(d.getTime() - 864e5))} style={dateNavBtnS}>‹</button>
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
          <button onClick={() => setCurDate((d) => new Date(d.getTime() + 864e5))} style={dateNavBtnS}>›</button>
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
          {[["all", "전체 보기"], ["project", "프로젝트"], ["quick", "빠른 업무"]].map(([f, l]) => (
            <div key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              background: filter === f ? "var(--ink)" : "var(--sf)",
              color: filter === f ? "#fff" : "var(--ink2)",
              border: `1px solid ${filter === f ? "var(--ink)" : "var(--bd)"}`,
            }}>{l}</div>
          ))}
          <div onClick={() => setSortAsc((s) => !s)} style={{
            marginLeft: "auto", padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
            cursor: "pointer", background: "var(--sf)", color: "var(--ink2)", border: "1px solid var(--bd)", whiteSpace: "nowrap",
          }}>{sortAsc ? "우선순위 ↑" : "우선순위 ↓"}</div>
        </div>

        {/* Add box */}
        <div style={{
          background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 14,
          padding: isMobile ? 12 : "14px 16px", marginBottom: 22,
          display: "flex", gap: isMobile ? 8 : 10, alignItems: "center", flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", border: "1px solid var(--bd)", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
            {["quick", "project"].map((tp) => (
              <button key={tp} onClick={() => setAddType(tp)} style={{
                padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                background: addType === tp ? "var(--ink)" : "var(--sf)",
                color: addType === tp ? "#fff" : "var(--ink2)",
              }}>{tp === "quick" ? "빠른" : "프로젝트"}</button>
            ))}
          </div>
          <input ref={addRef} placeholder="할 일 입력..." onKeyDown={(e) => e.key === "Enter" && handleAdd()} style={{
            flex: 1, minWidth: isMobile ? 120 : 160, border: "1px solid var(--bd)", borderRadius: 8,
            padding: "8px 12px", fontSize: 15, fontFamily: "inherit", outline: "none",
          }} />
          <select value={addPri} onChange={(e) => setAddPri(+e.target.value)} style={{
            border: "1px solid var(--bd)", borderRadius: 8, padding: "6px 8px", fontSize: 13,
            fontFamily: "inherit", background: "var(--sf)", cursor: "pointer", outline: "none",
          }}>
            <option value={1}>우선순위 1</option>
            <option value={2}>우선순위 2</option>
            <option value={3}>우선순위 3</option>
          </select>
          <button onClick={handleAdd} style={{
            background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>+ 추가</button>
        </div>

        {/* Task list */}
        {!visible.length && <Empty text="이 날짜에 할 일이 없어요" />}

        {filter !== "quick" && projActive.length > 0 && (
          <>
            <SectionHeader color="var(--blue)" label="프로젝트 업무" />
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
              display: "block", margin: "16px auto 0", background: "none", border: "1px solid var(--bd)",
              borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, color: "var(--ink3)",
              cursor: "pointer", fontFamily: "inherit",
            }}>완료 항목 삭제</button>
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
    </>
  );
}

function SectionHeader({ color, label }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink3)", letterSpacing: 0.5, margin: "18px 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />{label}
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
