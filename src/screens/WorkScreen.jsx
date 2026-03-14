import { useState, useEffect, useRef } from "react";
import { fmtTime, toISODate, uid, getRoutinesForDate, getBioPhase, getSlotBioPhase } from "../utils.js";
import { getDeepSlots } from "../constants.js";
import StatusBar from "../components/StatusBar.jsx";
import TimerBlock from "../components/TimerBlock.jsx";

function getTodayBlockCardStyles({ isRunning, isCompleted, isNow, domainColor }) {
  const background = "var(--bg2)";
  const runningBorder = isRunning ? "1.5px solid rgba(155,114,207,.6)" : null;

  let border = "1px solid var(--border)";
  if (runningBorder) {
    border = runningBorder;
  } else if (isCompleted) {
    border = "1px solid rgba(69,193,122,.25)";
  } else if (isNow && domainColor) {
    border = `2px solid ${domainColor}90`;
  } else if (domainColor) {
    border = `1px solid ${domainColor}50`;
  }

  const shadow = isRunning
    ? "none"
    : isNow && domainColor
      ? `0 0 32px ${domainColor}20`
      : "none";

  const animation = isRunning ? "dw-running-pulse 2.4s ease-in-out infinite" : "none";

  return {
    background,
    runningBorder,
    border,
    shadow,
    animation,
  };
}

function getTodayBlockCompletionState({ slot, project, manualCompleted }) {
  const isSessionMode = project?.mode === "sessions";
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

  return {
    isSessionMode,
    todayTaskIds,
    hasTodayTasks,
    relevantTasks,
    relevantDone,
    allTasksDone,
    isCompleted,
  };
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

  return {
    lateInfo,
    timerActive,
    isRunning,
    isPaused,
    elapsedMs,
    totalMs,
    remainMs,
    remainSec,
    countdownLabel,
    elapsedLabel,
  };
}

