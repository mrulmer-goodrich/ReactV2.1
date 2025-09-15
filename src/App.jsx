import React, { useEffect, useState } from "react";

/* ---------- SAFE MINIMAL APP (v1) ----------
   - Compiles cleanly
   - Loads from /api/load
   - Saves to /api/save only after server check AND only if meaningful
   - Includes a "Save to Cloud" button
   - Minimal UI so we can verify syncing
--------------------------------------------*/

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
      style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
    >
      Save to Cloud
    </button>
  );
}

export default function App(){
  // Initialize from localStorage
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      return raw ? JSON.parse(raw) : {
        classes: [{ id: "c1", name: "Period 1", rows: 4, cols: 6, seats: [], students: [], marks: {}, layoutMode: "grid" }],
        skills: [],
        selectedClassId: "c1",
        selectedSkillId: null,
        editAssignMode: false,
        tab: "home",
        selectedStudentId: null,
      };
    } catch {
      return { classes: [{ id: "c1", name: "Period 1", rows: 4, cols: 6, seats: [], students: [], marks: {}, layoutMode: "grid" }], skills: [], selectedClassId: "c1", tab: "home" };
    }
  });

  const [kvAvailable, setKvAvailable] = useState(false);
  const [remoteChecked, setRemoteChecked] = useState(false);

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
  useEffect(() => {
    try { localStorage.setItem(lsKey, JSON.stringify(state)); } catch {}
  }, [state]);

  // --- Minimal UI for sanity ---
  const c1 = state.classes.find(c => c.id === state.selectedClassId) || state.classes[0];

  const addStudent = () => {
    const name = prompt("Student name?");
    if (!name) return;
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const cls = next.classes.find(c => c.id === next.selectedClassId) || next.classes[0];
      cls.students.push({ id: Math.random().toString(36).slice(2,9), name, flags: { ml:false, mlNew:false, iep504:false, ec:false, bubble:false } });
      return next;
    });
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Academic Monitoring (Minimal)</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={addStudent} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>Add Student</button>
          <SaveToCloud state={state} />
        </div>
      </div>

      <div style={{ marginBottom: 12, fontSize: 12, color: "#555" }}>
        Cloud: {kvAvailable ? "Available" : "Unavailable"} • Checked: {remoteChecked ? "Yes" : "No"}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h3>Students (Class: {c1?.name || "—"})</h3>
          <ul>
            {(c1?.students || []).map(s => <li key={s.id}>{s.name}</li>)}
          </ul>
        </div>
        <div style={{ flex: 1 }}>
          <h3>State JSON</h3>
          <pre style={{ background: "#f6f8fa", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 320 }}>
            {JSON.stringify(state, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
