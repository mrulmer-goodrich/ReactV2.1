import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Upload,
  Plus,
  Pencil,
  Users,
  Settings,
  Move3D,
  Link as LinkIcon,
  SlidersHorizontal,
  LayoutTemplate,
  Trash2,
  Wrench,
} from "lucide-react";

/**
 * Academic Monitoring — Full App.jsx (Baseline v2)
 * - No default students or skills
 * - Add student on Enter; prevent duplicate names (case-insensitive)
 * - Edit/Delete student; delete unassigns seat & clears marks in current class
 * - Per-student "Clear all" clears marks across all skills in current class
 * - Header simplified; subheader removed
 * - Seat coordinate labels removed
 * - "Edit Seat Assignment" mode (toolbar + Settings). When ON, tapping a seat opens assign; OFF = tap cycles level
 * - Dragging seats (grid swap, free layout) never increments levels; tap-only cycles
 * - Rows/Cols moved to Settings modal
 * - Skills: Add/Rename/Edit/Delete, link to classes; Domain fixed list (+Other); Standard required from curated NC7 list (+Other)
 * - Import/Export JSON
 * - Robust migrateLegacy with NC.7 prefix stripping
 */

// ----------------- Constants & Helpers -----------------
const lsKey = "seating-monitor-v4"; // bump if schema changes
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
    ["NS.1", "Integers"],
    ["NS.2", "Rational Ops"],
    ["NS.3", "Absolute Value"],
  ],
  "Ratios & Proportions": [
    ["RP.1", "Ratios"],
    ["RP.2", "Unit Rate"],
    ["RP.3", "Percent"],
  ],
  "Expressions & Equations": [
    ["EE.1", "Evaluate"],
    ["EE.2", "Like Terms"],
    ["EE.3", "Distributive"],
  ],
  Geometry: [
    ["G.1", "Scale Factor"],
    ["G.2", "Area/Surface"],
    ["G.3", "Volume"],
  ],
  "Statistics & Probability": [
    ["SP.1", "Samples"],
    ["SP.2", "Measures"],
    ["SP.3", "Inferences"],
  ],
};

const levelMeta = {
  0: { name: "N/A", bg: "bg-gray-100", ring: "ring-gray-300", text: "text-gray-600" },
  1: { name: "Help", bg: "bg-red-100", ring: "ring-red-300", text: "text-red-800" },
  2: { name: "Developing", bg: "bg-amber-100", ring: "ring-amber-300", text: "text-amber-800" },
  3: { name: "Proficient", bg: "bg-green-100", ring: "ring-green-300", text: "text-green-800" },
  4: { name: "Advanced", bg: "bg-blue-100", ring: "ring-blue-300", text: "text-blue-800" },
};

// ----------------- Defaults & Migration -----------------
const DEFAULT_STATE = () => {
  const classId = uid();
  const rows = 4,
    cols = 6;
  const seats = Array.from({ length: rows * cols }, (_, i) => ({
    r: Math.floor(i / cols),
    c: i % cols,
    studentId: null,
  }));
  return {
    classes: [
      {
        id: classId,
        name: "Period 1",
        rows,
        cols,
        seats,
        students: [],
        marks: {},
        layoutMode: "grid",
      },
    ],
    skills: [],
    selectedClassId: classId,
    selectedSkillId: null,
    editAssignMode: false,
  };
};

function cleanStandard(code) {
  if (typeof code !== "string") return code;
  return code.replace(/^NC\.7\./, ""); // strip NC.7. prefix if present
}

