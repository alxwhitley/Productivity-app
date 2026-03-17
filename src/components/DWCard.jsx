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

export default function DWCard({
  slot,
  getProject,
  getDomain,
  manualCompleted,
  manualSkipped,
  lateStarted,
  getElapsedMs,
  nowMins,
  pickerState,
  setPickerState,
  dwInlineActive,
  setDwInlineActive,
  dwInlineText,
  setDwInlineText,
  dwInlineRef,
  logSession,
  markManualDone,
  setLateStarted,
  unmarkSkipped,
  markSkipped,
  unmarkManualDone,
  toggleTask,
  addTaskToProject,
  saveDWTodayTasks,
  commitDwInlineAdd,
  mutateDWSlot,
  viewDateKeyISO_ref,
  startTimerSlot,
  pauseTimerSlot,
  setDwPickerOpen,
}) {
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

  // Project was deleted or not found — treat as unassigned
  if (!proj) {
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

  const domain = proj ? getDomain(proj.domainId) : null;
  const domainColor = domain?.color || "#5BA8D4";
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
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${domainColor}`,
      borderRadius: 14,
      boxShadow: "none",
      opacity: (isPast && isCompleted) || isSkipped ? 0.40 : 1,
    }}>
      {/* Header row: domain pill + edit button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "inline-flex", fontSize: 11, fontWeight: 700, color: "var(--text2)", background: "var(--bg3)", borderRadius: 20, padding: "3px 10px" }}>{domainName || "No domain"}</span>
        {!isCompleted && !isSkipped && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              mutateDWSlot(viewDateKeyISO_ref.current, slot.slotIndex, null);
            }}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 4,
              color: "var(--text3)", display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Project name */}
      <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", marginTop: 12, lineHeight: 1.2 }}>{proj?.name}</div>

      {/* Progress bar */}
      {relevantTasks.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 4, borderRadius: 2, background: "var(--bg4)", width: "100%" }}>
            <div style={{ height: 4, borderRadius: 2, background: domainColor, width: `${Math.round((relevantTasks.filter(t => t.done).length / relevantTasks.length) * 100)}%`, transition: "width 0.3s ease" }} />
          </div>
        </div>
      )}

      {/* Pick tasks + Add button row */}
      {!isCompleted && !isSkipped && !isSessionMode && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={() => setDwPickerOpen({ slot, preProjectId: slot.projectId, preTasks: slot.todayTasks || [] })}
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 22,
              background: "var(--bg3)", border: "1px solid var(--border)", fontSize: 14, fontWeight: 500,
              color: "var(--text2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              textAlign: "center",
            }}
          >Pick tasks</button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDwInlineActive(slot.id);
              setDwInlineText("");
              setTimeout(() => dwInlineRef.current?.focus(), 30);
            }}
            style={{
              width: 40, height: 40, flexShrink: 0, borderRadius: 22,
              background: "var(--bg3)", border: "1px solid var(--border)",
              color: "var(--text2)", fontSize: 18, fontWeight: 400,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif", padding: 0,
            }}
          >+</button>
        </div>
      )}

      {/* Inline add task row */}
      {!isCompleted && !isSkipped && !isSessionMode && (
        <div
          onClick={() => {
            if (dwInlineActive !== slot.id) {
              setDwInlineActive(slot.id);
              setDwInlineText("");
              setTimeout(() => dwInlineRef.current?.focus(), 30);
            }
          }}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 0", minHeight: 44, cursor: dwInlineActive === slot.id ? "default" : "pointer",
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
            border: `1.5px solid ${dwInlineActive === slot.id ? "rgba(232,160,48,0.4)" : "var(--text3)"}`,
            background: "transparent", transition: "border-color .15s",
          }} />
          {dwInlineActive === slot.id ? (
            <input
              ref={dwInlineRef}
              value={dwInlineText}
              onChange={e => setDwInlineText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") commitDwInlineAdd(slot, proj);
                if (e.key === "Escape") { setDwInlineText(""); setDwInlineActive(null); }
              }}
              onBlur={() => commitDwInlineAdd(slot, proj)}
              onClick={e => e.stopPropagation()}
              placeholder="Add task…"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: "var(--text)", fontSize: 15, fontWeight: 500,
                fontFamily: "'DM Sans',sans-serif", padding: 0,
              }}
            />
          ) : (
            <span style={{ fontSize: 14, color: "var(--text3)", fontWeight: 400 }}>Add task…</span>
          )}
        </div>
      )}

      {/* Skipped state row */}
      {isSkipped && (
        <div className="dw-skipped-row" onClick={() => unmarkSkipped(slot.id)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 5l7 7-7 7M5 5l7 7-7 7" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="dw-skipped-label">Skipped</span>
          <span className="dw-undo-label">Tap to undo</span>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border2)", margin: "12px 0" }} />

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
                  if (isCompleted) {
                    unmarkManualDone(slot.id, proj?.id, slot.todayTasks);
                  }
                  toggleTask(proj.id, t.id);
                }}>
                <div className={`dw-task-circle${t.done ? " done" : ""}`}>
                  {t.done && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                </div>
                <span className={`dw-task-text${t.done ? " done" : ""}`} style={{ flex: 1 }}>{t.text}</span>
              </div>
            ))}
          </>
        ) : null}
      </div>

      {/* Complete button */}
      {!isCompleted && !isSkipped && (() => {
        const canComplete = relevantTasks.length > 0 && relevantTasks.every(t => t.done);
        return (
          <div style={{ paddingTop: 12, marginTop: "auto" }}>
            <button
              onClick={canComplete ? handleDone : undefined}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 22, fontSize: 15, fontWeight: 700,
                fontFamily: "'DM Sans',sans-serif",
                background: canComplete ? "var(--accent)" : "var(--bg3)",
                color: canComplete ? "#000000" : "var(--text3)",
                border: canComplete ? "none" : "1px solid var(--border)",
                cursor: canComplete ? "pointer" : "default",
                transition: "background .2s, color .2s, border .2s",
              }}
            >Complete</button>
          </div>
        );
      })()}
    </div>
  );
}
