import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, Upload, Plus, Pencil, Users, Settings, Home as HomeIcon,
  ListChecks, GraduationCap, Trash2, Wrench, Table2
} from "lucide-react";

/* ---------------------------------------------------------
   Academic Monitoring — v9.0 (User-requested updates)
   - Grade 7 NC Math Domains/Standards helpers (display strips "NC.7.")
   - Skills keep Domain/Standard OPTIONAL (no requirement to fill)
   - Removed "Advanced" level entirely (4 → mapped down to 3)
   - Student Detail view (from Setup › Roster): per-student skill summary
   - Compare view: pick 1–3 skills, table of students × skill colors
   - Legend becomes a left fly-out; header centered; tabs moved up
   - ABSENT seats: greyed desk with a bold X overlay; name stays visible
   - All changes preserve previous functionality and data
   --------------------------------------------------------- */

// Storage key
const lsKey = "seating-monitor-v7-1";

// Default blank app state
const blankState = {
  tab: "Home", // "Home" | "Setup" | "Monitor" | "Student" | "Compare"
  classes: [],
  selectedClassId: null,
  skills: [],
  selectedSkillId: null,
  selectedStudentId: null,
  editAssignMode: "assign" // or "unassign", etc.
};

// --- Grade 7 Domains/Standards map (short labels + short descriptions) ---
// NOTE: We strip any "NC.7." prefix on display. Authoring can still store full code.
const G7_DOMAINS = [
  { id: "RP", name: "Ratios & Proportions" },
  { id: "NS", name: "Number System" },
  { id: "EE", name: "Expressions & Equations" },
  { id: "G",  name: "Geometry" },
  { id: "SP", name: "Statistics & Probability" },
];

// Short, classroom-friendly descriptions. Not exhaustive, but covers common skills.
const G7_STANDARDS = {
  // RP
  "RP.1": "Compute unit rates (incl. complex fractions).",
  "RP.2": "Recognize & represent proportional relationships.",
  "RP.3": "Use percent problems incl. tax/discount/tip.",
  // NS
  "NS.1": "Add/subtract rational numbers; number line reasoning.",
  "NS.2": "Multiply/divide rational numbers; sign rules.",
  "NS.3": "Apply operations with rational numbers to real-world problems.",
  // EE
  "EE.1": "Use properties to add/subtract/multiply linear expressions.",
  "EE.2": "Understand that rewriting expressions reveals structure.",
  "EE.3": "Solve multi-step problems with positive/negative rational numbers.",
  "EE.4": "Use variables, write/simplify expressions, combine like terms.",
  // G
  "G.1":  "Scale drawings, scale factor, area/length relationships.",
  "G.2":  "Draw geometric figures with given conditions.",
  "G.3":  "Describe two-dimensional figures from angles/lines.",
  "G.4":  "Area & circumference; relate diameter/radius.",
  "G.5":  "Angle measure, area, surface area, volume problems.",
  "G.6":  "Solve real-world problems involving area/volume.",
  // SP
  "SP.1": "Understand & use sampling to draw inferences.",
  "SP.2": "Compare two populations with measures of center/variability.",
  "SP.3": "Chance processes; approximate probabilities via simulation.",
  "SP.4": "Develop & use probability models; compound events."
};

// Helper: display a standard without "NC.7." prefix. Accepts "NC.7.NS.1" or "NS.1".
function prettyStandard(stdCode) {
  if (!stdCode) return "";
  const s = String(stdCode).replace(/^NC\.7\./i, "");
  return s;
}

// --- Levels (Advanced removed). We remap any legacy 4 → 3. ---
const LEVELS = {
  0: { name: "Help",        bg: "bg-rose-100",    ring: "ring-rose-300",    text: "text-rose-800" },
  1: { name: "Approaching", bg: "bg-yellow-100",  ring: "ring-yellow-300",  text: "text-yellow-900" },
  2: { name: "Developing",  bg: "bg-amber-100",   ring: "ring-amber-300",   text: "text-amber-800" },
  3: { name: "Proficient",  bg: "bg-emerald-100", ring: "ring-emerald-300", text: "text-emerald-800" },
  5: { name: "ABSENT",      bg: "bg-gray-200",    ring: "ring-gray-300",    text: "text-gray-800" } // special rendering in seats
};
const validLevels = [0,1,2,3,5];