function migrateLegacy(raw) {
  try {
    const parsed = JSON.parse(raw);
    const st = parsed && typeof parsed === "object" ? parsed : DEFAULT_STATE();

    // classes
    if (!Array.isArray(st.classes)) st.classes = DEFAULT_STATE().classes;

    // skills (global library)
    if (Array.isArray(st.skills)) {
      st.skills = st.skills
        .filter((s) => s && typeof s === "object")
        .map((s) => ({
          id: typeof s.id === "string" ? s.id : uid(),
          name: typeof s.name === "string" ? s.name : "(unnamed)",
          domain: typeof s.domain === "string" ? s.domain : undefined,
          standardCode: cleanStandard(s.standardCode) || undefined,
          classIds: Array.isArray(s.classIds)
            ? [...new Set(s.classIds.filter(Boolean))]
            : [],
        }));
    } else {
      // legacy per-class skills -> lift to global
      const lifted = [];
      const seen = new Map();
      (st.classes || []).forEach((cl) => {
        const clSkills = Array.isArray(cl.skills) ? cl.skills : [];
        clSkills.forEach((sk) => {
          if (!sk || typeof sk !== "object") return;
          const name =
            typeof sk.name === "string" ? sk.name : "(unnamed)";
          const domain =
            typeof sk.domain === "string" ? sk.domain : undefined;
          const standardCode =
            cleanStandard(sk.standardCode) || undefined;
          const key = `${name}|${domain || ""}|${standardCode || ""}`;
          let id = seen.get(key);
          if (!id) {
            id = typeof sk.id === "string" ? sk.id : uid();
            seen.set(key, id);
            lifted.push({
              id,
              name,
              domain,
              standardCode,
              classIds: [cl.id],
            });
          } else {
            const ref = lifted.find((x) => x.id === id);
            if (ref && !ref.classIds.includes(cl.id)) ref.classIds.push(cl.id);
          }
        });
        if (cl && typeof cl === "object") cl.skills = [];
      });
      st.skills = lifted;
    }

    // normalize classes
    st.classes = st.classes.map((cl) => {
      const rows = Number.isFinite(cl.rows) ? Math.max(1, Math.min(24, cl.rows)) : 4;
      const cols = Number.isFinite(cl.cols) ? Math.max(1, Math.min(24, cl.cols)) : 6;
      const seats = Array.isArray(cl.seats) ? cl.seats : [];
      const students = Array.isArray(cl.students) ? cl.students : [];
      const marks = cl.marks && typeof cl.marks === "object" ? cl.marks : {};
      const layoutMode = cl.layoutMode === "free" ? "free" : "grid";
      const normSeats = [];
      for (let i = 0; i < rows * cols; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const ex = seats.find((s) => s && s.r === r && s.c === c) || { r, c, studentId: null };
        if (typeof ex.studentId !== "string") ex.studentId = ex.studentId || null;
        normSeats.push(ex);
      }
      return {
        id: typeof cl.id === "string" ? cl.id : uid(),
        name: typeof cl.name === "string" ? cl.name : "Class",
        rows,
        cols,
        seats: normSeats,
        students: students.filter((s) => s && typeof s === "object" && typeof s.id === "string"),
        marks,
        layoutMode,
      };
    });

    // selections
    if (!st.selectedClassId || !st.classes.find((c) => c.id === st.selectedClassId))
      st.selectedClassId = st.classes[0]?.id || DEFAULT_STATE().classes[0].id;

    if (st.selectedSkillId && !st.skills.find((s) => s.id === st.selectedSkillId))
      st.selectedSkillId = null;

    if (typeof st.editAssignMode !== "boolean") st.editAssignMode = false;

    return st;
  } catch {
    return DEFAULT_STATE();
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(lsKey);
    return raw ? migrateLegacy(raw) : DEFAULT_STATE();
  } catch {
    return DEFAULT_STATE();
  }
}

function saveState(s) {
  try {
    localStorage.setItem(lsKey, JSON.stringify(s));
  } catch {}
}

