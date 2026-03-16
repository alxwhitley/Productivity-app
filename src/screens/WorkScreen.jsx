import { useState, useEffect, useRef } from "react";
import { fmtTime, toISODate, uid, getRoutinesForDate } from "../utils.js";
import { getDeepSlots } from "../constants.js";
import StatusBar from "../components/StatusBar.jsx";
import ShutdownSheet from "../sheets/ShutdownSheet.jsx";
import DWPickerSheet from "../sheets/DWPickerSheet.jsx";
import TaskRow from "../components/TaskRow.jsx";

// Bio-phase definitions (hardcoded wake 7am)
const BIO_PHASES = [
  { id: "peak", label: "Mental Peak", startMin: 420, endMin: 720 },
  { id: "second", label: "Second Wind", startMin: 720, endMin: 900 },
  { id: "shallow", label: "Shallow", startMin: 900, endMin: 1020 },
  { id: "wind", label: "Wind Down", startMin: 1020, endMin: 1260 },
];

const PHASE_COLORS = {
  peak: { css: "var(--blue)", glow: "rgba(91,138,240,0.08)" },
  second: { css: "var(--green)", glow: "rgba(69,193,122,0.08)" },
  shallow: { css: "var(--teal)", glow: "rgba(75,170,187,0.08)" },
  wind: { css: "var(--purple)", glow: "rgba(155,114,207,0.08)" },
};
const BIO_TOTAL = 840; // 7am–9pm in minutes

// Fixed deep work slots: 2 under Mental Peak, 1 under Second Wind
const FIXED_DW_SLOTS = [
  { slotIndex: 0, startHour: 9, startMin: 0, durationMin: 90, phase: "peak" },
  { slotIndex: 1, startHour: 11, startMin: 0, durationMin: 90, phase: "peak" },
  { slotIndex: 2, startHour: 13, startMin: 0, durationMin: 90, phase: "second" },
];

function getPhaseForMins(mins) {
  for (const p of BIO_PHASES) {
    if (mins >= p.startMin && mins < p.endMin) return p.id;
  }
  return mins < 420 ? "peak" : "wind";
}

function getTodayBlockCompletionState({ slot, project, manualCompleted, manualSkipped }) {
  const isSessionMode = (project?.type || project?.mode) === "sessions";
  const todayTaskIds = slot.todayTasks;
  const hasTodayTasks = Array.isArray(todayTaskIds) && todayTaskIds.length > 0;
  const relevantTasks = hasTodayTasks
    ? todayTaskIds.map(id => project?.tasks.find(t => t.id === id)).filter(Boolean)
    : [];
  const relevantDone = relevantTasks.filter(t => t.done).length;
  const allTasksDone = isSessionMode
    ? manualCompleted.has(slot.id)
    : (relevantTasks.length > 0 && relevantDone === relevantTasks.length);
  const isCompleted = allTasksDone || manualCompleted.has(slot.id);
  const isSkipped = manualSkipped?.has(slot.id) || false;
  return { isSessionMode, todayTaskIds, hasTodayTasks, relevantTasks, relevantDone, allTasksDone, isCompleted, isSkipped };
}

function getTodayBlockTimingState({ slot, lateStarted, getElapsedMs }) {
  const lateInfo = lateStarted[slot.id];
  const timerActive = !!lateInfo;
  const isRunning = timerActive && !lateInfo.paused;
  const isPaused = timerActive && !!lateInfo.paused;
  const elapsedMs = getElapsedMs(lateInfo);
  const totalMs = slot.durationMin * 60 * 1000;
  const remainMs = timerActive ? Math.max(0, totalMs - elapsedMs) : totalMs;
  const remainSec = Math.ceil(remainMs / 1000);
  const cdM = Math.floor(remainSec / 60);
  const cdS = remainSec % 60;
  const countdownLabel = `${String(cdM).padStart(2, "0")}:${String(cdS).padStart(2, "0")}`;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const elapsedM = Math.floor(elapsedSec / 60);
  const elapsedS = elapsedSec % 60;
  const elapsedLabel = `${String(elapsedM).padStart(2, "0")}:${String(elapsedS).padStart(2, "0")}`;
  return { lateInfo, timerActive, isRunning, isPaused, elapsedMs, totalMs, remainMs, remainSec, countdownLabel, elapsedLabel };
}

