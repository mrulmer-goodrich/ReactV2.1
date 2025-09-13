import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, Upload, Plus, Pencil, Users, Settings, Move3D, Link as LinkIcon,
  SlidersHorizontal, LayoutTemplate, Trash2, Wrench, Home as HomeIcon,
  ListChecks, GraduationCap, ChevronRight, ChevronLeft
} from "lucide-react";

/**
 * Academic Monitoring — v3 (Tabs: Home • Setup • Monitor)
 *
 * 🔧 One-file drop-in (replace src/App.jsx). No new deps. Index.html stays the same.
 * - Home: playful landing with buttons to Setup / Monitor
 * - Setup: Class • Roster • Skills (cascading Domain→Standard with “Blank” & “Other”) • Modifications
 * - Monitor: pick class & skill; tap seats to cycle levels; assign mode; move seats; grid/free layout
 * - No default students/skills; add student on Enter; prevent duplicate names; edit/delete; per-student “Clear all”
 * - Skills: name + optional domain + optional standard (+ optional short description), link to classes
 * - Import/Export JSON
 * - Safe migration of old data; strips “NC.7.” prefix from standards
 */

// ----------------- Constants & Helpers -----------------
const lsKey = "seating-monitor-v5";
const uid = () => Math.random().toString(36).slice(2, 9);

const NC_DOMAINS = [
  "Number System",
  "Ratios & Proportions",
  "Expressions & Equations",
  "Geometry",
  "Statistics & Probability",
];

const NC7 = {
  "Number System": [
    ["NS.1", "Apply and extend previous understandings of addition and subtraction to add and subtract rational numbers."],
    ["NS.2", "Apply and extend previous understandings of multiplication and division and of fractions to multiply and divide rational numbers."],
    ["NS.3", "Solve real-world problems involving the four operations with rational numbers; apply absolute value."],
  ],
  "Ratios & Proportions": [
    ["RP.1", "Analyze proportional relationships and use them to solve real-world and mathematical problems."],
    ["RP.2", "Recognize and represent proportional relationships between quantities; unit rate."],
    ["RP.3", "Solve multistep ratio and percent problems, including simple interest, tax, markups, and percent error."],
  ],
  "Expressions & Equations": [
    ["EE.1", "Apply properties of operations to generate equivalent expressions; evaluate using substitution."],
    ["EE.2", "Understand combining like terms and use it to rewrite expressions."],
    ["EE.3", "Use the distributive property and properties of operations to factor or expand expressions."],
    ["EE.4", "Solve real-world problems by constructing and solving equations and inequalities."],
  ],
  Geometry: [
    ["G.1", "Understand scale drawings; compute actual lengths and areas; reproduce a scale drawing at a different scale."],
    ["G.2", "Draw, construct, and describe geometrical figures; describe relationships between them; area/surface."],
    ["G.3", "Solve real-world and mathematical problems involving angle measure, area, surface area, and volume."],
  ],
  "Statistics & Probability": [
    ["SP.1", "Use random sampling to draw inferences about a population."],
    ["SP.2", "Draw informal comparative inferences about two populations."],
    ["SP.3", "Investigate chance processes and develop, use, and evaluate probability models."],
  ],
};

const levelMeta = {
  0: { name: "N/A", bg: "bg-gray-100", ring: "ring-gray-300", text: "text-gray-600" },
  1: { name: "Help", bg: "bg-rose-100", ring: "ring-rose-300", text: "text-rose-800" },
  2: { name: "Developing", bg: "bg-amber-100", ring: "ring-amber-300", text: "text-amber-800" },
  3: { name: "Proficient", bg: "bg-emerald-100", ring: "ring-emerald-300", text: "text-emerald-800" },
  4: { name: "Advanced", bg: "bg-sky-100", ring: "ring-sky-300", text: "text-sky-800" },
};

// ----------------- Defaults & Migration -----------------
const DEFAULT_STATE = () => {
  const classId = uid();
  const rows = 4, cols = 6;
  const seats = Array.from({ length: rows * cols }, (_, i) => ({
    r: Math.floor(i / cols), c: i % cols, studentId: null,
  }));
  return {
    classes: [{ id: classId, name: "Period 1", rows, cols, seats, students: [], marks: {}, layoutMode: "grid" }],
    skills: [],
    selectedClassId: classId,
    selectedSkillId: null,
    editAssignMode: false,
    tab: "home", // "home" | "setup" | "monitor"
  };
};

function cleanStandard(code) {
  if (typeof code !== "string") return code;
  return code.replace(/^NC\.7\./, "");
}