// Flags
const FLAG_META = {
  ml:      { label: "ML",      dot: "bg-sky-500" },
  mlNew:   { label: "ML New",  dot: "bg-indigo-500" },
  iep504:  { label: "IEP/504", dot: "bg-purple-500" },
  ec:      { label: "EC",      dot: "bg-orange-500" },
  bubble:  { label: "Bubble",  dot: "bg-rose-500" },
};
const flagKeys = Object.keys(FLAG_META);

// Defensive: check if state has content before cloud-save
const isMeaningful = (s) => {
  try {
    const cls = s?.classes || [];
    const anyStudents = cls.some(c => (c.students || []).length > 0);
    const anySkills = (s?.skills || []).length > 0;
    const anyMarks = cls.some(c => c.marks && Object.keys(c.marks).length > 0);
    return anyStudents || anySkills || anyMarks;
  } catch {
    return false;
  }
};

// Normalize imported/loaded state
function normalizeState(input) {
  const s = JSON.parse(JSON.stringify(input || {}));
  if (!Array.isArray(s.classes)) s.classes = [];
  if (!Array.isArray(s.skills)) s.skills = [];
  if (!("tab" in s)) s.tab = "Home";

  // Ensure each class has shape
  s.classes = s.classes.map((c, idx) => ({
    id: c.id || `class-${idx}`,
    name: c.name || `Block ${idx+1}`,
    rows: c.rows ?? 4,
    cols: c.cols ?? 9,
    layoutMode: c.layoutMode || "grid",
    seats: Array.isArray(c.seats) ? c.seats : [],
    students: Array.isArray(c.students) ? c.students : [],
    marks: c.marks || {},
  }));

  // Default selections
  if (!s.selectedClassId && s.classes[0]) s.selectedClassId = s.classes[0].id;
  if (!s.selectedSkillId && s.skills[0]) s.selectedSkillId = s.skills[0].id;

  // Map out-of-date level "4: Advanced" → "3: Proficient"
  s.classes.forEach(cls => {
    if (cls.marks) {
      Object.keys(cls.marks).forEach(k => {
        const v = cls.marks[k];
        if (v === 4) cls.marks[k] = 3;
      });
    }
  });

  // Skills keep Domain/Standard OPTIONAL
  s.skills = s.skills.map(sk => ({
    id: sk.id || cryptoRandomId(),
    name: sk.name || "Untitled Skill",
    domain: sk.domain || null,   // Optional
    standard: sk.standard || sk.std || null, // accept legacy 'std'
    classIds: Array.isArray(sk.classIds) ? sk.classIds : [],
  }));

  return s;
}

// Random id (stable enough for client use)
function cryptoRandomId() {
  return Math.random().toString(36).slice(2,10);
}

