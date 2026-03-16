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

function getTodayBlockCompletionState({ slot, project, manualCompleted }) {
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
  return { isSessionMode, todayTaskIds, hasTodayTasks, relevantTasks, relevantDone, allTasksDone, isCompleted };
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
  const [expandedId, setExpandedId] = useState(null);
  const [celebratingId, setCelebratingId] = useState(null);
  const [dwOverflowOpen, setDwOverflowOpen] = useState(null);
  const [dwPickerOpen, setDwPickerOpen] = useState(null); // { slot, preProjectId?, preTasks? }
  const [lateStarted, setLateStarted] = useState({});
  const [tick, setTick] = useState(0);
  const [pickerState, setPickerState] = useState(null);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [showDwPulse, setShowDwPulse] = useState(false);

  const scrollRef = useRef(null);

  const todayStr = new Date().toDateString();
  const manualCompleted = new Set(
    (data.blockCompletions || []).filter(c => c.date === todayStr).map(c => c.blockId)
  );

  const { domains, projects, blocks } = data;

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

  const saveDWSlot = (slotId, slotIndex, projectId, startHour, startMin, durationMin, todayTasks) =>
    mutateDWSlot(viewDateKeyISO_ref.current, slotIndex, { projectId, startHour, startMin, durationMin, todayTasks: todayTasks || null });

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
    setRecentlyChecked(prev => { const next = new Set(prev); next.add(taskId); return next; });
    setTimeout(() => setRecentlyChecked(prev => { const next = new Set(prev); next.delete(taskId); return next; }), 450);
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
    setTimeout(() => { setCelebratingId(null); setExpandedId(null); }, 1600);
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

  const viewDate = today;
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

  const todayRoutines = getRoutinesForDate(data.routineBlocks || [], today);
  const viewRoutines = todayRoutines;

  const timeline = [
    ...viewRoutines.map(r => ({ type: "routine", id: r.id, mins: r.startHour * 60 + r.startMin, data: r })),
    ...todayDWSlots.map(s => ({ type: "deepwork", id: s.id, mins: s.startHour * 60 + s.startMin, data: s })),
  ].sort((a, b) => a.mins - b.mins);

  const currentItem = timeline.find(item => {
    const endMins = item.mins + (item.data.durationMin || 60);
    return item.mins <= nowMins && nowMins < endMins;
  });

  // Auto-expand current block
  const lastAutoExpanded = useRef(null);
  useEffect(() => {
    if (currentItem && currentItem.id !== lastAutoExpanded.current) {
      setExpandedId(currentItem.id);
      lastAutoExpanded.current = currentItem.id;
    }
  }, [currentItem?.id]);

  // ── Bio bar position ──
  const barPct = Math.max(0, Math.min(100, (nowMins - 420) / BIO_TOTAL * 100));

  // ── Today's Shallow Work (exclusively from todayLoosePicks) ──
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
  const hasShallowPicks = todayPickTasks.length > 0;

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

  // ── Shutdown visibility: show at 12pm+ ──
  const showShutdownFooter = nowMins >= 720;
  const shutdownDoneToday = data.shutdownDone && data.shutdownDate === todayISO;

  // ── Group blocks by phase ──
  // For deep work we use fixed phase assignments; for routines we compute from time
  const groupedBlocks = BIO_PHASES.map(phase => {
    const items = [];
    // Add routines in this phase
    viewRoutines.forEach(r => {
      const m = r.startHour * 60 + r.startMin;
      if (m >= phase.startMin && m < phase.endMin) {
        items.push({ type: "routine", id: r.id, mins: m, data: r });
      }
    });
    // Add deep work slots assigned to this phase
    todayDWSlots.forEach(s => {
      if (s.phase === phase.id) {
        items.push({ type: "deepwork", id: s.id, mins: s.startHour * 60 + s.startMin, data: s });
      }
    });
    items.sort((a, b) => a.mins - b.mins);
    return { ...phase, items };
  });

  // Determine which phases have content (blocks or shallow banner)
  const hasShallowContent = true; // Always show shallow phase

  // ── Render helpers ──

  const nowMinsForPast = now.getHours() * 60 + now.getMinutes();

  function renderRoutineCard(item, isNow) {
    const rb = item.data;
    const comp = (rb.completions || {})[dateKey] || {};
    const doneCt = rb.tasks.filter(t => comp[t.id]).length;
    const allDone = rb.tasks.length > 0 && doneCt === rb.tasks.length;
    const isExp = expandedId === rb.id;
    const blockEndMins = rb.startHour * 60 + rb.startMin + rb.durationMin;
    const isPast = !isNow && blockEndMins < nowMinsForPast;
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
        border: allDone ? "1px solid rgba(69,193,122,.2)" : isNow ? "1.5px solid rgba(75,170,187,.3)" : "1px solid var(--border)",
      }} onClick={() => setExpandedId(isExp ? null : rb.id)}>
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

  function renderUnassignedCard(slot) {
    return (
      <div key={slot.id} className={`work-card dw-empty${showDwPulse ? " dw-pulse" : ""}`} style={{
        background: "var(--bg2)",
        border: "1.5px dashed var(--border)",
        cursor: "pointer",
        height: 64, overflow: "hidden",
      }} onClick={() => setDwPickerOpen({ slot })}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, height: "100%", boxSizing: "border-box" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".3" /></svg>
          <div style={{ flex: 1, color: "var(--text2)" }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Deep Work Block</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text2)" }}>{(data.todayPrefs || {}).hideTimes ? "" : fmtTime(slot.startHour, slot.startMin) + " · "}{slot.durationMin} min</span>
        </div>
      </div>
    );
  }

  function renderAssignedCard(slot, isNow) {
    const proj = getProject(slot.projectId);
    const domain = proj ? getDomain(proj.domainId) : null;
    const domainColor = domain?.color || null;

    const { isSessionMode, hasTodayTasks, relevantTasks, relevantDone, isCompleted } = getTodayBlockCompletionState({ slot, project: proj, manualCompleted });
    const { timerActive, isRunning, countdownLabel: cdStr } = getTodayBlockTimingState({ slot, lateStarted, getElapsedMs });

    const isExp = expandedId === slot.id;
    const showBody = isExp && !isCompleted;
    const isPicking = pickerState?.blockId === slot.id;
    const blockEndMins = slot.startHour * 60 + slot.startMin + slot.durationMin;
    const isPast = !isNow && blockEndMins < nowMinsForPast;

    // Done card
    if (isCompleted) {
      const isExpDone = expandedId === slot.id;
      return (
        <div key={slot.id} className={`work-card${isPast ? " past-block" : ""}`} style={{
          background: "var(--bg2)", border: "1px solid var(--border)", opacity: 0.55, position: "relative", cursor: "pointer",
          height: isExpDone ? 180 : 64, overflow: "hidden", transition: "height .2s ease",
        }} onClick={() => setExpandedId(isExpDone ? null : slot.id)}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--border)", borderRadius: "14px 0 0 14px" }} />
          <div style={{ padding: "12px 16px 0 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text3)", letterSpacing: "-.01em" }}>{proj?.name}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{data.todayPrefs?.hideTimes ? "" : `${fmtTime(slot.startHour, slot.startMin)} · `}{slot.durationMin} min</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          {isExpDone && hasTodayTasks && (
            <div style={{ padding: "8px 16px 14px 20px", overflowY: "auto", maxHeight: 120 }} onClick={e => e.stopPropagation()}>
              {relevantTasks.map((t, i) => (
                <div key={t.id} className="tl-task-row" style={{ padding: "8px 0", borderBottom: i < relevantTasks.length - 1 ? "1px solid var(--border2)" : "none" }}>
                  <div className={`tl-check ${t.done ? "done" : ""}`}
                    style={{ width: 20, height: 20, flexShrink: 0, cursor: "pointer" }}
                    onClick={() => {
                      if (t.done) {
                        toggleTask(proj.id, t.id);
                        unmarkManualDone(slot.id, proj.id, [t.id]);
                      }
                    }}>
                    {t.done && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 14, color: t.done ? "var(--text2)" : "var(--text)", textDecoration: t.done ? "line-through" : "none", flex: 1 }}>{t.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    const handleDone = () => {
      const info = lateStarted[slot.id];
      const elapsedMs = getElapsedMs(info);
      const elapsedMin = Math.round(elapsedMs / 60000);
      if (elapsedMin > 0) logSession(proj.id, elapsedMin, null);
      markManualDone(slot.id, proj.id, slot.todayTasks);
      setLateStarted(prev => { const n = { ...prev }; delete n[slot.id]; return n; });
    };

    return (
      <div key={slot.id} className={`work-card${isPast && !isNow ? " past-block" : ""}`} style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        position: "relative",
        height: showBody ? 180 : 64, overflow: "hidden",
        transition: "height .2s ease",
      }} onClick={() => setExpandedId(isExp ? null : slot.id)}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: domainColor || "var(--text3)", borderRadius: "14px 0 0 14px" }} />

        {/* Overflow menu overlay */}
        {dwOverflowOpen === slot.id && (
          <div style={{ position: "absolute", inset: 0, background: "var(--bg2)", borderRadius: 14, zIndex: 10, display: "flex", flexDirection: "column", padding: "16px 16px 14px", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)" }}>{proj?.name}</span>
              <button onClick={() => setDwOverflowOpen(null)}
                style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text3)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => { mutateDWSlot(viewDateKeyISO, slot.slotIndex, null); setExpandedId(null); setDwOverflowOpen(null); }}
                style={{ padding: "14px 16px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
                Unassign
              </button>
              <button onClick={() => {
                setDwOverflowOpen(null);
                setDwPickerOpen({
                  slot,
                  preProjectId: slot.projectId,
                  preTasks: Array.isArray(slot.todayTasks) ? slot.todayTasks : [],
                });
              }}
                style={{ padding: "14px 16px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Change Project
              </button>
              <button onClick={() => {
                  const tomorrowISO = toISODate(new Date(Date.now() + 86400000));
                  mutateDWSlot(toISODate(), slot.slotIndex, null);
                  mutateDWSlot(tomorrowISO, slot.slotIndex, { projectId: slot.projectId, startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin, todayTasks: slot.todayTasks });
                  setExpandedId(null); setDwOverflowOpen(null);
                }}
                  style={{ padding: "14px 16px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", gap: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Move to Tomorrow
                </button>
            </div>
          </div>
        )}

        {/* Header row */}
        <div style={{ padding: "12px 16px 0 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", letterSpacing: "-.01em", lineHeight: 1.15 }}>{proj?.name}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              {data.todayPrefs?.hideTimes ? "" : `${fmtTime(slot.startHour, slot.startMin)} · `}{slot.durationMin} min
              {!showBody && !isSessionMode && hasTodayTasks ? ` · ${relevantDone}/${relevantTasks.length}` : ""}
            </div>
          </div>
          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button style={{ width: 20, height: 20, background: "none", border: "none", cursor: "pointer", color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); isRunning ? pauseTimerSlot(slot.id) : startTimerSlot(slot.id); }}>
              {isRunning
                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>
                : <svg width="10" height="11" viewBox="0 0 16 18" fill="none"><path d="M1 1l14 8-14 8V1z" fill="currentColor"/></svg>
              }
            </button>
            <span style={{ fontSize: 12, color: "var(--text2)", fontVariantNumeric: "tabular-nums", fontFamily: "'DM Sans', sans-serif" }}>{cdStr}</span>
            {showBody && (
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "var(--text3)", display: "flex", alignItems: "center" }}
                onClick={e => { e.stopPropagation(); setDwOverflowOpen(dwOverflowOpen === slot.id ? null : slot.id); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── EXPANDED BODY: tasks + done ── */}
        {showBody && (
          <div style={{ padding: "6px 16px 10px 20px", overflowY: "auto", maxHeight: 120 }} onClick={e => e.stopPropagation()}>
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
                  <TaskRow
                    key={t.id}
                    task={t}
                    onToggle={() => {
                      toggleTask(proj.id, t.id);
                      if (!t.done) {
                        const remaining = relevantTasks.filter(rt => rt.id !== t.id && !rt.done);
                        if (remaining.length === 0) { logSession(proj.id, slot.durationMin, null); markManualDone(slot.id, proj.id, slot.todayTasks); }
                      }
                    }}
                    onEdit={(newText) => setData(d => ({ ...d, projects: d.projects.map(p => p.id !== proj.id ? p : { ...p, tasks: p.tasks.map(tk => tk.id !== t.id ? tk : { ...tk, text: newText }) }) }))}
                    onDelete={() => setData(d => ({ ...d, projects: d.projects.map(p => p.id !== proj.id ? p : { ...p, tasks: p.tasks.filter(tk => tk.id !== t.id) }) }))}
                    onQuickWin={() => setData(d => ({ ...d, projects: d.projects.map(p => ({ ...p, tasks: p.tasks.map(tk => tk.id !== t.id ? tk : { ...tk, quickWin: !(tk.quickWin ?? false) }) })) }))}
                  />
                ))}
                {timerActive && (
                  <button onClick={handleDone}
                    style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--green)", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                    Done ✓
                  </button>
                )}
              </>
            ) : (
              <div style={{ cursor: "pointer", color: "var(--text3)", fontSize: 12 }}
                onClick={() => setPickerState({ blockId: slot.id, projectId: proj.id, selected: new Set(), newText: "" })}>
                + Pick tasks
              </div>
            )}
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
      <div ref={scrollRef} className="scroll" style={{ flex: 1, paddingBottom: 80 }}>

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

        {/* ── PHASE BAR ── */}
        <div className="phase-bar-wrap">
          <div className="phase-bar-row">
            <span className="phase-bar-label" style={{ color: PHASE_COLORS[currentPhase]?.css || "var(--text3)" }}>
              {BIO_PHASES.find(p => p.id === currentPhase)?.label || ""}
            </span>
            <div className="phase-bar-dots" style={{ color: PHASE_COLORS[currentPhase]?.css || "var(--text3)" }}>
              {BIO_PHASES.filter(p => p.id !== "wind").map(p => (
                <div key={p.id} className={`phase-bar-dot${currentPhase === p.id ? " active" : ""}`} />
              ))}
            </div>
          </div>
          <div className="phase-bar-track">
            <div className="phase-bar-fill" style={{ width: `${barPct}%`, background: PHASE_COLORS[currentPhase]?.css || "var(--accent)" }} />
          </div>
        </div>

        {/* ── BLOCKS BY PHASE ── */}

        {groupedBlocks.map(group => {
          const hasItems = group.items.length > 0;
          const isShallowPhase = group.id === "shallow";

          if (group.id === "wind") return null;
          if (!hasItems && !isShallowPhase) return null;

          const phaseColor = PHASE_COLORS[group.id];
          const isActivePhase = currentPhase === group.id;

          return (
            <div key={group.id}>
              {/* Phase header */}
              <div style={{ padding: "16px 16px 6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: isActivePhase ? (phaseColor?.css || "var(--text3)") : "var(--text3)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: isActivePhase ? 700 : 500, textTransform: "uppercase", color: isActivePhase ? "var(--text2)" : "var(--text3)", whiteSpace: "nowrap", letterSpacing: ".06em" }}>
                    {group.label}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
                </div>
                {isShallowPhase && (
                  <div style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)", marginTop: 3, paddingLeft: 16 }}>quick tasks · emails · admin</div>
                )}
              </div>


              {/* Block cards */}
              {group.items.map(item => {
                const isNow = currentItem?.id === item.id;
                if (item.type === "routine") return renderRoutineCard(item, isNow);
                if (item.type === "deepwork") {
                  const slot = item.data;
                  if (!slot.projectId) return renderUnassignedCard(slot);
                  return renderAssignedCard(slot, isNow);
                }
                return null;
              })}

              {/* Shallow work section */}
              {isShallowPhase && (
                <div style={{ margin: "8px 12px 0", background: "var(--bg2)", borderRadius: 14, padding: 16, borderLeft: "3px solid var(--teal)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 8 }}>Today's Shallow Work</div>
                  {hasShallowPicks ? (
                    <>
                      {todayPickTasks.map(t => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border2)", cursor: "pointer" }}
                          onClick={() => toggleTodayPickTask(t)}>
                          <div className={`tl-check ${t.done ? "done" : ""}`} style={{ width: 20, height: 20, flexShrink: 0 }}>
                            {t.done && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 14, color: t.done ? "var(--text3)" : "var(--text)", textDecoration: t.done ? "line-through" : "none", flex: 1 }}>{t.text}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{ cursor: "pointer", color: "var(--text3)", fontSize: 13 }}
                      onClick={() => onGoToTasks()}>
                      + Add from Tasks
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })}



      </div>


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