// ----------------- App -----------------
export default function App() {
  const [state, setState] = useState(loadState());
  useEffect(() => saveState(state), [state]);

  const currentClass = useMemo(
    () => state.classes.find((c) => c.id === state.selectedClassId),
    [state]
  );
  const classSkills = useMemo(
    () => state.skills.filter((s) => s.classIds.includes(state.selectedClassId)),
    [state]
  );
  const selectedSkill =
    classSkills.find((s) => s.id === state.selectedSkillId) || null;

  useEffect(() => {
    if (!selectedSkill && classSkills[0]) {
      setState((p) => ({ ...p, selectedSkillId: classSkills[0].id }));
    }
  }, [selectedSkill, classSkills]);

  if (!currentClass) return <div className="p-4">No class selected.</div>;

  // ----- Helpers -----
  const studentName = (id) =>
    currentClass.students.find((s) => s.id === id)?.name ?? "";
  const getLevel = (studentId) => {
    if (!studentId || !selectedSkill) return 0;
    const lv = currentClass.marks[selectedSkill.id]?.[studentId];
    return typeof lv === "number" ? lv : 0;
  };

  const setClass = (id) => setState((p) => ({ ...p, selectedClassId: id }));
  const setSkill = (id) => setState((p) => ({ ...p, selectedSkillId: id }));
  const toggleAssignMode = () =>
    setState((p) => ({ ...p, editAssignMode: !p.editAssignMode }));

  const cycleSeatLevel = (studentId) => {
    if (!selectedSkill || !studentId) return;
    setState((prev) => {
      const next = { ...prev };
      const cls = next.classes.find((c) => c.id === prev.selectedClassId);
      if (!cls) return prev;
      const cur = cls.marks[selectedSkill.id]?.[studentId] ?? 0;
      const newLevel = (cur + 1) % 5;
      if (!cls.marks[selectedSkill.id]) cls.marks[selectedSkill.id] = {};
      cls.marks[selectedSkill.id][studentId] = newLevel;
      return next;
    });
  };

  // ----- Import/Export -----
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoring-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setState(migrateLegacy(String(reader.result)));
      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  };

  // ----- Classes -----
  const addClass = () => {
    const name = prompt("New class name?");
    if (!name) return;
    const rows = 4,
      cols = 6;
    const seats = Array.from({ length: rows * cols }, (_, i) => ({
      r: Math.floor(i / cols),
      c: i % cols,
      studentId: null,
    }));
    const id = uid();
    setState((p) => ({
      ...p,
      classes: [
        ...p.classes,
        {
          id,
          name,
          rows,
          cols,
          seats,
          students: [],
          marks: {},
          layoutMode: "grid",
        },
      ],
      selectedClassId: id,
    }));
  };

  const renameClass = () => {
    const name = prompt("Rename class", currentClass.name);
    if (!name) return;
    setState((p) => ({
      ...p,
      classes: p.classes.map((c) => (c.id === currentClass.id ? { ...c, name } : c)),
    }));
  };

  // ----- Skills (Add/Rename/Edit/Delete/Link) -----
  const chooseDomain = (existing = "") => {
    const lines = [
      "Choose a Domain exactly as written:",
      ...NC_DOMAINS.map((d) => "- " + d),
      "- Other",
      existing ? `(Current: ${existing})` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const pick = prompt(lines);
    if (!pick) return null;
    if (pick === "Other") return "Other";
    if (NC_DOMAINS.includes(pick)) return pick;
    alert("Please type one of the listed options or 'Other'.");
    return null;
  };

  const chooseStandard = (domain, existing = "") => {
    const opts = (NC7[domain] || []).map(([code, label]) => `${code} ${label}`);
    const pick = prompt(
      [
        "Choose a Standard (required). Type exactly one:",
        ...opts.map((o) => "- " + o),
        "- Other",
        existing ? `(Current: ${existing})` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
    if (!pick) return null;
    if (pick === "Other") return "Other";
    const found = (NC7[domain] || []).find(
      ([code, label]) => pick === `${code} ${label}` || pick === code
    );
    return found ? found[0] : null;
  };

  const addSkill = () => {
    const name = prompt("Skill name (required)");
    if (!name) return;

    let domain = null;
    while (domain === null) domain = chooseDomain("");
    if (!domain) return; // cancelled
    if (domain === "Other") domain = "Other";

    let standard = null;
    while (standard === null) standard = chooseStandard(domain, "");
    if (!standard) return;
    if (standard === "Other") {
      standard = prompt("Enter a custom standard code (e.g., EE.9)");
      if (!standard) return;
    }

    setState((p) => ({
      ...p,
      skills: [
        ...p.skills,
        {
          id: uid(),
          name,
          domain,
          standardCode: cleanStandard(standard),
          classIds: [p.selectedClassId],
        },
      ],
    }));
  };

  const renameSkill = () => {
    if (!selectedSkill) return;
    const name = prompt("Rename skill", selectedSkill.name);
    if (!name) return;
    setState((p) => ({
      ...p,
      skills: p.skills.map((s) => (s.id === selectedSkill.id ? { ...s, name } : s)),
    }));
  };

  const editSkillMeta = () => {
    if (!selectedSkill) return;
    let domain = null;
    while (domain === null)
      domain = chooseDomain(selectedSkill.domain || "");
    if (!domain) return;
    if (domain === "Other") domain = "Other";

    let standard = null;
    while (standard === null)
      standard = chooseStandard(domain, selectedSkill.standardCode || "");
    if (!standard) return;
    if (standard === "Other") {
      standard = prompt("Enter a custom standard code (e.g., EE.9)");
      if (!standard) return;
    }

    setState((p) => ({
      ...p,
      skills: p.skills.map((s) =>
        s.id === selectedSkill.id
          ? { ...s, domain, standardCode: cleanStandard(standard) }
          : s
      ),
    }));
  };

  const deleteSkill = () => {
    if (!selectedSkill) return;
    if (
      !confirm(
        `Delete skill "${selectedSkill.name}"? This will remove its marks.`
      )
    )
      return;
    setState((p) => ({
      ...p,
      classes: p.classes.map((cl) => {
        const cls = { ...cl, marks: { ...cl.marks } };
        delete cls.marks[selectedSkill.id];
        return cls;
      }),
      skills: p.skills.filter((s) => s.id !== selectedSkill.id),
      selectedSkillId: p.selectedSkillId === selectedSkill.id ? null : p.selectedSkillId,
    }));
  };

  const linkSkillToClasses = () => {
    if (!selectedSkill) return;
    const currentNames = selectedSkill.classIds
      .map((id) => state.classes.find((c) => c.id === id)?.name || id)
      .join(", ");
    const names = prompt(
      `Link skill to which classes? Separate names by commas.\nCurrent: ${currentNames}`
    );
    if (names == null) return;
    const wanted = names
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ids = state.classes
      .filter((cl) => wanted.includes(cl.name))
      .map((cl) => cl.id);
    if (!ids.length) {
      alert("No matching class names.");
      return;
    }
    setState((p) => ({
      ...p,
      skills: p.skills.map((s) =>
        s.id === selectedSkill.id ? { ...s, classIds: [...new Set(ids)] } : s
      ),
    }));
  };

  // ----- Grid: swap seats mode -----
  const [moveMode, setMoveMode] = useState(false);
  const [moveSource, setMoveSource] = useState(null); // {r,c}
  const swapSeats = (a, b) => {
    setState((prev) => {
      const next = { ...prev };
      const idx = next.classes.findIndex((c) => c.id === prev.selectedClassId);
      if (idx < 0) return prev;
      const cls = { ...next.classes[idx] };
      const seats = cls.seats.map((s) => ({ ...s }));
      const sa = seats.find((s) => s.r === a.r && s.c === a.c);
      const sb = seats.find((s) => s.r === b.r && s.c === b.c);
      if (!sa || !sb) return prev;
      const tmp = sa.studentId;
      sa.studentId = sb.studentId;
      sb.studentId = tmp;
      cls.seats = seats;
      next.classes[idx] = cls;
      return next;
    });
  };

  const onSeatClickGrid = (seat, wasDrag) => {
    if (wasDrag) return; // suppress cycle if pointer moved
    if (state.editAssignMode) {
      openAssignModal(seat);
      return;
    }
    if (moveMode) {
      if (!moveSource) {
        setMoveSource({ r: seat.r, c: seat.c });
        return;
      }
      swapSeats(moveSource, seat);
      setMoveSource(null);
      return;
    }
    if (seat.studentId) cycleSeatLevel(seat.studentId);
  };

  // ----- Free Layout: drag desks anywhere -----
  const boardRef = useRef(null);
  const [dragging, setDragging] = useState(null); // {r,c}
  const [dragMoved, setDragMoved] = useState(false);

  const ensureXYForAll = () =>
    setState((p) => {
      const next = { ...p };
      const idx = next.classes.findIndex((c) => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      let changed = false;
      cls.seats = cls.seats.map((s) => {
        if (typeof s.x === "number" && typeof s.y === "number") return s;
        changed = true;
        return {
          ...s,
          x: (s.c + 0.5) / cls.cols,
          y: (s.r + 0.5) / cls.rows,
        };
      });
      if (changed) next.classes[idx] = cls;
      return next;
    });

  const setLayoutMode = (mode) => {
    setState((p) => {
      const next = { ...p };
      const idx = next.classes.findIndex((c) => c.id === p.selectedClassId);
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
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0.02, Math.min(0.98, x));
    const clampedY = Math.max(0.02, Math.min(0.98, y));
    setDragMoved(true);
    setState((p) => {
      const next = { ...p };
      const idx = next.classes.findIndex((c) => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      cls.seats = cls.seats.map((s) =>
        dragging && s.r === dragging.r && s.c === dragging.c
          ? { ...s, x: clampedX, y: clampedY }
          : s
      );
      next.classes[idx] = cls;
      return next;
    });
  };

  const onPointerUpBoard = () => setDragging(null);

  // ----- Settings (rows/cols moved here) -----
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rows, setRows] = useState(currentClass.rows);
  const [cols, setCols] = useState(currentClass.cols);
  useEffect(() => {
    setRows(currentClass.rows);
    setCols(currentClass.cols);
  }, [currentClass.rows, currentClass.cols]);

  const applySize = () =>
    setState((p) => {
      const next = { ...p };
      const idx = next.classes.findIndex((c) => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      const seats = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ex = cls.seats.find((s) => s.r === r && s.c === c);
          seats.push(ex ? ex : { r, c, studentId: null });
        }
      }
      cls.rows = rows;
      cls.cols = cols;
      cls.seats = seats;
      next.classes[idx] = cls;
      return next;
    });

  // ----- Assign Seat Modal -----
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignPos, setAssignPos] = useState(null);
  const [filter, setFilter] = useState("");
  const openAssignModal = (pos) => {
    setAssignPos(pos);
    setAssignOpen(true);
  };
  const assignSeat = (studentId) => {
    setState((p) => {
      const next = { ...p };
      const idx = next.classes.findIndex((c) => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      cls.seats = cls.seats.map((s) =>
        assignPos && s.r === assignPos.r && s.c === assignPos.c
          ? { ...s, studentId }
          : s
      );
      next.classes[idx] = cls;
      return next;
    });
    setAssignOpen(false);
  };

  // ----- Roster management -----
  const nameExists = (nm) =>
    currentClass.students.some(
      (s) => s.name.trim().toLowerCase() === nm.trim().toLowerCase()
    );

  const addStudent = (name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return false;
    if (nameExists(trimmed)) {
      alert("That name already exists in this class.");
      return false;
    }
    setState((p) => {
      const next = { ...p };
      const idx = next.classes.findIndex((c) => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      cls.students = [...cls.students, { id: uid(), name: trimmed }];
      next.classes[idx] = cls;
      return next;
    });
    return true;
  };

  const editStudent = (id, newName) => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    if (
      currentClass.students.find(
        (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase() && s.id !== id
      )
    ) {
      alert("That name already exists.");
      return;
    }
    setState((p) => {
      const next = { ...p };
      const idx = next.classes.findIndex((c) => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      cls.students = cls.students.map((s) =>
        s.id === id ? { ...s, name: trimmed } : s
      );
      next.classes[idx] = cls;
      return next;
    });
  };

  const deleteStudent = (id) => {
    if (
      !confirm(
        "Remove this student from the class? This will clear their marks and unassign their seat."
      )
    )
      return;
    setState((p) => {
      const next = { ...p };
      const idx = next.classes.findIndex((c) => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      // Unassign seats
      cls.seats = cls.seats.map((s) => (s.studentId === id ? { ...s, studentId: null } : s));
      // Clear marks across all skills for this class
      for (const k of Object.keys(cls.marks)) {
        if (cls.marks[k] && id in cls.marks[k]) delete cls.marks[k][id];
      }
      // Remove from roster
      cls.students = cls.students.filter((s) => s.id !== id);
      next.classes[idx] = cls;
      return next;
    });
  };

  const clearAllForStudent = (id) =>
    setState((p) => {
      const next = { ...p };
      const idx = next.classes.findIndex((c) => c.id === p.selectedClassId);
      if (idx < 0) return p;
      const cls = { ...next.classes[idx] };
      for (const k of Object.keys(cls.marks)) {
        if (cls.marks[k] && id in cls.marks[k]) delete cls.marks[k][id];
      }
      next.classes[idx] = cls;
      return next;
    });

  // Roster input state
  const [newName, setNewName] = useState("");

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Academic Monitoring</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportJSON}
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm bg-white hover:bg-slate-50 border"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <label className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm bg-white hover:bg-slate-50 border cursor-pointer">
              <Upload className="h-4 w-4" />
              Import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJSON(f);
                }}
              />
            </label>
            <button
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm bg-white hover:bg-slate-50 border"
            >
              <Wrench className="h-4 w-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 rounded-2xl bg-white p-3 shadow-sm border">
            <div className="flex flex-wrap items-center gap-3">
              {/* Class Select */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={state.selectedClassId}
                  onChange={(e) => setClass(e.target.value)}
                >
                  {state.classes.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addClass}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
                <button
                  onClick={renameClass}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <Pencil className="h-3 w-3" />
                  Rename
                </button>
              </div>

              {/* Skill Select + actions */}
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-500" />
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={state.selectedSkillId || ""}
                  onChange={(e) => setSkill(e.target.value)}
                >
                  {classSkills.length === 0 && (
                    <option value="">(No skills linked to this class)</option>
                  )}
                  {classSkills.map((sk) => (
                    <option key={sk.id} value={sk.id}>
                      {sk.name}
                      {sk.standardCode ? ` — ${sk.standardCode}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addSkill}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
                <button
                  onClick={renameSkill}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <Pencil className="h-3 w-3" />
                  Rename
                </button>
                <button
                  onClick={editSkillMeta}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  Meta
                </button>
                <button
                  onClick={linkSkillToClasses}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <LinkIcon className="h-3 w-3" />
                  Link
                </button>
                <button
                  onClick={deleteSkill}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50 text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>

              {/* Modes */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => {
                    setMoveMode(!moveMode);
                    setMoveSource(null);
                  }}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs ${
                    moveMode ? "bg-blue-50 border-blue-300" : "hover:bg-slate-50"
                  }`}
                >
                  <Move3D className="h-3 w-3" /> {moveMode ? "Move Seats: ON" : "Move Seats"}
                </button>
                <button
                  onClick={toggleAssignMode}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs ${
                    state.editAssignMode
                      ? "bg-emerald-50 border-emerald-300"
                      : "hover:bg-slate-50"
                  }`}
                >
                  Edit Seat Assignment: {state.editAssignMode ? "ON" : "OFF"}
                </button>
                <button
                  onClick={() =>
                    setLayoutMode(currentClass.layoutMode === "grid" ? "free" : "grid")
                  }
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <LayoutTemplate className="h-3 w-3" /> Layout:{" "}
                  {currentClass.layoutMode === "grid" ? "Grid" : "Free"}
                </button>
              </div>

              <Legend />
            </div>
          </div>

          {/* Roster & Tools */}
          <div className="rounded-2xl bg-white p-3 shadow-sm border">
            <EditorPanel
              state={state}
              setState={setState}
              addStudent={addStudent}
              editStudent={editStudent}
              deleteStudent={deleteStudent}
              clearAllForStudent={clearAllForStudent}
              newName={newName}
              setNewName={setNewName}
            />
          </div>
        </div>

        {/* Seating Area */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge>Skill: {selectedSkill?.name ?? "—"}</Badge>
              {selectedSkill?.standardCode && (
                <Badge>Std: {selectedSkill.standardCode}</Badge>
              )}
              {selectedSkill?.domain && <Badge>Domain: {selectedSkill.domain}</Badge>}
            </div>
            {/* Rows/Cols moved into Settings */}
          </div>

          {currentClass.layoutMode === "grid" ? (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${currentClass.cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: currentClass.rows * currentClass.cols }, (_, idx) => {
                const r = Math.floor(idx / currentClass.cols);
                const c = idx % currentClass.cols;
                const seat =
                  currentClass.seats.find((s) => s.r === r && s.c === c) || {
                    r,
                    c,
                    studentId: null,
                  };
                const lv = getLevel(seat.studentId);
                const meta = levelMeta[lv];
                const name = studentName(seat.studentId);

                // pointer-based drag suppression for grid (per-tile flag)
                let dragFlag = false;

                return (
                  <button
                    key={`${r}-${c}`}
                    className={`relative rounded-2xl p-3 h-20 ring-2 ${meta.ring} ${meta.bg} transition focus:outline-none hover:brightness-95`}
                    onPointerDown={() => {
                      dragFlag = false;
                    }}
                    onPointerMove={() => {
                      dragFlag = true;
                    }}
                    onPointerUp={() => onSeatClickGrid(seat, dragFlag)}
                    onDoubleClick={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      state.editAssignMode
                        ? "Tap to assign"
                        : seat.studentId
                        ? "Tap to cycle level"
                        : "Turn on Edit Seat Assignment to set student"
                    }
                  >
                    {/* (Coordinates removed) */}
                    <div className={`text-sm font-semibold ${meta.text} line-clamp-2 pr-6`}>
                      {name || "(empty)"}
                    </div>
                    <div className="absolute bottom-2 right-2 text-[10px] text-gray-500">
                      {meta.name}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              ref={boardRef}
              onPointerMove={onPointerMoveBoard}
              onPointerUp={onPointerUpBoard}
              className="relative w-full border rounded-2xl"
              style={{ height: 420 }}
            >
              {currentClass.seats.map((s) => {
                const x =
                  typeof s.x === "number" ? s.x : (s.c + 0.5) / currentClass.cols;
                const y =
                  typeof s.y === "number" ? s.y : (s.r + 0.5) / currentClass.rows;
                const lv = getLevel(s.studentId);
                const meta = levelMeta[lv];
                const name = studentName(s.studentId);

                // free layout tap/drag logic: if moved, do NOT cycle level
                let movedHere = false;

                return (
                  <button
                    key={`${s.r}-${s.c}`}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl p-3 h-20 w-36 ring-2 ${meta.ring} ${meta.bg} transition focus:outline-none hover:brightness-95`}
                    style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                    onPointerDown={(e) => onPointerDownSeat(e, s)}
                    onPointerMove={() => {
                      movedHere = true;
                    }}
                    onPointerUp={() => {
                      // if seat was dragged, ignore tap
                      if (movedHere || dragMoved) return;
                      if (state.editAssignMode) openAssignModal({ r: s.r, c: s.c });
                      else if (s.studentId) cycleSeatLevel(s.studentId);
                    }}
                    onDoubleClick={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      state.editAssignMode
                        ? "Tap to assign"
                        : s.studentId
                        ? "Tap to cycle level"
                        : "Turn on Edit Seat Assignment to set student"
                    }
                  >
                    {/* (Coordinates removed) */}
                    <div className={`text-sm font-semibold ${meta.text} line-clamp-2 pr-6`}>
                      {name || "(empty)"}
                    </div>
                    <div className="absolute bottom-2 right-2 text-[10px] text-gray-500">
                      {meta.name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Settings</h4>
              <button className="text-sm text-gray-500" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Edit Seat Assignment Mode</div>
                <button
                  onClick={toggleAssignMode}
                  className={`rounded-xl border px-3 py-1 text-sm ${
                    state.editAssignMode ? "bg-emerald-50 border-emerald-300" : "hover:bg-slate-50"
                  }`}
                >
                  {state.editAssignMode ? "ON" : "OFF"}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  When ON, tapping a seat assigns a student instead of changing level.
                </p>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Layout Mode</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLayoutMode("grid")}
                    className={`rounded-xl border px-3 py-1 text-sm ${
                      currentClass.layoutMode === "grid" ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setLayoutMode("free")}
                    className={`rounded-xl border px-3 py-1 text-sm ${
                      currentClass.layoutMode === "free" ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    Free
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Grid Size</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={rows}
                    onChange={(e) => setRows(parseInt(e.target.value || "1"))}
                    className="w-20 rounded-xl border px-2 py-1 text-sm"
                  />
                    <span className="text-sm text-gray-600">×</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={cols}
                    onChange={(e) => setCols(parseInt(e.target.value || "1"))}
                    className="w-20 rounded-xl border px-2 py-1 text-sm"
                  />
                  <button
                    onClick={applySize}
                    className="rounded-xl border px-3 py-1 text-sm hover:bg-slate-50"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Adjust rows/columns for the grid layout. Free layout seats keep their positions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Seat Modal */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Assign seat</h4>
              <button className="text-sm text-gray-500" onClick={() => setAssignOpen(false)}>
                Close
              </button>
            </div>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search student"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <div className="mt-3 max-h-64 overflow-y-auto divide-y">
              <button
                className="w-full text-left py-2 px-2 hover:bg-slate-50 text-sm"
                onClick={() => assignSeat(null)}
              >
                (empty)
              </button>
              {currentClass.students
                .filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left py-2 px-2 hover:bg-slate-50 text-sm"
                    onClick={() => assignSeat(s.id)}
                  >
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

// ----------------- Small UI helpers -----------------
function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100">
      {children}
    </span>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 ml-auto">
      {Object.entries(levelMeta).map(([k, m]) => (
        <div key={k} className="flex items-center gap-1">
          <span className={`h-3 w-3 inline-block rounded ${m.bg} ring-1 ${m.ring}`}></span>
          <span className="text-xs text-gray-600">{m.name}</span>
        </div>
      ))}
    </div>
  );
}

function EditorPanel({
  state,
  setState,
  addStudent,
  editStudent,
  deleteStudent,
  clearAllForStudent,
  newName,
  setNewName,
}) {
  const cl = state.classes.find((c) => c.id === state.selectedClassId);
  const onSubmit = (e) => {
    e.preventDefault();
    if (addStudent(newName)) setNewName("");
  };
  return (
    <div>
      <h3 className="font-semibold mb-2">Roster</h3>
      <form onSubmit={onSubmit} className="flex items-center gap-2 mb-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="First Last"
          className="flex-1 rounded-xl border px-2 py-1 text-sm"
        />
        <button type="submit" className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50">
          Add
        </button>
      </form>
      <div className="mt-3 max-h-64 overflow-y-auto divide-y">
        {cl.students.map((s) => (
          <StudentRow
            key={s.id}
            s={s}
            editStudent={editStudent}
            deleteStudent={deleteStudent}
            clearAllForStudent={clearAllForStudent}
          />
        ))}
      </div>
    </div>
  );
}

function StudentRow({ s, editStudent, deleteStudent, clearAllForStudent }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(s.name);
  const onSave = () => {
    editStudent(s.id, val);
    setEditing(false);
  };
  return (
    <div className="py-2 flex items-center justify-between gap-2">
      {editing ? (
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 rounded-xl border px-2 py-1 text-sm"
        />
      ) : (
        <div className="text-sm flex-1">{s.name}</div>
      )}
      {editing ? (
        <>
          <button className="text-xs" onClick={onSave}>
            Save
          </button>
          <button className="text-xs text-gray-500" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <button className="text-xs text-blue-600" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3 inline mr-1" />
            Edit
          </button>
          <button className="text-xs text-amber-700" onClick={() => clearAllForStudent(s.id)}>
            Clear all
          </button>
          <button className="text-xs text-red-600" onClick={() => deleteStudent(s.id)}>
            <Trash2 className="h-3 w-3 inline mr-1" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------- Lightweight Runtime Tests (optional) -----------------
(function runTests() {
  // Basic sanity for migrateLegacy (doesn't throw, preserves structure)
  const bad = JSON.stringify({
    classes: [
      { id: "A", name: 123, rows: "x", cols: null, seats: [{}], students: [{}] },
    ],
    skills: [{ id: 1, name: 2, standardCode: 3, classIds: "nope" }],
  });
  const s1 = migrateLegacy(bad);
  console.assert(Array.isArray(s1.classes) && s1.classes.length >= 1, "classes present");
  console.assert(Array.isArray(s1.skills), "skills present array");
  const raw2 = JSON.stringify({
    classes: [
      {
        id: "C1",
        rows: 1,
        cols: 1,
        seats: [{ r: 0, c: 0, studentId: null }],
        students: [],
        marks: {},
        skills: [{ id: "k1", name: "Old", standardCode: "NC.7.RP.2" }],
      },
    ],
    selectedClassId: "C1",
  });
  const s2 = migrateLegacy(raw2);
  const anyStd = (s2.skills.find((x) => x.standardCode) || {}).standardCode || "";
  console.assert(!anyStd.startsWith("NC.7."), "NC.7 stripped");
})();