// Helpers
function clsx(...arr){ return arr.filter(Boolean).join(" "); }
function Button({icon:Icon, children, onClick, className="", title}){
  return (
    <button
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
function Tiny({children}){ return <span className="text-[12px] text-slate-500">{children}</span>; }
function Dot({className}){ return <span className={clsx("inline-block w-2 h-2 rounded-full", className)} />; }

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
          {[0,1,2,3,5].map(lv=> (
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
          Absent seats appear greyed with an X across the desk. Names stay visible.
        </div>
      </div>
    </div>
  );
}

// Seat rendering (ABSENT = 5): grey + X overlay
function Seat({seat, student, level, onClick}){
  const isAbsent = level === 5;
  return (
    <div
      onClick={onClick}
      className={clsx(
        "relative rounded-xl border p-2 text-xs min-h-[56px] cursor-pointer select-none",
        isAbsent ? "bg-gray-100 border-gray-300" : "bg-white border-slate-300 hover:shadow-sm"
      )}
    >
      {isAbsent && (
        <>
          <div className="absolute inset-0 pointer-events-none opacity-70">
            {/* Diagonal lines forming an X */}
            <div className="absolute left-0 top-1/2 w-full h-[2px] bg-gray-400 rotate-45"></div>
            <div className="absolute left-0 top-1/2 w-full h-[2px] bg-gray-400 -rotate-45"></div>
          </div>
        </>
      )}
      <div className="flex items-center justify-between">
        <div className="font-medium text-slate-800 truncate">{student?.name || "—"}</div>
        <div className={clsx("px-2 py-0.5 rounded-full text-[10px] ring-1", LEVELS[level||0].ring, LEVELS[level||0].bg, LEVELS[level||0].text)}>
          {LEVELS[level||0].name}
        </div>
      </div>
      <div className="mt-1 flex gap-1 flex-wrap">
        {flagKeys.filter(k => student?.flags?.[k]).map(k => (
          <Dot key={k} className={FLAG_META[k].dot} />
        ))}
      </div>
    </div>
  );
}

// Simple seat grid
function SeatGrid({cls, marks, onSeatClick, studentById, selectedSkillId, compareSliceColors}){
  const rows = cls.rows || 4, cols = cls.cols || 9;
  const grid = Array.from({length: rows}).map((_,r)=> Array.from({length: cols}).map((__,c)=> cls.seats.find(s => s.r===r && s.c===c) || {r,c,studentId:null}));
  return (
    <div className="grid gap-2" style={{gridTemplateColumns: `repeat(${cols}, minmax(110px, 1fr))`}}>
      {grid.flat().map((seat, i) => {
        const student = studentById(seat.studentId);
        const k = selectedSkillId && student ? `${student.id}:${selectedSkillId}` : null;
        const rawLevel = k && marks ? marks[k] : null;
        const level = rawLevel === 4 ? 3 : (validLevels.includes(rawLevel) ? rawLevel : 0);
        return (
          <div key={i} className="relative">
            {/* Optional 3-slice compare overlay */}
            {compareSliceColors?.length > 0 && (
              <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1/3" style={{backgroundColor: compareSliceColors[0]||"transparent", opacity:.25}}/>
                <div className="absolute top-1/3 left-0 right-0 h-1/3" style={{backgroundColor: compareSliceColors[1]||"transparent", opacity:.25}}/>
                <div className="absolute top-2/3 left-0 right-0 h-1/3" style={{backgroundColor: compareSliceColors[2]||"transparent", opacity:.25}}/>
              </div>
            )}
            <Seat seat={seat} student={student} level={level} onClick={()=> onSeatClick?.(seat, student, level)} />
          </div>
        );
      })}
    </div>
  );
}

// Student card for detail view
function StudentCard({student, cls, skills, marks}){
  const grouped = useMemo(() => {
    const byStd = {};
    skills.forEach(sk => {
      const std = prettyStandard(sk.standard) || "—";
      const key = `${std}`;
      if (!byStd[key]) byStd[key] = [];
      byStd[key].push(sk);
    });
    return byStd;
  }, [skills]);

  const row = (sk) => {
    const mKey = `${student.id}:${sk.id}`;
    let lv = marks?.[mKey];
    if (lv === 4) lv = 3;
    lv = validLevels.includes(lv) ? lv : 0;
    return (
      <div key={sk.id} className="flex items-center justify-between py-1 border-b last:border-0">
        <div className="text-sm">
          <div className="font-medium">{sk.name}</div>
          <div className="text-xs text-slate-500">
            {prettyStandard(sk.standard)}
            {G7_STANDARDS[prettyStandard(sk.standard)] ? ` — ${G7_STANDARDS[prettyStandard(sk.standard)]}` : ""}
          </div>
        </div>
        <div className={clsx("px-2 py-0.5 rounded-full text-[11px] ring-1", LEVELS[lv].ring, LEVELS[lv].bg, LEVELS[lv].text)}>
          {LEVELS[lv].name}
        </div>
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
        <div key={std} className="border rounded-2xl">
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

// Compare view: select up to 3 skills; table students × skills; sortable
function CompareTable({cls, skills, marks}){
  const [selected, setSelected] = useState([]); // array of skill ids (max 3)
  const [sortKey, setSortKey] = useState("name"); // "name" or skillId
  const [sortDir, setSortDir] = useState("asc");

  const selectable = skills;
  const toggleSel = (id) => {
    setSelected((arr) => {
      if (arr.includes(id)) return arr.filter(x => x !== id);
      if (arr.length >= 3) return [...arr.slice(1), id];
      return [...arr, id];
    });
  };

  const rows = (cls?.students || []).map(st => {
    const cells = selected.map(sid => {
      let lv = marks?.[`${st.id}:${sid}`];
      if (lv === 4) lv = 3;
      lv = validLevels.includes(lv) ? lv : 0;
      return { sid, lv };
    });
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

  const colorFor = (lv) => {
    switch (lv) {
      case 0: return "#fecaca"; // rose-200-ish
      case 1: return "#fef08a"; // yellow-200-ish
      case 2: return "#fde68a"; // amber-200-ish
      case 3: return "#bbf7d0"; // green-200-ish
      case 5: return "#e5e7eb"; // gray-200-ish
      default: return "#ffffff";
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        {selectable.map(sk => (
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

      {selected.length > 0 ? (
        <div className="overflow-auto border rounded-2xl">
          <table className="min-w-[720px] w-full">
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
                      <div className="font-medium">{sk?.name}</div>
                      <div className="text-xs text-slate-500">
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
                      <div className="h-6 rounded-md ring-1" style={{background: colorFor(lv), borderColor: "#e5e7eb"}} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-slate-500 text-sm">Pick up to three skills to compare.</div>
      )}
    </div>
  );
}

// Main app
export default function App(){
  const [state, setState] = useState(blankState);
  const [legendOpen, setLegendOpen] = useState(false);

  // Boot: load from localStorage if present
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const s = normalizeState(JSON.parse(raw));
        setState(s);
      }
    } catch {}
  }, []);

  // Persist to localStorage (do not auto-push to cloud here)
  useEffect(() => {
    try {
      localStorage.setItem(lsKey, JSON.stringify(state));
    } catch {}
  }, [state]);

  const currentClass = useMemo(() => (state.classes || []).find(c => c.id === state.selectedClassId), [state]);
  const studentById = (id) => (currentClass?.students || []).find(s => s.id === id) || null;

  // Header actions
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

  // Setup helpers
  const addClass = () => setState(s => {
    const id = cryptoRandomId();
    const cls = { id, name: `Block ${s.classes.length+1}`, rows:4, cols:9, layoutMode:"grid", seats:[], students:[], marks:{} };
    return {...s, classes: [...s.classes, cls], selectedClassId: id};
  });
  const addStudent = () => {
    const name = prompt("Student name?");
    if (!name || !currentClass) return;
    setState(s => ({
      ...s,
      classes: s.classes.map(c => c.id === currentClass.id ? {
        ...c,
        students: [...(c.students||[]), { id: cryptoRandomId(), name, flags:{} }]
      } : c)
    }));
  };
  const openStudentDetail = (st) => setState(s => ({...s, selectedStudentId: st.id, tab: "Student"}));

  const addSkill = () => {
    const name = prompt("Skill name?");
    if (!name) return;
    const domain = prompt("Domain (optional, e.g., RP, NS, EE, G, SP) — can leave blank");
    const standard = prompt("Standard (optional, e.g., NS.1 or NC.7.NS.1) — can leave blank");
    setState(s => ({
      ...s,
      skills: [...s.skills, {
        id: cryptoRandomId(),
        name,
        domain: domain || null,
        standard: standard || null,
        classIds: s.classes.map(c => c.id)
      }]
    }));
  };

  // Monitor interactions (mark level)
  const setMark = (studentId, skillId, level) => {
    if (!currentClass) return;
    setState(s => ({
      ...s,
      classes: s.classes.map(c => {
        if (c.id !== currentClass.id) return c;
        const k = `${studentId}:${skillId}`;
        const v = (level === 4) ? 3 : level; // map 4 → 3 defensively
        const marks = {...(c.marks || {})};
        if (validLevels.includes(v)) marks[k] = v;
        return {...c, marks};
      })
    }));
  };

  // Header (centered, tabs inline with import/export)
  const Header = () => (
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
        <div className="justify-self-start">
          <button className="rounded-full border px-3 py-1 text-sm" onClick={()=>setLegendOpen(true)} title="Open legend">Legend</button>
        </div>
        <div className="justify-self-center text-center">
          <div className="text-xl font-bold">Academic Monitoring</div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border bg-white p-1">
            {["Home","Setup","Monitor","Compare"].map(t => (
              <Pill key={t} active={state.tab===t} onClick={()=>switchTab(t)}>{t}</Pill>
            ))}
          </div>
        </div>
        <div className="justify-self-end flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border cursor-pointer text-sm">
            <Upload size={16}/> Import
            <input type="file" accept="application/json" className="hidden" onChange={importJSON} />
          </label>
          <Button icon={Download} onClick={exportJSON}>Export</Button>
        </div>
      </div>
    </div>
  );

  // HOME
  const Home = () => (
    <div className="max-w-3xl mx-auto p-6 text-center">
      <div className="text-2xl font-bold mb-2">Welcome</div>
      <p className="text-slate-600">Use <b>Setup</b> to build classes, rosters, and skills. Use <b>Monitor</b> to color seats by skill. Try <b>Compare</b> to see 1–3 skills per student in a sortable table.</p>
    </div>
  );

  // SETUP
  const Setup = () => (
    <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Classes */}
      <div className="border rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold flex items-center gap-2"><HomeIcon size={16}/>Classes</div>
          <Button icon={Plus} onClick={addClass}>Add Class</Button>
        </div>
        <div className="space-y-1">
          {(state.classes || []).map(c => (
            <div
              key={c.id}
              className={clsx("px-3 py-2 rounded-xl border cursor-pointer", state.selectedClassId===c.id ? "bg-slate-900 text-white border-slate-900" : "bg-white")}
              onClick={()=> setState(s => ({...s, selectedClassId: c.id}))}
            >
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
                <div className="flex items-center gap-2">
                  <div className="font-medium">{st.name}</div>
                  <div className="flex gap-1">
                    {flagKeys.filter(k => st?.flags?.[k]).map(k => <Dot key={k} className={FLAG_META[k].dot} />)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button icon={ListChecks} onClick={()=>openStudentDetail(st)} className="!px-2" title="Open student detail">Open</Button>
                  <Button icon={Trash2} onClick={()=>{
                    if (!confirm("Remove this student from the class?")) return;
                    setState(s => ({
                      ...s,
                      classes: s.classes.map(c => {
                        if (c.id !== currentClass.id) return c;
                        const students = (c.students||[]).filter(x => x.id !== st.id);
                        const marks = Object.fromEntries(Object.entries(c.marks||{}).filter(([k]) => !k.startsWith(`${st.id}:`)));
                        return {...c, students, marks};
                      })
                    }));
                  }} className="!px-2">Remove</Button>
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
          <Button icon={Plus} onClick={addSkill}>Add Skill</Button>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
          {(state.skills || []).map(sk => (
            <div key={sk.id} className="px-3 py-2 rounded-xl border">
              <div className="flex items-center justify-between">
                <div className="font-medium">{sk.name}</div>
                <Tiny>{sk.classIds?.length || 0} classes</Tiny>
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {sk.domain ? <span className="mr-2">Domain: <b>{G7_DOMAINS.find(d=>d.id===sk.domain)?.name || sk.domain}</b></span> : <span className="mr-2 opacity-60">Domain: (optional)</span>}
                {sk.standard ? (
                  <span>Standard: <b>{prettyStandard(sk.standard)}</b>{G7_STANDARDS[prettyStandard(sk.standard)] ? ` — ${G7_STANDARDS[prettyStandard(sk.standard)]}` : ""}</span>
                ) : <span className="opacity-60">Standard: (optional)</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // MONITOR
  const Monitor = () => {
    const cls = currentClass;
    const skills = state.skills || [];
    const selSkill = skills.find(s => s.id === state.selectedSkillId) || null;

    const [sliceSkillIds, setSliceSkillIds] = useState([]); // up to 3 to overlay on seats

    useEffect(() => {
      setSliceSkillIds([]); // reset on class change
    }, [cls?.id]);

    const compareColors = sliceSkillIds.map((sid, idx) => {
      // pick a neutral color per slot; we draw soft overlays only
      return ["#60a5fa", "#f59e0b", "#10b981"][idx] || null; // blue / amber / green
    });

    return (
      <div className="max-w-6xl mx-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="font-semibold">Class:</div>
            <select
              className="border rounded-xl px-3 py-1"
              value={state.selectedClassId || ""}
              onChange={e => setState(s => ({...s, selectedClassId: e.target.value}))}
            >
              {(state.classes||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="font-semibold">Skill:</div>
            <select
              className="border rounded-xl px-3 py-1"
              value={state.selectedSkillId || ""}
              onChange={e => setState(s => ({...s, selectedSkillId: e.target.value}))}
            >
              {(state.skills||[]).map(sk => <option key={sk.id} value={sk.id}>{sk.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="font-semibold">Overlay (up to 3):</div>
            <div className="flex gap-1">
              {(state.skills||[]).map(sk => {
                const active = sliceSkillIds.includes(sk.id);
                return (
                  <button
                    key={sk.id}
                    onClick={() => {
                      setSliceSkillIds(old => {
                        if (old.includes(sk.id)) return old.filter(x => x !== sk.id);
                        if (old.length >= 3) return [...old.slice(1), sk.id];
                        return [...old, sk.id];
                      });
                    }}
                    className={clsx("px-2 py-1 rounded-full border text-xs", active ? "bg-slate-900 text-white border-slate-900" : "")}
                    title={(prettyStandard(sk.standard) ? `${prettyStandard(sk.standard)} — ` : "") + (G7_STANDARDS[prettyStandard(sk.standard)] || "")}
                  >
                    {sk.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          {cls ? (
            <SeatGrid
              cls={cls}
              marks={cls.marks}
              studentById={studentById}
              selectedSkillId={state.selectedSkillId}
              onSeatClick={(seat, student, level)=>{
                if (!student || !state.selectedSkillId) return;
                // Cycle levels: 0→1→2→3→5(ABSENT)→0
                const order = [0,1,2,3,5];
                const next = order[(order.indexOf(level ?? 0) + 1) % order.length];
                setMark(student.id, state.selectedSkillId, next);
              }}
              compareSliceColors={compareColors}
            />
          ) : <Tiny>No class selected.</Tiny>}
        </div>
      </div>
    );
  };

  // STUDENT (detail)
  const Student = () => {
    const cls = currentClass;
    const st = (cls?.students || []).find(s => s.id === state.selectedStudentId) || null;
    if (!st) return <div className="p-4 text-slate-500 text-sm">No student selected.</div>;
    const skills = (state.skills || []).filter(sk => sk.classIds?.includes(cls.id));
    return (
      <div className="p-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-lg font-semibold">Student Detail</div>
          <Button onClick={()=>switchTab("Setup")}><Users size={16}/> Back to Setup</Button>
        </div>
        <StudentCard student={st} cls={cls} skills={skills} marks={cls.marks} />
      </div>
    );
  };

  // COMPARE
  const Compare = () => {
    const cls = currentClass;
    const skills = (state.skills || []).filter(sk => !sk.classIds || sk.classIds.includes(cls?.id));
    return (
      <div className="p-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-lg font-semibold">Compare Skills</div>
          <div className="text-sm text-slate-500">{cls?.name}</div>
        </div>
        {cls ? <CompareTable cls={cls} skills={skills} marks={cls.marks} /> : <Tiny>Select a class.</Tiny>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <LegendFlyout open={legendOpen} onClose={()=>setLegendOpen(false)} />
      <main className="py-4">
        {state.tab === "Home" && <Home />}
        {state.tab === "Setup" && <Setup />}
        {state.tab === "Monitor" && <Monitor />}
        {state.tab === "Student" && <Student />}
        {state.tab === "Compare" && <Compare />}
      </main>
    </div>
  );
}
