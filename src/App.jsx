import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, Upload, Plus, Pencil, Users, Settings, Move3D,
  SlidersHorizontal, Home as HomeIcon, ListChecks, GraduationCap,
  Trash2, Wrench
} from "lucide-react";

/* ---------------------------------------------------------
   Academic Monitoring — v8.0 (Full UI + Safe Cloud Sync)
   - Waits for server check before auto-saving to KV
   - Never overwrites KV with blank/default state
   - Manual "Save to Cloud" button (works on phone/iPad/laptop)
   - Home / Setup (Classes, Roster, Skills) / Monitor (grid)
   --------------------------------------------------------- */

// Use this exact key everywhere (App + /api)
const lsKey = "seating-monitor-v7-1";

// Only save if there's real content (prevents wiping KV with blanks)
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

// One-tap push to the cloud (works on phone/iPad/laptop)
function SaveToCloud({ state }) {
  const run = async () => {
    try {
      const r = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: state }),
      });
      alert(`Cloud save: ${r.status}`); // expect 200
    } catch {
      alert("Cloud save failed. Are you on the production URL?");
    }
  };
  return (
    <button
      onClick={run}
      className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm bg-white hover:bg-slate-50 border"
      title="Push current data to the cloud immediately"
    >
      Save to Cloud
    </button>
  );
}

/* ---------- Defaults & Local Storage ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);

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
    tab: "home",
    selectedStudentId: null,
  };
};

function loadLocal(){
  try {
    const raw = localStorage.getItem(lsKey);
    return raw ? JSON.parse(raw) : DEFAULT_STATE();
  } catch { return DEFAULT_STATE(); }
}
function saveLocal(s){
  try { localStorage.setItem(lsKey, JSON.stringify(s)); } catch {}
}

/* ---------- Level + Flags ---------- */
const levelMeta = {
  0: { name: "N/A",       bg: "bg-gray-100",    ring: "ring-gray-300",    text: "text-gray-800" },
  1: { name: "Help",      bg: "bg-rose-100",    ring: "ring-rose-300",    text: "text-rose-800" },
  2: { name: "Developing",bg: "bg-amber-100",   ring: "ring-amber-300",   text: "text-amber-800" },
  3: { name: "Proficient",bg: "bg-emerald-100", ring: "ring-emerald-300", text: "text-emerald-800" },
  4: { name: "Advanced",  bg: "bg-sky-100",     ring: "ring-sky-300",     text: "text-sky-800" },
  5: { name: "ABSENT",    bg: "bg-violet-100",  ring: "ring-violet-300",  text: "text-violet-800" },
};
const FLAG_META = {
  ml:      { label: "ML",      dot: "bg-sky-500" },
  mlNew:   { label: "ML New",  dot: "bg-indigo-500" },
  iep504:  { label: "IEP/504", dot: "bg-purple-500" },
  ec:      { label: "EC",      dot: "bg-orange-500" },
  bubble:  { label: "Bubble",  dot: "bg-rose-500" },
};
const flagKeys = ["ml","mlNew","iep504","ec","bubble"];

