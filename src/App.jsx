import React, { useEffect, useMemo, useState } from "react";
import {
  Download, Upload, Plus, Pencil, Users, Home as HomeIcon,
  ListChecks, GraduationCap, Trash2, Wrench, X as XIcon, Check, XCircle, ChevronLeft, ChevronRight
} from "lucide-react";

/* ---------------------------------------------------------
   Academic Monitoring — v11.0
   - Seating modes: View / Assign / Swap / Move
   - Layout modes: Grid / Free / Snap-to-grid
   - Seat rotation (90° steps)
   - Slices stay clickable; skill data persists by student regardless of seat
   - normalizeState now gives each seat an id + x,y + rot and preserves r,c
   - Cleaned: removed legacy applyAll / setApplyAll / cycleAll
   --------------------------------------------------------- */

const lsKey = "seating-monitor-v7-1";

/* ===================== BASE STATE ===================== */
const blankState = {
  tab: "Home",
  classes: [],
  selectedClassId: null,
  skills: [],
  selectedSkillId: null, // used by Compare defaults
  selectedStudentId: null,
  editAssignMode: "assign",
  monitorSelectedSkillIds: [], // persisted monitor selection
  // monitorApplyAll removed (legacy)
};

/* ===================== TAXONOMY ===================== */
const G7_DOMAINS = [
  { id: "",   name: "(Optional)" },
  { id: "RP", name: "Ratios & Proportions" },
  { id: "NS", name: "Number System" },
  { id: "EE", name: "Expressions & Equations" },
  { id: "G",  name: "Geometry" },
  { id: "SP", name: "Statistics & Probability" },
];

const G7_STANDARDS = {
  "RP.1": "Compute unit rates (incl. complex fractions).",
  "RP.2": "Recognize & represent proportional relationships.",
  "RP.3": "Use percent problems incl. tax/discount/tip.",
  "NS.1": "Add/subtract rational numbers; number line reasoning.",
  "NS.2": "Multiply/divide rational numbers; sign rules.",
  "NS.3": "Apply operations with rational numbers to real-world problems.",
  "EE.1": "Use properties to add/subtract/multiply linear expressions.",
  "EE.2": "Understand that rewriting expressions reveals structure.",
  "EE.3": "Solve multi-step problems with rational numbers.",
  "EE.4": "Use variables; simplify expressions; combine like terms.",
  "G.1":  "Scale drawings; scale factor; area/length relations.",
  "G.2":  "Draw geometric figures with given conditions.",
  "G.3":  "Describe 2D figures by angles/lines.",
  "G.4":  "Area & circumference; relate diameter/radius.",
  "G.5":  "Angle measure, area, surface area, volume problems.",
  "G.6":  "Solve real-world problems involving area/volume.",
  "SP.1": "Sampling to draw inferences.",
  "SP.2": "Compare populations with center/variability.",
  "SP.3": "Chance processes; approximate probabilities.",
  "SP.4": "Probability models; compound events."
};

function prettyStandard(stdCode) {
  if (!stdCode) return "";
  return String(stdCode).replace(/^NC\.7\./i, "");
}

/* ===================== DISPLAY LEVELS ===================== */
const LEVELS = {
  0: { name: "Help",        bg: "bg-rose-100",    ring: "ring-rose-300",    text: "text-rose-800" },
  2: { name: "Developing",  bg: "bg-amber-100",   ring: "ring-amber-300",   text: "text-amber-800" },
  3: { name: "Proficient",  bg: "bg-emerald-100", ring: "ring-emerald-300", text: "text-emerald-800" },
  5: { name: "ABSENT",      bg: "bg-gray-200",    ring: "ring-gray-300",    text: "text-gray-800" }
};
const validLevels = [0,2,3,5];

const FLAG_META = {
  ml:      { label: "ML",     dot: "bg-sky-500" },
  mlNew:   { label: "ML New", dot: "bg-indigo-500" },
  iep504:  { label: "IEP",    dot: "bg-purple-500" },
  ec:      { label: "EC",     dot: "bg-orange-500" },
  bubble:  { label: "Bubble", dot: "bg-rose-500" },
  ca:      { label: "CA",     dot: "bg-gray-700" }, // Chronically Absent
};
const flagKeys = Object.keys(FLAG_META);

/* ===================== HELPERS ===================== */
function cryptoRandomId(){ return Math.random().toString(36).slice(2,10); }
function clsx(...a){ return a.filter(Boolean).join(" "); }
function Tiny({children}){ return <span className="text-[12px] text-slate-500">{children}</span>; }
function Dot({className}){ return <span className={clsx("inline-block w-2 h-2 rounded-full", className)} />; }

function getLevel(marks, studentId, skillId){
  if (!marks) return null;
  const v = marks[`${studentId}:${skillId}`];
  if (v === undefined || v === null) return null;
  const num = Number(v);
  if (num === 1) return 2;
  if (num === 4) return 3;
  return validLevels.includes(num) ? num : null;
}

// Good-feel cycle: Help → Developing → Proficient → Absent → Blank
function nextLevel(curr){
  const order = [0, 2, 3, 5, null];
  const idx = order.indexOf(curr);
  return order[(idx + 1) % order.length];
}

function overlayColor(lv){
  switch (lv) {
    case 0: return "rgba(244, 114, 182, 0.24)";
    case 2: return "rgba(251, 191, 36, 0.24)";
    case 3: return "rgba(16, 185, 129, 0.24)";
    case 5: return "rgba(107, 114, 128, 0.24)";
    default: return "transparent";
  }
}