export default function WorkScreen({ data, setData, onGoToTasks }) {
  const [celebratingId, setCelebratingId] = useState(null);
  const [dwPickerOpen, setDwPickerOpen] = useState(null);
  const [lateStarted, setLateStarted] = useState({});
  const [tick, setTick] = useState(0);
  const [pickerState, setPickerState] = useState(null);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [showDwPulse, setShowDwPulse] = useState(false);

  // Carousel state
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const carouselRef = useRef(null);

  // Shallow card expand
  const [shallowExpanded, setShallowExpanded] = useState(false);
  const [shallowPicking, setShallowPicking] = useState(false);
  const [shallowPickSelected, setShallowPickSelected] = useState(new Set());

  // Routine expand
  const [expandedRoutineId, setExpandedRoutineId] = useState(null);

  const todayStr = new Date().toDateString();
  const manualCompleted = new Set(
    (data.blockCompletions || []).filter(c => c.date === todayStr && !c.skipped).map(c => c.blockId)
  );
  const manualSkipped = new Set(
    (data.blockCompletions || []).filter(c => c.date === todayStr && c.skipped).map(c => c.blockId)
  );

  const { domains, projects } = data;

  const getElapsedMs = (info) => {
    if (!info) return 0;
    const accumulated = info.accumulatedMs || 0;
    if (info.paused) return accumulated;
    return accumulated + (Date.now() - (info.startedAt || Date.now()));
  };

  const startTimerSlot = (slotId) => {
    setLateStarted(prev => {
      const existing = prev[slotId];
      return { ...prev, [slotId]: { startedAt: Date.now(), accumulatedMs: existing?.accumulatedMs || 0, paused: false, pausedAt: null }};
    });
  };

  const pauseTimerSlot = (slotId) => {
    setLateStarted(prev => {
      const info = prev[slotId];
      if (!info || info.paused) return prev;
      const accumulated = (info.accumulatedMs || 0) + (Date.now() - info.startedAt);
      return { ...prev, [slotId]: { ...info, paused: true, pausedAt: Date.now(), accumulatedMs: accumulated } };
    });
  };

  const mutateDWSlot = (dateStr, slotIndex, patch) => {
    setData(prev => {
      const existing = [...((prev.deepWorkSlots || {})[dateStr] || [])];
      while (existing.length <= slotIndex) existing.push({});
      existing[slotIndex] = patch === null ? {} : { ...existing[slotIndex], ...patch };
      return { ...prev, deepWorkSlots: { ...(prev.deepWorkSlots || {}), [dateStr]: existing } };
    });
  };

  const viewDateKeyISO_ref = useRef("");

  const saveDWTodayTasks = (slotIndex, taskIds) =>
    mutateDWSlot(viewDateKeyISO_ref.current, slotIndex, { todayTasks: taskIds.length > 0 ? taskIds : null });

  const logSession = (projectId, durationMin, note) => {
    setData(d => ({
      ...d,
      sessionLog: [...(d.sessionLog || []), { id: uid(), projectId, date: toISODate(), durationMin, note: note || "" }],
    }));
  };

  const getProject = id => projects.find(p => p.id === id);
  const getDomain = id => domains.find(d => d.id === id);

  const toggleTask = (projectId, taskId) => {
    setData(d => ({
      ...d, projects: d.projects.map(p =>
        p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t) } : p
      )
    }));
  };

  const addTaskToProject = (projectId, text) => {
    const newId = uid();
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { id: newId, text, done: false }] } : p) }));
    return newId;
  };

  const markManualDone = (blockId, projectId, todayTaskIds) => {
    setData(d => {
      let updatedProjects = d.projects;
      if (projectId) {
        const proj = d.projects.find(p => p.id === projectId);
        if (proj) {
          const idsToCheck = (Array.isArray(todayTaskIds) && todayTaskIds.length > 0) ? todayTaskIds : proj.tasks.map(t => t.id);
          updatedProjects = d.projects.map(p => p.id === projectId
            ? { ...p, tasks: p.tasks.map(t => idsToCheck.includes(t.id) ? { ...t, done: true, doneAt: new Date().toISOString() } : t) }
            : p
          );
        }
      }
      const existing = d.blockCompletions || [];
      const alreadyLogged = existing.some(c => c.blockId === blockId && c.date === todayStr);
      const blk = (d.blocks || []).find(b => b.id === blockId);
      const durationMin = blk?.durationMin || 60;
      const blockCompletions = alreadyLogged ? existing : [...existing, { blockId, date: todayStr, durationMin }];
      return { ...d, projects: updatedProjects, blockCompletions };
    });
    setCelebratingId(blockId);
    setTimeout(() => setCelebratingId(null), 1600);
  };

  const unmarkManualDone = (blockId, projectId, todayTaskIds) => {
    setData(d => {
      let updatedProjects = d.projects;
      if (projectId) {
        const proj = d.projects.find(p => p.id === projectId);
        if (proj) {
          const idsToUncheck = (Array.isArray(todayTaskIds) && todayTaskIds.length > 0) ? todayTaskIds : proj.tasks.map(t => t.id);
          updatedProjects = d.projects.map(p => p.id === projectId
            ? { ...p, tasks: p.tasks.map(t => idsToUncheck.includes(t.id) ? { ...t, done: false, doneAt: undefined } : t) }
            : p
          );
        }
      }
      const blockCompletions = (d.blockCompletions || []).filter(c => !(c.blockId === blockId && c.date === todayStr));
      return { ...d, projects: updatedProjects, blockCompletions };
    });
  };

  const markSkipped = (blockId) => {
    setData(d => {
      const existing = d.blockCompletions || [];
      const alreadyLogged = existing.some(c => c.blockId === blockId && c.date === todayStr);
      const blockCompletions = alreadyLogged ? existing : [...existing, { blockId, date: todayStr, skipped: true }];
      return { ...d, blockCompletions };
    });
  };

  const unmarkSkipped = (blockId) => {
    setData(d => ({
      ...d,
      blockCompletions: (d.blockCompletions || []).filter(c => !(c.blockId === blockId && c.date === todayStr)),
    }));
  };

  // Live tick every second
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Reset shutdownDone each new day
  useEffect(() => {
    const todayISO = toISODate();
    if (data.shutdownDone && data.shutdownDate !== todayISO) {
      setData(d => ({ ...d, shutdownDone: false, shutdownDate: todayISO }));
    }
  }, [data.shutdownDone, data.shutdownDate]);

  // DW slot pulse hint on first load
  useEffect(() => {
    if (!(data.onboardingHints || {}).dwSlotPulseSeen) {
      setShowDwPulse(true);
      const t = setTimeout(() => {
        setShowDwPulse(false);
        setData(d => ({ ...d, onboardingHints: { ...(d.onboardingHints || {}), dwSlotPulseSeen: true } }));
      }, 2000);
      return () => clearTimeout(t);
    }
  }, []);

  // ── Date & timeline ──
  const now = new Date();
  const today = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const currentPhase = getPhaseForMins(nowMins);

  const dateKey = today.toDateString();
  const dateKeyISO = toISODate(today);
  const viewDateKeyISO = dateKeyISO;
  viewDateKeyISO_ref.current = viewDateKeyISO;

  const savedDWSlots = (data.deepWorkSlots || {})[viewDateKeyISO] || [];

  // Build the 3 fixed deep work slots
  const todayDWSlots = FIXED_DW_SLOTS.map((def, i) => {
    const saved = savedDWSlots[i] || {};
    return {
      id: `dw-${viewDateKeyISO}-${i}`,
      slotIndex: i,
      startHour: saved.startHour ?? def.startHour,
      startMin: saved.startMin ?? def.startMin,
      durationMin: saved.durationMin ?? def.durationMin,
      projectId: saved.projectId || null,
      todayTasks: saved.todayTasks || null,
      phase: def.phase,
    };
  });

  // ── Today's Shallow Work ──
  const todayISO = toISODate();
  const todayPickIds = (data.todayLoosePicks || {})[todayISO] || [];
  const todayPickTasks = todayPickIds.map(id => {
    const loose = (data.looseTasks || []).find(t => t.id === id);
    if (loose) return { ...loose, source: "loose" };
    for (const proj of (data.projects || [])) {
      const t = proj.tasks?.find(t => t.id === id);
      if (t) return { ...t, source: "project", projectId: proj.id };
    }
    return null;
  }).filter(Boolean);
  const shallowCount = todayPickTasks.length;
  const shallowDoneCount = todayPickTasks.filter(t => t.done).length;

  const toggleTodayPickTask = (task) => {
    if (task.source === "project") {
      toggleTask(task.projectId, task.id);
    } else {
      setData(d => ({
        ...d,
        looseTasks: (d.looseTasks || []).map(t =>
          t.id === task.id ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t
        ),
      }));
    }
  };

  // Shutdown visibility
  const showShutdownFooter = nowMins >= 720;
  const shutdownDoneToday = data.shutdownDone && data.shutdownDate === todayISO;

  // Routines for today
  const todayRoutines = getRoutinesForDate(data.routineBlocks || [], today);

  // ── Carousel ──
  const carouselSlots = todayDWSlots;

  // Scroll-driven dot indicator
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const onScroll = () => {
      const index = Math.round(el.scrollTop / el.clientHeight);
      setActiveCardIdx(index);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ── Render a single DW carousel card ──
  function renderDWCarouselCard(slot) {
    const isAssigned = !!slot.projectId;
    if (!isAssigned) {
      // Unassigned empty card
      return (
        <div className="dw-card-inner" style={{
          border: "1.5px dashed var(--border)",
          background: "var(--bg2)",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}>
          <div style={{ color: "var(--text3)", fontSize: 15, fontWeight: 500, marginBottom: 16 }}>No deep work scheduled</div>
          <button onClick={() => setDwPickerOpen({ slot })} style={{
            background: "none", border: "1.5px solid var(--accent)", borderRadius: 10,
            padding: "10px 20px", fontSize: 14, fontWeight: 700, color: "var(--accent)",
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
          }}>+ Plan your day</button>
        </div>
      );
    }

    const proj = getProject(slot.projectId);
    const domain = proj ? getDomain(proj.domainId) : null;
    const domainColor = domain?.color || "#8A9099";
    const domainName = domain?.name || "";
    const isSessionMode = (proj?.type || proj?.mode) === "sessions";
    const typeBadge = isSessionMode ? "Session" : "Task-based";

    const { hasTodayTasks, relevantTasks, relevantDone, isCompleted, isSkipped } = getTodayBlockCompletionState({ slot, project: proj, manualCompleted, manualSkipped });
    const { timerActive, isRunning, countdownLabel: cdStr } = getTodayBlockTimingState({ slot, lateStarted, getElapsedMs });

    const blockEndMins = slot.startHour * 60 + slot.startMin + slot.durationMin;
    const blockStartMins = slot.startHour * 60 + slot.startMin;
    const isPast = blockEndMins < nowMins;
    const isActive = blockStartMins <= nowMins && nowMins < blockEndMins;

    const cardBg = `${domainColor}26`; // ~15% opacity hex

    const isPicking = pickerState?.blockId === slot.id;

    const handleDone = () => {
      const info = lateStarted[slot.id];
      const elapsedMs = getElapsedMs(info);
      const elapsedMin = Math.round(elapsedMs / 60000);
      if (elapsedMin > 0) logSession(proj.id, elapsedMin, null);
      markManualDone(slot.id, proj.id, slot.todayTasks);
      setLateStarted(prev => { const n = { ...prev }; delete n[slot.id]; return n; });
    };

    return (
      <div className="dw-card-inner" style={{
        background: cardBg,
        border: "none",
        boxShadow: `inset 0 0 0 1.5px ${domainColor}60`,
        opacity: (isPast && isCompleted) || isSkipped ? 0.45 : 1,
      }}>
        {/* Header row: DEEP WORK · domain (or SKIPPED) */}
        <div className="dw-card-header-row">
          {isSkipped ? (
            <span className="dw-card-label" style={{ color: "var(--text3)" }}>Skipped</span>
          ) : (
            <span className="dw-card-label">Deep Work</span>
          )}
          <span className="dw-card-domain" style={{ color: domainColor }}>· {domainName || "No domain"}</span>
        </div>

        {/* Type badge */}
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)", background: "var(--bg3)", borderRadius: 6, padding: "2px 8px" }}>{typeBadge}</span>
        </div>

        {/* Project name */}
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginTop: 12, lineHeight: 1.2 }}>{proj?.name}</div>

        {/* Timer row */}
        {!isCompleted && !isSkipped && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <button onClick={(e) => { e.stopPropagation(); isRunning ? pauseTimerSlot(slot.id) : startTimerSlot(slot.id); }} style={{
              width: 20, height: 20, background: "none", border: "none", cursor: "pointer",
              color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
            }}>
              {isRunning
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>
                : <svg width="12" height="13" viewBox="0 0 16 18" fill="none"><path d="M1 1l14 8-14 8V1z" fill="currentColor"/></svg>
              }
            </button>
            <span style={{ fontSize: 15, color: "var(--text2)", fontVariantNumeric: "tabular-nums", fontFamily: "'DM Sans', sans-serif" }}>
              {cdStr}
            </span>
            <span style={{ fontSize: 13, color: "var(--text3)" }}>{slot.durationMin} min</span>
          </div>
        )}

        {/* Action / state row */}
        {isCompleted ? (
          <div className="dw-complete-row" onClick={() => unmarkManualDone(slot.id, proj?.id, slot.todayTasks)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="dw-complete-label">Complete</span>
            <span className="dw-undo-label">Tap to undo</span>
          </div>
        ) : isSkipped ? (
          <div className="dw-skipped-row" onClick={() => unmarkSkipped(slot.id)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 5l7 7-7 7M5 5l7 7-7 7" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="dw-skipped-label">Skipped</span>
            <span className="dw-undo-label">Tap to undo</span>
          </div>
        ) : (
          <div className="dw-action-row">
            <button className="dw-btn-complete" onClick={handleDone}>Complete</button>
            <button className="dw-btn-skip" onClick={() => markSkipped(slot.id)}>Skip</button>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />

        {/* Task list — scrollable */}
        <div className="task-scroll">
          {isPicking ? (() => {
            const ps = pickerState;
            const confirmPick = () => {
              let finalIds = [...ps.selected];
              if (ps.newText.trim()) { const newId = addTaskToProject(proj.id, ps.newText.trim()); finalIds.push(newId); }
              saveDWTodayTasks(slot.slotIndex, finalIds);
              setPickerState(null);
            };
            return (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>Pick today's tasks</div>
                {proj.tasks.filter(t => !t.done).map(t => {
                  const checked = ps.selected.has(t.id);
                  return (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 2px", cursor: "pointer" }}
                      onClick={() => setPickerState(prev => { const s = new Set(prev.selected); checked ? s.delete(t.id) : s.add(t.id); return { ...prev, selected: s }; })}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: checked ? "none" : "1.5px solid var(--border)", background: checked ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {checked && <span style={{ fontSize: 10, color: "#000", fontWeight: 800 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 14, color: checked ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                    </div>
                  );
                })}
                <input style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13, fontFamily: "'DM Sans',sans-serif", marginTop: 8, boxSizing: "border-box" }}
                  placeholder="Add new task…" value={ps.newText}
                  onChange={e => setPickerState(prev => ({ ...prev, newText: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && confirmPick()} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="dw-confirm-btn" style={{ flex: 1 }} onClick={confirmPick}>✓ Confirm</button>
                  <button className="dw-back" onClick={() => setPickerState(null)}>✕</button>
                </div>
              </div>
            );
          })() : hasTodayTasks ? (
            <>
              {relevantTasks.map(t => (
                <div key={t.id} className="dw-task-row" style={{ opacity: t.done ? 0.45 : 1, cursor: "pointer" }}
                  onClick={() => {
                    toggleTask(proj.id, t.id);
                    if (!t.done) {
                      const remaining = relevantTasks.filter(rt => rt.id !== t.id && !rt.done);
                      if (remaining.length === 0) { logSession(proj.id, slot.durationMin, null); markManualDone(slot.id, proj.id, slot.todayTasks); }
                    }
                  }}>
                  <div className={`dw-task-circle${t.done ? " done" : ""}`}>
                    {t.done && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                  </div>
                  <span className={`dw-task-text${t.done ? " done" : ""}`} style={{ flex: 1 }}>{t.text}</span>
                </div>
              ))}
              {timerActive && !isCompleted && (
                <button onClick={handleDone}
                  style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--green)", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  Done ✓
                </button>
              )}
            </>
          ) : (
            <div style={{ cursor: "pointer", color: "var(--blue)", fontSize: 13, fontWeight: 600 }}
              onClick={() => setPickerState({ blockId: slot.id, projectId: proj.id, selected: new Set(), newText: "" })}>
              + Pick tasks
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render routine card (kept from old design, still in scroll area) ──
  function renderRoutineCard(rb) {
    const comp = (rb.completions || {})[dateKey] || {};
    const doneCt = rb.tasks.filter(t => comp[t.id]).length;
    const allDone = rb.tasks.length > 0 && doneCt === rb.tasks.length;
    const isExp = expandedRoutineId === rb.id;
    const blockEndMins = rb.startHour * 60 + rb.startMin + rb.durationMin;
    const isPast = blockEndMins < nowMins;
    const toggleRtTask = (taskId) => {
      setData(d => ({
        ...d,
        routineBlocks: (d.routineBlocks||[]).map(r => {
          if (r.id !== rb.id) return r;
          const prev = (r.completions||{})[dateKey] || {};
          return { ...r, completions: { ...(r.completions||{}), [dateKey]: { ...prev, [taskId]: !prev[taskId] } } };
        })
      }));
    };

    return (
      <div key={rb.id} className={`work-card${isPast ? " past-block" : ""}`} style={{
        background: "var(--bg2)",
        border: allDone ? "1px solid rgba(69,193,122,.2)" : "1px solid var(--border)",
      }} onClick={() => setExpandedRoutineId(isExp ? null : rb.id)}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--teal)", flexShrink: 0, opacity: allDone ? 0.4 : 1, marginTop: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: allDone ? "var(--text3)" : "var(--text)", lineHeight: 1.2 }}>{rb.title}</div>
            {!isExp && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>{data.todayPrefs?.hideTimes ? "" : `${fmtTime(rb.startHour, rb.startMin)} · `}{rb.durationMin} min · {doneCt}/{rb.tasks.length}</div>}
          </div>
          {allDone && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: "var(--text3)", opacity: .4, transform: isExp ? "rotate(90deg)" : "none", transition: "transform .2s" }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        {isExp && (
          <div style={{ padding: "0 16px 14px" }}>
            {rb.tasks.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < rb.tasks.length - 1 ? "1px solid var(--border2)" : "none", cursor: "pointer" }}
                onClick={e => { e.stopPropagation(); toggleRtTask(t.id); }}>
                <div className={`tl-check ${comp[t.id] ? "done" : ""}`} style={{ width: 20, height: 20, flexShrink: 0 }}>
                  {comp[t.id] && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                </div>
                <span className={`tl-task-txt ${comp[t.id] ? "done" : ""}`} style={{ fontSize: 14 }}>{t.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ══════ RENDER ══════

  return (
    <div className="screen active" style={{ display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Full-screen ambient phase glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: `radial-gradient(ellipse at center, ${PHASE_COLORS[currentPhase]?.glow || "transparent"} 0%, transparent 70%)` }} />
      <StatusBar />

      {/* ── HEADER ── */}
      <div className="ph">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="ph-eye">Work</div>
            <div className="ph-title">Today's Work</div>
          </div>
          <button className="tab-gear" onClick={() => {}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── WORK CARD AREA (DW carousel + shallow card) ── */}
      <div className={`work-card-area${shallowExpanded ? " shallow-expanded" : ""}`}>
        {/* Side dots */}
        {carouselSlots.length > 1 && (
          <div className="dw-side-dots">
            {carouselSlots.map((_, i) => (
              <div key={i} className={`dw-side-dot${i === activeCardIdx ? " active" : ""}`} />
            ))}
          </div>
        )}

        {/* DW carousel */}
        <div className={`dw-carousel${carouselSlots.length <= 1 ? " single" : ""}`} ref={carouselRef}>
          {carouselSlots.length > 0 ? (
            carouselSlots.map(slot => (
              <div key={slot.id} className="dw-card-snap">
                {renderDWCarouselCard(slot)}
              </div>
            ))
          ) : (
            <div className="dw-card-snap">
              <div className="dw-card-inner" style={{
                border: "1.5px dashed var(--border)", background: "var(--bg2)",
                alignItems: "center", justifyContent: "center", textAlign: "center",
              }}>
                <div style={{ color: "var(--text3)", fontSize: 15, fontWeight: 500, marginBottom: 16 }}>No deep work scheduled</div>
                <button style={{
                  background: "none", border: "1.5px solid var(--accent)", borderRadius: 10,
                  padding: "10px 20px", fontSize: 14, fontWeight: 700, color: "var(--accent)",
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                }}>+ Plan your day</button>
              </div>
            </div>
          )}
        </div>

        {/* Shallow work card */}
        <div className={`shallow-card${shallowExpanded ? " expanded" : ""}`}
          onClick={() => { if (!shallowExpanded) setShallowExpanded(true); }}>

          {/* Rest state row */}
          <div className="shallow-card-rest">
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--teal)" }}>Shallow Work</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                {shallowCount === 0 ? "No tasks queued" : `${shallowCount} task${shallowCount !== 1 ? "s" : ""} queued${shallowDoneCount > 0 ? ` · ${shallowDoneCount} done` : ""}`}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "var(--text3)" }}>
              <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Expanded full content */}
          <div className="shallow-card-full">
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--teal)" }}>Shallow Work</span>
              <button onClick={(e) => { e.stopPropagation(); setShallowExpanded(false); setShallowPicking(false); }} style={{
                width: 26, height: 26, borderRadius: "50%", background: "var(--bg3)", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text2)",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Task list or picker */}
            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
              {shallowPicking ? (() => {
                const allLoose = (data.looseTasks || []).filter(t => !t.done);
                const allFab = (data.fabQueue || []).filter(t => !t.done);
                const pickable = [...allLoose, ...allFab.filter(f => !allLoose.some(l => l.id === f.id))];
                return (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>Select tasks for today</div>
                    {pickable.length === 0 ? (
                      <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 14, padding: "32px 0" }}>No tasks available</div>
                    ) : (
                      pickable.map(t => {
                        const checked = shallowPickSelected.has(t.id);
                        return (
                          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 2px", cursor: "pointer" }}
                            onClick={() => setShallowPickSelected(prev => { const s = new Set(prev); checked ? s.delete(t.id) : s.add(t.id); return s; })}>
                            <div style={{ width: 18, height: 18, borderRadius: 5, border: checked ? "none" : "1.5px solid var(--border)", background: checked ? "var(--teal)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {checked && <span style={{ fontSize: 10, color: "#fff", fontWeight: 800 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: 14, color: checked ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                          </div>
                        );
                      })
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        const newIds = [...new Set([...todayPickIds, ...shallowPickSelected])];
                        setData(d => ({ ...d, todayLoosePicks: { ...(d.todayLoosePicks || {}), [todayISO]: newIds } }));
                        setShallowPicking(false);
                        setShallowPickSelected(new Set());
                      }} style={{
                        flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                        background: "var(--teal)", border: "none", color: "#fff", cursor: "pointer",
                        fontFamily: "'DM Sans',sans-serif",
                      }}>✓ Confirm</button>
                      <button onClick={(e) => { e.stopPropagation(); setShallowPicking(false); setShallowPickSelected(new Set()); }} style={{
                        padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                        background: "var(--bg3)", border: "none", color: "var(--text2)", cursor: "pointer",
                        fontFamily: "'DM Sans',sans-serif",
                      }}>✕</button>
                    </div>
                  </>
                );
              })() : (
                <>
                  {todayPickTasks.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 14, padding: "32px 0" }}>No tasks queued</div>
                  ) : (
                    todayPickTasks.map(t => (
                      <div key={t.id} className="sw-task-row" style={{ cursor: "pointer" }}
                        onClick={(e) => { e.stopPropagation(); toggleTodayPickTask(t); }}>
                        <div className={`sw-task-circle${t.done ? " done" : ""}`}>
                          {t.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span className={`sw-task-text${t.done ? " done" : ""}`}>{t.text}</span>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {/* Bottom actions */}
            {!shallowPicking && (
              <div style={{ display: "flex", gap: 10, paddingTop: 12, borderTop: "1px solid var(--border2)", flexShrink: 0 }}>
                <button onClick={(e) => { e.stopPropagation(); onGoToTasks(); }} style={{
                  flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                  background: "var(--bg2)", border: "none", color: "var(--text)", cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif", textAlign: "center",
                }}>+ Add task</button>
                <button onClick={(e) => { e.stopPropagation(); setShallowPicking(true); setShallowPickSelected(new Set()); }} style={{
                  flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                  background: "var(--bg2)", border: "none", color: "var(--teal)", cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif", textAlign: "center",
                }}>Pull from Tasks</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ROUTINE BLOCKS ── */}
      {todayRoutines.length > 0 && (
        <div style={{ padding: "0 4px 8px", flexShrink: 0 }}>
          {todayRoutines.map(rb => renderRoutineCard(rb))}
        </div>
      )}

      {/* Bottom spacer for pill nav */}
      <div style={{ height: 80, flexShrink: 0 }} />

      {/* ── SHUTDOWN SHEET ── */}
      {shutdownOpen && (
        <ShutdownSheet
          data={data}
          alreadyDone={shutdownDoneToday}
          onClose={() => setShutdownOpen(false)}
          onComplete={() => {
            setData(d => ({ ...d, shutdownDone: true, shutdownDate: todayISO, taskCompletions: { ...(d.taskCompletions || {}), [todayISO]: [] } }));
            setShutdownOpen(false);
          }}
          onCategorizeLoose={(taskId, domainId) => {
            setData(d => ({
              ...d,
              looseTasks: (d.looseTasks || []).map(t => t.id === taskId ? { ...t, domainId } : t),
            }));
          }}
        />
      )}

      {/* ── DW PICKER SHEET ── */}
      {dwPickerOpen && (() => {
        const pickerSlot = dwPickerOpen.slot;
        return (
          <DWPickerSheet
            data={data}
            slot={pickerSlot}
            dateStr={viewDateKeyISO}
            slotIndex={pickerSlot.slotIndex}
            preSelectedProjectId={dwPickerOpen.preProjectId || null}
            preSelectedTasks={dwPickerOpen.preTasks || []}
            onClose={() => setDwPickerOpen(null)}
            onConfirm={(dateStr, slotIndex, projectId, taskIds) => {
              mutateDWSlot(dateStr, slotIndex, {
                projectId,
                startHour: pickerSlot.startHour,
                startMin: pickerSlot.startMin,
                durationMin: pickerSlot.durationMin,
                todayTasks: taskIds.length > 0 ? taskIds : null,
              });
            }}
          />
        );
      })()}

      {/* ── CELEBRATION OVERLAY ── */}
      {celebratingId && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 200 }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="celebrate-burst" />
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--accent)", background: "var(--bg2)", borderRadius: 20, padding: "8px 20px", border: "1px solid rgba(232,160,48,.3)" }}>Block complete ✓</div>
          </div>
        </div>
      )}
    </div>
  );
}