function migrateLegacy(raw) {
  try {
    const parsed = JSON.parse(raw);
    const st = parsed && typeof parsed === "object" ? parsed : DEFAULT_STATE();

    if (!Array.isArray(st.classes)) st.classes = DEFAULT_STATE().classes;

    if (Array.isArray(st.skills)) {
      st.skills = st.skills.filter(s => s && typeof s === "object").map(s => ({
        id: typeof s.id === "string" ? s.id : uid(),
        name: typeof s.name === "string" ? s.name : "(unnamed)",
        domain: typeof s.domain === "string" ? s.domain : undefined,
        standardCode: cleanStandard(s.standardCode) || undefined,
        description: typeof s.description === "string" ? s.description : undefined,
        classIds: Array.isArray(s.classIds) ? [...new Set(s.classIds.filter(Boolean))] : [],
      }));
    } else {
      const lifted = []; const seen = new Map();
      (st.classes || []).forEach(cl => {
        const clSkills = Array.isArray(cl.skills) ? cl.skills : [];
        clSkills.forEach(sk => {
          if (!sk || typeof sk !== "object") return;
          const name = typeof sk.name === "string" ? sk.name : "(unnamed)";
          const domain = typeof sk.domain === "string" ? sk.domain : undefined;
          const standardCode = cleanStandard(sk.standardCode) || undefined;
          const description = typeof sk.description === "string" ? sk.description : undefined;
          const key = `${name}|${domain || ""}|${standardCode || ""}|${description || ""}`;
          let id = seen.get(key);
          if (!id) {
            id = typeof sk.id === "string" ? sk.id : uid();
            seen.set(key, id);
            lifted.push({ id, name, domain, standardCode, description, classIds: [cl.id] });
          } else {
            const ref = lifted.find(x => x.id === id);
            if (ref && !ref.classIds.includes(cl.id)) ref.classIds.push(cl.id);
          }
        });
        if (cl && typeof cl === "object") cl.skills = [];
      });
      st.skills = lifted;
    }

    st.classes = st.classes.map(cl => {
      const rows = Number.isFinite(cl.rows) ? Math.max(1, Math.min(24, cl.rows)) : 4;
      const cols = Number.isFinite(cl.cols) ? Math.max(1, Math.min(24, cl.cols)) : 6;
      const seats = Array.isArray(cl.seats) ? cl.seats : [];
      const students = Array.isArray(cl.students) ? cl.students : [];
      const marks = cl.marks && typeof cl.marks === "object" ? cl.marks : {};
      const layoutMode = cl.layoutMode === "free" ? "free" : "grid";
      const normSeats = [];
      for (let i = 0; i < rows * cols; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        const ex = seats.find(s => s && s.r === r && s.c === c) || { r, c, studentId: null };
        if (typeof ex.studentId !== "string") ex.studentId = ex.studentId || null;
        normSeats.push(ex);
      }
      return {
        id: typeof cl.id === "string" ? cl.id : uid(),
        name: typeof cl.name === "string" ? cl.name : "Class",
        rows, cols, seats: normSeats,
        students: students.filter(s => s && typeof s === "object" && typeof s.id === "string"),
        marks, layoutMode,
      };
    });

    if (!st.selectedClassId || !st.classes.find(c => c.id === st.selectedClassId))
      st.selectedClassId = st.classes[0]?.id || DEFAULT_STATE().classes[0].id;

    if (st.selectedSkillId && !st.skills.find(s => s.id === st.selectedSkillId))
      st.selectedSkillId = null;

    if (typeof st.editAssignMode !== "boolean") st.editAssignMode = false;
    if (!["home", "setup", "monitor"].includes(st.tab)) st.tab = "home";

    return st;
  } catch {
    return DEFAULT_STATE();
  }
}

function loadState() {
  try { const raw = localStorage.getItem(lsKey); return raw ? migrateLegacy(raw) : DEFAULT_STATE(); }
  catch { return DEFAULT_STATE(); }
}
function saveState(s) { try { localStorage.setItem(lsKey, JSON.stringify(s)); } catch {} }

// ----------------- App (Tabs) -----------------
export default function App() {
  const [state, setState] = useState(loadState());
  useEffect(() => saveState(state), [state]);

  const setTab = (tab) => setState(p => ({ ...p, tab }));

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top bar */}
      <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HomeIcon className="h-6 w-6 text-slate-400" />
          <h1 className="text-2xl font-bold">Academic Monitoring</h1>
        </div>
        <div className="flex items-center gap-2">
          <TopExport state={state} />
          <TopImport onImport={(s) => setState(migrateLegacy(s))} />
          <button onClick={() => setTab("setup")} className={`rounded-2xl border px-3 py-2 bg-white hover:bg-slate-50 ${state.tab==="setup"?"ring-2 ring-slate-300":""}`}>Setup</button>
          <button onClick={() => setTab("monitor")} className={`rounded-2xl border px-3 py-2 bg-white hover:bg-slate-50 ${state.tab==="monitor"?"ring-2 ring-slate-300":""}`}>Monitor</button>
        </div>
      </div>

      {/* Tabs */}
      {state.tab === "home" && <Home setTab={setTab} />}
      {state.tab === "setup" && <SetupPage state={state} setState={setState} />}
      {state.tab === "monitor" && <MonitorPage state={state} setState={setState} />}
    </div>
  );
}

