import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, Trash2, Check as CheckIcon, X } from "lucide-react";
import AddProjectModal from "./AddProjectModal";

/* ── Pastel palette
   Tones tuned from the reference swatch the user supplied. `main` drives
   the timeline line/dot color + card accent; `light` / `text` are soft
   variants for surfaces and readable labels. */
const PAL = {
  coral:     { main: "#FFA1A1", light: "#FFE4E4", text: "#B04040", label: "코랄" },
  sky:       { main: "#64D9F3", light: "#C6F0F8", text: "#0A7A94", label: "스카이" },
  lilac:     { main: "#D8A0EE", light: "#EFDFF6", text: "#8A4FB0", label: "라일락" },
  mint:      { main: "#C0E1D2", light: "#E4F3EB", text: "#3A7858", label: "민트" },
  taupe:     { main: "#A98B76", light: "#E5DBD1", text: "#6B503D", label: "토프" },
  lavender:  { main: "#9B8EC7", light: "#DDD7ED", text: "#5A4E88", label: "라벤더" },
  peach:     { main: "#F2A65A", light: "#FBE2CD", text: "#A55A18", label: "피치" },
};
const PAL_KEYS = Object.keys(PAL);
const randomPalKey = () => PAL_KEYS[Math.floor(Math.random() * PAL_KEYS.length)];
/* Stable fallback for projects saved under legacy pal keys — derive a pastel
   from the project id so the color stays the same across reloads. */
const palByHash = (id) => PAL_KEYS[Math.abs(Number(id) || 0) % PAL_KEYS.length];
const resolvePal = (project) => PAL[project.pal] || PAL[palByHash(project.id)];

/* ── Date helpers (DST-safe) ── */
const pad = (n) => String(n).padStart(2, "0");
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pk = (k) => { const [y, m, d] = k.split("-"); return new Date(+y, +m - 1, +d); };
const addD = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const tod = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const fmtKo = (k) => { const [, m, d] = k.split("-"); return `${+m}/${+d}`; };
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/* ── Timeline constants (match Figma) ── */
const DAY_WIDTH = 81;
const ROW_HEIGHT = 70;
const DATE_HEADER_HEIGHT = 50;
const DOT_SIZE = 16;
const LINE_THICKNESS = 2;
const EXTEND_DAYS = 120;    /* days appended/prepended per scroll-edge hit */
const EDGE_BUFFER_PX = 3 * DAY_WIDTH;

/* ══════════════════════════════════════════════════════════
   Main
   ══════════════════════════════════════════════════════════ */