/* ===================== UI PRIMITIVES ===================== */
function Button({icon:Icon, children, onClick, className="", title, type="button"}){
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm",
        "hover:shadow-sm active:scale-[.99] transition",
        "border-slate-200 bg-white text-slate-700",
        className
      )}
    >
      {Icon && <Icon size={16} />} {children}
    </button>
  );
}
function Pill({active, onClick, children}){
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-3 py-1 rounded-full border text-sm",
        active ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700",
        "hover:shadow-sm transition"
      )}
    >
      {children}
    </button>
  );
}
function Modal({open, title, children, onClose}){
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl border w-[90vw] max-w-xl">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="text-slate-500"><XIcon size={18}/></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
function LegendFlyout({open, onClose}){
  return (
    <div className={clsx(
      "fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 shadow-xl z-40 transition-transform",
      open ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-4 border-b flex items-center justify-between">
        <div className="font-semibold">Legend</div>
        <button className="text-slate-500" onClick={onClose}>Close</button>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 gap-2">
          {[0,2,3,5].map(lv=> (
            <div key={lv} className={clsx("rounded-xl px-2 py-1 text-xs ring-1", LEVELS[lv].ring, LEVELS[lv].bg, LEVELS[lv].text)}>
              {LEVELS[lv].name}
            </div>
          ))}
        </div>
        <div>
          <div className="text-xs text-slate-600 mb-1">Student Flags</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {flagKeys.map(k => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full bg-slate-100 border px-2 py-1">
                <Dot className={FLAG_META[k].dot} />{FLAG_META[k].label}
              </span>
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Blank seats mean no data entered yet. Absent seats show an X overlay (single-skill view).
        </div>
      </div>
    </div>
  );
}

/* ===================== NORMALIZE & STORAGE ===================== */
function normalizeState(input) {
  const s = JSON.parse(JSON.stringify(input || {}));
  if (!Array.isArray(s.classes)) s.classes = [];
  if (!Array.isArray(s.skills)) s.skills = [];
  if (!s.tab) s.tab = "Home";
  if (!Array.isArray(s.monitorSelectedSkillIds)) s.monitorSelectedSkillIds = [];

  // constants for seat sizing + spacing used for default XY placement
  const SEAT_W = 110, SEAT_H = 78, GAP = 8;

  s.classes = s.classes.map((c, idx) => {
    // normalize base class fields
    const cls = {
      id: c.id || `class-${idx}`,
      name: c.name || `Block ${idx+1}`,
      rows: c.rows ?? 4,
      cols: c.cols ?? 9,
      layoutMode: c.layoutMode || "grid", // "grid" | "free" | "snap"
      seats: Array.isArray(c.seats) ? c.seats : [],
      students: Array.isArray(c.students) ? c.students : [],
      marks: c.marks || {},
    };

    // ensure seats array exists for grid (autofill full grid if empty)
    if (!cls.seats || cls.seats.length === 0) {
      const seats = [];
      for (let r=0; r<cls.rows; r++){
        for (let c=0; c<cls.cols; c++){
          seats.push({
            id: `seat-${r}-${c}`,
            r, c,
            x: c * (SEAT_W + GAP),
            y: r * (SEAT_H + GAP),
            rot: 0,
            studentId: null,
          });
        }
      }
      cls.seats = seats;
    } else {
      // normalize each existing seat
      cls.seats = cls.seats.map((seat, i) => {
        const hasGrid = Number.isInteger(seat?.r) && Number.isInteger(seat?.c);
        return {
          id: seat.id || `seat-${i}`,
          r: hasGrid ? seat.r : (Number.isInteger(seat?.r) ? seat.r : null),
          c: hasGrid ? seat.c : (Number.isInteger(seat?.c) ? seat.c : null),
          x: Number.isFinite(seat?.x) ? seat.x : (hasGrid ? seat.c * (SEAT_W + GAP) : 0),
          y: Number.isFinite(seat?.y) ? seat.y : (hasGrid ? seat.r * (SEAT_H + GAP) : 0),
          rot: Number.isFinite(seat?.rot) ? seat.rot : 0,
          studentId: seat?.studentId ?? null,
        };
      });
    }

    return cls;
  });

  // convert marks from nested or 1/4 legacy to flattened 0/2/3/5
  s.classes.forEach(cls => {
    const marks = cls.marks || {};
    let flattened = {};
    let isNested = Object.values(marks).some(v => typeof v === "object" && v);
    if (isNested) {
      Object.entries(marks).forEach(([skillId, byStudent]) => {
        if (!byStudent || typeof byStudent !== "object") return;
        Object.entries(byStudent).forEach(([studentId, lv]) => {
          let level = Number(lv);
          if (level === 1) level = 2;
          if (level === 4) level = 3;
          if (!validLevels.includes(level)) return;
          flattened[`${studentId}:${skillId}`] = level;
        });
      });
      cls.marks = flattened;
    } else {
      Object.entries(marks).forEach(([k, v]) => {
        let level = Number(v);
        if (level === 1) level = 2;
        if (level === 4) level = 3;
        if (validLevels.includes(level)) flattened[k] = level;
      });
      cls.marks = flattened;
    }
  });

  if (!s.selectedClassId && s.classes[0]) s.selectedClassId = s.classes[0].id;
  if (!s.selectedSkillId && s.skills[0]) s.selectedSkillId = s.skills[0].id;

  s.skills = s.skills.map(sk => ({
    id: sk.id || cryptoRandomId(),
    name: sk.name || "Untitled Skill",
    domain: sk.domain ?? null,
    standard: sk.standard ? prettyStandard(sk.standard) : (sk.std ? prettyStandard(sk.std) : null),
    classIds: Array.isArray(sk.classIds) ? sk.classIds : (s.classes.map(c => c.id))
  }));

  return s;
}

/* ===================== SEAT & GRID ===================== */
function Seat({student, baseLevel, flags, slices, onSliceClick, onSeatClick, singleMode, allowSeatClick}){
  const isAbsent = singleMode && baseLevel === 5;
  const bgClass = isAbsent
    ? "bg-gray-100 border-gray-300"
    : (singleMode && baseLevel!=null ? `${LEVELS[baseLevel].bg} border-slate-300` : "bg-white border-slate-300 hover:shadow-sm");

  return (
    <div
      className={clsx("relative rounded-xl border min-h-[78px] cursor-pointer select-none", bgClass)}
      onClick={allowSeatClick ? onSeatClick : undefined}
    >
      {/* Multi-skill overlay slices (on top, clickable) */}
      {slices && slices.length > 0 && (
        <div className="absolute inset-0 rounded-xl overflow-hidden flex z-10">
          {slices.map((sl, idx) => (
            <div
              key={idx}
              className="h-full relative"
              style={{ width: `${100 / slices.length}%`, background: overlayColor(sl.level) }}
              onClick={(e)=>{ e.stopPropagation(); onSliceClick?.(idx); }}
              title={sl.title}
            >
              {/* bottom-centered tiny level letter */}
              <div className="absolute left-0 right-0 bottom-0 pb-[2px] flex items-end justify-center text-[10px] text-slate-700 font-semibold select-none pointer-events-none">
                {sl.level === 3 ? "P" : sl.level === 2 ? "D" : sl.level === 0 ? "H" : sl.level === 5 ? "A" : ""}
              </div>
              {idx < slices.length - 1 && (<div className="absolute right-0 top-0 h-full w-[2px] bg-black/40 pointer-events-none" />)}
            </div>
          ))}
        </div>
      )}

      {/* Absent X overlay (only in single-skill view) */}
      {isAbsent && (
        <div className="absolute inset-0 pointer-events-none opacity-70 z-0">
          <div className="absolute left-0 top-1/2 w-full h-[2px] bg-gray-500 rotate-45"></div>
          <div className="absolute left-0 top-1/2 w-full h-[2px] bg-gray-500 -rotate-45"></div>
        </div>
      )}

      {/* Name + flags — non-interactive so slices/seat receive clicks */}
      <div className="relative p-2 h-full pointer-events-none">
        <div className="absolute inset-0 flex items-center justify-center px-2">
          <div className="font-medium text-slate-800 text-center leading-tight line-clamp-2">
            {student?.name || "—"}
          </div>
        </div>
        <div className="absolute left-2 bottom-2 flex gap-1 flex-wrap max-w-[70%]">
          {flagKeys.filter(k => flags?.[k]).map(k => <Dot key={k} className={FLAG_META[k].dot} />)}
        </div>
        {singleMode && baseLevel!=null && (
          <div className={clsx("absolute right-2 bottom-2 px-2 py-0.5 rounded-full text-[10px] ring-1",
            LEVELS[baseLevel].ring, LEVELS[baseLevel].bg, LEVELS[baseLevel].text)}>
            {LEVELS[baseLevel].name}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * SeatGrid — supports:
 * - seatMode: "view" | "assign" | "swap" | "move"
 * - layoutMode: "grid" (r/c CSS grid) | "free" (absolute XY) | "snap" (absolute XY, snap on release)
 * - activeStudentId (Assign mode picker)
 * - onUpdateSeats(updater) to mutate current class seats in App state
 * - onSelectSeat(seatId) to select a seat (e.g., for Rotate button)
 */
function SeatGrid({
  cls, marks, studentById, selectedSkillIds, onCycleOne,
  seatMode, layoutMode, activeStudentId, onUpdateSeats, onSelectSeat, selectedSeatId
}){
  const rows = cls.rows || 4, cols = cls.cols || 9;
  const SEAT_W = 110, SEAT_H = 78, GAP = 8;
  const SNAP_X = SEAT_W + GAP, SNAP_Y = SEAT_H + GAP;

  const setSeats = (updater) => onUpdateSeats(updater);
  const indexOfStudent = (sid) => (cls.seats || []).findIndex(s => s.studentId === sid);

  const swapByIndex = (i, j) => setSeats(seats => {
    if (i<0 || j<0 || i===j) return seats;
    const next = seats.slice();
    const a = {...next[i]}, b = {...next[j]};
    [a.studentId, b.studentId] = [b.studentId, a.studentId];
    next[i] = a; next[j] = b;
    return next;
  });

  const [swapIdx, setSwapIdx] = useState(null);

  // drag for FREE/SNAP
  const onDragSeat = (idx, dx, dy, done=false) => {
    setSeats(seats => {
      const next = seats.slice();
      const s = {...next[idx]};
      const nx = s.x + dx, ny = s.y + dy;
      if (layoutMode === "snap" && done) {
        s.x = Math.round(nx / SNAP_X) * SNAP_X;
        s.y = Math.round(ny / SNAP_Y) * SNAP_Y;
      } else {
        s.x = nx; s.y = ny;
      }
      next[idx] = s;
      return next;
    });
  };

  // GRID layout (CSS grid, r/c based)
  if (layoutMode === "grid") {
    const grid = Array.from({length: rows}).map((_,r)=>
      Array.from({length: cols}).map((__,c)=>
        cls.seats.find(s => s.r===r && s.c===c) || {__ghost:true, id:`ghost-${r}-${c}`, r,c,studentId:null}
      )
    );

    return (
      <div className="grid gap-2" style={{gridTemplateColumns: `repeat(${cols}, minmax(${SEAT_W}px, 1fr))`}}>
        {grid.flat().map((seat, i) => {
          const realIdx = cls.seats.findIndex(s => s.r===seat.r && s.c===seat.c);
          const st = studentById(seat.studentId);
          const count = selectedSkillIds?.length || 0;
          const singleView = (seatMode==="view" && count===1);
          const baseLevel = (st && singleView) ? getLevel(marks, st.id, selectedSkillIds[0]) : null;
          const slices = (st && seatMode==="view" && count>=2)
            ? selectedSkillIds.map(sid => ({ skillId: sid, level: getLevel(marks, st.id, sid), title: "Click to cycle" }))
            : [];

          const handleClick = () => {
            onSelectSeat?.(seat.id); // for Rotate button
            if (seatMode==="assign" && activeStudentId) {
              if (realIdx < 0) return; // ignore ghosts (shouldn't happen if normalized)
              const from = indexOfStudent(activeStudentId);
              setSeats(seats => {
                const next = seats.slice();
                const target = {...next[realIdx]};
                const oldOccupant = target.studentId;
                target.studentId = activeStudentId;
                next[realIdx] = target;
                if (from >= 0 && from !== realIdx) {
                  const origin = {...next[from]};
                  origin.studentId = oldOccupant || null; // swap if occupied
                  next[from] = origin;
                }
                return next;
              });
              return;
            }
            if (seatMode==="swap") {
              if (realIdx==null || realIdx<0) return;
              if (swapIdx==null) setSwapIdx(realIdx);
              else { swapByIndex(swapIdx, realIdx); setSwapIdx(null); }
              return;
            }
            if (seatMode==="view" && singleView && st) onCycleOne(st.id, selectedSkillIds[0]);
          };

          const onSliceClick = (sliceIdx) => {
            if (!(seatMode==="view" && st)) return;
            const sid = selectedSkillIds[sliceIdx];
            if (!sid) return;
            onCycleOne(st.id, sid);
          };

          const ring = selectedSeatId === seat.id ? "ring-2 ring-indigo-400" : "";

          return (
            <div key={seat.id || i} onClick={handleClick} className={clsx(ring, "rounded-xl")}>
              <Seat
                student={st}
                baseLevel={baseLevel}
                flags={st?.flags}
                slices={slices}
                onSliceClick={onSliceClick}
                singleMode={singleView}
                allowSeatClick={seatMode==="view" && singleView && !!selectedSkillIds[0]}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // FREE / SNAP (absolute positioning + drag)
  return (
    <div className="relative border rounded-2xl bg-white" style={{minHeight: (rows * (SEAT_H+GAP)) + 40}}>
      {(cls.seats||[]).map((seat, idx) => {
        const st = studentById(seat.studentId);
        const count = selectedSkillIds?.length || 0;
        const singleView = (seatMode==="view" && count===1);
        const baseLevel = (st && singleView) ? getLevel(marks, st.id, selectedSkillIds[0]) : null;
        const slices = (st && seatMode==="view" && count>=2)
          ? selectedSkillIds.map(sid => ({ skillId: sid, level: getLevel(marks, st.id, sid), title: "Click to cycle" }))
          : [];

        const onPointerDown = (e) => {
          if (seatMode!=="move") return;
          onSelectSeat?.(seat.id);
          const startX = e.clientX, startY = e.clientY;
          const move = (ev) => onDragSeat(idx, ev.clientX - startX, ev.clientY - startY, false);
          const up = (ev) => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            onDragSeat(idx, ev.clientX - startX, ev.clientY - startY, true); // snap if needed
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up, {once:true});
        };

        const handleClick = () => {
          onSelectSeat?.(seat.id);
          if (seatMode==="assign" && activeStudentId) {
            const from = indexOfStudent(activeStudentId);
            setSeats(seats => {
              const next = seats.slice();
              const target = {...next[idx]};
              const oldOccupant = target.studentId;
              target.studentId = activeStudentId;
              next[idx] = target;
              if (from >= 0 && from !== idx) {
                const origin = {...next[from]};
                origin.studentId = oldOccupant || null; // swap if occupied
                next[from] = origin;
              }
              return next;
            });
            return;
          }
          if (seatMode==="swap") {
            if (swapIdx==null) setSwapIdx(idx);
            else { swapByIndex(swapIdx, idx); setSwapIdx(null); }
            return;
          }
          if (seatMode==="view" && singleView && st) onCycleOne(st.id, selectedSkillIds[0]);
        };

        const onSliceClick = (sliceIdx) => {
          if (!(seatMode==="view" && st)) return;
          const sid = selectedSkillIds[sliceIdx];
          if (!sid) return;
          onCycleOne(st.id, sid);
        };

        const ring = selectedSeatId === seat.id ? "ring-2 ring-indigo-400" : "";

        return (
          <div
            key={seat.id || idx}
            onPointerDown={onPointerDown}
            onClick={handleClick}
            className={clsx("absolute rounded-xl", ring)}
            style={{
              left: seat.x, top: seat.y, width: SEAT_W, height: SEAT_H,
              transform: `rotate(${seat.rot||0}deg)`,
              transformOrigin: "center center",
            }}
          >
            <Seat
              student={st}
              baseLevel={baseLevel}
              flags={st?.flags}
              slices={slices}
              onSliceClick={onSliceClick}
              singleMode={singleView}
              allowSeatClick={seatMode==="view" && singleView && !!selectedSkillIds[0]}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ===================== STUDENT DETAILS ===================== */
function StudentCard({student, cls, skills, marks}){
  const grouped = useMemo(() => {
    const byStd = {};
    skills.forEach(sk => {
      const std = prettyStandard(sk.standard) || "—";
      if (!byStd[std]) byStd[std] = [];
      byStd[std].push(sk);
    });
    return byStd;
  }, [skills]);

  const row = (sk) => {
    const lv = getLevel(marks, student.id, sk.id);
    const badge = lv != null ? (
      <div className={clsx("px-2 py-0.5 rounded-full text-[11px] ring-1", LEVELS[lv].ring, LEVELS[lv].bg, LEVELS[lv].text)}>
        {LEVELS[lv].name}
      </div>
    ) : <div className="text-xs text-slate-400">—</div>;
    return (
      <div key={sk.id} className="flex items-center justify-between py-1 border-b last:border-0">
        <div className="text-sm">
          <div className="font-medium">{sk.name}</div>
          <div className="text-xs text-slate-500">
            {prettyStandard(sk.standard)}
            {G7_STANDARDS[prettyStandard(sk.standard)] ? ` — ${G7_STANDARDS[prettyStandard(sk.standard)]}` : ""}
          </div>
        </div>
        {badge}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-bold">{student.name}</div>
          <div className="flex gap-2 mt-1">
            {flagKeys.filter(k => student?.flags?.[k]).map(k => (
              <span key={k} className="inline-flex items-center gap-1 text-xs bg-slate-100 border px-2 py-1 rounded-full">
                <Dot className={FLAG_META[k].dot} />{FLAG_META[k].label}
              </span>
            ))}
          </div>
        </div>
        <div className="text-sm text-slate-500">{cls?.name}</div>
      </div>
      {Object.keys(grouped).sort().map(std => (
        <div key={std} className="border rounded-2xl overflow-hidden">
          <div className="px-3 py-2 border-b bg-slate-50 text-sm font-semibold flex items-center gap-2">
            <GraduationCap size={14}/>
            <span>{std}</span>
            {G7_STANDARDS[std] && <span className="text-slate-500 font-normal">· {G7_STANDARDS[std]}</span>}
          </div>
          <div className="p-3">
            {grouped[std].map(row)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===================== MONITOR VIEW ===================== */
function MonitorView({ state, setState, currentClass, studentById, setMark }){
  const cls = currentClass;
  const classSkills = (state.skills || []).filter(sk => (sk.classIds?.includes(cls?.id)));
  const selectedSkillIds = state.monitorSelectedSkillIds || [];
  const [skillsOpen, setSkillsOpen] = useState(true);

  // NEW seating & layout controls
  const [seatMode, setSeatMode] = useState("view");  // "view" | "assign" | "swap" | "move"
  const [activeStudentId, setActiveStudentId] = useState(""); // for Assign mode
  const [selectedSeatId, setSelectedSeatId] = useState(null); // for Rotate button

  // persist the selected skill set in app state (already persisted)
  const setSelectedSkillIds = (updater) => {
    setState(s => {
      const current = s.monitorSelectedSkillIds || [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return {...s, monitorSelectedSkillIds: next};
    });
  };

  const toggleSel = (id) => {
    setSelectedSkillIds(old => {
      if (old.includes(id)) return old.filter(x => x !== id);
      if (old.length >= 6) return old;
      return [...old, id];
    });
  };

  const cycleOne = (studentId, skillId) => {
    if (!cls) return;
    const curr = getLevel(cls.marks, studentId, skillId);
    setMark(studentId, skillId, nextLevel(curr));
  };

  const onUpdateSeats = (updater) => {
    if (!cls) return;
    setState(s => ({
      ...s,
      classes: s.classes.map(c => c.id===cls.id ? {
        ...c,
        seats: typeof updater === "function" ? updater(c.seats) : updater
      } : c)
    }));
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-3">
      {/* Top row: Class picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="font-semibold">Class:</div>
          <select className="border rounded-xl px-3 py-1" value={state.selectedClassId || ""} onChange={e => setState(s => ({...s, selectedClassId: e.target.value}))}>
            {(state.classes||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* NEW: Seating & Layout toolbar */}
      <div className="flex items-center gap-2 flex-wrap border rounded-2xl p-2 bg-white">
        <div className="text-sm font-semibold">Seating:</div>
        {["view","assign","swap","move"].map(m => (
          <Pill key={m} active={seatMode===m} onClick={()=>setSeatMode(m)}>
            {m[0].toUpperCase()+m.slice(1)}
          </Pill>
        ))}

        <div className="mx-2 h-5 w-px bg-slate-200" />

        <div className="text-sm font-semibold">Layout:</div>
        {["grid","free","snap"].map(m => (
          <Pill
            key={m}
            active={currentClass?.layoutMode===m}
            onClick={()=>setState(s => ({
              ...s,
              classes: s.classes.map(c => c.id===currentClass.id ? {...c, layoutMode: m} : c)
            }))}
          >
            {m[0].toUpperCase()+m.slice(1)}
          </Pill>
        ))}

        {seatMode==="assign" && (
          <select
            className="ml-2 border rounded-xl px-2 py-1 text-sm"
            value={activeStudentId}
            onChange={e=>setActiveStudentId(e.target.value)}
          >
            <option value="">(Pick student)</option>
            {(currentClass?.students||[]).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        <div className="mx-2 h-5 w-px bg-slate-200" />

        <Button
          className="!py-1 !px-2 text-xs"
          title="Rotate selected seat 90°"
          onClick={()=> {
            if (!selectedSeatId) return;
            setState(s => ({
              ...s,
              classes: s.classes.map(c => c.id===currentClass.id ? {
                ...c,
                seats: c.seats.map(seat => seat.id===selectedSeatId ? {...seat, rot: ((seat.rot||0)+90)%360} : seat)
              } : c)
            }))
          }}
        >
          Rotate 90°
        </Button>
      </div>

      {/* Selected Skills mapping (Left→Right) */}
      <div className="border rounded-2xl p-2 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Selected Skills (Left → Right)</div>
          <Button onClick={()=>setSkillsOpen(o=>!o)} className="!py-1 !px-2 text-xs">
            {skillsOpen ? "Hide" : "Show"}
          </Button>
        </div>

        {skillsOpen ? (
          <div className="flex flex-wrap gap-2 items-center">
            {selectedSkillIds.length === 0 && <Tiny>No skills selected.</Tiny>}
            {selectedSkillIds.map((sid, i) => {
              const sk = (state.skills||[]).find(s => s.id === sid);
              return (
                <span key={sid} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-slate-50 text-sm">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-xs">{i+1}</span>
                  <span className="truncate max-w-[220px]">{sk?.name}</span>
                  <button className="text-slate-500" onClick={()=>setSelectedSkillIds(arr => arr.filter(x => x !== sid))} title="Remove">×</button>
                </span>
              );
            })}
            {classSkills.map(sk => {
              const on = selectedSkillIds.includes(sk.id);
              return (
                <button key={sk.id} onClick={()=>toggleSel(sk.id)}
                  className={clsx("px-3 py-1 rounded-full border text-sm", on ? "bg-slate-900 text-white border-slate-900" : "bg-white")}
                  title={(prettyStandard(sk.standard) ? `${prettyStandard(sk.standard)} — ` : "") + (G7_STANDARDS[prettyStandard(sk.standard)] || "")}>
                  {on ? "✓ " : ""}{sk.name}
                </button>
              );
            })}
            {selectedSkillIds.length > 0 && (
              <button className="ml-auto px-3 py-1 rounded-full border text-sm" onClick={()=>setSelectedSkillIds([])}>Clear all</button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {selectedSkillIds.length === 0 ? (
              <Tiny>No skills selected.</Tiny>
            ) : (
              selectedSkillIds.map((sid, i) => {
                const sk = (state.skills||[]).find(s => s.id === sid);
                return (
                  <span key={sid} className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border bg-white text-xs">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-900 text-white text-[10px]">{i+1}</span>
                    <span className="truncate max-w-[140px]">{sk?.name}</span>
                  </span>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Grid / Free board */}
      <div>
        {cls ? (
          <SeatGrid
            cls={cls}
            marks={cls.marks}
            studentById={studentById}
            selectedSkillIds={selectedSkillIds}
            onCycleOne={cycleOne}
            // NEW props:
            seatMode={seatMode}
            layoutMode={currentClass.layoutMode}
            activeStudentId={activeStudentId}
            onUpdateSeats={onUpdateSeats}
            onSelectSeat={setSelectedSeatId}
            selectedSeatId={selectedSeatId}
          />
        ) : <Tiny>No class selected.</Tiny>}
      </div>

      {/* Mode tips */}
      {selectedSkillIds.length === 0 && (
        <div className="text-xs text-slate-500">Tip: Choose 1 skill to tint the whole seat and tap to cycle. Choose 2–6 skills to see slices (click a slice to edit).</div>
      )}
      {selectedSkillIds.length === 1 && seatMode==="view" && (
        <div className="text-xs text-slate-500">Tip: Tap a seat to cycle this skill.</div>
      )}
      {selectedSkillIds.length >= 2 && seatMode==="view" && (
        <div className="text-xs text-slate-500">Tip: Click each vertical slice to edit that specific skill.</div>
      )}
      {seatMode==="assign" && (
        <div className="text-xs text-slate-500">Assign: pick a student, then click a seat to place or swap.</div>
      )}
      {seatMode==="swap" && (
        <div className="text-xs text-slate-500">Swap: click the first seat, then the second seat.</div>
      )}
      {seatMode==="move" && currentClass?.layoutMode!=="grid" && (
        <div className="text-xs text-slate-500">Move: drag seats. In “Snap” layout, seats snap to an invisible grid when released.</div>
      )}
      {seatMode==="move" && currentClass?.layoutMode==="grid" && (
        <div className="text-xs text-slate-500">Grid layout uses row/column positions. Switch to Free or Snap to drag seats freely.</div>
      )}
    </div>
  );
}

/* ===================== SAVE TO CLOUD (dummy POST) ===================== */
function SaveToCloud({ state }) {
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(null); // true | false | null

  const doSave = async () => {
    try {
      setSaving(true);
      setOk(null);
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: state }),
      });
      setOk(res.ok);
    } catch {
      setOk(false);
    } finally {
      setSaving(false);
      // fade status after a moment
      setTimeout(() => setOk(null), 1500);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button onClick={doSave} title="Save current data to Cloud">
        {saving ? "Saving…" : "Save to Cloud"}
      </Button>
      {ok === true && <span className="text-xs text-emerald-700">Saved</span>}
      {ok === false && <span className="text-xs text-rose-700">Failed</span>}
    </div>
  );
}

/* ===================== MAIN APP ===================== */
export default function App(){
  const [state, setState] = useState(blankState);
  const [legendOpen, setLegendOpen] = useState(false);

  // Skill modal
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [skillEditing, setSkillEditing] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) setState(normalizeState(JSON.parse(raw)));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(lsKey, JSON.stringify(state)); } catch {}
  }, [state]);

  const currentClass = useMemo(() => (state.classes || []).find(c => c.id === state.selectedClassId), [state]);
  const studentById = (id) => (currentClass?.students || []).find(s => s.id === id) || null;
  const switchTab = (tab) => setState(s => ({...s, tab}));

  const importJSON = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = normalizeState(JSON.parse(text));
      setState(parsed);
    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoring-state-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Setup actions
  const addClass = () => setState(s => {
    const id = cryptoRandomId();
    const cls = { id, name: `Block ${s.classes.length+1}`, rows:4, cols:9, layoutMode:"grid", seats:[], students:[], marks:{} };
    return {...s, classes: [...s.classes, cls], selectedClassId: id};
  });
  const addStudent = () => {
    const name = prompt("Student name?");
    if (!name || !currentClass) return;
    setState(s => ({...s, classes: s.classes.map(c => c.id === currentClass.id ? {...c, students: [...(c.students||[]), { id: cryptoRandomId(), name, flags:{} }]} : c)}));
  };
  const renameClass = () => {
    const name = prompt("New class name?", currentClass?.name || "");
    if (!name || !currentClass) return;
    setState(s => ({...s, classes: s.classes.map(c => c.id === currentClass.id ? {...c, name} : c)}));
  };
  const removeStudent = (st) => {
    if (!currentClass) return;
    if (!confirm("Remove this student from the class?")) return;
    setState(s => ({...s, classes: s.classes.map(c => {
      if (c.id !== currentClass.id) return c;
      const students = (c.students||[]).filter(x => x.id !== st.id);
      const marks = Object.fromEntries(Object.entries(c.marks||{}).filter(([k]) => !k.startsWith(`${st.id}:`)));
      return {...c, students, marks};
    })}));
  };
  const toggleFlag = (st, key) => {
    if (!currentClass) return;
    setState(s => ({...s, classes: s.classes.map(c => {
      if (c.id !== currentClass.id) return c;
      const students = (c.students||[]).map(x => x.id===st.id ? {...x, flags: {...(x.flags||{}), [key]: !x?.flags?.[key]}} : x);
      return {...c, students};
    })}));
  };
  const openStudentDetail = (st) => setState(s => ({...s, selectedStudentId: st.id, tab: "Student"}));

  // Skill modal save/delete
  const saveSkillFromModal = (payload) => {
    setState(s => {
      if (payload.id) {
        return {...s, skills: s.skills.map(sk => sk.id === payload.id ? payload : sk)};
      } else {
        return {...s, skills: [...s.skills, {...payload, id: cryptoRandomId()}]};
      }
    });
  };
  const deleteSkill = (sk) => {
    if (!confirm("Delete this skill?")) return;
    setState(s => ({...s,
      skills: s.skills.filter(x => x.id !== sk.id),
      classes: s.classes.map(c => {
        const marks = Object.fromEntries(Object.entries(c.marks||{}).filter(([k]) => !k.endsWith(`:${sk.id}`)));
        return {...c, marks};
      })
    }));
  };

  const setMark = (studentId, skillId, next) => {
    if (!currentClass) return;
    setState(s => ({...s, classes: s.classes.map(c => {
      if (c.id !== currentClass.id) return c;
      const k = `${studentId}:${skillId}`;
      const marks = {...(c.marks || {})};
      if (next == null) delete marks[k]; else if (validLevels.includes(next)) marks[k] = next;
      return {...c, marks};
    })}));
  };

  /* ---------- Header ---------- */
  const Header = () => (
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
        {state.tab!=="Home" ? (
          <div className="justify-self-start">
            <button className="rounded-full border px-3 py-1 text-sm" onClick={()=>setLegendOpen(true)} title="Open legend">Legend</button>
          </div>
        ) : <div />}
        <div className="justify-self-center text-center">
          <div className="text-xl font-bold">Academic Monitoring</div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border bg-white p-1">
            {["Home","Setup","Monitor","Compare","Student"].map(t => (
              <Pill key={t} active={state.tab===t} onClick={()=>switchTab(t)}>{t}</Pill>
            ))}
          </div>
        </div>
        <div className="justify-self-end flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border cursor-pointer text-sm">
            <Upload size={16}/> Import
            <input type="file" accept="application/json" className="hidden" onChange={importJSON} />
          </label>

          <SaveToCloud state={state} />

          <Button icon={Download} onClick={exportJSON}>Export</Button>
        </div>
      </div>
    </div>
  );

  /* ---------- Pages ---------- */
  const Home = () => (
    <div className="max-w-3xl mx-auto p-6 text-center">
      <div className="mx-auto mb-4 flex items-center justify-center gap-3 text-slate-600">
        <svg width="44" height="44" viewBox="0 0 24 24"><text x="4" y="16" fontSize="16">+</text></svg>
        <svg width="44" height="44" viewBox="0 0 24 24"><text x="6" y="16" fontSize="16">−</text></svg>
        <svg width="44" height="44" viewBox="0 0 24 24"><text x="6" y="16" fontSize="16">×</text></svg>
        <svg width="44" height="44" viewBox="0 0 24 24"><text x="6" y="16" fontSize="16">÷</text></svg>
      </div>
      <div className="text-2xl font-bold mb-2">Welcome</div>
      <p className="text-slate-600">Use <b>Setup</b> to build classes, rosters, and skills. Use <b>Monitor</b> to mark one or many skills on seats (and to assign/swap/move seats). Try <b>Compare</b> to view up to six skills at once, sortable by each skill. Use <b>Student</b> to browse students without going back to Setup.</p>
    </div>
  );

  const SkillForm = ({initial, onSubmit, onCancel}) => {
    const [name, setName] = useState(initial?.name || "");
    const [domain, setDomain] = useState(initial?.domain || "");
    const [standard, setStandard] = useState(prettyStandard(initial?.standard || ""));
    const [classIds, setClassIds] = useState(initial?.classIds?.slice() || (state.classes.map(c=>c.id)));

    const toggleClassId = (id) => setClassIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

    const submit = (e) => {
      e.preventDefault();
      if (!name.trim()) { alert("Please enter a skill name."); return; }
      onSubmit({ id: initial?.id, name: name.trim(), domain: domain || null, standard: standard ? prettyStandard(standard.trim()) : null, classIds: classIds.slice() });
    };

    return (
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm text-slate-600">Skill name</label>
          <input className="w-full border rounded-xl px-3 py-2" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g., 9/15 Set up H-table" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600">Domain (optional)</label>
            <select className="w-full border rounded-xl px-3 py-2" value={domain||""} onChange={e=>setDomain(e.target.value)}>
              {G7_DOMAINS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Standard (optional)</label>
            <select className="w-full border rounded-xl px-3 py-2" value={standard||""} onChange={e=>setStandard(e.target.value)}>
              <option value="">(none)</option>
              {Object.keys(G7_STANDARDS).sort().map(k => (<option key={k} value={k}>{k} — {G7_STANDARDS[k]}</option>))}
            </select>
          </div>
        </div>
        <div>
          <div className="text-sm text-slate-600 mb-1">Applies to Classes</div>
          <div className="flex flex-wrap gap-2">
            {state.classes.map(c => {
              const on = classIds.includes(c.id);
              return (
                <button type="button" key={c.id}
                  className={clsx("px-3 py-1 rounded-full border text-sm", on ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700")}
                  onClick={()=>toggleClassId(c.id)}>{c.name}</button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}><XCircle size={16}/> Cancel</Button>
          <Button type="submit"><Check size={16}/> Save</Button>
        </div>
      </form>
    );
  };

  const Setup = () => (
    <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Classes */}
      <div className="border rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold flex items-center gap-2"><HomeIcon size={16}/>Classes</div>
          <div className="flex gap-2">
            <Button onClick={addClass} icon={Plus}>Add</Button>
            <Button onClick={renameClass} icon={Pencil}>Rename</Button>
          </div>
        </div>
        <div className="space-y-1">
          {(state.classes || []).map(c => (
            <div key={c.id} className={clsx("px-3 py-2 rounded-xl border cursor-pointer", state.selectedClassId===c.id ? "bg-slate-900 text-white border-slate-900" : "bg-white")} onClick={()=> setState(s => ({...s, selectedClassId: c.id}))}>
              {c.name}
            </div>
          ))}
        </div>
      </div>

      {/* Roster */}
      <div className="border rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold flex items-center gap-2"><Users size={16}/>Roster</div>
          <Button icon={Plus} onClick={addStudent}>Add Student</Button>
        </div>
        {currentClass ? (
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {currentClass.students?.map(st => (
              <div key={st.id} className="flex items-center justify-between px-3 py-2 rounded-xl border">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button icon={ListChecks} onClick={()=>openStudentDetail(st)} className="!px-2 order-1" title="Open student detail">Open</Button>
                  <div className="font-medium order-2">{st.name}</div>
                  <div className="flex gap-1 order-3">
                    {flagKeys.map(k => {
                      const on = !!st?.flags?.[k];
                      return (
                        <button
                          key={k}
                          className={clsx(
                            "px-2 h-6 inline-flex items-center rounded-full border text-[11px] whitespace-normal leading-none select-none",
                            on ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700",
                            "cursor-default"
                          )}
                          onDoubleClick={()=>toggleFlag(st, k)}   // require double-tap/click
                          title={`${FLAG_META[k].label} — double-tap to toggle`}
                        >
                          {FLAG_META[k].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button icon={Trash2} onClick={()=>removeStudent(st)} className="!px-2">Remove</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <Tiny>Select a class.</Tiny>}
      </div>

      {/* Skills */}
      <div className="border rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold flex items-center gap-2"><Wrench size={16}/>Skills</div>
          <Button icon={Plus} onClick={()=>{ setSkillEditing(null); setSkillModalOpen(true); }}>Add Skill</Button>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
          {(state.skills || []).map(sk => (
            <div key={sk.id} className="px-3 py-2 rounded-2xl border">
              <div className="flex items-center justify-between">
                <div className="font-medium">{sk.name}</div>
                <div className="flex gap-2">
                  <Button className="!px-2" icon={Pencil} onClick={()=>{ setSkillEditing(sk); setSkillModalOpen(true); }}>Edit</Button>
                  <Button className="!px-2" icon={Trash2} onClick={()=>deleteSkill(sk)}>Delete</Button>
                </div>
              </div>
              <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>{sk.domain ? <>Domain: <b>{G7_DOMAINS.find(d=>d.id===sk.domain)?.name || sk.domain}</b></> : <>Domain: <span className="opacity-60">(optional)</span></>}</span>
                <span>{sk.standard ? <>Standard: <b>{prettyStandard(sk.standard)}</b>{G7_STANDARDS[prettyStandard(sk.standard)] ? ` — ${G7_STANDARDS[prettyStandard(sk.standard)]}` : ""}</> : <>Standard: <span className="opacity-60">(optional)</span></>}</span>
                <span>Classes: {(sk.classIds||[]).map(id => state.classes.find(c=>c.id===id)?.name || "?" ).join(", ")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Skill Modal */}
      <Modal open={skillModalOpen} title={skillEditing ? "Edit Skill" : "Add Skill"} onClose={()=>setSkillModalOpen(false)}>
        <SkillForm
          initial={skillEditing}
          onSubmit={(payload)=>{ saveSkillFromModal(payload); setSkillModalOpen(false); }}
          onCancel={()=>setSkillModalOpen(false)}
        />
      </Modal>
    </div>
  );

  const Student = () => {
    // In-page Class & Student switchers
    const classes = state.classes || [];
    const [pageClassId, setPageClassId] = useState(state.selectedClassId || classes[0]?.id || "");
    const cls = classes.find(c => c.id === pageClassId);
    const students = cls?.students || [];

    const [pageStudentId, setPageStudentId] = useState(state.selectedStudentId || students[0]?.id || "");
    useEffect(()=>{
      if (!students.find(s => s.id === pageStudentId)) {
        setPageStudentId(students[0]?.id || "");
      }
    }, [pageClassId]);

    const st = students.find(s => s.id === pageStudentId);
    const skills = (state.skills || []).filter(sk => sk.classIds?.includes(cls?.id));
    const evaluatedSkills = skills.filter(sk => getLevel(cls?.marks, st?.id, sk.id) != null);

    const idx = students.findIndex(s => s.id === pageStudentId);
    const goPrev = () => { if (idx > 0) setPageStudentId(students[idx-1].id); };
    const goNext = () => { if (idx < students.length-1) setPageStudentId(students[idx+1].id); };

    return (
      <div className="p-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between mb-2">
          <div className="text-lg font-semibold">Student Detail</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="font-semibold">Class:</div>
              <select className="border rounded-xl px-3 py-1" value={pageClassId} onChange={e=>setPageClassId(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <div className="font-semibold">Student:</div>
              <select className="border rounded-xl px-3 py-1" value={pageStudentId} onChange={e=>setPageStudentId(e.target.value)}>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <Button className="!px-2" onClick={goPrev}><ChevronLeft size={16}/></Button>
              <Button className="!px-2" onClick={goNext}><ChevronRight size={16}/></Button>
            </div>
          </div>
        </div>
        {st && cls ? (
          <StudentCard student={st} cls={cls} skills={evaluatedSkills} marks={cls.marks} />
        ) : <Tiny>No student found in this class.</Tiny>}
      </div>
    );
  };

  const Compare = () => {
    const [selectedClassId, setSelectedClassId] = useState(state.selectedClassId || state.classes[0]?.id || "");
    useEffect(()=>{
      if (state.selectedClassId && state.selectedClassId !== selectedClassId) setSelectedClassId(state.selectedClassId);
    }, [state.selectedClassId]);
    const cls = (state.classes || []).find(c => c.id === selectedClassId);
    const skills = (state.skills || []).filter(sk => sk.classIds?.includes(cls?.id));

    const [selected, setSelected] = useState([]);
    const [skillsOpen, setSkillsOpen] = useState(true);
    const [sortKey, setSortKey] = useState("name");
    const [sortDir, setSortDir] = useState("asc");

    const toggleSel = (id) => {
      setSelected((arr) => {
        if (arr.includes(id)) return arr.filter(x => x !== id);
        if (arr.length >= 6) return [...arr];
        return [...arr, id];
      });
    };

    const rows = (cls?.students || []).map(st => {
      const cells = selected.map(sid => ({ sid, lv: getLevel(cls.marks, st.id, sid) }));
      return { st, cells };
    });

    const cmp = (a, b) => {
      if (sortKey === "name") {
        const n1 = a.st.name.toLowerCase(), n2 = b.st.name.toLowerCase();
        return sortDir === "asc" ? (n1 < n2 ? -1 : n1 > n2 ? 1 : 0) : (n1 > n2 ? -1 : n1 < n2 ? 1 : 0);
      } else {
        const sid = sortKey;
        const l1 = a.cells.find(c=>c.sid===sid)?.lv ?? -1;
        const l2 = b.cells.find(c=>c.sid===sid)?.lv ?? -1;
        return sortDir === "asc" ? (l1 - l2) : (l2 - l1);
      }
    };

    const sortedRows = [...rows].sort(cmp);

    const headerClick = (key) => {
      if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
      else { setSortKey(key); setSortDir("asc"); }
    };

    const cellBg = (lv) => {
      switch (lv) {
        case 0: return "#fecaca";
        case 2: return "#fde68a";
        case 3: return "#bbf7d0";
        case 5: return "#e5e7eb";
        default: return "#ffffff";
      }
    };

    return (
      <div className="p-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">Compare Skills</div>
            <div className="flex items-center gap-2 ml-4">
              <div className="font-semibold">Class:</div>
              <select
                className="border rounded-xl px-3 py-1 text-base font-medium"
                value={selectedClassId}
                onChange={e => { setSelectedClassId(e.target.value); setState(s => ({...s, selectedClassId: e.target.value})); }}
              >
                {(state.classes||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={()=>setSkillsOpen(o=>!o)} className="!py-1 !px-2 text-xs">
            {skillsOpen ? "Hide skills" : "Show skills"}
          </Button>
        </div>

        <div className="max-w-6xl mx-auto p-2 mb-2 border rounded-2xl">
          {skillsOpen ? (
            <div className="flex flex-wrap gap-2">
              {skills.map(sk => (
                <button
                  key={sk.id}
                  onClick={()=>toggleSel(sk.id)}
                  className={clsx(
                    "px-3 py-1 rounded-full border text-sm",
                    selected.includes(sk.id) ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700"
                  )}
                  title={(prettyStandard(sk.standard) ? `${prettyStandard(sk.standard)} — ` : "") + (G7_STANDARDS[prettyStandard(sk.standard)] || "")}
                >
                  {sk.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selected.length === 0
                ? <Tiny>No skills selected.</Tiny>
                : selected.map((sid, i) => {
                    const sk = skills.find(s => s.id === sid);
                    return (
                      <span key={sid} className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border bg-white text-xs">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-900 text-white text-[10px]">{i+1}</span>
                        <span className="truncate max-w-[160px]">{sk?.name}</span>
                      </span>
                    );
                  })}
            </div>
          )}
        </div>

        {cls && selected.length > 0 ? (
          <div className="max-w-6xl mx-auto overflow-auto border rounded-2xl">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{width:"220px"}}/>
                {selected.map((sid)=>(<col key={sid} style={{width:`${Math.max(120, Math.floor(800/selected.length))}px`}}/>))}
              </colgroup>
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 cursor-pointer" onClick={()=>headerClick("name")}>Student</th>
                  {selected.map(sid => {
                    const sk = skills.find(s => s.id === sid);
                    return (
                      <th
                        key={sid}
                        className="px-3 py-2 text-left cursor-pointer"
                        onClick={()=>headerClick(sid)}
                        title={(prettyStandard(sk?.standard) ? `${prettyStandard(sk?.standard)} — ` : "") + (G7_STANDARDS[prettyStandard(sk?.standard)] || "")}
                      >
                        <div className="font-medium truncate">{sk?.name}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {prettyStandard(sk?.standard)} {G7_STANDARDS[prettyStandard(sk?.standard)] ? `· ${G7_STANDARDS[prettyStandard(sk?.standard)]}` : ""}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(({st, cells}) => (
                  <tr key={st.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-medium">{st.name}</div>
                    </td>
                    {cells.map(({sid, lv}) => (
                      <td key={sid} className="px-3 py-2">
                        <div className="h-6 rounded-md ring-1" style={{background: cellBg(lv), borderColor: "#e5e7eb"}} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-slate-500 text-sm max-w-6xl mx-auto">Pick up to six skills to compare.</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <LegendFlyout open={legendOpen && state.tab!=="Home"} onClose={()=>setLegendOpen(false)} />

      <main className="py-4">
        {state.tab === "Home" && <Home />}
        {state.tab === "Setup" && <Setup />}
        {state.tab === "Monitor" && (
          <MonitorView
            state={state}
            setState={setState}
            currentClass={currentClass}
            studentById={studentById}
            setMark={setMark}
          />
        )}
        {state.tab === "Student" && <Student />}
        {state.tab === "Compare" && <Compare />}
      </main>
    </div>
  );
}
