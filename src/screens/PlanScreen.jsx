import { useState, useEffect, useRef } from "react";
import { fmtTime, getRoutinesForDate } from "../utils.js";
import { getDeepSlots } from "../constants.js";
import GearIcon from "../components/GearIcon.jsx";
import StatusBar from "../components/StatusBar.jsx";
import RoutineBlockView from "../components/RoutineBlockView.jsx";
import WorkWeekSheet from "../sheets/WorkWeekSheet.jsx";

export default function PlanScreen({ data, setData, onGoToSeason, lightMode, toggleTheme }) {
  const { domains, projects, blocks, weekIntention, workWeek = [2,3,4,5,6] } = data;
  const [editingIntention, setEditingIntention] = useState(false);
  const [intentionDraft, setIntentionDraft] = useState(weekIntention);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [showWorkWeek, setShowWorkWeek] = useState(false);

  const getProject = id => projects.find(p => p.id === id);
  const getDomain  = id => domains.find(d => d.id === id);
  const today      = new Date();
  const days       = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const [wkDwPickerOpen, setWkDwPickerOpen] = useState(null); // `${dateStr}-${slotIndex}`
  const [wkDwPickerStep, setWkDwPickerStep] = useState({}); // { [key]: "project"|"confirm" }
  const [wkDwPickerProj, setWkDwPickerProj] = useState({}); // { [key]: projectId }
  const [wkDwPickerTime, setWkDwPickerTime] = useState({}); // { [key]: { startHour, startMin, durationMin } }
  const [wkDwPickerTasks, setWkDwPickerTasks] = useState({}); // { [key]: [taskId, ...] }
  const wkScrollRef = useRef(null);
  const wkPickerRef = useRef(null);

  useEffect(() => {
    if (wkDwPickerOpen && wkPickerRef.current && wkScrollRef.current) {
      setTimeout(() => {
        const pickerEl = wkPickerRef.current;
        const scrollEl = wkScrollRef.current;
        if (!pickerEl || !scrollEl) return;
        // Scroll the button (parent of picker) to near top of screen
        const btnEl = pickerEl.previousElementSibling;
        const targetEl = btnEl || pickerEl;
        const elTop = targetEl.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
        scrollEl.scrollTo({ top: Math.max(0, elTop - 80), behavior: "smooth" });
      }, 50);
    }
  }, [wkDwPickerOpen]);

  const saveIntention = () => { setData(d => ({ ...d, weekIntention: intentionDraft })); setEditingIntention(false); };
  const deleteBlock   = id => setData(d => ({ ...d, blocks: d.blocks.filter(b => b.id !== id) }));
  const updateBlock   = (id, changes) => { setData(d => ({ ...d, blocks: d.blocks.map(b => b.id===id?{...b,...changes}:b) })); setEditingBlockId(null); };

  // DW slot mutation for week view — uses same pattern as TodayScreen's mutateDWSlot
  const mutateDWSlotForDate = (dateStr, slotIndex, patch) => {
    setData(prev => {
      const existing = [...((prev.deepWorkSlots || {})[dateStr] || [])];
      while (existing.length <= slotIndex) existing.push({});
      existing[slotIndex] = patch === null ? {} : { ...existing[slotIndex], ...patch };
      return { ...prev, deepWorkSlots: { ...(prev.deepWorkSlots || {}), [dateStr]: existing } };
    });
  };

  const saveDWSlotForDate = (dateStr, slotIndex, projectId, startHour, startMin, durationMin, todayTasks) =>
    mutateDWSlotForDate(dateStr, slotIndex, { projectId, startHour, startMin, durationMin, todayTasks: todayTasks || null });

  const clearDWSlotForDate = (dateStr, slotIndex) =>
    mutateDWSlotForDate(dateStr, slotIndex, null);

  // Live slot definitions for this user
  const deepSlots = getDeepSlots(data);

  // For a given dayOffset, build the merged sorted list of real blocks + DW slots (filled + empty)
  const getMergedRows = (offset) => {
    const dayDate = new Date(today); dayDate.setDate(today.getDate() + offset);
    const dow = dayDate.getDay();
    const isWorkDay = workWeek.includes(dow);
    const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth()+1).padStart(2,"0")}-${String(dayDate.getDate()).padStart(2,"0")}`;
    if (!isWorkDay) return [];

    // Filled DW slots for this day
    const savedDW = (data.deepWorkSlots || {})[dateStr] || [];
    const filledDWSlots = deepSlots.map((def, i) => {
      const saved = savedDW[i] || {};
      if (!saved.projectId) return null;
      return {
        type: "deepwork-filled",
        dateStr,
        slotIndex: i,
        startHour: saved.startHour ?? def.startHour,
        startMin: saved.startMin ?? def.startMin,
        durationMin: saved.durationMin ?? def.durationMin,
        projectId: saved.projectId,
      };
    }).filter(Boolean);

    // How many filled DW slots exist? Empty = maxDeepBlocks - filled (min 0)
    const maxDW = data.deepWorkTargets?.maxDeepBlocks ?? 3;
    const filledCount = filledDWSlots.length;
    const emptyCount = Math.max(0, maxDW - filledCount);

    // Empty DW slots: use the deepSlots that are NOT filled, up to emptyCount
    const emptyDWSlots = deepSlots
      .filter((def, i) => !(savedDW[i] || {}).projectId)
      .slice(0, emptyCount)
      .map((def, arrIdx) => ({
        type: "ghost",
        dateStr,
        slot: def,
        origSlot: def,
        dayOffset: offset,
      }));

    const allItems = [
      ...filledDWSlots,
      ...emptyDWSlots,
    ];

    allItems.sort((a, b) => {
      const getMin = x => {
        if (x.type === "deepwork-filled") return x.startHour*60+x.startMin;
        return x.slot.startHour*60+x.slot.startMin;
      };
      return getMin(a) - getMin(b);
    });

    return allItems;
  };

  return (
    <div className="screen active">
      <StatusBar />
      <div className="ph">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div className="ph-eye">Week of {months[today.getMonth()]} {today.getDate()}</div>
            <div className="ph-title">Weekly Plan</div>
          </div>
          <button className="plan-gear" onClick={() => setShowWorkWeek(true)}><GearIcon size={20} /></button>
        </div>
      </div>
      <div className="scroll" ref={wkScrollRef}>

        {[0,1,2,3,4,5,6].map(offset => {
          const dayDate = new Date(today); dayDate.setDate(today.getDate() + offset);
          const dow = dayDate.getDay();
          const isWorkDay = workWeek.includes(dow);
          const isToday = offset === 0;
          const isPastDay = !isToday && dayDate < today;
          const mergedRows = getMergedRows(offset);
          const dayDateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth()+1).padStart(2,"0")}-${String(dayDate.getDate()).padStart(2,"0")}`;
          const dayDateKey = dayDate.toDateString();
          const completedBlockIds = new Set(
            (data.blockCompletions || []).filter(c => c.date === dayDateKey).map(c => c.blockId)
          );
          const dayHasPickerOpen = wkDwPickerOpen && wkDwPickerOpen.startsWith(dayDateStr);

          return (
            <div key={offset} className={["week-card", isToday ? "today-card" : "", isPastDay ? "past-day" : ""].filter(Boolean).join(" ")} style={dayHasPickerOpen ? { overflow:"visible" } : undefined}>
              <div className="wc-head">
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span className={`wc-day ${isToday ? "today" : ""}`}>{days[dow]}</span>
                  {!isWorkDay && <span style={{ fontSize:10, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"var(--text3)", opacity:.6, padding:"2px 7px", border:"1px solid var(--border2)", borderRadius:20 }}>Rest</span>}
                </div>
                <span className="wc-date">{months[dayDate.getMonth()]} {dayDate.getDate()}{isToday ? " · Today" : ""}</span>
              </div>

              {(() => {
                const routinesForDay = getRoutinesForDate(data.routineBlocks || [], dayDate);
                const allRows = [
                  ...routinesForDay.map(rb => ({ type: "routine", routine: rb })),
                  ...mergedRows.map(r => ({ ...r }))
                ].sort((a, b) => {
                  const aH = a.type === "routine" ? a.routine.startHour * 60 + a.routine.startMin : (a.block || a.slot)?.startHour * 60 + (a.block || a.slot)?.startMin;
                  const bH = b.type === "routine" ? b.routine.startHour * 60 + b.routine.startMin : (b.block || b.slot)?.startHour * 60 + (b.block || b.slot)?.startMin;
                  return aH - bH;
                });
                return allRows.map((row, i) => {
                if (row.type === "routine") {
                  return (
                    <RoutineBlockView
                      key={row.routine.id + dayDate.toDateString()}
                      routine={row.routine}
                      dateKey={dayDate.toDateString()}
                      data={data}
                      setData={setData}
                      compact
                    />
                  );
                }
                // Filled deep work slot
                if (row.type === "deepwork-filled") {
                  const proj2 = getProject(row.projectId);
                  const domain2 = proj2 ? getDomain(proj2.domainId) : null;
                  const domainColor2 = domain2?.color || null;
                  const cardKey = `dwfilled_${row.dateStr}_${row.slotIndex}`;
                  const isExpFilled = wkDwPickerOpen === cardKey + "_exp";
                  const savedDW2 = (data.deepWorkSlots || {})[row.dateStr] || [];
                  const savedSlot2 = savedDW2[row.slotIndex] || {};
                  const assignedTaskIds = savedSlot2.todayTasks || null;
                  const projTasks3 = (proj2?.tasks || []).filter(t => !t.done);
                  const selectedTasks3 = wkDwPickerTasks[cardKey] !== undefined
                    ? wkDwPickerTasks[cardKey]
                    : (assignedTaskIds || []);

                  const toggleTask3 = (taskId) => {
                    setWkDwPickerTasks(st => {
                      const cur = st[cardKey] !== undefined ? st[cardKey] : (assignedTaskIds || []);
                      const next = cur.includes(taskId) ? cur.filter(id => id !== taskId) : [...cur, taskId];
                      return { ...st, [cardKey]: next };
                    });
                  };

                  const saveTasksForFilled = () => {
                    const tasks = selectedTasks3.length > 0 ? selectedTasks3 : null;
                    saveDWSlotForDate(row.dateStr, row.slotIndex, row.projectId, row.startHour, row.startMin, row.durationMin, tasks);
                    setWkDwPickerOpen(null);
                    setWkDwPickerTasks(st => { const n={...st}; delete n[cardKey]; return n; });
                  };

                  const isDoneFilled = completedBlockIds.has(cardKey) ||
                    (isPastDay && assignedTaskIds?.length > 0 && assignedTaskIds.every(id => proj2?.tasks?.find(t => t.id === id)?.done));
                  const isMissedFilled = isPastDay && !isDoneFilled;
                  return (
                    <div key={cardKey} style={{ padding: "6px 12px 2px", opacity: isDoneFilled ? 0.38 : isMissedFilled ? 0.55 : 1, filter: isDoneFilled ? "saturate(0.15)" : "none", transition: "opacity .2s" }}>
                      <div
                        style={{
                          background: "var(--bg3)",
                          border: isMissedFilled ? "1px solid rgba(224,85,85,0.25)" : domainColor2 ? `1px solid ${domainColor2}60` : "1px solid var(--border)",
                          boxShadow: isDoneFilled || isMissedFilled ? "none" : domainColor2 ? `0 0 14px ${domainColor2}1a` : "none",
                          borderRadius: 12,
                          overflow: "hidden",
                          cursor: isPastDay ? "default" : "pointer",
                        }}
                        onClick={() => { if (!isPastDay) setWkDwPickerOpen(isExpFilled ? null : cardKey + "_exp"); }}
                      >
                        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px" }}>
                          <div style={{ width:3, borderRadius:2, alignSelf:"stretch", minHeight:36, background: domainColor2 || "var(--bg4)", flexShrink:0 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", textDecoration: isMissedFilled ? "line-through" : "none" }}>{proj2?.name || "—"}</div>
                            <div style={{ fontSize:11, color:"var(--text3)", marginTop:3 }}>
                              {domain2?.name} · {row.durationMin} min · {fmtTime(row.startHour, row.startMin)}
                              {assignedTaskIds?.length > 0 ? ` · ${assignedTaskIds.length} task${assignedTaskIds.length > 1 ? "s" : ""}` : ""}
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {isDoneFilled
                              ? <div style={{ width:20, height:20, borderRadius:"50%", background:"rgba(69,193,122,0.2)", border:"1.5px solid rgba(69,193,122,0.5)", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:10, color:"#45C17A", fontWeight:800 }}>✓</span></div>
                              : isMissedFilled
                                ? <div style={{ fontSize:10, fontWeight:700, letterSpacing:".05em", textTransform:"uppercase", color:"var(--red)", opacity:.7 }}>missed</div>
                                : <><div style={{ fontSize:10, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color: domainColor2 || "var(--accent)", opacity:.8 }}>DW</div>
                                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color:"var(--text3)", opacity:.45, transform: isExpFilled ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s" }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></>
                            }
                          </div>
                        </div>
                        {isExpFilled && !isPastDay && (
                          <div style={{ borderTop:"1px solid var(--border2)" }} onClick={e => e.stopPropagation()}>
                            {projTasks3.length > 0 && proj2?.mode !== "sessions" && (
                              <div style={{ padding:"10px 14px 4px" }}>
                                <div style={{ fontSize:11, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"var(--text3)", marginBottom:6 }}>
                                  Focus tasks <span style={{ color:"var(--text3)", fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optional)</span>
                                </div>
                                {projTasks3.map(t => {
                                  const isSel = selectedTasks3.includes(t.id);
                                  return (
                                    <div key={t.id} onClick={() => toggleTask3(t.id)}
                                      style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 4px", cursor:"pointer", borderRadius:8 }}>
                                      <div style={{
                                        width:18, height:18, borderRadius:5,
                                        border: isSel ? "none" : "1.5px solid var(--border)",
                                        background: isSel ? "var(--accent)" : "transparent",
                                        display:"flex", alignItems:"center", justifyContent:"center",
                                        flexShrink:0, transition:"all .15s"
                                      }}>
                                        {isSel && <span style={{ fontSize:10, color:"#000", fontWeight:800 }}>✓</span>}
                                      </div>
                                      <span style={{ fontSize:13, color: isSel ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div style={{ display:"flex", gap:8, padding:"10px 14px 14px" }}>
                              {projTasks3.length > 0 && (
                                <button onClick={saveTasksForFilled}
                                  style={{ flex:1, background:"var(--accent)", color:"#000", border:"none", borderRadius:8, padding:"9px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                                  Save
                                </button>
                              )}
                              <button onClick={e => { e.stopPropagation(); clearDWSlotForDate(row.dateStr, row.slotIndex); setWkDwPickerOpen(null); setWkDwPickerTasks(st => { const n={...st}; delete n[cardKey]; return n; }); }}
                                style={{ flex:1, background:"rgba(224,85,85,.1)", color:"var(--red)", border:"none", borderRadius:8, padding:"9px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                                Clear slot
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Empty deep work slot — inline picker (matches Today tab design)
                const s = row.slot;
                const pickerKey = `${row.dateStr}-${s.slotIndex}`;
                const isPickerOpen2 = wkDwPickerOpen === pickerKey;
                const pickerStep2 = wkDwPickerStep[pickerKey] || "project";
                const pickerProj2 = wkDwPickerProj[pickerKey] ? getProject(wkDwPickerProj[pickerKey]) : null;
                const pickerTime2 = wkDwPickerTime[pickerKey] || { startHour: s.startHour, startMin: s.startMin, durationMin: s.durationMin };
                const timeOptions2 = [];
                for (let h = 5; h <= 21; h++) for (let m of [0, 15, 30, 45]) timeOptions2.push({ h, m });
                const fmt2 = (h, m) => { const hh = h > 12 ? h-12 : h===0?12:h; const mm = m===0?"":`:${String(m).padStart(2,"0")}`; return `${hh}${mm}${h>=12?"pm":"am"}`; };
                return (
                  <div key={`ghost_${row.dateStr}_${s.slotIndex}`} style={{ padding: "6px 12px 2px" }}>
                    <button className={`dw-empty${isPickerOpen2 ? " is-open" : ""}`} style={{ borderRadius: isPickerOpen2 ? "14px 14px 0 0" : 14 }}
                      onClick={() => {
                        setWkDwPickerOpen(isPickerOpen2 ? null : pickerKey);
                        setWkDwPickerStep(st => ({ ...st, [pickerKey]: "project" }));
                      }}
                    >
                      <div className="dw-plus">+</div>
                      <div style={{ flex:1, textAlign:"left" }}>
                        <div className="dw-empty-label">Deep Work Block</div>
                        <div className="dw-empty-sub">{s.durationMin} min · {fmt2(s.startHour, s.startMin)} · tap to assign</div>
                      </div>
                      <div className="dw-empty-dur">{s.durationMin}m</div>
                    </button>
                    {isPickerOpen2 && (
                      <div className="dw-picker-wrap" ref={wkPickerRef}>
                        {/* UNIFIED picker: project list with inline tasks */}
                        {(() => {
                          const selProjId = wkDwPickerProj[pickerKey] || null;
                          const selProj = selProjId ? data.projects.find(p => p.id === selProjId) : null;
                          const curTime = wkDwPickerTime[pickerKey] || { startHour: s.startHour, startMin: s.startMin, durationMin: s.durationMin };
                          const curSelTasks = (wkDwPickerTasks[pickerKey] !== undefined) ? wkDwPickerTasks[pickerKey] : [];
                          const toggleTask2 = (tid) => {
                            setWkDwPickerTasks(st => {
                              const existing = st[pickerKey] !== undefined ? st[pickerKey] : [];
                              const next = existing.includes(tid) ? existing.filter(id=>id!==tid) : [...existing, tid];
                              return { ...st, [pickerKey]: next };
                            });
                          };
                          return (
                            <>
                              <div className="dw-picker-sect">Choose a project</div>
                              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                                {data.projects.filter(p => p.status === "active").map(p => {
                                  const d2 = data.domains?.find(d => d.id === p.domainId);
                                  const isSel = selProjId === p.id;
                                  const incompleteTasks = (p.tasks||[]).filter(t=>!t.done);
                                  const tasksSel = isSel ? curSelTasks : [];
                                  return (
                                    <div key={p.id} style={{ borderRadius:10, overflow:"hidden", border: isSel ? `1.5px solid ${d2?.color||"var(--accent)"}` : "1.5px solid var(--border2)", background: isSel ? `${d2?.color||"var(--accent)"}11` : "var(--bg3)", transition:"all .15s" }}>
                                      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", cursor:"pointer" }}
                                        onClick={() => {
                                          if (isSel) {
                                            setWkDwPickerProj(st => { const n={...st}; delete n[pickerKey]; return n; });
                                            setWkDwPickerTasks(st => { const n={...st}; delete n[pickerKey]; return n; });
                                          } else {
                                            setWkDwPickerProj(st => ({ ...st, [pickerKey]: p.id }));
                                            setWkDwPickerTasks(st => ({ ...st, [pickerKey]: [] }));
                                            setWkDwPickerTime(st => ({ ...st, [pickerKey]: { startHour:s.startHour, startMin:s.startMin, durationMin:s.durationMin } }));
                                          }
                                        }}
                                      >
                                        <div style={{ width:9, height:9, borderRadius:"50%", background: d2?.color||"var(--text3)", flexShrink:0 }} />
                                        <div style={{ flex:1, minWidth:0 }}>
                                          <div style={{ fontSize:13, fontWeight:600, color: isSel ? "var(--text)" : "var(--text2)" }}>{p.name}</div>
                                          <div style={{ fontSize:11, color:"var(--text3)" }}>{d2?.name}{incompleteTasks.length > 0 ? ` · ${incompleteTasks.length} task${incompleteTasks.length!==1?"s":""}` : ""}</div>
                                        </div>
                                        <div style={{ width:18, height:18, borderRadius:"50%", border: isSel ? "none" : "1.5px solid var(--border)", background: isSel ? (d2?.color||"var(--accent)") : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s" }}>
                                          {isSel && <span style={{ fontSize:9, color:"#000", fontWeight:800 }}>✓</span>}
                                        </div>
                                      </div>
                                      {isSel && incompleteTasks.length > 0 && (
                                        <div style={{ borderTop:"1px solid var(--border2)", padding:"6px 12px 10px" }}>
                                          <div style={{ fontSize:10, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--text3)", marginBottom:6 }}>Focus tasks</div>
                                          {incompleteTasks.map(t => {
                                            const tSel = tasksSel.includes(t.id);
                                            return (
                                              <div key={t.id} onClick={() => toggleTask2(t.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 2px", cursor:"pointer" }}>
                                                <div style={{ width:16, height:16, borderRadius:4, border: tSel ? "none" : "1.5px solid var(--border)", background: tSel ? "var(--accent)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .12s" }}>
                                                  {tSel && <span style={{ fontSize:8, color:"#000", fontWeight:800 }}>✓</span>}
                                                </div>
                                                <span style={{ fontSize:13, color: tSel ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {data.todayPrefs?.hideTimes ? (
                                <div onClick={() => setData(d => ({ ...d, todayPrefs: { ...(d.todayPrefs||{}), hideTimes: false } }))}
                                  style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:10, background:"var(--bg3)", border:"1.5px dashed var(--border)", cursor:"pointer", marginBottom:10, opacity:0.6 }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"/></svg>
                                  <span style={{ fontSize:13, color:"var(--text2)" }}>Times hidden — tap to enable</span>
                                </div>
                              ) : (
                                <div className="dw-time-row" style={{ marginBottom:10 }}>
                                  <div style={{ flex:1 }}>
                                    <div className="dw-picker-sect" style={{ padding:"0 0 4px" }}>Start time</div>
                                    <select className="dw-time-sel" value={`${curTime.startHour}:${curTime.startMin}`}
                                      onChange={e => { const [h,m] = e.target.value.split(":").map(Number); setWkDwPickerTime(st => ({ ...st, [pickerKey]: { ...st[pickerKey], startHour:h, startMin:m } })); }}>
                                      {timeOptions2.map(({h,m}) => <option key={`${h}${m}`} value={`${h}:${m}`}>{fmt2(h,m)}</option>)}
                                    </select>
                                  </div>
                                  <div style={{ flex:1 }}>
                                    <div className="dw-picker-sect" style={{ padding:"0 0 4px" }}>Duration</div>
                                    <select className="dw-time-sel" value={curTime.durationMin}
                                      onChange={e => setWkDwPickerTime(st => ({ ...st, [pickerKey]: { ...st[pickerKey], durationMin: Number(e.target.value) } }))}>
                                      {[30,45,60,75,90,105,120].map(d => <option key={d} value={d}>{d} min</option>)}
                                    </select>
                                  </div>
                                </div>
                              )}
                              <button className="dw-confirm-btn"
                                disabled={!selProjId}
                                style={{ opacity: selProjId ? 1 : 0.4 }}
                                onClick={() => {
                                  if (!selProjId) return;
                                  const tasks = curSelTasks.length > 0 ? curSelTasks : null;
                                  saveDWSlotForDate(row.dateStr, s.slotIndex, selProjId, curTime.startHour, curTime.startMin, curTime.durationMin, tasks);
                                  setWkDwPickerOpen(null);
                                  setWkDwPickerStep(st => { const n={...st}; delete n[pickerKey]; return n; });
                                  setWkDwPickerProj(st => { const n={...st}; delete n[pickerKey]; return n; });
                                  setWkDwPickerTasks(st => { const n={...st}; delete n[pickerKey]; return n; });
                                }}
                              >✓ Confirm</button>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })})()}

            </div>
          );
        })}
        <div className="spacer" />
      </div>

      {showWorkWeek && (
        <WorkWeekSheet
          workWeek={workWeek}
          data={data}
          onClose={() => setShowWorkWeek(false)}
          onSave={(ww, defs) => {
            setData(d => ({ ...d, workWeek: ww, deepBlockDefaults: defs }));
            setShowWorkWeek(false);
          }}
          lightMode={lightMode}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