/* ---------- Small UI bits ---------- */
function Badge({ children }){
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 border px-2 py-1 text-[11px] text-slate-700">
      {children}
    </span>
  );
}
function Legend(){
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {[0,1,2,3,4,5].map(lv=> (
          <div key={lv} className={`rounded-xl px-2 py-1 text-xs ring-2 ${levelMeta[lv].ring} ${levelMeta[lv].bg} ${levelMeta[lv].text}`}>
            {levelMeta[lv].name}
          </div>
        ))}
      </div>
      <div className="mt-2">
        <div className="text-xs text-slate-600 mb-1">Student Flags</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {flagKeys.map(k => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${FLAG_META[k].dot}`}></span>{FLAG_META[k].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
function SectionCard({ title, icon, extra, children }){
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-100 grid place-items-center">{icon}</div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}
function CenteredToggleBig({ active, setTab }){
  return (
    <div className="flex items-center justify-center">
      <div className="rounded-full p-1 bg-white border shadow-sm inline-flex">
        <button
          onClick={()=> setTab("setup")}
          className={`px-6 py-3 rounded-full text-sm md:text-base font-semibold ${active==="setup" ? "text-white bg-gradient-to-r from-sky-500 to-indigo-500" : "text-slate-700 hover:bg-slate-50"}`}
        >
          Setup
        </button>
        <button
          onClick={()=> setTab("monitor")}
          className={`px-6 py-3 rounded-full text-sm md:text-base font-semibold ${active==="monitor" ? "text-white bg-gradient-to-r from-emerald-500 to-teal-500" : "text-slate-700 hover:bg-slate-50"}`}
        >
          Monitor
        </button>
      </div>
    </div>
  );
}

function TopExport({ state }){
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoring-state-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={exportJSON} className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm bg-white hover:bg-slate-50 border">
      <Download className="h-4 w-4" />Export
    </button>
  );
}
function TopImport({ onImport }){
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result) || "{}");
        onImport(parsed);
      } catch { alert("Invalid JSON file."); }
    };
    reader.readAsText(file);
  };
  return (
    <label className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm bg-white hover:bg-slate-50 border cursor-pointer">
      <Upload className="h-4 w-4" />Import
      <input type="file" accept="application/json" className="hidden"
             onChange={(e)=>{const f=e.target.files?.[0]; if(f) importJSON(f);}} />
    </label>
  );
}

/* ========================== App ========================== */
export default function App(){
  const [state, setState] = useState(loadLocal());
  const [kvAvailable, setKvAvailable] = useState(false);
  const [remoteChecked, setRemoteChecked] = useState(false);
  const setTab = (tab)=> setState(p=> ({ ...p, tab }));

  // Load from KV (and mark we've checked the server)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/load");
        if (alive) setKvAvailable(r.ok);
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          if (alive && j && j.data && typeof j.data === "object") {
            setState(j.data); // use server data when present
          }
        }
      } catch {
        if (alive) setKvAvailable(false);
      } finally {
        if (alive) setRemoteChecked(true); // ✅ we looked at the server (even if empty)
      }
    })();
    return () => { alive = false; };
  }, []);

  // Auto-save to KV (guarded so blanks don't wipe cloud)
  useEffect(() => {
    if (!kvAvailable) return;        // need KV up
    if (!remoteChecked) return;      // ✅ don't push until after server check
    if (!isMeaningful(state)) return;// ✅ never push blank/default
    (async () => {
      try {
        await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: state }),
        });
      } catch {}
    })();
  }, [state, kvAvailable, remoteChecked]);

  // Always back up locally
  useEffect(() => { saveLocal(state); }, [state]);

  const notReady = !state || !Array.isArray(state.classes);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top bar */}
      <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
        <button onClick={()=> setTab("home")} className="flex items-center gap-3 group">
          <HomeIcon className="h-6 w-6 text-slate-400 group-hover:text-slate-600 transition" />
          <h1 className="text-2xl font-bold group-hover:text-slate-700 transition">Academic Monitoring</h1>
        </button>
        <div className="flex items-center gap-2">
          <TopExport state={state} />
          <TopImport onImport={(obj)=> setState(obj)} />
          <SaveToCloud state={state} />
        </div>
      </div>

      {notReady ? (
        <div className="p-6 text-sm text-gray-600">Loading…</div>
      ) : (
        <>
          {state.tab==="home" && <Home setTab={setTab} />}
          {state.tab==="setup" && <SetupPage state={state} setState={setState} setTab={setTab} />}
          {state.tab==="monitor" && <MonitorPage state={state} setState={setState} setTab={setTab} />}
        </>
      )}
    </div>
  );
}

/* ========================== Home ========================== */
function Home({ setTab }){
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <div className="rounded-3xl bg-white border shadow-sm p-10 grid gap-8">
        <button onClick={()=> setTab("home")} className="mx-auto w-full max-w-3xl">
          <div className="relative w-full rounded-3xl overflow-hidden border bg-gradient-to-br from-sky-50 via-fuchsia-50 to-emerald-50 hover:opacity-95 transition">
            <div className="aspect-[16/7] w-full grid place-items-center">
              <div className="text-7xl md:text-8xl select-none">➗ ✖️ ➕ ➖</div>
            </div>
          </div>
        </button>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={()=> setTab("setup")}
            className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 shadow-sm text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:opacity-95"
          >
            <ListChecks className="h-5 w-5" /> Go to Setup
          </button>
          <button
            onClick={()=> setTab("monitor")}
            className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 shadow-sm text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95"
          >
            <GraduationCap className="h-5 w-5" /> Go to Monitor
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================== Setup Page ========================== */
function SetupPage({ state, setState, setTab }){
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <CenteredToggleBig active="setup" setTab={setTab} />
      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <ClassListCard state={state} setState={setState} />
        <RosterCard state={state} setState={setState} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <SkillsCard state={state} setState={setState} />
        <SetupHelperCard />
      </div>
    </div>
  );
}

function ClassListCard({ state, setState }){
  const [newClassName, setNewClassName] = useState("");
  const [filter, setFilter] = useState("");

  const addClass = () => {
    const name = newClassName.trim();
    if (!name) return;
    const rows = 4, cols = 6;
    const seats = Array.from({ length: rows*cols }, (_,i)=> ({ r: Math.floor(i/cols), c: i%cols, studentId: null }));
    const id = uid();
    setState(p=> ({ ...p, classes: [...p.classes, { id, name, rows, cols, seats, students: [], marks: {}, layoutMode:"grid" }], selectedClassId: id }));
    setNewClassName("");
  };

  const renameClass = (id) => {
    const curr = state.classes.find(c=> c.id===id);
    const name = prompt("Rename class", curr?.name || "");
    if (!name) return;
    setState(p=> ({ ...p, classes: p.classes.map(c=> c.id===id ? { ...c, name } : c) }));
  };

  const deleteClass = (id) => {
    if (state.classes.length <= 1) { alert("Keep at least one class."); return; }
    const curr = state.classes.find(c=> c.id===id);
    if (!confirm(`Delete class "${curr?.name||id}"? All its data will be removed.`)) return;
    setState(p=> {
      const classes = p.classes.filter(c=> c.id!==id);
      const selectedClassId = p.selectedClassId === id ? classes[0].id : p.selectedClassId;
      const skills = p.skills.map(s=> ({ ...s, classIds: (s.classIds||[]).filter(cid=> cid!==id) }));
      return { ...p, classes, selectedClassId, skills };
    });
  };

  const setSelected = (id)=> setState(p=> ({ ...p, selectedClassId: id }));

  const list = state.classes
    .filter(c=> c.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a,b)=> a.name.localeCompare(b.name));

  return (
    <SectionCard
      title="Classes"
      icon={<Users className="h-4 w-4" />}
      extra={<Badge>Working in: {state.classes.find(c=> c.id===state.selectedClassId)?.name || "—"}</Badge>}
    >
      <form onSubmit={(e)=>{ e.preventDefault(); addClass(); }} className="flex items-center gap-2 mb-2">
        <input value={newClassName} onChange={(e)=> setNewClassName(e.target.value)} placeholder="e.g., Period 2" className="flex-1 rounded-xl border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">Add</button>
      </form>
      <input value={filter} onChange={(e)=> setFilter(e.target.value)} placeholder="Search classes" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
      <div className="max-h-64 overflow-y-auto divide-y">
        {list.map(c=> (
          <div key={c.id} className="py-2 flex items-center justify-between gap-2">
            <button onClick={()=> setSelected(c.id)} className={`text-sm flex-1 text-left ${state.selectedClassId===c.id ? "font-semibold" : ""}`}>{c.name}</button>
            <div className="flex items-center gap-2">
              <button className="text-xs text-blue-600" onClick={()=> renameClass(c.id)}><Pencil className="h-3 w-3 inline mr-1" />Rename</button>
              <button className="text-xs text-red-600" onClick={()=> deleteClass(c.id)}><Trash2 className="h-3 w-3 inline mr-1" />Delete</button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function RosterCard({ state, setState }){
  const cl = state.classes.find(c=> c.id===state.selectedClassId);
  const [newName, setNewName] = useState("");
  const nameExists = (nm)=> cl.students.some(s=> s.name.trim().toLowerCase() === nm.trim().toLowerCase());

  const addStudent = (name)=>{
    const trimmed = (name||"").trim();
    if (!trimmed) return false;
    if (nameExists(trimmed)) { alert("That name already exists in this class."); return false; }
    setState(p=>{
      const next = { ...p };
      const idx = next.classes.findIndex(c=> c.id===p.selectedClassId);
      if (idx<0) return p;
      const cls = { ...next.classes[idx] };
      cls.students = [...cls.students, { id: uid(), name: trimmed, flags: { ml:false, mlNew:false, iep504:false, ec:false, bubble:false } }];
      next.classes[idx] = cls;
      return next;
    });
    return true;
  };
  const editStudent = (id, newName)=>{
    const trimmed = (newName||"").trim(); if (!trimmed) return;
    if (cl.students.find(s=> s.name.trim().toLowerCase()===trimmed.toLowerCase() && s.id!==id)){ alert("That name already exists."); return; }
    setState(p=>{ const next={...p}; const idx=next.classes.findIndex(c=> c.id===p.selectedClassId); if(idx<0) return p;
      const cls={...next.classes[idx]}; cls.students = cls.students.map(s=> s.id===id ? { ...s, name: trimmed } : s); next.classes[idx]=cls; return next; });
  };
  const setFlags = (id, newFlags)=>{
    setState(p=>{ const next={...p}; const idx=next.classes.findIndex(c=> c.id===p.selectedClassId); if(idx<0) return p;
      const cls={...next.classes[idx]}; cls.students = cls.students.map(s=> s.id===id ? { ...s, flags: { ...s.flags, ...newFlags } } : s); next.classes[idx]=cls; return next; });
  };
  const deleteStudent = (id)=>{
    if (!confirm("Remove this student? Their marks will be cleared and seat unassigned.")) return;
    setState(p=>{ const next={...p}; const idx=next.classes.findIndex(c=> c.id===p.selectedClassId); if(idx<0) return p;
      const cls={...next.classes[idx]};
      cls.seats = cls.seats.map(s=> s.studentId===id ? { ...s, studentId: null } : s);
      for (const k of Object.keys(cls.marks)) if (cls.marks[k] && id in cls.marks[k]) delete cls.marks[k][id];
      cls.students = cls.students.filter(s=> s.id!==id);
      next.classes[idx]=cls; return next; });
  };
  const clearAllForStudent = (id)=>{
    setState(p=>{ const next={...p}; const idx=next.classes.findIndex(c=> c.id===p.selectedClassId); if(idx<0) return p;
      const cls={...next.classes[idx]}; for (const k of Object.keys(cls.marks)) if (cls.marks[k] && id in cls.marks[k]) delete cls.marks[k][id];
      next.classes[idx]=cls; return next; });
  };
  const onSubmit=(e)=>{ e.preventDefault(); if(addStudent(newName)) setNewName(""); };

  return (
    <SectionCard
      title="Roster"
      icon={<ListChecks className="h-4 w-4" />}
      extra={<Badge>Working in: {cl?.name || "—"}</Badge>}
    >
      <form onSubmit={onSubmit} className="flex items-center gap-2 mb-2">
        <input value={newName} onChange={(e)=> setNewName(e.target.value)} placeholder="First Last" className="flex-1 rounded-xl border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">Add</button>
      </form>
      <div className="max-h-64 overflow-y-auto divide-y">
        {cl.students.map(s=> (
          <StudentRow
            key={s.id}
            s={s}
            editStudent={editStudent}
            deleteStudent={deleteStudent}
            clearAllForStudent={clearAllForStudent}
            onFlags={(flags)=> setFlags(s.id, flags)}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function StudentRow({ s, editStudent, deleteStudent, clearAllForStudent, onFlags }){
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(s.name);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const onSave = ()=> { editStudent(s.id, val); setEditing(false); };

  const [localFlags, setLocalFlags] = useState({
    ml: !!s.flags?.ml, mlNew: !!s.flags?.mlNew, iep504: !!s.flags?.iep504, ec: !!s.flags?.ec, bubble: !!s.flags?.bubble
  });
  useEffect(()=>{ setLocalFlags({
    ml: !!s.flags?.ml, mlNew: !!s.flags?.mlNew, iep504: !!s.flags?.iep504, ec: !!s.flags?.ec, bubble: !!s.flags?.bubble
  }); }, [s.flags]);

  const toggle = (k)=> setLocalFlags(f=> ({ ...f, [k]: !f[k] }));
  const saveFlags = ()=> { onFlags(localFlags); setFlagsOpen(false); };

  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <input value={val} onChange={(e)=> setVal(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter") onSave(); if(e.key==="Escape") setEditing(false); }} className="flex-1 rounded-xl border px-2 py-1 text-sm" />
        ) : (
          <div className="text-sm flex-1">
            {s.name}
            <span className="ml-2 inline-flex items-center gap-1">
              {flagKeys.filter(k=> s.flags?.[k]).map(k=> (
                <span key={k} className={`h-2.5 w-2.5 rounded-full ${FLAG_META[k].dot}`} title={FLAG_META[k].label} />
              ))}
            </span>
          </div>
        )}
        {editing ? (
          <div className="flex items-center gap-2">
            <button className="text-xs" onClick={onSave}>Save</button>
            <button className="text-xs text-gray-500" onClick={()=> setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button className="text-xs text-blue-600" onClick={()=> setEditing(true)}><Pencil className="h-3 w-3 inline mr-1" />Edit</button>
            <button className="text-xs" onClick={()=> setFlagsOpen(v=>!v)}>Flags</button>
            <button className="text-xs text-amber-700" onClick={()=> clearAllForStudent(s.id)}>Clear all</button>
            <button className="text-xs text-red-600" onClick={()=> deleteStudent(s.id)}><Trash2 className="h-3 w-3 inline mr-1" />Delete</button>
          </div>
        )}
      </div>

      {flagsOpen && (
        <div className="mt-2 rounded-xl border p-2 bg-slate-50">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {flagKeys.map(k=> (
              <label key={k} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!localFlags[k]} onChange={()=> toggle(k)} />
                <span className="inline-flex items-center gap-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${FLAG_META[k].dot}`} />
                  {FLAG_META[k].label}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button className="rounded-xl border px-2 py-1 text-xs bg-emerald-600 text-white" onClick={saveFlags}>Save flags</button>
            <button className="rounded-xl border px-2 py-1 text-xs" onClick={()=> setFlagsOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillsCard({ state, setState }){
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");

  const classSkills = useMemo(()=> (state.skills||[]).filter(s=> (s.classIds||[]).includes(state.selectedClassId)), [state]);

  const openNew = ()=> { setEditing(null); setFormOpen(true); };
  const openEdit = (sk)=> { setEditing(sk); setFormOpen(true); };

  const deleteSkill = (skillId) => {
    if (!confirm("Delete this skill and all its marks?")) return;
    setState(p=> ({
      ...p,
      classes: p.classes.map(cl=> { const cls = { ...cl, marks: { ...cl.marks } }; delete cls.marks?.[skillId]; return cls; }),
      skills: p.skills.filter(s=> s.id!==skillId),
      selectedSkillId: p.selectedSkillId === skillId ? null : p.selectedSkillId
    }));
  };

  const visible = classSkills
    .filter(s=> [s.name, s.standardCode, s.domain, s.description].join(" ").toLowerCase().includes(filter.toLowerCase()))
    .sort((a,b)=> a.name.localeCompare(b.name));

  return (
    <SectionCard
      title="Skills (Setup)"
      icon={<SlidersHorizontal className="h-4 w-4" />}
      extra={<Badge>Working in: {state.classes.find(c=> c.id===state.selectedClassId)?.name || "—"}</Badge>}
    >
      <div className="flex items-center gap-2 mb-2">
        <button onClick={openNew} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"><Plus className="h-4 w-4" />Add Skill</button>
        <input value={filter} onChange={(e)=> setFilter(e.target.value)} placeholder="Search skills" className="flex-1 rounded-xl border px-3 py-2 text-sm" />
      </div>

      {formOpen && (
        <SkillForm
          initial={editing}
          classes={state.classes}
          defaultClassId={state.selectedClassId}
          onSave={(vals)=>{
            const { id, name, domain, standardCode, description, classIds } = vals;
            const cleaned = classIds && classIds.length ? [...new Set(classIds)] : [state.selectedClassId];
            if (id){
              setState(p=> ({ ...p, skills: p.skills.map(s=> s.id===id ? { ...s, name, domain, standardCode, description, classIds: cleaned } : s) }));
            } else {
              const newSkill = { id: uid(), name, domain, standardCode, description, classIds: cleaned };
              setState(p=> ({ ...p, skills: [...p.skills, newSkill], selectedSkillId: newSkill.id }));
            }
            setFormOpen(false);
          }}
          onCancel={()=> setFormOpen(false)}
        />
      )}

      <div className="max-h-64 overflow-y-auto divide-y">
        {visible.map(sk=> (
          <div key={sk.id} className="py-2 flex items-start justify-between gap-2">
            <div className="text-sm flex-1">
              <div className="font-medium">{sk.name}</div>
              <div className="text-xs text-slate-600 space-x-2">
                {sk.domain && <span>Domain: {sk.domain}</span>}
                {sk.standardCode && <span>Std: {sk.standardCode}</span>}
                {sk.description && <span>{sk.description}</span>}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Linked to: {(sk.classIds||[]).map(id=> (state.classes.find(c=> c.id===id)?.name || id)).join(", ") || "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs text-blue-600" onClick={()=> openEdit(sk)}><Pencil className="h-3 w-3 inline mr-1" />Edit</button>
              <button className="text-xs text-red-600" onClick={()=> deleteSkill(sk.id)}><Trash2 className="h-3 w-3 inline mr-1" />Delete</button>
            </div>
          </div>
        ))}
        {visible.length===0 && <div className="py-6 text-center text-sm text-slate-500">No skills yet — add one!</div>}
      </div>
    </SectionCard>
  );
}

function SkillForm({ initial, onSave, onCancel, classes = [], defaultClassId }){
  const [name, setName] = useState(initial?.name || "");
  const [domain, setDomain] = useState(initial?.domain || "");
  const [standard, setStandard] = useState(initial?.standardCode || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [checked, setChecked] = useState(
    initial?.classIds?.length ? new Set(initial.classIds) : new Set([defaultClassId])
  );

  const toggleClass = (id) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };

  const save = ()=>{
    if (!name.trim()){ alert("Skill name is required."); return; }
    onSave({
      id: initial?.id,
      name: name.trim(),
      domain: domain.trim() || undefined,
      standardCode: standard.trim() || undefined,
      description: description.trim() || undefined,
      classIds: Array.from(checked),
    });
  };

  return (
    <div className="mb-3 rounded-2xl border p-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">Skill name *</label>
          <input value={name} onChange={(e)=> setName(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g., Distributive Property" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Short description (optional)</label>
          <input value={description} onChange={(e)=> setDescription(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g., negatives" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Domain (optional)</label>
          <input value={domain} onChange={(e)=> setDomain(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g., Expressions & Equations" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Standard (optional)</label>
          <input value={standard} onChange={(e)=> setStandard(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g., EE.3" />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs text-slate-500 mb-1">Link this skill to class(es)</div>
        <div className="flex flex-wrap gap-3">
          {classes.map(cl => (
            <label key={cl.id} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={checked.has(cl.id)}
                onChange={()=> toggleClass(cl.id)}
              />
              {cl.name}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} className="rounded-xl border px-3 py-1 text-sm bg-emerald-600 text-white hover:bg-emerald-700">Save</button>
        <button onClick={onCancel} className="rounded-xl border px-3 py-1 text-sm hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}

function SetupHelperCard(){
  return (
    <SectionCard title="Tips" icon={<Wrench className="h-4 w-4" />}>
      <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
        <li>Use <b>Roster</b> to add/edit students and set <b>Flags</b>.</li>
        <li>Add skills in <b>Skills</b> and link to class(es).</li>
        <li>Switch to <b>Monitor</b> to assign seats and tap desks to track levels.</li>
      </ul>
    </SectionCard>
  );
}

/* ========================== Monitor Page ========================== */
function MonitorPage({ state, setState, setTab }){
  const currentClass = useMemo(()=> state.classes.find(c=> c.id===state.selectedClassId), [state]);
  const classSkills = useMemo(()=> (state.skills||[]).filter(s=> (s.classIds||[]).includes(state.selectedClassId)), [state]);
  const selectedSkill = classSkills.find(s=> s.id===state.selectedSkillId) || null;

  useEffect(()=>{ if(!selectedSkill && classSkills[0]) setState(p=> ({ ...p, selectedSkillId: classSkills[0].id })); }, [selectedSkill, classSkills, setState]);

  const setClass = (id)=> setState(p=> ({ ...p, selectedClassId: id }));
  const setSkill = (id)=> setState(p=> ({ ...p, selectedSkillId: id }));

  const studentById = (id)=> currentClass.students.find(s=> s.id===id) || null;
  const studentName = (id)=> studentById(id)?.name ?? "";

  const getLevel = (studentId)=> {
    if (!studentId || !selectedSkill) return 0;
    const lv = currentClass.marks?.[selectedSkill.id]?.[studentId];
    return typeof lv === "number" ? lv : 0;
  };
  const cycleSeatLevel = (studentId)=>{
    if (!selectedSkill || !studentId) return;
    setState(prev=>{
      const next={...prev}; const cls=next.classes.find(c=> c.id===prev.selectedClassId); if(!cls) return prev;
      const cur = cls.marks?.[selectedSkill.id]?.[studentId] ?? 0;
      const newLevel = (cur+1) % 6; // 0..5 with 5=ABSENT
      if (!cls.marks) cls.marks = {};
      if (!cls.marks[selectedSkill.id]) cls.marks[selectedSkill.id]={};
      cls.marks[selectedSkill.id][studentId]=newLevel; return next;
    });
  };

  const [moveMode, setMoveMode] = useState(false);
  const [moveSource, setMoveSource] = useState(null); // {r,c}
  const swapSeats = (a,b)=>{
    setState(prev=>{
      const next={...prev}; const idx=next.classes.findIndex(c=> c.id===prev.selectedClassId); if(idx<0) return prev;
      const cls={...next.classes[idx]}; const seats=cls.seats.map(s=> ({...s}));
      const sa = seats.find(s=> s.r===a.r && s.c===a.c);
      const sb = seats.find(s=> s.r===b.r && s.c===b.c);
      if (!sa || !sb) return prev;
      const tmp = sa.studentId; sa.studentId = sb.studentId; sb.studentId = tmp;
      cls.seats=seats; next.classes[idx]=cls; return next;
    });
  };
  const onSeatClick = (seat)=>{
    if (moveMode){
      if (!moveSource){ setMoveSource({ r: seat.r, c: seat.c }); return; }
      swapSeats(moveSource, seat); setMoveSource(null); return;
    }
    if (state.editAssignMode) { openAssignModal(seat); return; }
    if (seat.studentId) cycleSeatLevel(seat.studentId);
  };

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignPos, setAssignPos] = useState(null);
  const [filter, setFilter] = useState("");
  const openAssignModal = (pos)=> { setAssignPos(pos); setAssignOpen(true); };
  const assignSeat = (studentId)=>{
    setState(p=>{
      const next={...p}; const idx=next.classes.findIndex(c=> c.id===p.selectedClassId); if(idx<0) return p;
      const cls={...next.classes[idx]}; const seats = cls.seats.map(s=> ({...s}));
      if (studentId){
        seats.forEach(s=> { if (s.studentId === studentId) s.studentId = null; });
      }
      const target = seats.find(s=> s.r===assignPos.r && s.c===assignPos.c);
      if (target) target.studentId = studentId || null;
      cls.seats = seats; next.classes[idx]=cls; return next;
    });
    setAssignOpen(false);
  };

  if (!currentClass) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <CenteredToggleBig active="monitor" setTab={setTab} />

      {/* Top row: selectors */}
      <div className="rounded-3xl bg-white p-4 shadow-sm border mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <select className="rounded-xl border px-3 py-2 text-sm" value={state.selectedClassId} onChange={(e)=> setClass(e.target.value)}>
              {state.classes.map(cl=> <option key={cl.id} value={cl.id}>{cl.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-gray-500" />
            <select className="rounded-xl border px-3 py-2 text-sm" value={state.selectedSkillId || ""} onChange={(e)=> setSkill(e.target.value)}>
              {classSkills.length===0 && <option value="">(No skills linked to this class)</option>}
              {classSkills.map(sk=> (
                <option key={sk.id} value={sk.id}>
                  {sk.name}{sk.standardCode?` — ${sk.standardCode}`:""}{sk.description?` — ${sk.description}`:""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Skill: {selectedSkill?.name ?? "—"}</Badge>
            {selectedSkill?.standardCode && <Badge>Std: {selectedSkill.standardCode}</Badge>}
            {selectedSkill?.description && <Badge>{selectedSkill.description}</Badge>}
          </div>
        </div>
      </div>

      {/* Main area: LEFT legend + controls • CENTER grid */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
        {/* Left legend + controls */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Legend</h3>
            <Legend />
          </div>
          <div>
            <h3 className="font-semibold mb-2">Controls</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium mb-1">Seat Mode</div>
                <button onClick={()=>{ setMoveMode(!moveMode); setMoveSource(null); }} className={`w-full inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm ${moveMode?"bg-blue-50 border-blue-300":"hover:bg-slate-50"}`}>
                  <Move3D className="h-4 w-4" /> {moveMode? "Move Seats: ON":"Move Seats"}
                </button>
                <button onClick={()=> setState(p=> ({ ...p, editAssignMode: !p.editAssignMode }))} className={`mt-2 w-full inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm ${state.editAssignMode? "bg-emerald-50 border-emerald-300":"hover:bg-slate-50"}`}>
                  Edit Seat Assignment: {state.editAssignMode? "ON":"OFF"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Seating grid */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${currentClass.cols}, minmax(0, 1fr))`, gap: 12 }}>
            {currentClass.seats.map((seat, idx)=> {
              const studentId = seat.studentId;
              const name = studentId ? studentName(studentId) : "";
              const level = getLevel(studentId);
              return (
                <button
                  key={idx}
                  onClick={()=> onSeatClick(seat)}
                  className={`h-20 rounded-2xl border grid place-items-center text-sm ring-2 ${levelMeta[level].ring} ${levelMeta[level].bg} ${levelMeta[level].text}`}
                  title={studentId ? `${name} — Level ${level}` : "Empty seat"}
                >
                  {studentId ? name : "—"}
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-slate-600">
            Tip: Turn on <b>Edit Seat Assignment</b>, then tap a seat to assign a student. Turn it off to tap seats and cycle levels 0–5.
          </div>
        </div>
      </div>

      {/* Assign modal */}
      {assignOpen && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50" onClick={()=> setAssignOpen(false)}>
          <div className="bg-white rounded-2xl border shadow-lg max-w-lg w-full p-4" onClick={(e)=> e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Assign Seat</h3>
              <button className="text-sm" onClick={()=> setAssignOpen(false)}>Close</button>
            </div>
            <input value={filter} onChange={(e)=> setFilter(e.target.value)} placeholder="Search students" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
            <div className="max-h-64 overflow-y-auto divide-y">
              {currentClass.students
                .filter(s=> s.name.toLowerCase().includes(filter.toLowerCase()))
                .map(s=> (
                <div key={s.id} className="py-2 flex items-center justify-between">
                  <div className="text-sm">{s.name}</div>
                  <button className="text-xs" onClick={()=> assignSeat(s.id)}>Assign here</button>
                </div>
              ))}
              <div className="py-2 flex items-center justify-between">
                <div className="text-sm text-slate-500">(Empty)</div>
                <button className="text-xs" onClick={()=> assignSeat(null)}>Clear seat</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