export default function ProjectTimeline({ projects, actions, loading }) {
  const { addProject, updateProject, deleteProject, addSub, updateSub, deleteSub } = actions;
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="pt-wrap">
      <AddProjectModal
        show={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={({ text, start, end }) => addProject({ text, start, end, pal: randomPalKey() })}
      />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16,
      }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>프로젝트</div>
        <button
          onClick={() => setAddOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", border: "none", borderRadius: 10,
            background: "var(--ink)", color: "#fff",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          <Plus size={15} /> 새 프로젝트
        </button>
      </div>

      {loading ? (
        <div style={{ color: "var(--ink3)", padding: 40, textAlign: "center" }}>로딩 중...</div>
      ) : (
        <>
          <TimelineTrack
            projects={projects}
            onUpdateProject={updateProject}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onUpdate={(updates) => updateProject(p.id, updates)}
                onDelete={() => {
                  if (window.confirm(`"${p.text}" 프로젝트를 삭제할까요?`)) deleteProject(p.id);
                }}
                onAddSub={(text) => addSub(p.id, text)}
                onUpdateSub={(sid, updates) => updateSub(p.id, sid, updates)}
                onDeleteSub={(sid) => deleteSub(p.id, sid)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Timeline (horizontal, infinite scroll)
   ══════════════════════════════════════════════════════════ */
function TimelineTrack({ projects, onUpdateProject }) {
  /* Range is open-ended: we grow it at either edge as the user scrolls.
     To avoid a scroll-position jump when PREPENDING, we apply a matching
     scrollLeft offset in a useLayoutEffect before the browser paints. */
  const [rangeStart, setRangeStart] = useState(() => addD(tod(), -120));
  const [rangeDays, setRangeDays] = useState(400);

  const scrollRef = useRef(null);
  const adjustingRef = useRef(false);      // suppress scroll-handler while we're the one moving scrollLeft
  const pendingAdjustRef = useRef(0);      // px to add to scrollLeft after next render
  const initialScrolledRef = useRef(false);

  const todayK = dk(tod());
  const totalWidth = rangeDays * DAY_WIDTH;

  /* Initial scroll: center today horizontally — only once. */
  useLayoutEffect(() => {
    if (initialScrolledRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const x = daysBetween(rangeStart, tod()) * DAY_WIDTH;
    adjustingRef.current = true;
    el.scrollLeft = Math.max(0, x - el.clientWidth / 2);
    requestAnimationFrame(() => { adjustingRef.current = false; });
    initialScrolledRef.current = true;
  }, [rangeStart]);

  /* Apply pending scroll adjustment (after a prepend) */
  useLayoutEffect(() => {
    if (!pendingAdjustRef.current || !scrollRef.current) return;
    adjustingRef.current = true;
    scrollRef.current.scrollLeft += pendingAdjustRef.current;
    pendingAdjustRef.current = 0;
    requestAnimationFrame(() => { adjustingRef.current = false; });
  });

  const onScroll = (e) => {
    if (adjustingRef.current) return;
    const sl = e.target.scrollLeft;
    const cw = e.target.clientWidth;
    if (sl < EDGE_BUFFER_PX) {
      pendingAdjustRef.current = EXTEND_DAYS * DAY_WIDTH;
      setRangeStart((prev) => addD(prev, -EXTEND_DAYS));
      setRangeDays((d) => d + EXTEND_DAYS);
    } else if (sl + cw > totalWidth - EDGE_BUFFER_PX) {
      setRangeDays((d) => d + EXTEND_DAYS);
    }
  };

  return (
    <div className="pt-timeline" ref={scrollRef} onScroll={onScroll}>
      <div className="pt-track" style={{ width: totalWidth }}>
        <DateHeader rangeStart={rangeStart} rangeDays={rangeDays} todayK={todayK} />
        <div className="pt-body" style={{ position: "relative" }}>
          {projects.map((p, i) => (
            <TimelineRow
              key={p.id}
              project={p}
              rangeStart={rangeStart}
              rowIndex={i}
              onUpdate={(upd) => onUpdateProject(p.id, upd)}
              scrollRef={scrollRef}
            />
          ))}
          {projects.length === 0 && (
            <div style={{
              padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 13,
            }}>
              프로젝트를 추가하면 타임라인이 표시됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Date header (ruler: text above, horizontal line with tick marks)
   Matches Figma: no column borders, no column background.
   ══════════════════════════════════════════════════════════ */
function DateHeader({ rangeStart, rangeDays, todayK }) {
  const labels = [];
  const ticks = [];
  for (let i = 0; i < rangeDays; i++) {
    const d = addD(rangeStart, i);
    const k = dk(d);
    const wd = d.getDay();
    const isToday = k === todayK;
    const centerX = i * DAY_WIDTH + DAY_WIDTH / 2;
    const color = isToday ? "var(--blue)"
      : wd === 0 ? "#B33030"
      : wd === 6 ? "var(--blue)"
      : "var(--ink2)";
    labels.push(
      <div key={k} style={{
        position: "absolute",
        left: centerX, top: 8,
        transform: "translateX(-50%)",
        textAlign: "center",
        color,
        fontWeight: isToday ? 800 : 500,
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}>
        <div style={{ fontSize: 12, lineHeight: 1.2 }}>{`${d.getMonth() + 1}/${d.getDate()}`}</div>
        <div style={{ fontSize: 11, lineHeight: 1.2 }}>{WEEKDAY[wd]}</div>
      </div>
    );
    ticks.push(
      <div key={`t-${k}`} style={{
        position: "absolute",
        left: centerX - 0.5,
        /* Ticks extend UPWARD from the main line (Figma: ticks at y=82–89,
           line at y=89). Bottom aligned = share the line's bottom pixel. */
        bottom: 0,
        width: 1, height: 7,
        background: isToday ? "var(--blue)" : "var(--bd2)",
      }} />
    );
  }
  return (
    <div className="pt-date-header" style={{ height: DATE_HEADER_HEIGHT }}>
      {labels}
      {/* main horizontal line at the very bottom of the ruler */}
      <div style={{
        position: "absolute",
        left: 0, right: 0, bottom: 0,
        height: 1,
        background: "var(--bd2)",
      }} />
      {ticks}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   A single project row — line + dots + label + drag handles
   ══════════════════════════════════════════════════════════ */
function TimelineRow({ project, rangeStart, rowIndex, onUpdate, scrollRef }) {
  const pal = resolvePal(project);
  const startD = pk(project.start);
  const endD = pk(project.end);

  /* x coordinates (center-of-day). Each row is its own relative-positioned
     container, so children's top is in row-local coords (not pt-body coords).
     rowIndex is kept only for debugging / future use. */
  void rowIndex;
  const startX = daysBetween(rangeStart, startD) * DAY_WIDTH + DAY_WIDTH / 2;
  const endX = daysBetween(rangeStart, endD) * DAY_WIDTH + DAY_WIDTH / 2;
  const lineY = ROW_HEIGHT / 2;

  /* Intermediate dots — one per subtask.
     Position = subtask.deadline on the shared day axis when set; otherwise
     fall back to an even split between start and end. A dot is filled when
     the subtask is done; hollow otherwise. */
  const midDots = project.subs.map((s, i) => {
    const x = s.deadline
      ? daysBetween(rangeStart, pk(s.deadline)) * DAY_WIDTH + DAY_WIDTH / 2
      : startX + (endX - startX) * ((i + 1) / (project.subs.length + 1));
    return { sid: s.sid, x, done: s.done };
  });

  /* ── Drag state ──
     mode: 'start' | 'end' | 'move'
     Work in scroll-container coordinates (element bbox + scrollLeft) so the
     drag stays correct even as the user scrolls mid-drag. */
  const dragRef = useRef(null);

  const beginDrag = (mode, e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      origStart: startD,
      origEnd: endD,
      startClientX: e.clientX,
    };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  };

  const onDragMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const deltaDays = Math.round((e.clientX - d.startClientX) / DAY_WIDTH);
    if (d.mode === "start") {
      const newStart = addD(d.origStart, deltaDays);
      if (newStart <= d.origEnd) onUpdate({ start: dk(newStart) });
    } else if (d.mode === "end") {
      const newEnd = addD(d.origEnd, deltaDays);
      if (newEnd >= d.origStart) onUpdate({ end: dk(newEnd) });
    } else if (d.mode === "move") {
      onUpdate({
        start: dk(addD(d.origStart, deltaDays)),
        end: dk(addD(d.origEnd, deltaDays)),
      });
    }
  };

  const onDragEnd = () => {
    dragRef.current = null;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  };

  return (
    <div className="pt-row" style={{ height: ROW_HEIGHT, position: "relative" }}>
      {/* Line */}
      <div
        onMouseDown={(e) => beginDrag("move", e)}
        style={{
          position: "absolute",
          left: startX, width: endX - startX,
          top: lineY - LINE_THICKNESS / 2,
          height: LINE_THICKNESS,
          background: pal.main,
          cursor: "grab",
          zIndex: 2,
        }}
      />

      {/* Start dot (filled) */}
      <Dot
        x={startX} y={lineY}
        color={pal.main}
        filled
        onMouseDown={(e) => beginDrag("start", e)}
        cursor="ew-resize"
      />

      {/* Intermediate (subtask) dots */}
      {midDots.map((d) => (
        <Dot key={d.sid} x={d.x} y={lineY} color={pal.main} filled={d.done} />
      ))}

      {/* End dot (filled) */}
      <Dot
        x={endX} y={lineY}
        color={pal.main}
        filled
        onMouseDown={(e) => beginDrag("end", e)}
        cursor="ew-resize"
      />

      {/* Label — below the line, left-aligned to start */}
      <div style={{
        position: "absolute",
        left: startX + 10,
        top: lineY + DOT_SIZE / 2 + 4,
        fontSize: 13,
        fontWeight: 700,
        color: project.done ? "var(--ink3)" : "var(--ink)",
        textDecoration: project.done ? "line-through" : "none",
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}>
        {project.text}
      </div>
    </div>
  );
}

function Dot({ x, y, color, filled, onMouseDown, cursor }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        left: x - DOT_SIZE / 2,
        top: y - DOT_SIZE / 2,
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        background: filled ? color : "#fff",
        cursor: cursor || "default",
        zIndex: 3,
        boxSizing: "border-box",
      }}
    />
  );
}

/* ══════════════════════════════════════════════════════════
   Project card (bottom list) — unchanged from before
   ══════════════════════════════════════════════════════════ */
function Check({ checked, size = 20, onClick }) {
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

function ProjectCard({ project, onUpdate, onDelete, onAddSub, onUpdateSub, onDeleteSub }) {
  const pal = resolvePal(project);
  const subAddRef = useRef(null);
  const [editingSid, setEditingSid] = useState(null);

  const doneCount = project.subs.filter((s) => s.done).length;
  const total = project.subs.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const submitAddSub = () => {
    const v = subAddRef.current?.value.trim();
    if (!v) return;
    onAddSub(v);
    subAddRef.current.value = "";
  };

  return (
    <div className="task-card" style={{
      background: "var(--sf)",
      border: "1px solid var(--bd)",
      borderLeft: `4px solid ${pal.main}`,
      borderRadius: 14,
      padding: 14,
      opacity: project.done ? 0.6 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Check checked={project.done} size={22} onClick={() => onUpdate({ done: !project.done })} />
        <input
          type="text"
          defaultValue={project.text}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== project.text) onUpdate({ text: v });
            else e.target.value = project.text;
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          style={{
            flex: 1, fontFamily: "inherit", fontSize: 15, fontWeight: 700,
            border: "none", background: "transparent", outline: "none",
            color: "var(--ink)",
            textDecoration: project.done ? "line-through" : "none",
          }}
        />
        <button
          className="hover-btn"
          onClick={onDelete}
          style={{
            border: "none", background: "none", cursor: "pointer", color: "var(--ink3)",
            padding: 4, display: "flex", alignItems: "center",
          }}
          title="프로젝트 삭제"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
        fontSize: 12, color: "var(--ink2)", marginBottom: 10,
      }}>
        <input type="date" value={project.start} onChange={(e) => onUpdate({ start: e.target.value })} style={dateInputS} />
        <span style={{ color: "var(--ink3)" }}>—</span>
        <input type="date" value={project.end} onChange={(e) => onUpdate({ end: e.target.value })} style={dateInputS} />
        <select
          value={project.pal}
          onChange={(e) => onUpdate({ pal: e.target.value })}
          style={{
            border: "1px solid var(--bd)", borderRadius: 6, padding: "3px 6px",
            fontSize: 12, fontFamily: "inherit", background: "var(--sf)",
            color: "var(--ink2)", cursor: "pointer", outline: "none",
          }}
        >
          {Object.entries(PAL).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {total > 0 && (
          <span style={{ marginLeft: "auto", fontWeight: 600 }}>
            {doneCount}/{total} ({pct}%)
          </span>
        )}
      </div>

      {total > 0 && (
        <div style={{ height: 4, background: "var(--sf2)", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pal.main, borderRadius: 4, transition: "width .3s" }} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {project.subs.map((s) => (
          <div key={s.sid} className="sub-row" style={{
            display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
          }}>
            <Check
              size={16}
              checked={s.done}
              onClick={() => onUpdateSub(s.sid, {
                done: !s.done,
                done_at: !s.done ? dk(new Date()) : null,
              })}
            />
            {editingSid === s.sid ? (
              <input
                autoFocus
                defaultValue={s.text}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.text) onUpdateSub(s.sid, { text: v });
                  setEditingSid(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingSid(null);
                }}
                style={{
                  flex: 1, fontFamily: "inherit", fontSize: 13,
                  border: "1px solid var(--bd2)", borderRadius: 6,
                  padding: "3px 6px", outline: "none",
                }}
              />
            ) : (
              <span
                onClick={() => setEditingSid(s.sid)}
                style={{
                  flex: 1, fontSize: 13,
                  color: s.done ? "var(--ink3)" : "var(--ink)",
                  textDecoration: s.done ? "line-through" : "none",
                  cursor: "text",
                }}
              >
                {s.text}
                {s.done && s.done_at && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "var(--ink3)" }}>
                    {fmtKo(s.done_at)}
                  </span>
                )}
              </span>
            )}
            {/* Deadline — positions the hollow dot on the timeline */}
            <input
              type="date"
              value={s.deadline || ""}
              onChange={(e) => onUpdateSub(s.sid, { deadline: e.target.value || null })}
              title="마감일"
              style={{
                fontFamily: "inherit", fontSize: 11,
                border: "1px solid var(--bd)", borderRadius: 6,
                padding: "2px 4px", background: "var(--sf)",
                color: s.deadline ? "var(--ink2)" : "var(--ink3)",
                outline: "none", minWidth: 0,
              }}
            />
            <button
              className="sub-del-btn"
              onClick={() => onDeleteSub(s.sid)}
              style={{
                opacity: 0, transition: "opacity .15s",
                border: "none", background: "none", cursor: "pointer",
                color: "var(--ink3)", padding: 2, display: "flex", alignItems: "center",
              }}
            >
              <X size={13} />
            </button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            ref={subAddRef}
            placeholder="하위 항목 추가..."
            onKeyDown={(e) => e.key === "Enter" && submitAddSub()}
            style={{
              flex: 1, fontFamily: "inherit", fontSize: 12,
              border: "1px dashed var(--bd2)", borderRadius: 6,
              padding: "4px 8px", background: "transparent",
              color: "var(--ink2)", outline: "none",
            }}
          />
          <button
            onClick={submitAddSub}
            style={{
              border: "none", background: "var(--sf2)", color: "var(--ink2)",
              borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

const dateInputS = {
  border: "1px solid var(--bd)",
  borderRadius: 6,
  padding: "3px 6px",
  fontSize: 12,
  fontFamily: "inherit",
  background: "var(--sf)",
  color: "var(--ink2)",
  outline: "none",
};
