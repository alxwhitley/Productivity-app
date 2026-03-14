import { useState, useEffect, useRef } from "react";
import { fmtTime, toISODate, uid, getRoutinesForDate } from "../utils.js";
import { getDeepSlots } from "../constants.js";
import StatusBar from "../components/StatusBar.jsx";
import TodaySettingsSheet from "../sheets/TodaySettingsSheet.jsx";

// Bio-phase definitions (hardcoded wake 7am)
const BIO_PHASES = [
  { id: "peak", label: "Mental Peak", icon: "\u26A1", startMin: 420, endMin: 720 },
  { id: "second", label: "Second Wind", icon: "\uD83D\uDD01", startMin: 720, endMin: 900 },
  { id: "shallow", label: "Shallow", icon: "\uD83D\uDCCB", startMin: 900, endMin: 1020 },
  { id: "wind", label: "Wind Down", icon: "\uD83C\uDF19", startMin: 1020, endMin: 1260 },
];
const BIO_TOTAL = 840; // 7am–9pm in minutes

function getPhaseForMins(mins) {
  for (const p of BIO_PHASES) {
    if (mins >= p.startMin && mins < p.endMin) return p.id;
  }
  return mins < 420 ? "peak" : "wind";
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
  const [recentlyChecked, setRecentlyChecked] = useState(new Set());
  const [dwOverflowOpen, setDwOverflowOpen] = useState(null);
  const [dwPickerProj, setDwPickerProj] = useState({});
  const [dwPickerTime, setDwPickerTime] = useState({});
  const [viewingTomorrow, setViewingTomorrow] = useState(false);
  const [lateStarted, setLateStarted] = useState({});
  const [tick, setTick] = useState(0);
  const [pickerState, setPickerState] = useState(null);
  const [dwAddingTask, setDwAddingTask] = useState(null);
  const [dwNewTaskText, setDwNewTaskText] = useState("");
  const [editingDwTaskId, setEditingDwTaskId] = useState(null);
  const [editingDwTaskText, setEditingDwTaskText] = useState("");
  const [planningMode, setPlanningMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dayPlanOpen, setDayPlanOpen] = useState(false);

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

  const doneTimer = (slot, proj) => {
    const info = lateStarted[slot.id];
    const elapsedMs = getElapsedMs(info);
    const elapsedMin = Math.round(elapsedMs / 60000);
    if (elapsedMin > 0) logSession(proj.id, elapsedMin, null);
    markManualDone(slot.id, proj.id, slot.todayTasks);
    setLateStarted(prev => { const n = { ...prev }; delete n[slot.id]; return n; });
  };

  const resetTimer = (slotId) => {
    setLateStarted(prev => { const n = { ...prev }; delete n[slotId]; return n; });
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

  const startBlock = (slotId) => {
    startTimerSlot(slotId);
    setExpandedId(slotId);
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

  // ── Date & timeline ──
  const now = new Date();
  const today = new Date();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dateKey = today.toDateString();
  const dateKeyISO = toISODate(today);
  const tomorrowDateKey = tomorrow.toDateString();
  const tomorrowDateKeyISO = toISODate(tomorrow);

  const viewDate = viewingTomorrow ? tomorrow : today;
  const viewDateKey = viewingTomorrow ? tomorrowDateKey : dateKey;
  const viewDateKeyISO = viewingTomorrow ? tomorrowDateKeyISO : dateKeyISO;
  viewDateKeyISO_ref.current = viewDateKeyISO;

  const deepDefaults = getDeepSlots(data);
  const savedDWSlots = (data.deepWorkSlots || {})[viewDateKeyISO] || [];
  const maxDeepBlocks = data.deepWorkTargets?.maxDeepBlocks ?? 3;
  const filledSlots = ((data.deepWorkSlots || {})[dateKeyISO] || []).filter(s => s && s.projectId).length;
  const isPlanned = filledSlots >= maxDeepBlocks;

  const todayRoutines = getRoutinesForDate(data.routineBlocks || [], today);
  const viewRoutines = viewingTomorrow ? getRoutinesForDate(data.routineBlocks || [], tomorrow) : todayRoutines;

  const todayDWSlots = Array.from({ length: maxDeepBlocks }, (_, i) => {
    const def = deepDefaults[i] || deepDefaults[deepDefaults.length - 1];
    const saved = savedDWSlots[i] || {};
    return {
      id: `dw-${viewDateKeyISO}-${i}`,
      slotIndex: i,
      startHour: saved.startHour ?? def.startHour,
      startMin: saved.startMin ?? def.startMin,
      durationMin: saved.durationMin ?? def.durationMin,
      projectId: saved.projectId || null,
      todayTasks: saved.todayTasks || null,
    };
  });

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

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const name = data.todayPrefs?.name;

  // ── Deep work progress ──
  const dwMinutesCompleted = (data.blockCompletions || [])
    .filter(c => c.date === todayStr)
    .reduce((sum, c) => sum + (c.durationMin || 0), 0);
  const dwGoalHrs = data.deepWorkTargets?.dailyHours || 4;
  const dwGoalMin = dwGoalHrs * 60;
  const dwPct = Math.min(100, Math.round(dwMinutesCompleted / dwGoalMin * 100));
  const dwHrs = Math.floor(dwMinutesCompleted / 60);
  const dwRemMin = dwMinutesCompleted % 60;
  const dwLabel = [dwHrs > 0 ? `${dwHrs} hr` : null, dwRemMin > 0 ? `${dwRemMin} min` : null].filter(Boolean).join(" ") || "0 min";

  // ── Bio bar position ──
  const barPct = Math.max(0, Math.min(100, (nowMins - 420) / BIO_TOTAL * 100));

  // ── Group timeline by phase ──
  const groupedBlocks = BIO_PHASES.map(phase => ({
    ...phase,
    items: timeline.filter(item => {
      const m = item.mins;
      return m >= phase.startMin && m < phase.endMin;
    }),
  })).filter(g => g.items.length > 0);

  // ── Render helpers ──

  function renderRoutineCard(item, isNow) {
    const rb = item.data;
    const comp = (rb.completions || {})[dateKey] || {};
    const doneCt = rb.tasks.filter(t => comp[t.id]).length;
    const allDone = rb.tasks.length > 0 && doneCt === rb.tasks.length;
    const isExp = expandedId === rb.id;
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
      <div key={rb.id} className="work-card" style={{
        background: "var(--bg2)",
        border: allDone ? "1px solid rgba(69,193,122,.2)" : isNow ? "1.5px solid rgba(75,170,187,.3)" : "1px solid var(--border)",
        opacity: allDone ? 0.5 : 1,
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
    const isExp = expandedId === slot.id;
    const ptKey = slot.id;
    const selProjId = dwPickerProj[ptKey] || null;
    const curTime = dwPickerTime[ptKey] || { startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin };
    const curSelTasks = curTime._tasks !== undefined ? curTime._tasks : [];
    const togglePT = (tid) => setDwPickerTime(s => {
      const base = s[ptKey] || { startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin };
      const ex = base._tasks || [];
      return { ...s, [ptKey]: { ...base, _tasks: ex.includes(tid) ? ex.filter(x => x !== tid) : [...ex, tid] } };
    });

    return (
      <div key={slot.id} className="work-card" style={{
        background: "var(--bg2)",
        border: "1.5px dashed var(--border)",
      }} onClick={() => setExpandedId(isExp ? null : slot.id)}>
        {!isExp ? (
          <div style={{ padding: "18px 16px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" opacity=".3"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text3)", opacity: .5 }}>Deep Work Block</span>
            <span style={{ fontSize: 11, color: "var(--text3)", opacity: .4 }}>{data.todayPrefs?.hideTimes ? "" : fmtTime(slot.startHour, slot.startMin) + " · "}{slot.durationMin} min</span>
          </div>
        ) : (
          <div style={{ padding: "14px 16px" }} onClick={e => e.stopPropagation()}>
            {!selProjId ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 10 }}>Assign project</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  {data.projects.filter(p => p.status === "active").map(p => {
                    const d2 = data.domains?.find(d => d.id === p.domainId);
                    const incomp = (p.tasks || []).filter(t => !t.done);
                    return (
                      <div key={p.id}
                        onClick={() => { setDwPickerProj(s => ({ ...s, [ptKey]: p.id })); setDwPickerTime(s => ({ ...s, [ptKey]: { startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin, _tasks: [] } })); }}
                        style={{ borderRadius: 11, background: "var(--bg3)", border: "1.5px solid var(--border2)", padding: "10px 12px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: d2?.color || "var(--text3)", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text3)", paddingLeft: 15 }}>{d2?.name}{incomp.length > 0 ? ` · ${incomp.length}t` : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (() => {
              const sp = data.projects.find(p => p.id === selProjId);
              const sd = data.domains?.find(d => d.id === sp?.domainId);
              const incomp = (sp?.tasks || []).filter(t => !t.done);
              const confirmAssign = () => {
                const t = dwPickerTime[ptKey] || { startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin };
                const tasks = (t._tasks && t._tasks.length > 0) ? t._tasks : null;
                saveDWSlot(slot.id, slot.slotIndex, selProjId, t.startHour, t.startMin, t.durationMin, tasks);
                setDwPickerProj(s => { const n = { ...s }; delete n[ptKey]; return n; });
                setDwPickerTime(s => { const n = { ...s }; delete n[ptKey]; return n; });
                if (planningMode) {
                  const nextEmpty = todayDWSlots.find(s => !s.projectId && s.id !== slot.id);
                  if (nextEmpty) { setExpandedId(nextEmpty.id); } else { setExpandedId(null); setPlanningMode(false); }
                } else { setExpandedId(null); }
              };
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <button onClick={() => setDwPickerProj(s => { const n = { ...s }; delete n[ptKey]; return n; })}
                      style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 12, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Back
                    </button>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: sd?.color || "var(--text3)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sp?.name}</span>
                  </div>
                  {incomp.length > 0 ? (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>Pick focus tasks</div>
                      {incomp.map(t => {
                        const tSel = curSelTasks.includes(t.id);
                        return (
                          <div key={t.id} onClick={() => togglePT(t.id)}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: "1px solid var(--border2)", cursor: "pointer" }}>
                            <div style={{ width: 18, height: 18, borderRadius: 5, border: tSel ? "none" : "1.5px solid var(--border)", background: tSel ? (sd?.color || "var(--accent)") : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {tSel && <span style={{ fontSize: 9, color: "#000", fontWeight: 800 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: 13, color: tSel ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--text3)", padding: "8px 0 12px" }}>No open tasks — assigning project only.</div>
                  )}
                  {dwAddingTask === slot.id && (
                    <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                      <input autoFocus
                        style={{ flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }}
                        placeholder="Task name…" value={dwNewTaskText} onChange={e => setDwNewTaskText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { const txt = dwNewTaskText.trim(); if (txt) { const newId = addTaskToProject(selProjId, txt); togglePT(newId); } setDwNewTaskText(""); setDwAddingTask(null); }
                          if (e.key === "Escape") { setDwAddingTask(null); setDwNewTaskText(""); }
                        }} />
                      <button onClick={() => { const txt = dwNewTaskText.trim(); if (txt) { const newId = addTaskToProject(selProjId, txt); togglePT(newId); } setDwNewTaskText(""); setDwAddingTask(null); }}
                        style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>Add</button>
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button style={{ flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}
                      onClick={() => { setDwAddingTask(dwAddingTask === slot.id ? null : slot.id); setDwNewTaskText(""); }}>+ Add Task</button>
                    <button className="dw-confirm-btn" style={{ flex: 1, padding: "10px 12px" }} onClick={confirmAssign}>
                      ✓ Assign{curSelTasks.length > 0 ? ` · ${curSelTasks.length} task${curSelTasks.length !== 1 ? "s" : ""}` : ""}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  function renderAssignedCard(slot) {
    const proj = getProject(slot.projectId);
    const domain = proj ? getDomain(proj.domainId) : null;
    const domainColor = domain?.color || null;

    const { isSessionMode, hasTodayTasks, relevantTasks, relevantDone, isCompleted } = getTodayBlockCompletionState({ slot, project: proj, manualCompleted });
    const { timerActive, isRunning, isPaused, countdownLabel: cdStr, elapsedLabel: elapsedStr } = getTodayBlockTimingState({ slot, lateStarted, getElapsedMs });

    const isExp = expandedId === slot.id;
    const isActive = timerActive;
    const showBody = isActive || (isExp && !isCompleted);
    const isPicking = pickerState?.blockId === slot.id;

    // Done card
    if (isCompleted && !isActive) {
      return (
        <div key={slot.id} className="work-card" style={{
          background: "var(--bg2)", border: "1px solid var(--border)", opacity: 0.5, position: "relative",
        }}>
          {domainColor && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--border)", borderRadius: "18px 0 0 18px" }} />}
          <div style={{ padding: "14px 16px 14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 2 }}>{domain?.name || "Deep Work"}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text3)", letterSpacing: "-.02em" }}>{proj?.name}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>{data.todayPrefs?.hideTimes ? "" : `${fmtTime(slot.startHour, slot.startMin)} · `}{slot.durationMin} min</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      );
    }

    return (
      <div key={slot.id} className="work-card" style={{
        background: "var(--bg2)",
        border: isActive ? `2px solid ${domainColor || "var(--accent)"}` : "1px solid var(--border)",
        boxShadow: isActive && domainColor ? `0 0 18px ${domainColor}33` : "none",
        position: "relative",
      }} onClick={() => { if (!isActive) setExpandedId(isExp ? null : slot.id); }}>
        {domainColor && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: domainColor, borderRadius: "18px 0 0 18px" }} />}

        {/* Overflow menu overlay */}
        {dwOverflowOpen === slot.id && (
          <div style={{ position: "absolute", inset: 0, background: "var(--bg2)", borderRadius: 18, zIndex: 10, display: "flex", flexDirection: "column", padding: "16px 16px 14px" }} onClick={e => e.stopPropagation()}>
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
              {!viewingTomorrow && (
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
              )}
            </div>
          </div>
        )}

        {/* Header row */}
        <div style={{ padding: "14px 16px 12px 20px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: isActive ? "var(--accent)" : (domainColor || "var(--text3)"), marginBottom: 4 }}>
              {isActive ? "IN PROGRESS" : (domain?.name || "Deep Work")}
            </div>
            <div style={{ fontSize: isActive ? 20 : 18, fontWeight: 800, color: "var(--text)", letterSpacing: "-.02em", lineHeight: 1.15 }}>{proj?.name}</div>
            {!showBody && (
              <>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
                  {data.todayPrefs?.hideTimes ? "" : `${fmtTime(slot.startHour, slot.startMin)} · `}{slot.durationMin} min
                  {!isSessionMode && hasTodayTasks ? ` · ${relevantDone}/${relevantTasks.length}` : ""}
                </div>
                {!isSessionMode && !hasTodayTasks && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "var(--text2)", fontSize: 13 }}
                    onClick={e => { e.stopPropagation(); setPickerState({ blockId: slot.id, projectId: proj.id, selected: new Set(), newText: "" }); setExpandedId(slot.id); }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                    <span>Pick tasks for this block</span>
                  </div>
                )}
              </>
            )}
          </div>
          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
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
            {!isActive && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: "var(--text3)", opacity: .4, transform: isExp ? "rotate(90deg)" : "none", transition: "transform .2s" }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </div>
        </div>

        {/* ── ACTIVE STATE: Timer + tasks + buttons ── */}
        {isActive && (
          <div style={{ padding: "0 16px 16px 20px" }} onClick={e => e.stopPropagation()}>
            {/* 48px countdown */}
            <div style={{ textAlign: "center", padding: "12px 0 2px" }}>
              <div style={{ fontSize: 48, fontWeight: 800, fontVariantNumeric: "tabular-nums", fontFamily: "'DM Sans', sans-serif", color: isPaused ? "var(--accent)" : "var(--text)", letterSpacing: "-.02em", lineHeight: 1 }}>
                {cdStr}
              </div>
              {isRunning && (
                <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", animation: "pulse-dot 1.2s ease-in-out infinite" }} />
                </div>
              )}
              {isPaused && (
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: "var(--accent)", textTransform: "uppercase", marginTop: 4 }}>Paused</div>
              )}
              <button onClick={() => mutateDWSlot(toISODate(), slot.slotIndex, { durationMin: slot.durationMin + 5 })}
                style={{ fontSize: 12, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", padding: "8px 0", fontFamily: "'DM Sans',sans-serif" }}>+ 5 min</button>
            </div>

            {/* Task list */}
            {!isSessionMode && hasTodayTasks && (
              <div style={{ margin: "4px 0 8px" }}>
                {relevantTasks.map((t, i) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < relevantTasks.length - 1 ? "1px solid var(--border2)" : "none" }}>
                    <div className={`tl-check ${t.done ? "done" : ""} ${recentlyChecked.has(t.id) ? "bounce" : ""}`} style={{ width: 20, height: 20, flexShrink: 0 }}
                      onClick={() => {
                        toggleTask(proj.id, t.id);
                        if (!t.done) {
                          const remaining = relevantTasks.filter(rt => rt.id !== t.id && !rt.done);
                          if (remaining.length === 0) { logSession(proj.id, slot.durationMin, null); markManualDone(slot.id, proj.id, slot.todayTasks); }
                        }
                      }}>
                      {t.done && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 14, color: t.done ? "var(--text3)" : "var(--text)", textDecoration: t.done ? "line-through" : "none", flex: 1 }}>{t.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pause/Resume + Done */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {isRunning ? (
                <button onClick={() => pauseTimerSlot(slot.id)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 700, color: "var(--text2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>
                  Pause
                </button>
              ) : (
                <button onClick={() => startTimerSlot(slot.id)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 700, color: "var(--text2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  <svg width="10" height="11" viewBox="0 0 16 18" fill="none"><path d="M1 1l14 8-14 8V1z" fill="currentColor"/></svg>
                  Resume
                </button>
              )}
              <button onClick={() => doneTimer(slot, proj)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--green)", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Done ✓
              </button>
            </div>
          </div>
        )}

        {/* ── EXPANDED UPCOMING: tasks + start ── */}
        {showBody && !isActive && (
          <div style={{ padding: "0 16px 14px 20px" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>{domain?.name}{data.todayPrefs?.hideTimes ? "" : ` · ${fmtTime(slot.startHour, slot.startMin)}`} · {slot.durationMin} min</div>

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
                {relevantTasks.map((t, i) => (
                  <div key={t.id} className="tl-task-row" style={{ padding: "8px 0", borderBottom: i < relevantTasks.length - 1 ? "1px solid var(--border2)" : "none" }}>
                    <div className={`tl-check ${t.done ? "done" : ""} ${recentlyChecked.has(t.id) ? "bounce" : ""}`}
                      style={{ width: 20, height: 20, flexShrink: 0 }}
                      onClick={() => {
                        toggleTask(proj.id, t.id);
                        if (!t.done) {
                          const remaining = relevantTasks.filter(rt => rt.id !== t.id && !rt.done);
                          if (remaining.length === 0) { logSession(proj.id, slot.durationMin, null); markManualDone(slot.id, proj.id, slot.todayTasks); }
                        }
                      }}>
                      {t.done && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                    </div>
                    {editingDwTaskId === t.id ? (
                      <input autoFocus
                        style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1.5px solid var(--accent)", outline: "none", color: "var(--text)", fontSize: 14, fontFamily: "'DM Sans',sans-serif", padding: "1px 0" }}
                        value={editingDwTaskText} onChange={e => setEditingDwTaskText(e.target.value)}
                        onBlur={() => {
                          const txt = editingDwTaskText.trim();
                          if (txt && txt !== t.text) setData(d => ({ ...d, projects: d.projects.map(p => p.id !== proj.id ? p : { ...p, tasks: p.tasks.map(tk => tk.id !== t.id ? tk : { ...tk, text: txt }) }) }));
                          setEditingDwTaskId(null);
                        }}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }} />
                    ) : (
                      <span className={`tl-task-txt ${t.done ? "done" : ""}`} style={{ fontSize: 14, cursor: "text" }}
                        onClick={() => { if (!t.done) { setEditingDwTaskId(t.id); setEditingDwTaskText(t.text); } }}>
                        {t.text}
                      </span>
                    )}
                  </div>
                ))}
                {/* Start session button */}
                <button onClick={() => startBlock(slot.id)}
                  style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "var(--purple)", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  <svg width="10" height="11" viewBox="0 0 16 18" fill="none"><path d="M1 1l14 8-14 8V1z" fill="currentColor"/></svg>
                  Start Session
                </button>
              </>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 10 }}>No tasks picked yet.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tl-start-btn" style={{ flex: 1 }}
                    onClick={() => setPickerState({ blockId: slot.id, projectId: proj.id, selected: new Set(), newText: "" })}>
                    Pick tasks
                  </button>
                  <button onClick={() => startBlock(slot.id)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--purple)", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                    <svg width="8" height="9" viewBox="0 0 16 18" fill="none"><path d="M1 1l14 8-14 8V1z" fill="currentColor"/></svg>
                    Start
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ══════ RENDER ══════

  return (
    <div className="screen active">
      <StatusBar />
      <div ref={scrollRef} className="scroll" style={{ paddingBottom: 100 }}>

        {/* ── HEADER ── */}
        <div style={{ padding: "14px 24px 10px" }}>
          {viewingTomorrow && (
            <button onClick={() => setViewingTomorrow(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 8px", display: "flex", alignItems: "center", gap: 4, color: "var(--text3)", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Today
            </button>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              {viewingTomorrow && (
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-.02em", marginBottom: 2 }}>Tomorrow</div>
              )}
              <div style={{ fontSize: 14, color: "var(--text2)", fontWeight: 500 }}>
                {days[viewDate.getDay()]}, {months[viewDate.getMonth()]} {viewDate.getDate()}
              </div>
              <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
                {viewingTomorrow
                  ? `${timeline.length} block${timeline.length !== 1 ? "s" : ""} planned`
                  : `${greeting}${name ? `, ${name}` : ""}.`
                }
              </div>
            </div>
            {/* Gear icon */}
            <button onClick={() => setSettingsOpen(true)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text3)", marginTop: 2 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="2" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── DEEP WORK PROGRESS ── */}
        {!viewingTomorrow && (
          <div style={{ padding: "0 24px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>
              {dwLabel} deep work · {dwGoalHrs} hr goal
            </div>
            <div style={{ height: 4, background: "var(--bg4)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "var(--blue)", borderRadius: 2, width: `${dwPct}%`, transition: "width .5s" }} />
            </div>
          </div>
        )}

        {/* ── BIO-PHASE BAR ── */}
        {!viewingTomorrow && (
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ display: "flex", marginBottom: 6 }}>
              {BIO_PHASES.map(p => (
                <span key={p.id} style={{ flex: p.endMin - p.startMin, textAlign: "center", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text3)", lineHeight: 1.2 }}>
                  {p.label}
                </span>
              ))}
            </div>
            <div style={{ position: "relative", height: 4, background: "var(--bg4)", borderRadius: 2 }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", background: "var(--accent)", borderRadius: 2, width: `${barPct}%` }} />
              <div className="work-bio-dot" style={{ left: `${barPct}%` }} />
            </div>
          </div>
        )}

        {/* ── DAY PLAN COLLAPSIBLE ── */}
        {!viewingTomorrow && timeline.length > 0 && (
          <div style={{ padding: "0 16px 12px" }}>
            <button onClick={() => setDayPlanOpen(!dayPlanOpen)}
              style={{ width: "100%", textAlign: "center", background: "none", border: "none", cursor: "pointer", padding: "8px 0", fontSize: 13, color: "var(--text3)", fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
              {dayPlanOpen ? "\u25B4" : "\u25BE"} Day plan
            </button>
            {dayPlanOpen && (
              <div style={{ padding: "4px 8px" }}>
                {timeline.map(item => {
                  const startH = Math.floor(item.mins / 60);
                  const startM = item.mins % 60;
                  const label = item.type === "routine"
                    ? item.data.title
                    : (item.data.projectId ? getProject(item.data.projectId)?.name || "Assigned" : "Unassigned");
                  return (
                    <div key={item.id} style={{ padding: "5px 0", fontSize: 13, color: "var(--text2)", display: "flex", justifyContent: "space-between" }}>
                      <span>{label}</span>
                      <span style={{ color: "var(--text3)", fontSize: 12 }}>{fmtTime(startH, startM)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PLAN MY DAY CTA ── */}
        {!viewingTomorrow && !isPlanned && (
          <div onClick={() => {
            setPlanningMode(true);
            const firstEmpty = todayDWSlots.find(s => !s.projectId);
            if (firstEmpty) setExpandedId(firstEmpty.id);
          }} style={{ margin: "0 16px 12px", background: "var(--bg2)", borderRadius: 14, borderLeft: "4px solid var(--accent)", padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>Plan your deep work</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>Assign your focus blocks for today</div>
            <button onClick={e => {
              e.stopPropagation();
              setPlanningMode(true);
              const firstEmpty = todayDWSlots.find(s => !s.projectId);
              if (firstEmpty) setExpandedId(firstEmpty.id);
            }} style={{ display: "block", width: "100%", marginTop: 12, padding: "12px 0", background: "var(--accent)", color: "#000", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", cursor: "pointer" }}>
              Plan My Day →
            </button>
          </div>
        )}

        {/* ── BLOCKS BY PHASE ── */}
        {timeline.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 24px", fontSize: 13, color: "var(--text3)" }}>
            No blocks today.
          </div>
        )}

        {groupedBlocks.map(group => (
          <div key={group.id}>
            {/* Phase header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 16px 6px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text3)", whiteSpace: "nowrap", letterSpacing: ".06em" }}>
                {group.icon} {group.label}
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
            </div>

            {/* Cards */}
            {group.items.map(item => {
              const isNow = !viewingTomorrow && currentItem?.id === item.id;

              if (item.type === "routine") return renderRoutineCard(item, isNow);
              if (item.type === "deepwork") {
                const slot = item.data;
                if (!slot.projectId) return renderUnassignedCard(slot);
                return renderAssignedCard(slot);
              }
              return null;
            })}
          </div>
        ))}

        {/* ── TOMORROW PILL ── */}
        {!viewingTomorrow && (
          <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
            <button onClick={() => setViewingTomorrow(true)}
              style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 22, padding: "8px 20px", fontSize: 13, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              Tomorrow →
            </button>
          </div>
        )}

        {/* ── SHUTDOWN STATUS ── */}
        {(() => {
          const todayISO = toISODate();
          if (data.shutdownDone && data.shutdownDate === todayISO) {
            return (
              <div style={{ margin: "0 16px 24px", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(69,193,122,.2)", background: "rgba(69,193,122,.06)", display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>Shutdown complete</span>
              </div>
            );
          }
          return null;
        })()}

        <div className="spacer" />
      </div>

      {/* ── SETTINGS SHEET ── */}
      {settingsOpen && (
        <TodaySettingsSheet data={data} setData={setData} onClose={() => setSettingsOpen(false)} />
      )}

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
