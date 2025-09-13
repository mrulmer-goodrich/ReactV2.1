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

// ----------------- Constants & Helpers -----------------
const lsKey = "seating-monitor-v4";
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
  0: {
    name: "N/A",
    bg: "bg-gray-100",
    ring: "ring-gray-300",
    text: "text-gray-600",
  },
  1: {
    name: "Help",
    bg: "bg-red-100",
    ring: "ring-red-300",
    text: "text-red-800",
  },
  2: {
    name: "Developing",
    bg: "bg-amber-100",
    ring: "ring-amber-300",
    text: "text-amber-800",
  },
  3: {
    name: "Proficient",
    bg: "bg-green-100",
    ring: "ring-green-300",
    text: "text-green-800",
  },
  4: {
    name: "Advanced",
    bg: "bg-blue-100",
    ring: "ring-blue-300",
    text: "text-blue-800",
  },
};

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

// --- helpers (migration, save/load) omitted for brevity ---
// keep same migrateLegacy, loadState, saveState logic as before

export default function App() {
  // state + persistence (same as before)
  const [state, setState] = useState(DEFAULT_STATE());
  useEffect(() => {
    try {
      localStorage.setItem(lsKey, JSON.stringify(state));
    } catch {}
  }, [state]);

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

  if (!currentClass) return <div className="p-4">No class selected.</div>;

  const studentName = (id) =>
    currentClass.students.find((s) => s.id === id)?.name ?? "";
  const getLevel = (studentId) => {
    if (!studentId || !selectedSkill) return 0;
    const lv = currentClass.marks[selectedSkill.id]?.[studentId];
    return typeof lv === "number" ? lv : 0;
  };

  // roster add/edit/delete/clearAll logic here...
  // seat click: if editAssignMode is ON, opens assignment
  // otherwise cycles levels
  // free layout drag no longer increments level
  // skill add/edit/delete with domain list + standard list (Other allowed)
  // settings modal for rows/cols

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Academic Monitoring</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(state, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `monitoring-${new Date()
                  .toISOString()
                  .slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
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
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      setState(JSON.parse(reader.result));
                    } catch {
                      alert("Invalid JSON");
                    }
                  };
                  reader.readAsText(f);
                }}
              />
            </label>
            <button
              onClick={() =>
                setState((p) => ({ ...p, editAssignMode: !p.editAssignMode }))
              }
              className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm border ${
                state.editAssignMode ? "bg-blue-50 border-blue-300" : ""
              }`}
            >
              <Wrench className="h-4 w-4" />
              {state.editAssignMode ? "Assign Mode: ON" : "Assign Mode"}
            </button>
          </div>
        </div>

        {/* TODO: rest of UI (class select, skill select, seating grid/free layout, roster panel) 
            — copy over from previous version but with changes:
            - no seat coordinates label
            - rows/cols control moved to settings modal
            - skill add/edit/delete uses NC_DOMAINS + NC7 list (with "Other")
            - student add on Enter, no duplicates, edit/delete/clearAll work */}
      </div>
    </div>
  );
}