// ----------------- Home -----------------
function Home({ setTab }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <div className="rounded-3xl bg-white border shadow-sm p-10 grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">Welcome 👋</h2>
          <p className="text-slate-600">
            Track understanding across seats, skills, and classes. Build skills in <em>Setup</em>, then tap levels in <em>Monitor</em>.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setTab("setup")} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 shadow-sm bg-sky-600 text-white hover:bg-sky-700">
              <ListChecks className="h-4 w-4" /> Go to Setup
            </button>
            <button onClick={() => setTab("monitor")} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 shadow-sm bg-emerald-600 text-white hover:bg-emerald-700">
              <GraduationCap className="h-4 w-4" /> Go to Monitor
            </button>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-full max-w-md rounded-3xl bg-gradient-to-br from-sky-50 to-emerald-50 border p-6">
            <div className="text-7xl text-center">➗ ✖️ ➕ ➖</div>
            <p className="text-center text-slate-600 mt-4">
              Middle school math vibes, optimized for iPad tapping and quick checks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- Setup Page -----------------
function SetupPage({ state, setState }) {
  const currentClass = useMemo(
    () => state.classes.find(c => c.id === state.selectedClassId),
    [state]
  );

  // class helpers
  const setClass = (id) => setState(p => ({ ...p, selectedClassId: id }));
  const addClass = () => {
    const name = prompt("New class name?");
    if (!name) return;
    const rows = 4, cols = 6;
    const seats = Array.from({ length: rows * cols }, (_, i) => ({ r: Math.floor(i/cols), c: i%cols, studentId: null }));
    const id = uid();
    setState(p => ({ ...p, classes: [...p.classes, { id, name, rows, cols, seats, students: [], marks: {}, layoutMode: "grid" }], selectedClassId: id }));
  };
  const renameClass = () => {
    const name = prompt("Rename class", currentClass?.name || "");
    if (!name) return;
    setState(p => ({ ...p, classes: p.classes.map(c => c.id === currentClass.id ? { ...c, name } : c) }));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <div className="grid lg:grid-cols-4 gap-4">
        {/* Class */}
        <SectionCard title="Class" icon={<Users className="h-4 w-4" />}>
          <div className="flex items-center gap-2">
            <select className="rounded-xl border px-3 py-2 text-sm" value={state.selectedClassId} onChange={(e) => setClass(e.target.value)}>
              {state.classes.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
            </select>
            <button onClick={addClass} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"><Plus className="h-3 w-3" />Add</button>
            <button onClick={renameClass} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"><Pencil className="h-3 w-3" />Rename</button>
          </div>
        </SectionCard>

        {/* Roster */}
        <RosterCard state={state} setState={setState} />

        {/* Skills (cascading) */}
        <SkillsCard state={state} setState={setState} />

        {/* Modifications / Settings */}
        <SettingsCard state={state} setState={setState} />
      </div>
    </div>
  );
}

// ----------------- Monitor Page -----------------
function MonitorPage({ state, setState }) {
  const currentClass = useMemo(
    () => state.classes.find(c => c.id === state.selectedClassId),
    [state]
  );
  const classSkills = useMemo(
    () => state.skills.filter(s => s.classIds.includes(state.selectedClassId)),
    [state]
  );
  const selectedSkill = classSkills.find(s => s.id === state.selectedSkillId) || null;

  useEffect(() => {
    if (!selectedSkill && classSkills[0]) {
      setState(p => ({ ...p, selectedSkillId: classSkills[0].id }));
    }
  }, [selectedSkill, classSkills, setState]);

  const setClass = (id) => setState(p => ({ ...p, selectedClassId: id }));
  const setSkill = (id) => setState(p => ({ ...p, selectedSkillId: id }));

  // --- seat interactions ---
  const studentName = (id) => currentClass.students.find(s => s.id === id)?.name ?? "";
  const getLevel = (studentId) => {
    if (!studentId || !selectedSkill) return 0;
    const lv = currentClass.marks[selectedSkill.id]?.[studentId];
    return typeof lv === "number" ? lv : 0;
  };
  const cycleSeatLevel = (studentId) => {
    if (!selectedSkill || !studentId) return;
    setState(prev => {
      const next = { ...prev };
      const cls = next.classes.find(c => c.id === prev.selectedClassId);
      if (!cls) return prev;
      const cur = cls.marks[selectedSkill.id]?.[studentId] ?? 0;
      const newLevel = (cur + 1) % 5;
      if (!cls.marks[selectedSkill.id]) cls.marks[selectedSkill.id] = {};
      cls.marks[selectedSkill.id][studentId] = newLevel;
      return next;
    });
  };

  const [moveMode, setMoveMode] = useState(false);
  const [moveSource, setMoveSource] = useState(null);
  const swapSeats = (a, b) => {
    setState(prev => {
      const next = { ...prev };
      const idx = next.classes.findIndex(c => c.id === prev.selectedClassId);
      if (idx < 0) return prev;
      const cls = { ...next.classes[idx] };
      const seats = cls.seats.map(s => ({ ...s }));
      const sa = seats.find(s => s.r === a.r && s.c === a.c);
      const sb = seats.find(s => s.r === b.r && s.c === b.c);
      if (!sa || !sb) return prev;
      const tmp = sa.studentId; sa.studentId = sb.studentId; sb.studentId = tmp;
      cls.seats = seats; next.classes[idx] = cls; return next;
    });
  };
  const onSeatClickGrid = (seat, wasDrag) => {
    if (wasDrag) return;
    if (state.editAssignMode) { openAssignModal(seat); return; }
    if (moveMode) {
      if (!moveSource) { setMoveSource({ r: seat.r, c: seat.c }); return; }
      swapSeats(moveSource, seat); setMoveSource(null); return;
    }
    if (seat.studentId) cycleSeatLevel(seat.studentId);
  };

  // free layout
  const boardRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragMoved, setDragMoved] = useState(false);
  const ensureXYForAll = () =>
    setState(p => {
      const next = { ...p };
      const idx = next.classes.findIndex(c => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] }; let changed = false;
      cls.seats = cls.seats.map(s => {
        if (typeof s.x === "number" && typeof s.y === "number") return s;
        changed = true;
        return { ...s, x: (s.c + 0.5) / cls.cols, y: (s.r + 0.5) / cls.rows };
      });
      if (changed) next.classes[idx] = cls;
      return next;
    });
  const setLayoutMode = (mode) => {
    setState(p => {
      const next = { ...p };
      const idx = next.classes.findIndex(c => c.id === p.selectedClassId);
      if (idx < 0) return p;
      next.classes[idx] = { ...next.classes[idx], layoutMode: mode };
      return next;
    });
    if (mode === "free") ensureXYForAll();
  };
  const onPointerDownSeat = (e, seat) => {
    if (currentClass.layoutMode !== "free") return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragMoved(false);
    setDragging({ r: seat.r, c: seat.c });
  };
  const onPointerMoveBoard = (e) => {
    if (currentClass.layoutMode !== "free" || !dragging) return;
    const board = boardRef.current; if (!board) return;
    const rect = board.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0.02, Math.min(0.98, x));
    const clampedY = Math.max(0.02, Math.min(0.98, y));
    setDragMoved(true);
    setState(p => {
      const next = { ...p };
      const idx = next.classes.findIndex(c => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      cls.seats = cls.seats.map(s => (dragging && s.r === dragging.r && s.c === dragging.c) ? { ...s, x: clampedX, y: clampedY } : s);
      next.classes[idx] = cls; return next;
    });
  };
  const onPointerUpBoard = () => setDragging(null);

  // assign modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignPos, setAssignPos] = useState(null);
  const [filter, setFilter] = useState("");
  const openAssignModal = (pos) => { setAssignPos(pos); setAssignOpen(true); };
  const assignSeat = (studentId) => {
    setState(p => {
      const next = { ...p };
      const idx = next.classes.findIndex(c => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      cls.seats = cls.seats.map(s => (assignPos && s.r === assignPos.r && s.c === assignPos.c) ? { ...s, studentId } : s);
      next.classes[idx] = cls; return next;
    });
    setAssignOpen(false);
  };

  if (!currentClass) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* Left: selectors & tools */}
        <div className="lg:col-span-3 rounded-3xl bg-white p-4 shadow-sm border">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <select className="rounded-xl border px-3 py-2 text-sm" value={state.selectedClassId} onChange={(e) => setClass(e.target.value)}>
                {state.classes.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-gray-500" />
              <select className="rounded-xl border px-3 py-2 text-sm" value={state.selectedSkillId || ""} onChange={(e)=> setSkill(e.target.value)}>
                {classSkills.length===0 && <option value="">(No skills linked to this class)</option>}
                {classSkills.map(sk => (
                  <option key={sk.id} value={sk.id}>
                    {sk.name}{sk.standardCode?` — ${sk.standardCode}`:""}{sk.description?` — ${sk.description}`:""}
                  </option>
                ))}
              </select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={()=>{ setMoveMode(!moveMode); setMoveSource(null); }} className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs ${moveMode?"bg-blue-50 border-blue-300":"hover:bg-slate-50"}`}>
                <Move3D className="h-3 w-3" /> {moveMode? "Move Seats: ON":"Move Seats"}
              </button>
              <button onClick={()=> setState(p=>({...p, editAssignMode: !p.editAssignMode}))} className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs ${state.editAssignMode? "bg-emerald-50 border-emerald-300":"hover:bg-slate-50"}`}>
                Edit Seat Assignment: {state.editAssignMode? "ON":"OFF"}
              </button>
              <button onClick={()=> currentClass.layoutMode==='grid' ? setLayoutMode('free') : setLayoutMode('grid')} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50">
                <LayoutTemplate className="h-3 w-3" /> Layout: {currentClass.layoutMode==='grid' ? "Grid" : "Free"}
              </button>
            </div>

            <Legend />
          </div>

          {/* Skill chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>Skill: {selectedSkill?.name ?? "—"}</Badge>
            {selectedSkill?.standardCode && <Badge>Std: {selectedSkill.standardCode}</Badge>}
            {selectedSkill?.domain && <Badge>Domain: {selectedSkill.domain}</Badge>}
            {selectedSkill?.description && <Badge>{selectedSkill.description}</Badge>}
          </div>

          {/* Seating Area */}
          <div className="mt-4">
            {currentClass.layoutMode === "grid" ? (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${currentClass.cols}, minmax(0, 1fr))` }}>
                {Array.from({ length: currentClass.rows * currentClass.cols }, (_, idx) => {
                  const r = Math.floor(idx / currentClass.cols);
                  const c = idx % currentClass.cols;
                  const seat = currentClass.seats.find(s => s.r===r && s.c===c) || { r, c, studentId: null };
                  const lv = getLevel(seat.studentId);
                  const meta = levelMeta[lv];
                  const name = studentName(seat.studentId);

                  let dragFlag = false;
                  return (
                    <button
                      key={`${r}-${c}`}
                      className={`relative rounded-2xl p-3 h-20 ring-2 ${meta.ring} ${meta.bg} transition focus:outline-none hover:brightness-95`}
                      onPointerDown={()=>{ dragFlag=false; }}
                      onPointerMove={()=>{ dragFlag=true; }}
                      onPointerUp={()=> onSeatClickGrid(seat, dragFlag)}
                      onDoubleClick={(e)=> e.preventDefault()}
                      onContextMenu={(e)=> e.preventDefault()}
                      title={state.editAssignMode ? "Tap to assign" : (seat.studentId ? "Tap to cycle level":"Turn on Edit Seat Assignment to set student")}
                    >
                      <div className={`text-sm font-semibold ${meta.text} line-clamp-2 pr-6`}>{name || "(empty)"}</div>
                      <div className="absolute bottom-2 right-2 text-[10px] text-gray-500">{meta.name}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div ref={boardRef} onPointerMove={onPointerMoveBoard} onPointerUp={onPointerUpBoard} className="relative w-full border rounded-2xl" style={{ height: 420 }}>
                {currentClass.seats.map(s => {
                  const x = typeof s.x === "number" ? s.x : (s.c + 0.5) / currentClass.cols;
                  const y = typeof s.y === "number" ? s.y : (s.r + 0.5) / currentClass.rows;
                  const lv = getLevel(s.studentId);
                  const meta = levelMeta[lv];
                  const name = studentName(s.studentId);
                  let movedHere = false;
                  return (
                    <button
                      key={`${s.r}-${s.c}`}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl p-3 h-20 w-36 ring-2 ${meta.ring} ${meta.bg} transition focus:outline-none hover:brightness-95`}
                      style={{ left: `${x*100}%`, top: `${y*100}%` }}
                      onPointerDown={(e)=> onPointerDownSeat(e, s)}
                      onPointerMove={()=>{ movedHere = true; }}
                      onPointerUp={()=> {
                        if (movedHere || dragMoved) return;
                        if (state.editAssignMode) openAssignModal({ r: s.r, c: s.c });
                        else if (s.studentId) cycleSeatLevel(s.studentId);
                      }}
                      onDoubleClick={(e)=> e.preventDefault()}
                      onContextMenu={(e)=> e.preventDefault()}
                      title={state.editAssignMode ? "Tap to assign" : (s.studentId ? "Tap to cycle level" : "Turn on Edit Seat Assignment to set student")}
                    >
                      <div className={`text-sm font-semibold ${meta.text} line-clamp-2 pr-6`}>{name || "(empty)"}</div>
                      <div className="absolute bottom-2 right-2 text-[10px] text-gray-500">{meta.name}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: quick roster for reference (read-only here) */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border">
          <h3 className="font-semibold mb-2">Roster (read-only in Monitor)</h3>
          <div className="max-h-[420px] overflow-y-auto divide-y">
            {currentClass.students.map(s => <div key={s.id} className="py-2 text-sm">{s.name}</div>)}
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Assign seat</h4>
              <button className="text-sm text-gray-500" onClick={()=>setAssignOpen(false)}>Close</button>
            </div>
            <input value={filter} onChange={(e)=> setFilter(e.target.value)} placeholder="Search student" className="w-full rounded-xl border px-3 py-2 text-sm" />
            <div className="mt-3 max-h-64 overflow-y-auto divide-y">
              <button className="w-full text-left py-2 px-2 hover:bg-slate-50 text-sm" onClick={()=> assignSeat(null)}>(empty)</button>
              {currentClass.students
                .filter(s => s.name.toLowerCase().includes(filter.toLowerCase()))
                .sort((a,b)=> a.name.localeCompare(b.name))
                .map(s => (
                  <button key={s.id} className="w-full text-left py-2 px-2 hover:bg-slate-50 text-sm" onClick={()=> assignSeat(s.id)}>
                    {s.name}
                  </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- Cards & Panels -----------------
function SectionCard({ title, icon, children }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm border">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-full bg-slate-100 grid place-items-center">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function RosterCard({ state, setState }) {
  const cl = state.classes.find(c => c.id === state.selectedClassId);
  const [newName, setNewName] = useState("");

  const nameExists = (nm) =>
    cl.students.some(s => s.name.trim().toLowerCase() === nm.trim().toLowerCase());

  const addStudent = (name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return false;
    if (nameExists(trimmed)) { alert("That name already exists in this class."); return false; }
    setState(p => {
      const next = { ...p };
      const idx = next.classes.findIndex(c => c.id === p.selectedClassId); if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      cls.students = [...cls.students, { id: uid(), name: trimmed }];
      next.classes[idx] = cls; return next;
    });
    return true;
  };

  const editStudent = (id, newName) => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    if (cl.students.find(s => s.name.trim().toLowerCase() === trimmed.toLowerCase() && s.id !== id)) {
      alert("That name already exists."); return;
    }
    setState(p => {
      const next = { ...p };
      const idx = next.classes.findIndex(c => c.id === p.selectedClassId); if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      cls.students = cls.students.map(s => s.id === id ? { ...s, name: trimmed } : s);
      next.classes[idx] = cls; return next;
    });
  };

  const deleteStudent = (id) => {
    if (!confirm("Remove this student from the class? This will clear their marks and unassign their seat.")) return;
    setState(p => {
      const next = { ...p };
      const idx = next.classes.findIndex(c => c.id === p.selectedClassId); if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      cls.seats = cls.seats.map(s => s.studentId === id ? { ...s, studentId: null } : s);
      for (const k of Object.keys(cls.marks)) if (cls.marks[k] && id in cls.marks[k]) delete cls.marks[k][id];
      cls.students = cls.students.filter(s => s.id !== id);
      next.classes[idx] = cls; return next;
    });
  };

  const clearAllForStudent = (id) =>
    setState(p => {
      const next = { ...p };
      const idx = next.classes.findIndex(c => c.id === p.selectedClassId); if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      for (const k of Object.keys(cls.marks)) if (cls.marks[k] && id in cls.marks[k]) delete cls.marks[k][id];
      next.classes[idx] = cls; return next;
    });

  const onSubmit = (e) => {
    e.preventDefault();
    if (addStudent(newName)) setNewName("");
  };

  return (
    <SectionCard title="Roster" icon={<ListChecks className="h-4 w-4" />}>
      <form onSubmit={onSubmit} className="flex items-center gap-2 mb-2">
        <input value={newName} onChange={(e)=> setNewName(e.target.value)} placeholder="First Last" className="flex-1 rounded-xl border px-2 py-1 text-sm" />
        <button type="submit" className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50">Add</button>
      </form>
      <div className="max-h-64 overflow-y-auto divide-y">
        {cl.students.map(s => <StudentRow key={s.id} s={s} editStudent={editStudent} deleteStudent={deleteStudent} clearAllForStudent={clearAllForStudent} />)}
      </div>
    </SectionCard>
  );
}

function StudentRow({ s, editStudent, deleteStudent, clearAllForStudent }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(s.name);
  const onSave = () => { editStudent(s.id, val); setEditing(false); };
  return (
    <div className="py-2 flex items-center justify-between gap-2">
      {editing ? (
        <input value={val} onChange={(e)=> setVal(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter") onSave(); if(e.key==="Escape") setEditing(false); }} className="flex-1 rounded-xl border px-2 py-1 text-sm" />
      ) : (
        <div className="text-sm flex-1">{s.name}</div>
      )}
      {editing ? (
        <div className="flex items-center gap-2">
          <button className="text-xs" onClick={onSave}>Save</button>
          <button className="text-xs text-gray-500" onClick={()=> setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button className="text-xs text-blue-600" onClick={()=> setEditing(true)}><Pencil className="h-3 w-3 inline mr-1" />Edit</button>
          <button className="text-xs text-amber-700" onClick={()=> clearAllForStudent(s.id)}>Clear all</button>
          <button className="text-xs text-red-600" onClick={()=> deleteStudent(s.id)}><Trash2 className="h-3 w-3 inline mr-1" />Delete</button>
        </div>
      )}
    </div>
  );
}

function SkillsCard({ state, setState }) {
  const currentClass = useMemo(() => state.classes.find(c => c.id === state.selectedClassId), [state]);
  const classSkills = useMemo(() => state.skills.filter(s => s.classIds.includes(state.selectedClassId)), [state]);
  const selectedSkill = classSkills.find(s => s.id === state.selectedSkillId) || null;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // skill or null

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = () => { if (!selectedSkill) return; setEditing(selectedSkill); setFormOpen(true); };

  const deleteSkill = () => {
    if (!selectedSkill) return;
    if (!confirm(`Delete skill "${selectedSkill.name}"? This will remove its marks.`)) return;
    setState(p => ({
      ...p,
      classes: p.classes.map(cl => { const cls = { ...cl, marks: { ...cl.marks } }; delete cls.marks[selectedSkill.id]; return cls; }),
      skills: p.skills.filter(s => s.id !== selectedSkill.id),
      selectedSkillId: p.selectedSkillId === selectedSkill.id ? null : p.selectedSkillId
    }));
  };

  const linkSkillToClasses = () => {
    if (!selectedSkill) return;
    const currentNames = selectedSkill.classIds.map(id => state.classes.find(c => c.id === id)?.name || id).join(", ");
    const names = prompt(`Link skill to which classes? Separate names by commas.\nCurrent: ${currentNames}`);
    if (names == null) return;
    const wanted = names.split(",").map(s => s.trim()).filter(Boolean);
    const ids = state.classes.filter(cl => wanted.includes(cl.name)).map(cl => cl.id);
    if (!ids.length) { alert("No matching class names."); return; }
    setState(p => ({ ...p, skills: p.skills.map(s => s.id === selectedSkill.id ? { ...s, classIds: [...new Set(ids)] } : s) }));
  };

  return (
    <SectionCard title="Skills (Setup)" icon={<SlidersHorizontal className="h-4 w-4" />}>
      <div className="flex items-center gap-2">
        <select className="rounded-xl border px-3 py-2 text-sm" value={state.selectedSkillId || ""} onChange={(e)=> setState(p=> ({ ...p, selectedSkillId: e.target.value }))}>
          {classSkills.length===0 && <option value="">(No skills linked to this class)</option>}
          {classSkills.map(sk => (
            <option key={sk.id} value={sk.id}>
              {sk.name}{sk.standardCode?` — ${sk.standardCode}`:""}{sk.description?` — ${sk.description}`:""}
            </option>
          ))}
        </select>
        <button onClick={openNew} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"><Plus className="h-3 w-3" />Add</button>
        <button onClick={openEdit} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"><Pencil className="h-3 w-3" />Rename/Edit</button>
        <button onClick={linkSkillToClasses} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"><LinkIcon className="h-3 w-3" />Link</button>
        <button onClick={deleteSkill} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50 text-red-600"><Trash2 className="h-3 w-3" />Delete</button>
      </div>

      {formOpen && (
        <SkillForm
          close={() => setFormOpen(false)}
          initial={editing}
          onSave={(vals) => {
            const { id, name, domain, standardCode, description, classIds } = vals;
            if (id) {
              // update
              setState(p => ({ ...p, skills: p.skills.map(s => s.id === id ? { ...s, name, domain, standardCode, description, classIds } : s) }));
            } else {
              // create (link to current class by default if none provided)
              const linkIds = classIds && classIds.length ? classIds : [state.selectedClassId];
              setState(p => ({ ...p, skills: [...p.skills, { id: uid(), name, domain, standardCode, description, classIds: linkIds }] }));
            }
            setFormOpen(false);
          }}
        />
      )}
    </SectionCard>
  );
}

function SkillForm({ initial, onSave, close }) {
  const [name, setName] = useState(initial?.name || "");
  const [domain, setDomain] = useState(initial?.domain || "");
  const [standard, setStandard] = useState(initial?.standardCode || "");
  const [otherDomain, setOtherDomain] = useState("");
  const [otherStandard, setOtherStandard] = useState("");
  const [description, setDescription] = useState(initial?.description || "");

  const currentDomain = domain === "__other__" ? otherDomain : domain;
  const currentStandard = standard === "__other__" ? otherStandard : standard;

  const domainOptions = ["", ...NC_DOMAINS, "__other__"];
  const standardOptions = ["", ...(NC7[domain] || []).map(([code]) => code), "__other__"];

  const save = () => {
    if (!name.trim()) { alert("Skill name is required."); return; }
    const cleanStd = currentStandard ? cleanStandard(currentStandard.trim()) : undefined;
    onSave({
      id: initial?.id,
      name: name.trim(),
      domain: currentDomain ? currentDomain : undefined,
      standardCode: cleanStd,
      description: description.trim() ? description.trim() : undefined,
      classIds: initial?.classIds || [],
    });
  };

  return (
    <div className="mt-3 rounded-2xl border p-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">Skill name</label>
          <input value={name} onChange={(e)=> setName(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g., Distributive Property" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Short description (optional)</label>
          <input value={description} onChange={(e)=> setDescription(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g., with integers only" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Domain (blank or pick)</label>
          <select value={domain} onChange={(e)=> setDomain(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
            {domainOptions.map(opt => <option key={opt} value={opt}>{opt === "" ? "— (blank)" : opt === "__other__" ? "Other…" : opt}</option>)}
          </select>
          {domain === "__other__" && (
            <input value={otherDomain} onChange={(e)=> setOtherDomain(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm" placeholder="Enter custom domain" />
          )}
        </div>
        <div>
          <label className="text-xs text-slate-500">Standard (filtered by domain; blank or pick)</label>
          <select value={standard} onChange={(e)=> setStandard(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
            {standardOptions.map(opt => <option key={opt} value={opt}>{opt === "" ? "— (blank)" : opt === "__other__" ? "Other…" : opt}</option>)}
          </select>
          {standard === "__other__" && (
            <input value={otherStandard} onChange={(e)=> setOtherStandard(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm" placeholder="Enter custom code (e.g., EE.3)" />
          )}
          {domain && NC7[domain] && standard && standard !== "__other__" && (
            <p className="text-xs text-slate-500 mt-1">
              {(NC7[domain].find(([code]) => code === standard) || [,""])[1]}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} className="rounded-xl border px-3 py-1 text-sm bg-emerald-600 text-white hover:bg-emerald-700">Save</button>
        <button onClick={close} className="rounded-xl border px-3 py-1 text-sm hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}

function SettingsCard({ state, setState }) {
  const cl = state.classes.find(c => c.id === state.selectedClassId);
  const [rows, setRows] = useState(cl.rows);
  const [cols, setCols] = useState(cl.cols);
  useEffect(() => { setRows(cl.rows); setCols(cl.cols); }, [cl.rows, cl.cols]);

  const applySize = () => setState(p => {
    const next = { ...p };
    const idx = next.classes.findIndex(c => c.id === p.selectedClassId); if (idx < 0) return p;
    const cls = { ...next.classes[idx] };
    const seats = [];
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
      const ex = cls.seats.find(s => s.r===r && s.c===c);
      seats.push(ex ? ex : { r, c, studentId: null });
    }
    cls.rows = rows; cls.cols = cols; cls.seats = seats; next.classes[idx] = cls; return next;
  });

  return (
    <SectionCard title="Modifications" icon={<Wrench className="h-4 w-4" />}>
      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium mb-1">Edit Seat Assignment Mode</div>
          <button onClick={()=> setState(p=> ({ ...p, editAssignMode: !p.editAssignMode }))} className={`rounded-xl border px-3 py-1 text-sm ${state.editAssignMode ? "bg-emerald-50 border-emerald-300" : "hover:bg-slate-50"}`}>
            {state.editAssignMode ? "ON" : "OFF"}
          </button>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Layout Mode</div>
          <div className="flex items-center gap-2">
            <button onClick={()=> setState(p=> { const next={...p}; const idx=next.classes.findIndex(c=> c.id===p.selectedClassId); next.classes[idx] = { ...next.classes[idx], layoutMode: "grid" }; return next; })} className={`rounded-xl border px-3 py-1 text-sm ${cl.layoutMode==="grid" ? "bg-slate-100" : "hover:bg-slate-50"}`}>Grid</button>
            <button onClick={()=> setState(p=> { const next={...p}; const idx=next.classes.findIndex(c=> c.id===p.selectedClassId); next.classes[idx] = { ...next.classes[idx], layoutMode: "free" }; return next; })} className={`rounded-xl border px-3 py-1 text-sm ${cl.layoutMode==="free" ? "bg-slate-100" : "hover:bg-slate-50"}`}>Free</button>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Grid Size</div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={24} value={rows} onChange={(e)=> setRows(parseInt(e.target.value || "1"))} className="w-20 rounded-xl border px-2 py-1 text-sm" />
            <span className="text-sm text-gray-600">×</span>
            <input type="number" min={1} max={24} value={cols} onChange={(e)=> setCols(parseInt(e.target.value || "1"))} className="w-20 rounded-xl border px-2 py-1 text-sm" />
            <button onClick={applySize} className="rounded-xl border px-3 py-1 text-sm hover:bg-slate-50">Apply</button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ----------------- UI Bits -----------------
function TopExport({ state }) {
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `monitoring-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  return (
    <button onClick={exportJSON} className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm bg-white hover:bg-slate-50 border">
      <Download className="h-4 w-4" /> Export
    </button>
  );
}
function TopImport({ onImport }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm bg-white hover:bg-slate-50 border cursor-pointer">
      <Upload className="h-4 w-4" /> Import
      <input
        type="file" accept="application/json" className="hidden"
        onChange={(e)=> {
          const f = e.target.files?.[0]; if (!f) return;
          const reader = new FileReader();
          reader.onload = ()=> { try { onImport(String(reader.result)); } catch { alert("Invalid JSON file."); } };
          reader.readAsText(f);
        }}
      />
    </label>
  );
}

function Badge({ children }) {
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100">{children}</span>;
}

function Legend() {
  return (
    <div className="flex items-center gap-3 ml-2">
      {Object.entries(levelMeta).map(([k,m])=> (
        <div key={k} className="flex items-center gap-1 text-xs text-gray-600">
          <span className={`h-3 w-3 inline-block rounded ${m.bg} ring-1 ${m.ring}`}></span>{m.name}
        </div>
      ))}
    </div>
  );
}

// ----------------- Lightweight Tests -----------------
(function runTests(){
  const bad = JSON.stringify({ classes:[{ id:"A", rows:"x", cols:null, seats:[{}], students:[{}] }], skills:[{ id:1, name:2, standardCode:3, classIds:"nope" }] });
  const s1 = migrateLegacy(bad);
  console.assert(Array.isArray(s1.classes) && s1.classes.length >= 1, "classes present");
  console.assert(Array.isArray(s1.skills), "skills array present");
  const raw2 = JSON.stringify({ classes:[{ id:"C1", rows:1, cols:1, seats:[{r:0,c:0,studentId:null}], students:[], marks:{}, skills:[{name:"Old", standardCode:"NC.7.EE.3"}] }], selectedClassId:"C1" });
  const s2 = migrateLegacy(raw2);
  const anyStd = (s2.skills.find(x => x.standardCode) || {}).standardCode || "";
  console.assert(!anyStd.startsWith("NC.7."), "NC.7 stripped");
})();