export default function WorkScreen({ data, setData, onGoToTasks }) {
  const [expandedId, setExpandedId] = useState(null);
  const [celebratingId, setCelebratingId] = useState(null);
  const [recentlyChecked, setRecentlyChecked] = useState(new Set());
  const [blockMenuOpen, setBlockMenuOpen] = useState(null);
  const [blockMenuMode, setBlockMenuMode] = useState(null);
  const [dwPickerOpen, setDwPickerOpen] = useState(null);
  const [dwPickerStep, setDwPickerStep] = useState({});
  const [dwPickerProj, setDwPickerProj] = useState({});
  const [dwPickerTime, setDwPickerTime] = useState({});
  const [viewingTomorrow, setViewingTomorrow] = useState(false);
  const [lateStarted, setLateStarted] = useState({});
  const [newTaskText, setNewTaskText] = useState({});
  const [tick, setTick] = useState(0);
  const [dwOverflowOpen, setDwOverflowOpen] = useState(null);
  const [pickerState, setPickerState] = useState(null);
  const [dwAddingTask, setDwAddingTask] = useState(null);
  const [dwNewTaskText, setDwNewTaskText] = useState("");
  const [editingDwTaskId, setEditingDwTaskId] = useState(null);
  const [editingDwTaskText, setEditingDwTaskText] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTime, setEditingTime] = useState(null);
  const [planningMode, setPlanningMode] = useState(false);

  const scrollRef = useRef(null);

  // manualCompleted derived from persisted data (today's date only)
  const todayStr = new Date().toDateString();
  const manualCompleted = new Set(
    (data.blockCompletions || []).filter(c => c.date === todayStr).map(c => c.blockId)
  );

  const { domains, projects, blocks, shutdownDone } = data;

  // Get elapsed ms for a slot (handles running + paused states)
  const getElapsedMs = (info) => {
    if (!info) return 0;
    const accumulated = info.accumulatedMs || 0;
    if (info.paused) return accumulated;
    return accumulated + (Date.now() - (info.startedAt || Date.now()));
  };

  // Start or resume timer
  const startTimerSlot = (slotId) => {
    setLateStarted(prev => {
      const existing = prev[slotId];
      return { ...prev, [slotId]: {
        startedAt: Date.now(),
        accumulatedMs: existing?.accumulatedMs || 0,
        paused: false,
        pausedAt: null,
      }};
    });
  };

  // Pause timer
  const pauseTimerSlot = (slotId) => {
    setLateStarted(prev => {
      const info = prev[slotId];
      if (!info || info.paused) return prev;
      const accumulated = (info.accumulatedMs || 0) + (Date.now() - info.startedAt);
      return { ...prev, [slotId]: { ...info, paused: true, pausedAt: Date.now(), accumulatedMs: accumulated } };
    });
  };

  // Done: log elapsed time, mark complete, clear timer
  const doneTimer = (slot, proj) => {
    const info = lateStarted[slot.id];
    const elapsedMs = getElapsedMs(info);
    const elapsedMin = Math.round(elapsedMs / 60000);
    if (elapsedMin > 0) logSession(proj.id, elapsedMin, null);
    markManualDone(slot.id, proj.id, slot.todayTasks);
    setLateStarted(prev => { const n = { ...prev }; delete n[slot.id]; return n; });
  };

  // Reset: clear timer entirely without saving
  const resetTimer = (slotId) => {
    setLateStarted(prev => { const n = { ...prev }; delete n[slotId]; return n; });
  };

  // ── DW slot mutation helper ──
  const mutateDWSlot = (dateStr, slotIndex, patch) => {
    setData(prev => {
      const existing = [...((prev.deepWorkSlots || {})[dateStr] || [])];
      while (existing.length <= slotIndex) existing.push({});
      existing[slotIndex] = patch === null ? {} : { ...existing[slotIndex], ...patch };
      return { ...prev, deepWorkSlots: { ...(prev.deepWorkSlots || {}), [dateStr]: existing } };
    });
  };

  const saveDWSlot = (slotId, slotIndex, projectId, startHour, startMin, durationMin, todayTasks) =>
    mutateDWSlot(viewDateKeyISO, slotIndex, { projectId, startHour, startMin, durationMin, todayTasks: todayTasks || null });

  const clearDWSlot = (slotIndex) =>
    mutateDWSlot(viewDateKeyISO, slotIndex, null);

  const saveDWTodayTasks = (slotIndex, taskIds) =>
    mutateDWSlot(viewDateKeyISO, slotIndex, { todayTasks: taskIds.length > 0 ? taskIds : null });

  const saveDWSessionNote = (slotIndex, note) =>
    mutateDWSlot(viewDateKeyISO, slotIndex, { sessionNote: note || null });

  const rescheduleDWSlot = (slotIndex, newHour, newMin) => {
    mutateDWSlot(viewDateKeyISO, slotIndex, { startHour: newHour, startMin: newMin });
    setEditingTime(null);
  };

  const logSession = (projectId, durationMin, note) => {
    setData(d => ({
      ...d,
      sessionLog: [...(d.sessionLog || []), {
        id: uid(),
        projectId,
        date: toISODate(),
        durationMin,
        note: note || "",
      }],
    }));
  };

  const getProject = id => projects.find(p => p.id === id);
  const getDomain  = id => domains.find(d => d.id === id);

  const toggleTask = (projectId, taskId) => {
    setData(d => ({
      ...d, projects: d.projects.map(p =>
        p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t) } : p
      )
    }));
    setRecentlyChecked(prev => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    setTimeout(() => setRecentlyChecked(prev => {
      const next = new Set(prev); next.delete(taskId); return next;
    }), 450);
  };

  const updateTaskText = (projectId, taskId, newText) => {
    if (!newText.trim()) return;
    setData(d => ({
      ...d, projects: d.projects.map(p =>
        p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, text: newText.trim() } : t) } : p
      )
    }));
    setEditingTaskId(null);
  };

  const addTask = (projectId) => {
    const text = (newTaskText[projectId] || "").trim();
    if (!text) return;
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { id: uid(), text, done: false }] } : p) }));
    setNewTaskText(t => ({ ...t, [projectId]: "" }));
  };

  const saveTodayTasks = (blockId, taskIds) => {
    const todayStr = new Date().toDateString();
    setData(d => {
      const wasCompleted = (d.blockCompletions || []).some(c => c.blockId === blockId && c.date === todayStr);
      const blk = d.blocks.find(b => b.id === blockId);
      const prevIds = Array.isArray(blk?.todayTasks) ? blk.todayTasks : [];
      const hasNewTasks = taskIds.some(id => !prevIds.includes(id));
      const blockCompletions = wasCompleted && hasNewTasks
        ? (d.blockCompletions || []).filter(c => !(c.blockId === blockId && c.date === todayStr))
        : d.blockCompletions;
      return {
        ...d,
        blocks: d.blocks.map(b => b.id === blockId ? { ...b, todayTasks: taskIds } : b),
        blockCompletions,
      };
    });
  };

  const markManualDone = (blockId, projectId, todayTaskIds) => {
    setData(d => {
      let projects = d.projects;
      if (projectId) {
        const proj = d.projects.find(p => p.id === projectId);
        if (proj) {
          const idsToCheck = (Array.isArray(todayTaskIds) && todayTaskIds.length > 0)
            ? todayTaskIds
            : proj.tasks.map(t => t.id);
          projects = d.projects.map(p => p.id === projectId
            ? { ...p, tasks: p.tasks.map(t => idsToCheck.includes(t.id) ? { ...t, done: true, doneAt: new Date().toISOString() } : t) }
            : p
          );
        }
      }
      const todayStr = new Date().toDateString();
      const existing = d.blockCompletions || [];
      const alreadyLogged = existing.some(c => c.blockId === blockId && c.date === todayStr);
      const blk = (d.blocks || []).find(b => b.id === blockId);
      const durationMin = blk?.durationMin || 60;
      const blockCompletions = alreadyLogged ? existing : [...existing, { blockId, date: todayStr, durationMin }];
      return { ...d, projects, blockCompletions };
    });
    setCelebratingId(blockId);
    setTimeout(() => {
      setCelebratingId(null);
      setExpandedId(null);
    }, 1600);
  };

  const unmarkManualDone = (blockId, projectId, todayTaskIds) => {
    setData(d => {
      let projects = d.projects;
      if (projectId) {
        const proj = d.projects.find(p => p.id === projectId);
        if (proj) {
          const idsToUncheck = (Array.isArray(todayTaskIds) && todayTaskIds.length > 0)
            ? todayTaskIds
            : proj.tasks.map(t => t.id);
          projects = d.projects.map(p => p.id === projectId
            ? { ...p, tasks: p.tasks.map(t => idsToUncheck.includes(t.id) ? { ...t, done: false, doneAt: undefined } : t) }
            : p
          );
        }
      }
      const todayStr = new Date().toDateString();
      const blockCompletions = (d.blockCompletions || []).filter(c => !(c.blockId === blockId && c.date === todayStr));
      return { ...d, projects, blockCompletions };
    });
  };

  const addTaskToProject = (projectId, text) => {
    const newId = uid();
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { id: newId, text, done: false }] } : p) }));
    return newId;
  };

  const startBlock = (slotId) => {
    startTimerSlot(slotId);
    setExpandedId(slotId);
  };

  // Live tick every second (powers clock + countdowns)
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

  // Scroll DW slot button to near top of screen when picker opens
  useEffect(() => {
    if (!dwPickerOpen) return;
    setTimeout(() => {
      const btn = document.querySelector(`[data-dwslot="${dwPickerOpen}"]`);
      if (btn && scrollRef.current) {
        const scrollEl = scrollRef.current;
        const btnTop = btn.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
        scrollEl.scrollTo({ top: Math.max(0, btnTop - 80), behavior: "smooth" });
      }
    }, 30);
  }, [dwPickerOpen]);

  const now   = new Date();
  const today = new Date();
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Tomorrow date keys
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dateKey = today.toDateString();
  const dateKeyISO = toISODate(today);
  const tomorrowDateKey = tomorrow.toDateString();
  const tomorrowDateKeyISO = toISODate(tomorrow);

  // Active view date (today or tomorrow)
  const viewDate = viewingTomorrow ? tomorrow : today;
  const viewDateKey = viewingTomorrow ? tomorrowDateKey : dateKey;
  const viewDateKeyISO = viewingTomorrow ? tomorrowDateKeyISO : dateKeyISO;

  // Build deep work slots for active view
  const deepDefaults = getDeepSlots(data);
  const savedDWSlots = (data.deepWorkSlots || {})[viewDateKeyISO] || [];
  const maxDeepBlocks = data.deepWorkTargets?.maxDeepBlocks ?? 3;
  const filledSlots = ((data.deepWorkSlots || {})[dateKeyISO] || []).filter(s => s && s.projectId).length;
  const isPlanned = filledSlots >= maxDeepBlocks;

  const todayBlocks = blocks.filter(b => b.dayOffset === 0);
  const todayRoutines = getRoutinesForDate(data.routineBlocks || [], today);
  const viewRoutines = viewingTomorrow ? getRoutinesForDate(data.routineBlocks || [], tomorrow) : todayRoutines;

  // Always show exactly maxDeepBlocks slots
  const todayDWSlots = Array.from({ length: maxDeepBlocks }, (_, i) => {
    const def = deepDefaults[i] || deepDefaults[deepDefaults.length - 1];
    const saved = savedDWSlots[i] || {};
    return ({
      id: `dw-${viewDateKeyISO}-${i}`,
      slotIndex: i,
      startHour: saved.startHour ?? def.startHour,
      startMin:  saved.startMin  ?? def.startMin,
      durationMin: saved.durationMin ?? def.durationMin,
      projectId:   saved.projectId || null,
      todayTasks:  saved.todayTasks || null,
    });
  });

  const timeline = [
    ...viewRoutines.map(r => ({ type: "routine", id: r.id, mins: r.startHour * 60 + r.startMin, data: r })),
    ...todayDWSlots.map(s => ({ type: "deepwork", id: s.id, mins: s.startHour * 60 + s.startMin, data: s })),
  ].sort((a, b) => a.mins - b.mins);

  // Find the "current" block
  const currentItem = timeline.find(item => {
    const endMins = item.mins + (item.data.durationMin || 60);
    return item.mins <= nowMins && nowMins < endMins;
  });

  // Next upcoming
  const nextItem = timeline.find(item => item.mins > nowMins);

  // Auto-expand the current block
  const lastAutoExpanded = useRef(null);
  useEffect(() => {
    if (currentItem && currentItem.id !== lastAutoExpanded.current) {
      setExpandedId(currentItem.id);
      lastAutoExpanded.current = currentItem.id;
    }
  }, [currentItem?.id]);

  // Clock display
  const clockH = now.getHours() > 12 ? now.getHours() - 12 : now.getHours() === 0 ? 12 : now.getHours();
  const clockM = now.getMinutes().toString().padStart(2, "0");
  const clockAmpm = now.getHours() >= 12 ? "PM" : "AM";

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const name = data.todayPrefs?.name;

  return (
    <div className="screen active" style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <StatusBar />

      {/* ── HEADER ── */}
      <div className="ph" style={{ paddingBottom:10, paddingTop:10, flexShrink:0 }}>
        {viewingTomorrow && (
          <button onClick={() => setViewingTomorrow(false)} style={{ background:"none", border:"none", cursor:"pointer", padding:"0 0 8px", display:"flex", alignItems:"center", gap:4, color:"var(--text3)", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Today
          </button>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
              {!viewingTomorrow
                ? <><span className="today-clock">{clockH}:{clockM}</span><span className="today-clock-ampm">{clockAmpm}</span></>
                : <span className="today-clock" style={{ fontSize:28 }}>Tomorrow</span>
              }
            </div>
            <div style={{ fontSize:13, color:"var(--text2)", marginTop:2, fontWeight:500 }}>
              {days[viewDate.getDay()]}, {months[viewDate.getMonth()]} {viewDate.getDate()}
            </div>
          </div>
        </div>
        <div style={{ fontSize:12, color:"var(--text3)", marginTop:6 }}>
          {viewingTomorrow
            ? `${timeline.length} block${timeline.length !== 1 ? "s" : ""} planned`
            : `${greeting}${name ? `, ${name}` : ""}.`
          }
        </div>
      </div>

      {/* ── BIO-TIME BANNER ── */}
      {!viewingTomorrow && (() => {
        const bio = getBioPhase(data.wakeUpTime);
        return (
          <div style={{ margin:"0 16px 12px", padding:"10px 14px", borderRadius:12, background:bio.bgColor, borderLeft:`3px solid ${bio.color}`, display:"flex", alignItems:"flex-start", gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, color:bio.color, marginBottom:2 }}>{bio.label}</div>
              <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.4 }}>{bio.advice}</div>
            </div>
          </div>
        );
      })()}

      {/* ── PLAN MY DAY CTA ── */}
      {!viewingTomorrow && (
        isPlanned ? (
          <div style={{ textAlign:"center", padding:"8px 0", flexShrink:0 }}>
            <span style={{ fontSize:12, color:"var(--text3)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Edit today's plan</span>
          </div>
        ) : (
          <div onClick={() => {
            setPlanningMode(true);
            const firstEmpty = todayDWSlots.find(s => !s.projectId);
            if (firstEmpty) setExpandedId(firstEmpty.id);
          }} style={{ margin:"0 16px 12px", background:"var(--bg2)", borderRadius:14, borderLeft:"4px solid var(--accent)", padding:"14px 16px", cursor:"pointer", flexShrink:0 }}>
            <div style={{ fontSize:15, fontWeight:600, color:"var(--text)", lineHeight:1.3 }}>Plan your deep work</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>Assign your focus blocks for today</div>
            <button onClick={(e) => {
              e.stopPropagation();
              setPlanningMode(true);
              const firstEmpty = todayDWSlots.find(s => !s.projectId);
              if (firstEmpty) setExpandedId(firstEmpty.id);
            }} style={{ display:"block", width:"100%", marginTop:12, padding:"12px 0", background:"var(--accent)", color:"#000", border:"none", borderRadius:12, fontSize:14, fontWeight:700, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>
              Plan My Day →
            </button>
          </div>
        )
      )}

      {/* ── CARD STACK — fills remaining screen height ── */}
      {(() => {
        const allCards = [...timeline];

        if (allCards.length === 0) {
          return (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <div style={{ fontSize:13, color:"var(--text3)", textAlign:"center" }}>No blocks today.<br/>Add some in the Week tab.</div>
            </div>
          );
        }

        return (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
            {/* Tomorrow link */}
            <div style={{ display:"flex", justifyContent:"flex-end", padding:"0 14px 6px", flexShrink:0 }}>
              {!viewingTomorrow ? (
                <button onClick={() => setViewingTomorrow(true)}
                  style={{ background:"none", border:"none", fontSize:12, color:"var(--text3)", fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"2px 0", letterSpacing:".02em" }}>
                  Tomorrow →
                </button>
              ) : (
                <button onClick={() => setViewingTomorrow(false)}
                  style={{ background:"none", border:"none", fontSize:12, color:"var(--accent)", fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"2px 0", letterSpacing:".02em" }}>
                  ← Today
                </button>
              )}
            </div>
            <div ref={scrollRef} style={{ flex:1, display:"flex", flexDirection:"column", gap:8, padding:"0 12px 8px", overflow:"hidden", minHeight:0 }}>
            {allCards.map((item) => {
              const isPast = !viewingTomorrow && (item.mins + (item.data.durationMin || 60)) <= nowMins;
              const isNow  = !viewingTomorrow && currentItem?.id === item.id;
              const isExp  = expandedId === item.id;
              const flexVal = currentItem ? (isNow ? 2.2 : 0.8) : 1;

              // ── ROUTINE CARD ──
              if (item.type === "routine") {
                const rb = item.data;
                const comp = (rb.completions || {})[dateKey] || {};
                const doneCt = rb.tasks.filter(t => comp[t.id]).length;
                const allDone = rb.tasks.length > 0 && doneCt === rb.tasks.length;
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
                  <div key={rb.id} style={{ flex: isExp ? 3 : 0.85, minHeight:0, borderRadius:18, background: isExp ? "var(--bg2)" : "var(--bg2)", border: isExp ? "1.5px solid rgba(75,170,187,.5)" : isNow ? "1.5px solid rgba(75,170,187,.3)" : allDone ? "1px solid rgba(69,193,122,.2)" : "1px solid var(--border)", boxShadow: isExp ? "0 0 24px rgba(75,170,187,.15)" : "none", overflow:"hidden", display:"flex", flexDirection:"column", opacity: isPast && !allDone && !isExp ? 0.45 : 1, transition:"flex .35s cubic-bezier(.4,0,.2,1), opacity .2s, border-color .2s, box-shadow .2s", cursor:"pointer" }}
                    onClick={() => setExpandedId(isExp ? null : rb.id)}
                  >
                    {/* Collapsed header */}
                    <div style={{ padding: isExp ? "14px 16px 10px" : "14px 16px 12px", flex: isExp ? "none" : 1, display:"flex", alignItems:"flex-start", gap:12, minHeight:0 }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:"var(--teal)", flexShrink:0, opacity: allDone ? 0.4 : 1, marginTop:3 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize: isNow ? 17 : 14, fontWeight:700, color: allDone ? "var(--text3)" : "var(--text)", letterSpacing:"-.01em", lineHeight:1.2 }}>{rb.title}</div>
                        {!isExp && <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>{data.todayPrefs?.hideTimes ? "" : `${fmtTime(rb.startHour, rb.startMin)} · `}{rb.durationMin} min · {doneCt}/{rb.tasks.length} done</div>}
                      </div>
                      {allDone && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, color:"var(--text3)", opacity:.4, transform: isExp ? "rotate(90deg)" : "none", transition:"transform .2s" }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    {isExp && (
                      <div style={{ flex:1, overflowY:"auto", padding:"0 16px 14px" }}>
                        {rb.tasks.map((t, i) => (
                          <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 0", borderBottom: i < rb.tasks.length-1 ? "1px solid var(--border2)" : "none", cursor:"pointer" }}
                            onClick={e => { e.stopPropagation(); toggleRtTask(t.id); }}>
                            <div className={`tl-check ${comp[t.id] ? "done" : ""}`} style={{ width:20, height:20, flexShrink:0 }}>
                              {comp[t.id] && <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>}
                            </div>
                            <span className={`tl-task-txt ${comp[t.id] ? "done" : ""}`} style={{ fontSize:14 }}>{t.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // ── DEEP WORK CARD ──
              if (item.type === "deepwork") {
                const slot = item.data;
                const proj = slot.projectId ? getProject(slot.projectId) : null;
                const domain = proj ? getDomain(proj.domainId) : null;
                const domainColor = domain?.color || null;
                const isFilled = !!proj;
                const isPickerOpen = dwPickerOpen === slot.id;
                const pickerTime = dwPickerTime[slot.id] || { startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin };

                // Completion state
                const {
                  isSessionMode,
                  todayTaskIds,
                  hasTodayTasks,
                  relevantTasks,
                  relevantDone,
                  allTasksDone,
                  isCompleted,
                } = getTodayBlockCompletionState({
                  slot,
                  project: proj,
                  manualCompleted,
                });

                const {
                  lateInfo,
                  timerActive,
                  isRunning,
                  isPaused,
                  elapsedMs,
                  totalMs,
                  remainMs,
                  remainSec,
                  countdownLabel: cdStr,
                  elapsedLabel: elapsedStr,
                } = getTodayBlockTimingState({
                  slot,
                  lateStarted,
                  getElapsedMs,
                });

                const isPicking = pickerState?.blockId === slot.id;

                const {
                  background: cardBg,
                  runningBorder: cardRunningBorder,
                  border: cardBorder,
                  shadow: cardShadow,
                  animation: cardAnimation,
                } = getTodayBlockCardStyles({
                  isRunning,
                  isCompleted,
                  isNow,
                  domainColor,
                });

                if (!isFilled) {
                  // ── UNASSIGNED CARD ──
                  const ptKey = slot.id;
                  const selProjId = dwPickerProj[ptKey] || null;
                  const selProj = selProjId ? data.projects.find(p => p.id === selProjId) : null;
                  const curTime = dwPickerTime[ptKey] || { startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin };
                  const curSelTasks = curTime._tasks !== undefined ? curTime._tasks : [];
                  const togglePT = (tid) => setDwPickerTime(s => {
                    const base = s[ptKey] || { startHour:slot.startHour, startMin:slot.startMin, durationMin:slot.durationMin };
                    const ex = base._tasks||[];
                    return { ...s, [ptKey]: { ...base, _tasks: ex.includes(tid) ? ex.filter(x=>x!==tid) : [...ex, tid] } };
                  });

                  // Bio coach label for empty slot
                  const slotBio = getSlotBioPhase(slot.startHour, slot.startMin, data.wakeUpTime);

                  return (
                    <div key={slot.id} data-blockid={slot.id} style={{ flex: isExp ? 3 : 0.6, minHeight:0, borderRadius:18, background: isExp ? "var(--bg2)" : "var(--bg2)", border: isExp ? "1.5px solid rgba(255,255,255,.18)" : "1.5px dashed rgba(255,255,255,.1)", overflow:"hidden", display:"flex", flexDirection:"column", opacity: 1, transition:"flex .35s cubic-bezier(.4,0,.2,1), border-color .2s", cursor:"pointer" }}
                      onClick={() => setExpandedId(isExp ? null : slot.id)}
                    >
                      {!isExp ? (
                        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:7, padding:"10px 14px" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="rgba(255,255,255,.18)" strokeWidth="2" strokeLinecap="round"/></svg>
                          <span style={{ fontSize:10, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"rgba(255,255,255,.15)", textAlign:"center" }}>Deep Work Block</span>
                        </div>
                      ) : (
                        <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }} onClick={e => e.stopPropagation()}>
                          {/* Bio coach label */}
                          <div style={{ fontSize:11, color:slotBio.color, marginBottom:8, fontWeight:600 }}>
                            {slotBio.label} — {slotBio.advice}
                          </div>
                          {!selProjId ? (
                            /* ── STEP 1: 2-col project grid ── */
                            <>
                              <div style={{ fontSize:11, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--text3)", marginBottom:10 }}>Assign project</div>
                              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
                                {data.projects.filter(p => p.status === "active").map(p => {
                                  const d2 = data.domains?.find(d => d.id === p.domainId);
                                  const incomp = (p.tasks||[]).filter(t=>!t.done);
                                  return (
                                    <div key={p.id}
                                      onClick={() => { setDwPickerProj(s => ({ ...s, [ptKey]: p.id })); setDwPickerTime(s => ({ ...s, [ptKey]: { startHour:slot.startHour, startMin:slot.startMin, durationMin:slot.durationMin, _tasks:[] } })); }}
                                      style={{ borderRadius:11, background:"var(--bg3)", border:"1.5px solid var(--border2)", padding:"10px 12px", cursor:"pointer", display:"flex", flexDirection:"column", gap:4, transition:"border-color .15s, background .15s" }}>
                                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                                        <div style={{ width:8, height:8, borderRadius:"50%", background: d2?.color||"var(--text3)", flexShrink:0 }} />
                                        <span style={{ fontSize:13, fontWeight:700, color:"var(--text)", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
                                      </div>
                                      <div style={{ fontSize:11, color:"var(--text3)", paddingLeft:15 }}>{d2?.name}{incomp.length > 0 ? ` · ${incomp.length}t` : ""}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            /* ── STEP 2: task list for selected project ── */
                            (() => {
                              const sp = data.projects.find(p => p.id === selProjId);
                              const sd = data.domains?.find(d => d.id === sp?.domainId);
                              const incomp = (sp?.tasks||[]).filter(t=>!t.done);
                              const confirmAssign = () => {
                                const t = dwPickerTime[ptKey] || { startHour:slot.startHour, startMin:slot.startMin, durationMin:slot.durationMin };
                                const tasks = (t._tasks && t._tasks.length > 0) ? t._tasks : null;
                                saveDWSlot(slot.id, slot.slotIndex, selProjId, t.startHour, t.startMin, t.durationMin, tasks);
                                setDwPickerProj(s => { const n={...s}; delete n[ptKey]; return n; });
                                setDwPickerTime(s => { const n={...s}; delete n[ptKey]; return n; });
                                // Planning mode: auto-advance to next empty slot
                                if (planningMode) {
                                  const nextEmpty = todayDWSlots.find(s => !s.projectId && s.id !== slot.id);
                                  if (nextEmpty) {
                                    setExpandedId(nextEmpty.id);
                                  } else {
                                    setExpandedId(null);
                                    setPlanningMode(false);
                                  }
                                } else {
                                  setExpandedId(null);
                                }
                              };
                              return (
                                <>
                                  {/* Back + project name header */}
                                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                                    <button onClick={() => setDwPickerProj(s => { const n={...s}; delete n[ptKey]; return n; })}
                                      style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer", padding:0, fontFamily:"'DM Sans',sans-serif", fontSize:12, display:"flex", alignItems:"center", gap:4, fontWeight:600 }}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                      Back
                                    </button>
                                    <div style={{ width:8, height:8, borderRadius:"50%", background: sd?.color||"var(--text3)", flexShrink:0 }} />
                                    <span style={{ fontSize:13, fontWeight:700, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sp?.name}</span>
                                  </div>
                                  {/* Task list */}
                                  {incomp.length > 0 ? (
                                    <>
                                      <div style={{ fontSize:11, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Pick focus tasks</div>
                                      {incomp.map(t => {
                                        const tSel = curSelTasks.includes(t.id);
                                        return (
                                          <div key={t.id} onClick={() => togglePT(t.id)}
                                            style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 4px", borderBottom:"1px solid var(--border2)", cursor:"pointer" }}>
                                            <div style={{ width:18, height:18, borderRadius:5, border: tSel ? "none" : "1.5px solid var(--border)", background: tSel ? (sd?.color||"var(--accent)") : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .12s" }}>
                                              {tSel && <span style={{ fontSize:9, color:"#000", fontWeight:800 }}>✓</span>}
                                            </div>
                                            <span style={{ fontSize:13, color: tSel ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                                          </div>
                                        );
                                      })}
                                    </>
                                  ) : (
                                    <div style={{ fontSize:13, color:"var(--text3)", padding:"8px 0 12px" }}>No open tasks — assigning project only.</div>
                                  )}
                                  {/* Quick add task inline */}
                                  {dwAddingTask === slot.id && (
                                    <div style={{ marginTop:10, display:"flex", gap:6 }}>
                                      <input autoFocus
                                        style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"8px 10px", color:"var(--text)", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none", boxSizing:"border-box" }}
                                        placeholder="Task name…"
                                        value={dwNewTaskText}
                                        onChange={e => setDwNewTaskText(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === "Enter") {
                                            const txt = dwNewTaskText.trim();
                                            if (txt) { const newId = addTaskToProject(selProjId, txt); togglePT(newId); }
                                            setDwNewTaskText(""); setDwAddingTask(null);
                                          }
                                          if (e.key === "Escape") { setDwAddingTask(null); setDwNewTaskText(""); }
                                        }} />
                                      <button onClick={() => {
                                          const txt = dwNewTaskText.trim();
                                          if (txt) { const newId = addTaskToProject(selProjId, txt); togglePT(newId); }
                                          setDwNewTaskText(""); setDwAddingTask(null);
                                        }}
                                        style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"8px 12px", color:"var(--text2)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}>
                                        Add
                                      </button>
                                      <button onClick={() => { setDwAddingTask(null); setDwNewTaskText(""); }}
                                        style={{ background:"none", border:"none", color:"var(--text3)", fontSize:18, cursor:"pointer", padding:"0 6px", lineHeight:1 }}>×</button>
                                    </div>
                                  )}
                                  <div style={{ marginTop:12, display:"flex", gap:8 }}>
                                    <button style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 12px", fontSize:13, fontWeight:600, color: dwAddingTask === slot.id ? "var(--accent)" : "var(--text2)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"color .15s" }}
                                      onClick={() => { setDwAddingTask(dwAddingTask === slot.id ? null : slot.id); setDwNewTaskText(""); }}>
                                      + Add Task
                                    </button>
                                    <button className="dw-confirm-btn" style={{ flex:1, padding:"10px 12px" }} onClick={confirmAssign}>
                                      ✓ Assign{curSelTasks.length > 0 ? ` · ${curSelTasks.length} task${curSelTasks.length!==1?"s":""}` : ""}
                                    </button>
                                  </div>
                                </>
                              );
                            })()
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // ── ASSIGNED CARD ──
                const incompleteTasks = (proj?.tasks||[]).filter(t=>!t.done);

                const expandedBg = domainColor ? `color-mix(in srgb, ${domainColor} 8%, var(--bg2))` : "var(--bg2)";
                const expandedBorder = isCompleted ? "1px solid rgba(69,193,122,.4)" : domainColor ? `2px solid ${domainColor}` : "1.5px solid rgba(255,255,255,.25)";
                const expandedShadow = domainColor ? `0 0 40px ${domainColor}30, 0 0 0 1px ${domainColor}20` : "0 0 20px rgba(255,255,255,.06)";
                return (
                  <div key={slot.id} data-blockid={slot.id}
                    style={{ flex: isExp ? 3 : (currentItem && !isExp ? 0.8 : 1), minHeight:0, borderRadius:18, background: isExp ? expandedBg : cardBg, border: isExp ? expandedBorder : cardBorder, boxShadow: isExp ? expandedShadow : cardShadow, animation: isRunning ? cardAnimation : "none", overflow:"hidden", display:"flex", flexDirection:"column", opacity: 1, transition:"flex .35s cubic-bezier(.4,0,.2,1), opacity .2s, border-color .2s, background .2s, box-shadow .2s", "--domain-color": domainColor || "transparent", position:"relative" }}
                    onClick={() => setExpandedId(isExp ? null : slot.id)}
                  >
                    {/* Colour stripe */}
                    {domainColor && <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background: isCompleted ? "var(--border)" : domainColor, borderRadius:"18px 0 0 18px", transition:"background .3s" }} />}

                    {/* ── Overflow overlay — fills card, X to close ── */}
                    {dwOverflowOpen === slot.id && (
                      <div style={{ position:"absolute", inset:0, background:"var(--bg2)", borderRadius:18, zIndex:10, display:"flex", flexDirection:"column", padding:"16px 16px 14px" }} onClick={e => e.stopPropagation()}>
                        {/* Header row */}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:"var(--text2)" }}>{proj?.name}</span>
                          <button onClick={() => setDwOverflowOpen(null)}
                            style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"50%", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text3)", flexShrink:0 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                        {/* Options */}
                        <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1 }}>
                          <button
                            onClick={() => { mutateDWSlot(viewDateKeyISO, slot.slotIndex, null); setExpandedId(null); setDwOverflowOpen(null); }}
                            style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:14, padding:"0 16px", fontSize:14, fontWeight:600, color:"var(--text2)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:12 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
                            Unassign
                          </button>
                          {!viewingTomorrow && (
                            <button
                              onClick={() => {
                                const tomorrowISO = toISODate(new Date(Date.now() + 86400000));
                                mutateDWSlot(toISODate(), slot.slotIndex, null);
                                mutateDWSlot(tomorrowISO, slot.slotIndex, { projectId: slot.projectId, startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin, todayTasks: slot.todayTasks });
                                setExpandedId(null); setDwOverflowOpen(null);
                              }}
                              style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:14, padding:"0 16px", fontSize:14, fontWeight:600, color:"var(--text2)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:12 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              Move to Tomorrow
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Collapsed header — visible always, bigger when now */}
                    <div style={{ padding: isExp ? "14px 16px 10px 20px" : "14px 16px 12px 20px", flex: isExp ? "none" : 1, display:"flex", alignItems:"flex-start", gap:12, minHeight:0 }}>
                      {/* Mode icon */}
                      <div style={{ width:34, height:34, borderRadius:10, background: isCompleted ? "var(--bg3)" : isExp ? (domainColor ? `${domainColor}25` : "var(--bg3)") : (domainColor ? `${domainColor}18` : "var(--bg3)"), border: isCompleted ? "1px solid var(--border)" : isExp ? `1.5px solid ${domainColor ? domainColor+"60" : "var(--border)"}` : `1px solid ${domainColor ? domainColor+"35" : "var(--border)"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity: isCompleted ? 0.5 : 1, transition:"background .2s, border-color .2s" }}>
                        {isSessionMode
                          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2-5.3" stroke={isCompleted ? "var(--text3)" : (domainColor||"var(--text2)")} strokeWidth="2.2" strokeLinecap="round"/><path d="M20 7v5h-5" stroke={isCompleted ? "var(--text3)" : (domainColor||"var(--text2)")} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke={isCompleted ? "var(--text3)" : (domainColor||"var(--text2)")} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke={isCompleted ? "var(--text3)" : (domainColor||"var(--text2)")} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        }
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        {/* Eyebrow */}
                        <div style={{ fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color: isNow ? (domainColor||"var(--accent)") : "var(--text3)", marginBottom: isNow || isExp ? 4 : 2, opacity: isCompleted ? 0.5 : 1 }}>
                          {isSessionMode ? "Deep Work · Session" : "Deep Work · Tasks"}
                        </div>
                        <div style={{ fontSize: isNow && !isExp ? 20 : 15, fontWeight:800, color: isCompleted ? "var(--text3)" : "var(--text)", letterSpacing:"-.02em", lineHeight:1.15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace: isExp ? "normal" : "nowrap" }}>{proj.name}</div>
                        {!isExp && (
                          <>
                            <div style={{ fontSize:11, color:"var(--text3)", marginTop:3 }}>
                              {domain?.name}{data.todayPrefs?.hideTimes ? "" : ` · ${fmtTime(slot.startHour, slot.startMin)}`} · {slot.durationMin} min
                              {!isSessionMode && hasTodayTasks ? ` · ${relevantDone}/${relevantTasks.length}` : ""}
                            </div>
                            {!isSessionMode && (() => {
                              if (!hasTodayTasks) return isCompleted ? null : (
                                <div style={{ marginTop:8, fontSize:12, color:"var(--text3)", opacity:.5, fontStyle:"italic" }}>Assign tasks</div>
                              );
                              const preview = relevantTasks.slice(0, 3);
                              const hidden = relevantTasks.length - 3;
                              return (
                                <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:5, opacity: isCompleted ? 0.35 : 1, transition:"opacity .3s" }}>
                                  {preview.map(t => (
                                    <div key={t.id} onClick={e => { e.stopPropagation(); if (!isCompleted) toggleTask(proj.id, t.id); }}
                                      style={{ display:"flex", alignItems:"center", gap:7, cursor: isCompleted ? "default" : "pointer" }}>
                                      <div style={{ width:13, height:13, borderRadius:3, border: t.done ? "none" : `1.5px solid ${domainColor ? domainColor+"60" : "var(--border)"}`, background: t.done ? "var(--green)" : "transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                        {t.done && <span style={{ fontSize:7, color:"#000", fontWeight:900 }}>✓</span>}
                                      </div>
                                      <span style={{ fontSize:12, color:"var(--text3)", textDecoration: t.done ? "line-through" : "none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.text}</span>
                                    </div>
                                  ))}
                                  {hidden > 0 && (
                                    <div style={{ fontSize:11, color:"var(--text3)", opacity:.6, paddingLeft:20 }}>+{hidden} more</div>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                      {isCompleted && !isExp && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      {!isCompleted && !isExp && (
                        timerActive ? (
                          <div style={{ display:"flex", alignItems:"center", gap:5, background:"var(--bg3)", border:`1px solid ${isRunning ? "rgba(232,160,48,.4)" : "rgba(232,160,48,.2)"}`, borderRadius:20, padding:"3px 8px 3px 6px", flexShrink:0 }}>
                            <div style={{ width:5, height:5, borderRadius:"50%", background: isRunning ? "var(--accent)" : "var(--text3)", flexShrink:0, opacity: isRunning ? 1 : 0.5 }} />
                            <span style={{ fontSize:11, fontWeight:700, color: isRunning ? "var(--accent)" : "var(--text3)", fontVariantNumeric:"tabular-nums", letterSpacing:".02em" }}>{cdStr}</span>
                          </div>
                        ) : hasTodayTasks ? (
                          <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--bg3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:"1px solid var(--border2)" }}>
                            <span style={{ fontSize:11, fontWeight:800, color: relevantDone === relevantTasks.length ? "var(--green)" : "var(--text2)" }}>{relevantDone}/{relevantTasks.length}</span>
                          </div>
                        ) : null
                      )}
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                        {isExp && (
                          <button style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", color:"var(--text3)", display:"flex", alignItems:"center" }}
                            onClick={e => { e.stopPropagation(); setDwOverflowOpen(dwOverflowOpen === slot.id ? null : slot.id); }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                              <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                            </svg>
                          </button>
                        )}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color:"var(--text3)", opacity:.4, transform: isExp ? "rotate(90deg)" : "none", transition:"transform .2s", cursor:"pointer" }} onClick={e => { e.stopPropagation(); setExpandedId(isExp ? null : slot.id); if (!isExp) setDwOverflowOpen(null); }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>

                    {/* Expanded body */}
                    {isExp && (() => {
                      // Total logged hours for this project (session log)
                      var totalLoggedMin = (data.sessionLog || [])
                        .filter(s => s.projectId === proj.id)
                        .reduce((sum, s) => sum + (s.durationMin || 0), 0);
                      var totalLoggedHrs = totalLoggedMin / 60;
                      var loggedDisplay = totalLoggedMin === 0 ? null
                        : totalLoggedMin < 60 ? `${totalLoggedMin}m logged`
                        : `${totalLoggedHrs % 1 === 0 ? totalLoggedHrs : totalLoggedHrs.toFixed(1)}h logged`;

                      // Timer derived values
                      var timerProgress = timerActive
                        ? Math.min(1, getElapsedMs(lateInfo) / (slot.durationMin * 60 * 1000))
                        : 0;
                      // Ring stroke colour by state
                      var ringStroke = isRunning ? "var(--purple)" : isPaused ? "var(--accent)" : "rgba(155,114,207,.25)";

                      return (
                        <div style={{ flex:1, overflowY:"auto", padding:"0 16px 14px 20px" }} onClick={() => setExpandedId(null)}>
                          <div style={{ fontSize:12, color:"var(--text2)", marginBottom:10 }}>{domain?.name}{data.todayPrefs?.hideTimes ? "" : ` · ${fmtTime(slot.startHour, slot.startMin)}`} · {slot.durationMin} min{loggedDisplay ? ` · ${loggedDisplay}` : ""}</div>

                          {isCompleted ? (
                            <div onClick={e => e.stopPropagation()}>
                              {!isSessionMode && hasTodayTasks && (
                                <div style={{ display:"flex", flexDirection:"column", gap:2, opacity:0.35, marginBottom:14 }}>
                                  {relevantTasks.map((t, i) => (
                                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom: i < relevantTasks.length-1 ? "1px solid var(--border2)" : "none" }}>
                                      <div className="tl-check done" style={{ width:20, height:20, flexShrink:0 }}>
                                        <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>
                                      </div>
                                      <span style={{ fontSize:14, color:"var(--text3)", textDecoration:"line-through" }}>{t.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                <div style={{ width:22, height:22, borderRadius:"50%", background:"rgba(69,193,122,.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                                <span style={{ fontSize:13, color:"var(--green)", fontWeight:700, flex:1 }}>Session complete</span>
                                <button onClick={() => unmarkManualDone(slot.id, proj.id, slot.todayTasks)}
                                  style={{ background:"none", border:"1px solid var(--border)", borderRadius:8, fontSize:12, color:"var(--text3)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"4px 10px" }}>
                                  ← Undo
                                </button>
                              </div>
                            </div>

                          ) : isSessionMode ? (
                            <div onClick={e => e.stopPropagation()}>
                              {totalLoggedMin > 0 && (
                                <div style={{ background:"var(--bg3)", borderRadius:10, padding:"8px 14px", marginBottom:4, display:"flex", alignItems:"center", gap:10 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color:"var(--blue)", flexShrink:0 }}>
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                  </svg>
                                  <span style={{ fontSize:12, color:"var(--text2)" }}>
                                    <span style={{ fontWeight:700, color:"var(--text)" }}>{totalLoggedHrs % 1 === 0 ? totalLoggedHrs : totalLoggedHrs.toFixed(1)}h</span>
                                    {" "}logged across all sessions
                                  </span>
                                </div>
                              )}
                              <TimerBlock onDone={() => doneTimer(slot, proj)} activeTaskLabel={(relevantTasks.find(t => !t.done)?.text) || proj?.name || null} isRunning={isRunning} isPaused={isPaused} timerActive={timerActive} timerProgress={timerProgress} ringStroke={ringStroke} cdStr={cdStr} elapsedStr={elapsedStr} slot={slot} mutateDWSlot={mutateDWSlot} resetTimer={resetTimer} startTimerSlot={startTimerSlot} pauseTimerSlot={pauseTimerSlot} />
                            </div>

                          ) : isPicking ? (
                            (() => {
                              const ps = pickerState;
                              const confirmPick = () => {
                                let finalIds = [...ps.selected];
                                if (ps.newText.trim()) { const newId = addTaskToProject(proj.id, ps.newText.trim()); finalIds.push(newId); }
                                saveDWTodayTasks(slot.slotIndex, finalIds);
                                setPickerState(null);
                              };
                              return (
                                <div>
                                  <div style={{ fontSize:12, fontWeight:700, color:"var(--text3)", letterSpacing:".05em", textTransform:"uppercase", marginBottom:8 }}>Pick today's tasks</div>
                                  {proj.tasks.filter(t=>!t.done).map(t => {
                                    const checked = ps.selected.has(t.id);
                                    return (
                                      <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 2px", cursor:"pointer" }}
                                        onClick={() => setPickerState(prev => { const s = new Set(prev.selected); checked ? s.delete(t.id) : s.add(t.id); return { ...prev, selected: s }; })}>
                                        <div style={{ width:18, height:18, borderRadius:5, border: checked ? "none" : "1.5px solid var(--border)", background: checked ? "var(--accent)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                          {checked && <span style={{ fontSize:10, color:"#000", fontWeight:800 }}>✓</span>}
                                        </div>
                                        <span style={{ fontSize:14, color: checked ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                                      </div>
                                    );
                                  })}
                                  <input style={{ width:"100%", background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:8, padding:"8px 10px", color:"var(--text)", fontSize:13, fontFamily:"'DM Sans',sans-serif", marginTop:8, boxSizing:"border-box" }}
                                    placeholder="Add new task…" value={ps.newText}
                                    onChange={e => setPickerState(prev => ({ ...prev, newText: e.target.value }))}
                                    onKeyDown={e => e.key === "Enter" && confirmPick()} />
                                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                                    <button className="dw-confirm-btn" style={{ flex:1 }} onClick={confirmPick}>✓ Confirm</button>
                                    <button className="dw-back" onClick={() => setPickerState(null)}>✕</button>
                                  </div>
                                </div>
                              );
                            })()

                          ) : hasTodayTasks ? (
                            <>
                              {relevantTasks.map((t, i) => (
                                <div key={t.id} className="tl-task-row" style={{ padding:"8px 0", borderBottom: i < relevantTasks.length-1 ? "1px solid var(--border2)" : "none" }}>
                                  <div className={`tl-check ${t.done ? "done" : ""} ${recentlyChecked.has(t.id) ? "bounce" : ""}`}
                                    style={{ width:20, height:20, flexShrink:0 }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleTask(proj.id, t.id);
                                      const wasAlreadyDone = t.done;
                                      if (!wasAlreadyDone) {
                                        const remaining = relevantTasks.filter(rt => rt.id !== t.id && !rt.done);
                                        if (remaining.length === 0) {
                                          logSession(proj.id, slot.durationMin, null);
                                          markManualDone(slot.id, proj.id, slot.todayTasks);
                                        }
                                      }
                                    }}>
                                    {t.done && <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>}
                                  </div>
                                  {editingDwTaskId === t.id ? (
                                    <input autoFocus
                                      style={{ flex:1, background:"transparent", border:"none", borderBottom:"1.5px solid var(--accent)", outline:"none", color:"var(--text)", fontSize:14, fontFamily:"'DM Sans',sans-serif", padding:"1px 0" }}
                                      value={editingDwTaskText}
                                      onChange={e => setEditingDwTaskText(e.target.value)}
                                      onBlur={() => {
                                        const txt = editingDwTaskText.trim();
                                        if (txt && txt !== t.text) setData(d => ({ ...d, projects: d.projects.map(p => p.id !== proj.id ? p : { ...p, tasks: p.tasks.map(tk => tk.id !== t.id ? tk : { ...tk, text: txt }) }) }));
                                        setEditingDwTaskId(null);
                                      }}
                                      onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }}
                                      onClick={e => e.stopPropagation()} />
                                  ) : (
                                    <span className={`tl-task-txt ${t.done ? "done" : ""}`} style={{ fontSize:14, cursor:"text" }}
                                      onClick={e => { e.stopPropagation(); if (!t.done) { setEditingDwTaskId(t.id); setEditingDwTaskText(t.text); } }}>
                                      {t.text}
                                    </span>
                                  )}
                                </div>
                              ))}
                              <TimerBlock onDone={() => doneTimer(slot, proj)} activeTaskLabel={(relevantTasks.find(t => !t.done)?.text) || proj?.name || null} isRunning={isRunning} isPaused={isPaused} timerActive={timerActive} timerProgress={timerProgress} ringStroke={ringStroke} cdStr={cdStr} elapsedStr={elapsedStr} slot={slot} mutateDWSlot={mutateDWSlot} resetTimer={resetTimer} startTimerSlot={startTimerSlot} pauseTimerSlot={pauseTimerSlot} />
                            </>

                          ) : (
                            <div onClick={e => e.stopPropagation()}>
                              <div style={{ fontSize:13, color:"var(--text3)", marginBottom:10 }}>No tasks picked yet.</div>
                              <button className="tl-start-btn"
                                onClick={e => { e.stopPropagation(); setPickerState({ blockId: slot.id, projectId: proj.id, selected: new Set(), newText: "" }); }}>
                                Pick tasks
                              </button>
                              <TimerBlock onDone={() => doneTimer(slot, proj)} activeTaskLabel={(relevantTasks.find(t => !t.done)?.text) || proj?.name || null} isRunning={isRunning} isPaused={isPaused} timerActive={timerActive} timerProgress={timerProgress} ringStroke={ringStroke} cdStr={cdStr} elapsedStr={elapsedStr} slot={slot} mutateDWSlot={mutateDWSlot} resetTimer={resetTimer} startTimerSlot={startTimerSlot} pauseTimerSlot={pauseTimerSlot} />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              }

              return null;
            })}
            </div>
          </div>
        );
      })()}

      {/* ── Inline Shutdown ── */}
      {(() => {
        const { shutdownDone } = data;
        const todayISO = toISODate();
        if (shutdownDone && data.shutdownDate === todayISO) {
          return (
            <div style={{ margin:"16px 16px 24px", padding:"14px 18px", borderRadius:14, border:"1px solid rgba(69,193,122,.2)", background:"rgba(69,193,122,.06)", display:"flex", alignItems:"center", gap:12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize:14, fontWeight:700, color:"var(--green)" }}>Shutdown complete</span>
            </div>
          );
        }
        return null;
      })()}

      {/* Celebration overlay */}
      {celebratingId && (
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:200 }}>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div className="celebrate-burst" />
            <div style={{ fontSize:14, fontWeight:800, color:"var(--accent)", background:"var(--bg2)", borderRadius:20, padding:"8px 20px", border:"1px solid rgba(232,160,48,.3)" }}>Block complete ✓</div>
          </div>
        </div>
      )}

      {/* Back button */}
      <button className="work-back-btn" onClick={onGoToTasks}>← Tasks</button>
    </div>
  );
}
