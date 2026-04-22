import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Check as CheckIcon, X, ChevronDown, GripVertical, ChevronUp } from "lucide-react";
import AddProjectModal from "./AddProjectModal";

/* ── Palette — 9 swatches from Figma "참고" (Color Input reference column).
   `main` drives line/dot/accent; `text` is a darker readable variant for
   the "중간 팝업" text-on-white popup style. */
const PAL = {
  red:       { main: "#B33030", text: "#8C1F1F", label: "레드" },
  coral:     { main: "#FFA1A1", text: "#B04040", label: "코랄" },
  peach:     { main: "#F2A65A", text: "#A55A18", label: "피치" },
  green:     { main: "#85C38E", text: "#3D7A4A", label: "그린" },
  sky:       { main: "#64D9F3", text: "#57B7CD", label: "스카이" },
  magenta:   { main: "#D8A0EE", text: "#8E4BA6", label: "마젠타" },
  purple:    { main: "#9B8EC7", text: "#5E549A", label: "퍼플" },
  lavender:  { main: "#B19CE4", text: "#6B57A0", label: "라벤더" },
  slate:     { main: "#5E5E58", text: "#3A3A35", label: "슬레이트" },
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
const fmtMD = (k) => { if (!k) return ""; const [, m, d] = k.split("-"); return `${+m}월 ${+d}일`; };
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/* A project counts as "done" when explicitly flagged OR every subtask is
   complete. Drives card default-collapsed state + bottom-sort order. */
const isProjectDone = (p) => {
  if (p.done) return true;
  const subs = p.subs || [];
  return subs.length > 0 && subs.every((s) => s.done);
};

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
  const { addProject, updateProject, deleteProject, addSub, updateSub, deleteSub, reorderSubs } = actions;
  const [addOpen, setAddOpen] = useState(false);
  /* Refs for each ProjectCard so the timeline can scroll to a card on click. */
  const cardRefs = useRef({});

  /* Floating "차트로 이동" button — shows when the timeline chart rows
     have scrolled out of view (hidden behind the sticky ruler or above it).
     Observes .pt-timeline-rows directly; the sticky header itself stays
     pinned so observing it would never trigger. */
  const [chartHidden, setChartHidden] = useState(false);
  useEffect(() => {
    if (loading) return;
    /* Wait a frame for the rows container to mount. */
    let io;
    const attach = () => {
      const el = document.querySelector(".pt-timeline-rows");
      if (!el || typeof IntersectionObserver === "undefined") return;
      io = new IntersectionObserver(
        ([entry]) => setChartHidden(!entry.isIntersecting),
        { threshold: 0 },
      );
      io.observe(el);
    };
    const raf = requestAnimationFrame(attach);
    return () => {
      cancelAnimationFrame(raf);
      if (io) io.disconnect();
    };
  }, [loading]);
  const scrollToChart = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const scrollToCard = (pid) => {
    const el = cardRefs.current[pid];
    if (!el) return;
    /* Offset by the sticky header + tab nav so the card's top isn't hidden
       behind the pinned area. Measured at click time because sticky layout
       changes with viewport width. */
    const sticky = document.querySelector(".pt-sticky-top");
    const nav = document.querySelector(".tab-nav");
    const navH = nav ? nav.getBoundingClientRect().height : 0;
    const stickyH = sticky ? sticky.getBoundingClientRect().height : 0;
    const y = el.getBoundingClientRect().top + window.scrollY - navH - stickyH - 16;
    window.scrollTo({ top: y, behavior: "smooth" });
    el.classList.add("pt-card-flash");
    setTimeout(() => el.classList.remove("pt-card-flash"), 1200);
  };

  return (
    <div className="pt-wrap">
      <AddProjectModal
        show={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={({ text, start, end }) => addProject({ text, start, end, pal: randomPalKey() })}
      />

      {loading ? (
        <div style={{ color: "var(--ink3)", padding: 40, textAlign: "center" }}>로딩 중...</div>
      ) : (
        <>
          {/* Sticky top contains ONLY title + date ruler. The project rows of
              the timeline render below and scroll with the page. */}
          <div className="pt-sticky-top">
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              marginBottom: 12, paddingTop: 16,
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
            <div id="pt-ruler-slot" />
          </div>

          <TimelineTrack
            projects={projects}
            onUpdateProject={updateProject}
            onSelectProject={scrollToCard}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[...projects]
              .sort((a, b) => Number(isProjectDone(a)) - Number(isProjectDone(b)))
              .map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                cardRef={(el) => { if (el) cardRefs.current[p.id] = el; else delete cardRefs.current[p.id]; }}
                onUpdate={(updates) => updateProject(p.id, updates)}
                onDelete={() => {
                  if (window.confirm(`"${p.text}" 프로젝트를 삭제할까요?`)) deleteProject(p.id);
                }}
                onAddSub={(text) => addSub(p.id, text)}
                onUpdateSub={(sid, updates) => updateSub(p.id, sid, updates)}
                onDeleteSub={(sid) => deleteSub(p.id, sid)}
                onReorderSubs={(newOrder) => reorderSubs && reorderSubs(p.id, newOrder)}
              />
            ))}
          </div>
        </>
      )}

      {chartHidden && !loading && (
        <button
          onClick={scrollToChart}
          title="차트로 이동"
          aria-label="차트로 이동"
          style={{
            position: "fixed",
            right: 24,
            bottom: 28,
            zIndex: 500,
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "1px solid var(--bd)",
            background: "var(--ink)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 18px rgba(0,0,0,.18)",
          }}
        >
          <ChevronUp size={22} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Timeline (horizontal, infinite scroll)
   ══════════════════════════════════════════════════════════ */
function TimelineTrack({ projects, onUpdateProject, onSelectProject }) {
  /* Range is open-ended: we grow it at either edge as the user scrolls.
     To avoid a scroll-position jump when PREPENDING, we apply a matching
     scrollLeft offset in a useLayoutEffect before the browser paints. */
  const [rangeStart, setRangeStart] = useState(() => addD(tod(), -120));
  const [rangeDays, setRangeDays] = useState(400);

  /* Two horizontally-synced scroll viewports: the ruler is in the sticky
     header (it pins to the top on page scroll), and the rows scroll with
     the page. Either can initiate horizontal scroll; we mirror scrollLeft
     into the other. */
  const rulerScrollRef = useRef(null);
  const rowsScrollRef = useRef(null);
  /* Portal the ruler into the sticky slot so the title + ruler pin together
     while project rows render (and scroll with the page) below. */
  const [rulerSlot, setRulerSlot] = useState(null);
  useEffect(() => {
    setRulerSlot(document.getElementById("pt-ruler-slot"));
  }, []);

  const adjustingRef = useRef(false);
  const pendingAdjustRef = useRef(0);
  const initialScrolledRef = useRef(false);
  const syncingRef = useRef(false);  /* suppress mirror-echo */

  const [view, setView] = useState({ x: 0, w: 0 });

  const todayK = dk(tod());
  const totalWidth = rangeDays * DAY_WIDTH;

  /* Center today on first render. Sync BOTH containers so the ruler shows
     the same slice as the rows on load. */
  useLayoutEffect(() => {
    if (initialScrolledRef.current) return;
    const rows = rowsScrollRef.current;
    const ruler = rulerScrollRef.current;
    if (!rows || !ruler) return;
    const x = daysBetween(rangeStart, tod()) * DAY_WIDTH;
    const target = Math.max(0, x - rows.clientWidth / 2);
    adjustingRef.current = true;
    rows.scrollLeft = target;
    ruler.scrollLeft = target;
    requestAnimationFrame(() => { adjustingRef.current = false; });
    initialScrolledRef.current = true;
    setView({ x: rows.scrollLeft, w: rows.clientWidth });
  }, [rangeStart]);

  useEffect(() => {
    const el = rowsScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setView(() => ({ x: el.scrollLeft, w: el.clientWidth }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Wheel → horizontal scroll. Windows mouse wheels only emit deltaY, and
     our container has overflow-y:hidden, so without this the page scrolls
     vertically instead of the timeline moving left/right. When deltaY is
     the dominant axis we redirect it to scrollLeft; native deltaX (Mac
     trackpad horizontal swipe) is left alone so it isn't double-applied. */
  useEffect(() => {
    const rows = rowsScrollRef.current;
    const ruler = rulerScrollRef.current;
    if (!rows || !ruler) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      rows.scrollLeft += e.deltaY;
    };
    rows.addEventListener("wheel", onWheel, { passive: false });
    ruler.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      rows.removeEventListener("wheel", onWheel);
      ruler.removeEventListener("wheel", onWheel);
    };
  }, []);

  useLayoutEffect(() => {
    if (!pendingAdjustRef.current) return;
    const rows = rowsScrollRef.current;
    const ruler = rulerScrollRef.current;
    if (!rows || !ruler) return;
    adjustingRef.current = true;
    rows.scrollLeft += pendingAdjustRef.current;
    ruler.scrollLeft = rows.scrollLeft;
    pendingAdjustRef.current = 0;
    requestAnimationFrame(() => { adjustingRef.current = false; });
  });

  /* Mirror scroll from one container to the other. The source of truth for
     edge-detection / infinite extend is the ROWS scroll container — the
     ruler is purely a visual mirror. */
  const onRowsScroll = (e) => {
    const sl = e.target.scrollLeft;
    const cw = e.target.clientWidth;
    setView({ x: sl, w: cw });
    if (!syncingRef.current && rulerScrollRef.current && rulerScrollRef.current.scrollLeft !== sl) {
      syncingRef.current = true;
      rulerScrollRef.current.scrollLeft = sl;
      requestAnimationFrame(() => { syncingRef.current = false; });
    }
    if (adjustingRef.current) return;
    if (sl < EDGE_BUFFER_PX) {
      pendingAdjustRef.current = EXTEND_DAYS * DAY_WIDTH;
      setRangeStart((prev) => addD(prev, -EXTEND_DAYS));
      setRangeDays((d) => d + EXTEND_DAYS);
    } else if (sl + cw > totalWidth - EDGE_BUFFER_PX) {
      setRangeDays((d) => d + EXTEND_DAYS);
    }
  };
  const onRulerScroll = (e) => {
    const sl = e.target.scrollLeft;
    if (!syncingRef.current && rowsScrollRef.current && rowsScrollRef.current.scrollLeft !== sl) {
      syncingRef.current = true;
      rowsScrollRef.current.scrollLeft = sl;
      requestAnimationFrame(() => { syncingRef.current = false; });
    }
  };

  const rulerNode = (
    <div className="pt-timeline pt-timeline-ruler" ref={rulerScrollRef} onScroll={onRulerScroll}>
      <div className="pt-track" style={{ width: totalWidth }}>
        <DateHeader rangeStart={rangeStart} rangeDays={rangeDays} todayK={todayK} />
      </div>
    </div>
  );

  return (
    <>
      {/* Ruler is portalled into the .pt-sticky-top slot; falls back inline
          before the slot mounts so it never disappears from the layout. */}
      {rulerSlot ? createPortal(rulerNode, rulerSlot) : rulerNode}
      {/* Rows — NOT sticky; scrolls with page. Shares scrollLeft with the ruler above. */}
      <div className="pt-timeline pt-timeline-rows" ref={rowsScrollRef} onScroll={onRowsScroll}>
        <div className="pt-track" style={{ width: totalWidth }}>
          <div className="pt-body" style={{ position: "relative" }}>
          {projects.map((p, i) => (
            <TimelineRow
              key={p.id}
              project={p}
              rangeStart={rangeStart}
              rowIndex={i}
              onUpdate={(upd) => onUpdateProject(p.id, upd)}
              onSelect={() => onSelectProject && onSelectProject(p.id)}
              scrollRef={rowsScrollRef}
              view={view}
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
    </>
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
    /* Sat/Sun ruler colors — peach family per Figma (the today-highlight
       tick uses #DAAEAE so the weekend palette stays in that warm range). */
    const color = isToday ? "#D48888"
      : wd === 0 ? "#D48888"
      : wd === 6 ? "#DAAEAE"
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
        background: isToday ? "#D48888" : "var(--bd2)",
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
function TimelineRow({ project, rangeStart, rowIndex, onUpdate, onSelect, scrollRef, view }) {
  const pal = resolvePal(project);
  const startD = pk(project.start);
  const endD = pk(project.end);

  /* x coordinates (center-of-day). Each row is its own relative-positioned
     container, so children's top is in row-local coords (not pt-body coords).
     rowIndex is kept only for debugging / future use. */
  void rowIndex;
  void scrollRef;
  const startX = daysBetween(rangeStart, startD) * DAY_WIDTH + DAY_WIDTH / 2;
  const endX = daysBetween(rangeStart, endD) * DAY_WIDTH + DAY_WIDTH / 2;
  const lineY = ROW_HEIGHT / 2;

  /* ── Hover popups ──
     Line / start / end / label hover → compact project summary (title + date
     range), anchored to the hovered element so end-dot hover shows it near
     the end-dot (not near the start of the line). Middle subtask dots open
     their own subtask tooltip. 80ms hide-debounce prevents flicker when the
     cursor crosses between adjacent hover targets. */
  const lineRef = useRef(null);
  const hideTimerRef = useRef(null);
  const dotHideTimerRef = useRef(null);
  const [tip, setTip] = useState(null);       // project-summary card { x, y }
  const [dotTip, setDotTip] = useState(null); // subtask popup { sid, text, done, x, y }

  const cancelHide = () => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  };
  const showTip = (el) => {
    if (dragRef.current) return;
    cancelHide();
    const anchor = el || lineRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.bottom + 8 });
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => setTip(null), 80);
  };
  useEffect(() => () => { cancelHide(); if (dotHideTimerRef.current) clearTimeout(dotHideTimerRef.current); }, []);
  const hoverHandlers = {
    onMouseEnter: (e) => showTip(e.currentTarget),
    onMouseLeave: scheduleHide,
  };

  const showDotTip = (sub, el) => {
    if (dragRef.current) return;
    if (dotHideTimerRef.current) { clearTimeout(dotHideTimerRef.current); dotHideTimerRef.current = null; }
    const r = el.getBoundingClientRect();
    setDotTip({
      sid: sub.sid,
      text: sub.text,
      done: sub.done,
      x: r.left + r.width / 2,
      y: r.top - 6,
    });
  };
  const hideDotTip = () => {
    if (dotHideTimerRef.current) clearTimeout(dotHideTimerRef.current);
    dotHideTimerRef.current = setTimeout(() => setDotTip(null), 80);
  };

  /* Intermediate dots — only subtasks WITH a deadline show up on the timeline.
     Position = subtask.deadline on the shared day axis.
     A dot is filled when the subtask is done; hollow otherwise. */
  const midDots = project.subs
    .filter((s) => s.deadline)
    .map((s) => ({
      sid: s.sid,
      x: daysBetween(rangeStart, pk(s.deadline)) * DAY_WIDTH + DAY_WIDTH / 2,
      done: s.done,
    }));

  /* ── Drag state ──
     mode: 'start' | 'end' | 'move'
     Work in scroll-container coordinates (element bbox + scrollLeft) so the
     drag stays correct even as the user scrolls mid-drag. */
  const dragRef = useRef(null);
  const movedRef = useRef(false);

  const beginDrag = (mode, e) => {
    e.preventDefault();
    e.stopPropagation();
    movedRef.current = false;
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
    if (Math.abs(e.clientX - d.startClientX) > 3) movedRef.current = true;
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
      {/* Invisible hover hitbox — the line itself is only 2px tall, which is
         way too thin to hover comfortably. This zone extends vertically
         ±20px around the line and laterally past both endpoints so the
         tooltip opens reliably. Sits BEHIND line/dots (zIndex 1) so their
         own mouseDown handlers still run. */}
      <div
        {...hoverHandlers}
        style={{
          position: "absolute",
          left: Math.min(startX, endX) - 12,
          width: Math.abs(endX - startX) + 24,
          top: lineY - 20,
          height: 40,
          zIndex: 1,
        }}
      />

      {/* Line */}
      <div
        ref={lineRef}
        onMouseDown={(e) => beginDrag("move", e)}
        onClick={() => { if (!movedRef.current) onSelect?.(); }}
        {...hoverHandlers}
        style={{
          position: "absolute",
          left: startX, width: endX - startX,
          top: lineY - LINE_THICKNESS / 2,
          height: LINE_THICKNESS,
          background: pal.main,
          cursor: "pointer",
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
        hoverHandlers={hoverHandlers}
      />

      {/* Intermediate (subtask) dots */}
      {midDots.map((d) => {
        const sub = project.subs.find((s) => s.sid === d.sid);
        return (
          <Dot
            key={d.sid}
            x={d.x} y={lineY}
            color={pal.main}
            filled={d.done}
            hoverHandlers={{
              onMouseEnter: (e) => {
                if (sub) showDotTip(sub, e.currentTarget);
              },
              onMouseLeave: hideDotTip,
            }}
          />
        );
      })}

      {/* End dot (filled) */}
      <Dot
        x={endX} y={lineY}
        color={pal.main}
        filled
        onMouseDown={(e) => beginDrag("end", e)}
        cursor="ew-resize"
        hoverHandlers={hoverHandlers}
      />

      {/* Label — centered on the VISIBLE slice of the line (intersection of
         the line with the current viewport). Falls back to full-line center
         until `view` is measured. */}
      {(() => {
        const viewLeft = view?.w ? view.x : startX;
        const viewRight = view?.w ? view.x + view.w : endX;
        const vL = Math.max(startX, viewLeft);
        const vR = Math.min(endX, viewRight);
        const visible = vR > vL;
        const centerX = visible ? (vL + vR) / 2 : (startX + endX) / 2;
        return (
          <div
            {...hoverHandlers}
            onClick={() => onSelect?.()}
            style={{
              position: "absolute",
              left: centerX,
              transform: "translateX(-50%)",
              top: lineY + DOT_SIZE / 2 + 6,
              textAlign: "center",
              fontSize: 14,
              fontWeight: 500,
              color: project.done ? "var(--ink3)" : "var(--ink)",
              textDecoration: project.done ? "line-through" : "none",
              whiteSpace: "nowrap",
              pointerEvents: "auto",
              cursor: "pointer",
            }}
          >
            {project.text}
          </div>
        );
      })()}

      {tip && createPortal(
        <SummaryCard project={project} pal={pal} x={tip.x} y={tip.y} />,
        document.body,
      )}
      {dotTip && createPortal(
        <SubtaskPopup
          text={dotTip.text}
          done={dotTip.done}
          pal={pal}
          x={dotTip.x}
          y={dotTip.y}
        />,
        document.body,
      )}
    </div>
  );
}

/* Subtask popup — "팝업" (filled) when subtask is done, "중간 팝업"
   (white bg, colored text) when pending. Positioned above the hovered dot. */
function SubtaskPopup({ text, done, pal, x, y }) {
  const solid = done;
  return (
    <div style={{
      position: "fixed",
      left: x,
      top: y,
      transform: "translate(-50%, -100%)",
      maxWidth: 260,
      padding: "7px 14px",
      background: solid ? pal.main : "#fff",
      color: solid ? "#fff" : pal.text,
      border: solid ? "none" : `1px solid ${pal.main}`,
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1.3,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      boxShadow: "0 4px 14px rgba(0,0,0,.12)",
      zIndex: 1001,
      pointerEvents: "none",
    }}>
      {text}
    </div>
  );
}

/* Compact project summary (hover tooltip) — title + date range only.
   The full subtask list is intentionally omitted; users click the project
   label to jump to the card where every detail is editable. */
function SummaryCard({ project, pal, x, y }) {
  return (
    <div style={{
      position: "fixed",
      left: x,
      top: y,
      transform: "translateX(-50%)",
      maxWidth: 280,
      background: pal.main,
      color: "#fff",
      borderRadius: 10,
      padding: "10px 14px",
      boxShadow: "0 6px 20px rgba(0,0,0,.15)",
      zIndex: 1000,
      pointerEvents: "none",
      whiteSpace: "nowrap",
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
        {project.text}
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, marginTop: 3 }}>
        {fmtKo(project.start)} ~ {fmtKo(project.end)}
      </div>
    </div>
  );
}

function Dot({ x, y, color, filled, onMouseDown, cursor, hoverHandlers }) {
  return (
    <div
      onMouseDown={onMouseDown}
      {...(hoverHandlers || {})}
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

/* Compact date pill — custom display layered over an invisible native date
   input so the calendar picker still opens, but the visual size + label
   (e.g. "3월 1일") match Figma's tight layout that native inputs can't honor.
   `tone`: "light" (white) or "muted" (gray, for completed rows). */
function MiniDateBtn({ value, onChange, placeholder = "일자", tone = "light", minWidth = 44 }) {
  const inputRef = useRef(null);
  const open = (e) => {
    e.preventDefault();
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch { /* fallthrough */ }
    }
    el.focus();
  };
  const muted = tone === "muted";
  return (
    <div
      onClick={open}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 20,
        minWidth,
        padding: "0 8px",
        fontSize: 11,
        fontWeight: 600,
        color: value ? (muted ? "#fff" : "var(--ink2)") : (muted ? "rgba(255,255,255,.85)" : "var(--ink3)"),
        background: muted ? "#757575" : "var(--sf)",
        border: `1px solid ${muted ? "#757575" : "var(--bd)"}`,
        borderRadius: 10,
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {value ? fmtMD(value) : placeholder}
      <input
        ref={inputRef}
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          pointerEvents: "none",
          border: 0,
        }}
      />
    </div>
  );
}

function ProjectCard({ project, cardRef, onUpdate, onDelete, onAddSub, onUpdateSub, onDeleteSub, onReorderSubs }) {
  const pal = resolvePal(project);
  const subAddRef = useRef(null);
  const [editingSid, setEditingSid] = useState(null);
  const [collapsed, setCollapsed] = useState(() => isProjectDone(project));
  const [palOpen, setPalOpen] = useState(false);
  const [dragSid, setDragSid] = useState(null);
  const [dragOverSid, setDragOverSid] = useState(null);

  const doneCount = project.subs.filter((s) => s.done).length;
  const total = project.subs.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const submitAddSub = () => {
    const v = subAddRef.current?.value.trim();
    if (!v) return;
    onAddSub(v);
    subAddRef.current.value = "";
  };

  const status = pct === 100 && total > 0 ? "완료" : "진행중";
  const isDone = pct === 100 && total > 0;
  /* Column widths aligned with Figma "After" (목표 52 / 완료 52 / delete 17). */
  const COL_TARGET = 52;
  const COL_DONE = 52;
  const COL_DEL = 17;

  return (
    <div ref={cardRef} className="task-card" style={{
      background: "var(--sf)",
      border: "1px solid var(--bd2)",
      borderRadius: 14,
      padding: "32px 23px 21px",
      opacity: isDone ? 0.65 : 1,
      position: "relative",
      scrollMarginTop: 16,
    }}>
      {/* Title row — Figma: chevron + title + pct (no checkbox; trash on hover) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "펼치기" : "접기"}
          aria-label={collapsed ? "펼치기" : "접기"}
          style={{
            border: "none", background: "none", cursor: "pointer",
            padding: 0, margin: 0, width: 14, height: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ink2)",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0)",
            transition: "transform .15s",
            flexShrink: 0,
          }}
        >
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>
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
            flex: 1, fontFamily: "inherit", fontSize: 18, fontWeight: 700,
            border: "none", background: "transparent", outline: "none",
            color: "var(--ink)",
            textDecoration: isDone ? "line-through" : "none",
            padding: 0,
          }}
        />
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink2)" }}>
          {pct}%
        </span>
      </div>

      {/* Hover-only delete button — top-right of card */}
      <button
        className="card-del-btn"
        onClick={onDelete}
        title="프로젝트 삭제"
        style={{
          position: "absolute",
          top: 10, right: 10,
          opacity: 0,
          transition: "opacity .15s",
          border: "none", background: "none", cursor: "pointer",
          color: "var(--ink3)",
          padding: 4, display: "flex", alignItems: "center",
        }}
      >
        <Trash2 size={14} />
      </button>

      {/* Meta row: mini date pills + color swatch + progress + status */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
        fontSize: 12, color: "var(--ink2)", marginBottom: 10,
      }}>
        <MiniDateBtn value={project.start} onChange={(v) => v && onUpdate({ start: v })} />
        <span style={{ color: "var(--ink3)", margin: "0 2px" }}>→</span>
        <MiniDateBtn value={project.end} onChange={(v) => v && onUpdate({ end: v })} />

        {/* Color swatch — Figma Color Input: 16px circle + small chevron.
            Custom popover shows circles (not names) per 참고 column. */}
        <div style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          height: 16,
          marginLeft: 2,
        }}>
          <button
            type="button"
            onClick={() => setPalOpen((v) => !v)}
            aria-label="색상 선택"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              border: "none", background: "none", padding: 0, cursor: "pointer",
            }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: "50%", background: pal.main,
              flexShrink: 0,
            }} />
            <ChevronDown size={9} strokeWidth={2.2} color="var(--ink3)" />
          </button>
          {palOpen && (
            <>
              <div
                onClick={() => setPalOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 20 }}
              />
              <div style={{
                position: "absolute",
                top: 22, left: 0,
                background: "var(--sf)",
                border: "1px solid var(--bd2)",
                borderRadius: 10,
                padding: 8,
                display: "grid",
                gridTemplateColumns: "repeat(3, 20px)",
                gap: 6,
                boxShadow: "0 6px 18px rgba(0,0,0,.12)",
                zIndex: 21,
              }}>
                {PAL_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    title={PAL[k].label}
                    onClick={() => { onUpdate({ pal: k }); setPalOpen(false); }}
                    style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: PAL[k].main,
                      border: project.pal === k ? "2px solid var(--ink)" : "1px solid rgba(0,0,0,.08)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {total > 0 && (
          <>
            <span style={pillS}>{doneCount}/{total}</span>
            <span style={pillS}>{status}</span>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4, background: "var(--sf2)", borderRadius: 4,
        overflow: "hidden", marginBottom: 12,
      }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: pal.main,
          borderRadius: 4, transition: "width .3s",
        }} />
      </div>

      {/* Column header */}
      {total > 0 && !collapsed && (
        <div style={{
          display: "flex", alignItems: "center",
          padding: "8px 0",
          borderBottom: "1px solid var(--bd)",
          fontSize: 12, fontWeight: 400, color: "var(--ink)",
          marginBottom: 2,
        }}>
          <div style={{ flex: 1 }}>세부 내용</div>
          <div style={{ width: COL_TARGET, textAlign: "center" }}>목표 일자</div>
          <div style={{ width: 8 }} />
          <div style={{ width: COL_DONE, textAlign: "center" }}>완료 일자</div>
          <div style={{ width: COL_DEL }} />
        </div>
      )}

      {/* Subtasks */}
      {!collapsed && (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {project.subs.map((s) => (
          <div
            key={s.sid}
            className="sub-row"
            onDragOver={(e) => {
              if (dragSid == null || dragSid === s.sid) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverSid(s.sid);
            }}
            onDragLeave={() => {
              if (dragOverSid === s.sid) setDragOverSid(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragSid == null || dragSid === s.sid) return;
              const ids = project.subs.map((x) => x.sid);
              const from = ids.indexOf(dragSid);
              const to = ids.indexOf(s.sid);
              if (from < 0 || to < 0) return;
              const reordered = ids.slice();
              reordered.splice(from, 1);
              reordered.splice(to, 0, dragSid);
              onReorderSubs(reordered);
              setDragSid(null);
              setDragOverSid(null);
            }}
            style={{
              display: "flex", alignItems: "flex-start", gap: 0,
              padding: "6px 0",
              borderTop: dragOverSid === s.sid ? "2px solid var(--ink)" : "2px solid transparent",
              opacity: dragSid === s.sid ? 0.4 : 1,
              position: "relative",
            }}
          >
            {/* Drag handle — visible on row hover, the only draggable element */}
            <span
              className="sub-grip"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(s.sid));
                setDragSid(s.sid);
              }}
              onDragEnd={() => { setDragSid(null); setDragOverSid(null); }}
              title="드래그하여 순서 변경"
              style={{
                position: "absolute",
                left: -18, top: 7,
                opacity: 0,
                transition: "opacity .15s",
                color: "var(--ink3)",
                cursor: "grab",
                display: "flex", alignItems: "center", userSelect: "none",
              }}
            >
              <GripVertical size={14} />
            </span>
            <Check
              size={16}
              checked={s.done}
              onClick={() => onUpdateSub(s.sid, {
                done: !s.done,
                done_at: !s.done ? dk(new Date()) : null,
              })}
            />
            <div style={{ flex: 1, paddingLeft: 8, minWidth: 0 }}>
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
                    width: "100%", fontFamily: "inherit", fontSize: 13,
                    border: "1px solid var(--bd2)", borderRadius: 6,
                    padding: "3px 6px", outline: "none",
                  }}
                />
              ) : (
                <span
                  onClick={() => setEditingSid(s.sid)}
                  style={{
                    fontSize: 13,
                    color: s.done ? "var(--ink3)" : "var(--ink)",
                    textDecoration: s.done ? "line-through" : "none",
                    cursor: "text",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                    display: "block",
                    lineHeight: 1.45,
                  }}
                >
                  {s.text}
                </span>
              )}
            </div>
            {/* 목표 일자 */}
            <div style={{ width: COL_TARGET, display: "flex", justifyContent: "center" }}>
              <MiniDateBtn
                value={s.deadline}
                onChange={(v) => onUpdateSub(s.sid, { deadline: v })}
                minWidth={50}
              />
            </div>
            <div style={{ width: 8 }} />
            {/* 완료 일자 */}
            <div style={{ width: COL_DONE, display: "flex", justifyContent: "center" }}>
              <MiniDateBtn
                value={s.done_at}
                onChange={(v) => onUpdateSub(s.sid, {
                  done_at: v,
                  done: !!v,
                })}
                minWidth={50}
                tone={s.done ? "muted" : "light"}
              />
            </div>
            <div style={{ width: COL_DEL, display: "flex", justifyContent: "center" }}>
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
          </div>
        ))}

        {/* Add subtask */}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input
            ref={subAddRef}
            placeholder="하위 항목 추가..."
            onKeyDown={(e) => e.key === "Enter" && submitAddSub()}
            style={{
              flex: 1, fontFamily: "inherit", fontSize: 12,
              border: "1px dashed var(--bd2)", borderRadius: 6,
              padding: "6px 10px", background: "transparent",
              color: "var(--ink2)", outline: "none",
            }}
          />
          <button
            onClick={submitAddSub}
            style={{
              border: "none", background: "var(--sf2)", color: "var(--ink2)",
              borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            추가
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

/* Status label ("4/6", "진행중") — Figma: plain text, no pill container. */
const pillS = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink2)",
  whiteSpace: "nowrap",
  marginLeft: 6,
};
