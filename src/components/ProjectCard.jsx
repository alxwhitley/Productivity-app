import { useState, useRef, useEffect } from "react";
import { getPct } from "../utils.js";
import TaskRow from "./TaskRow.jsx";

function ProjectCard({ proj, domain: domainProp, isExp, newTaskText,
  onToggleExpand, onToggleStatus, onDelete, onEditSave,
  onToggleTask, onDeleteTask, onSaveTask, onQuickWinTask, onTodayTask, todayPickIds,
  onNewTaskChange, onAddTask, autoFocus,
  data, onTypeChange, scrollIntoView }) {
  // Always read domain from live data to avoid stale color references
  const domain = (data?.domains || []).find(d => d.id === proj.domainId) || domainProp;
  const isSessionMode = (proj.type || proj.mode) === "sessions";
  const [addingTask, setAddingTask] = useState(false);
  const [newText, setNewText] = useState("");
  const taskInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const pct = getPct(proj.tasks);
  const [swipeX, setSwipeX] = useState(0);
  const [showEdit, setShowEdit] = useState(!!autoFocus);
  const [draftName, setDraftName] = useState(proj.name);
  const startX = useRef(null);
  const MAX = 160; const SNAP = 60;

  const onTouchStart = e => { startX.current = e.touches[0].clientX; };
  const onTouchMove  = e => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -MAX));
    else if (swipeX < 0) setSwipeX(Math.min(0, swipeX + dx));
  };
  const onTouchEnd = () => {
    setSwipeX(swipeX < -SNAP ? -MAX : 0);
    startX.current = null;
  };

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => { nameInputRef.current?.focus(); nameInputRef.current?.select(); }, 80);
    }
  }, []);

  const handleSaveEdit = () => {
    if (showEdit) {
      onEditSave({ name: draftName.trim() || proj.name });
      setShowEdit(false);
    }
  };

  const doScrollIntoView = (el) => {
    if (scrollIntoView && el) scrollIntoView(el);
  };

  // Sessions hours from blockCompletions + deepWorkSlots
  const getSessionHours = () => {
    const completions = (data?.blockCompletions || []);
    const slots = data?.deepWorkSlots || {};
    let totalMins = 0;
    for (const c of completions) {
      const dateSlots = slots[c.date] || [];
      for (const s of dateSlots) {
        if (s && s.projectId === proj.id) {
          totalMins += c.durationMin || 0;
          break;
        }
      }
    }
    return (totalMins / 60).toFixed(1);
  };

  const isBacklog = proj.status !== "active";
  const showBody = isExp || customizeOpen;

  return (
    <div style={{ margin: "0 16px 8px", borderRadius: 14, background: "var(--bg2)", overflow: "hidden", filter: isBacklog ? "grayscale(1)" : "none", opacity: isBacklog ? 0.5 : 1 }}>
      {/* Header — swipeable */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: showBody || showEdit ? "14px 14px 0 0" : 14 }}>
        {/* Action bg: Delete */}
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 80, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={onDelete}>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>Delete</span>
          </div>
        </div>
        {/* Sliding content */}
        <div
          className="proj-card"
          style={{ transform: `translateX(${swipeX}px)`, transition: startX.current === null ? "transform .2s ease" : "none", position: "relative", background: "var(--bg2)", borderRadius: 0, zIndex: 1 }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={() => { if (swipeX < 0) { setSwipeX(0); return; } if (!customizeOpen) onToggleExpand(); }}
        >
          <div className="proj-card-top">
            {/* Mode icon */}
            <div style={{ width:32, height:32, borderRadius:"50%", background: `${domain?.color || "var(--text3)"}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {isSessionMode
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2-5.3" stroke={domain?.color || "var(--text3)"} strokeWidth="2" strokeLinecap="round"/><path d="M20 7v5h-5" stroke={domain?.color || "var(--text3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={domain?.color || "var(--text3)"} strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke={domain?.color || "var(--text3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </div>
            {showEdit ? (
              <input
                ref={nameInputRef}
                className="proj-card-name-input"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setShowEdit(false); }}
                onBlur={handleSaveEdit}
                onFocus={e => doScrollIntoView(e.target)}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="proj-card-name"
                style={{ cursor: "text" }}
                onClick={e => { e.stopPropagation(); if (swipeX < 0) return; setDraftName(proj.name); setShowEdit(true); setTimeout(() => { nameInputRef.current?.focus(); nameInputRef.current?.select(); }, 60); }}
              >{proj.name || <span style={{color:"var(--text3)"}}>Untitled</span>}</span>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              {/* ··· customize trigger */}
              <span
                style={{ fontSize: 18, color: "var(--text3)", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                onClick={e => { e.stopPropagation(); setCustomizeOpen(!customizeOpen); setDeleteConfirm(false); }}
              >···</span>
              {!showEdit && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color:"var(--text3)", opacity:.4, transform: isExp ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s", flexShrink:0 }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
          {isSessionMode ? (
            <div className="proj-card-meta">
              <span className="proj-card-tasks" style={{ color: "var(--text2)" }}>{getSessionHours()} hrs logged</span>
            </div>
          ) : (
            <>
              <div className="proj-bar-wrap">
                <div className="proj-bar-fill" style={{ width: `${pct}%`, background: domain?.color }} />
              </div>
              <div className="proj-card-meta">
                <span className="proj-card-tasks">{proj.tasks.filter(t => t.done).length} of {proj.tasks.length} tasks</span>
                <span className="proj-card-pct" style={{ color: domain?.color || "var(--text3)" }}>{pct}%</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Customize panel ── */}
      {customizeOpen && (
        <div className="proj-tasks-expand" style={{ padding: "12px 16px 16px" }}>
          {/* Type */}
          <div className="sh" style={{ padding: "0 0 8px" }}>
            <span className="sh-label">Type</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["tasks", "sessions"].map(t => {
              const sel = (proj.type || proj.mode || "tasks") === t;
              return (
                <button key={t} onClick={() => onTypeChange(t)} style={{
                  background: sel ? "var(--bg3)" : "transparent",
                  border: sel ? "1.5px solid var(--text3)" : "1.5px solid var(--border)",
                  color: sel ? "var(--text)" : "var(--text3)",
                  borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                }}>{t === "tasks" ? "Tasks" : "Sessions"}</button>
              );
            })}
          </div>

          {/* Status */}
          <div className="sh" style={{ padding: "0 0 8px" }}>
            <span className="sh-label">Status</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["active", "backlog"].map(s => {
              const sel = proj.status === s;
              return (
                <button key={s} onClick={e => { e.stopPropagation(); onToggleStatus(e); }} style={{
                  background: sel ? "var(--bg3)" : "transparent",
                  border: sel ? "1.5px solid var(--text3)" : "1.5px solid var(--border)",
                  color: sel ? "var(--text)" : "var(--text3)",
                  borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                }}>{s === "active" ? "Active" : "Backlog"}</button>
              );
            })}
          </div>

          {/* Delete */}
          <div style={{ paddingTop: 8, borderTop: "1px solid var(--border2)" }}>
            <span
              style={{ fontSize: 13, color: "var(--red)", cursor: "pointer", fontWeight: 500 }}
              onClick={() => {
                if (deleteConfirm) { onDelete(); setCustomizeOpen(false); }
                else setDeleteConfirm(true);
              }}
            >{deleteConfirm ? "Tap again to confirm" : "Delete project"}</span>
          </div>
        </div>
      )}

      {/* Tasks (only for type === "tasks") */}
      {isExp && !customizeOpen && !isSessionMode && (
        <div className="proj-tasks-expand">
          {proj.tasks.map(t => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => onToggleTask(t.id)}
              onDelete={() => onDeleteTask(t.id)}
              onEdit={text => onSaveTask(t.id, text)}
              onQuickWin={() => onQuickWinTask(t.id)}
              onToday={onTodayTask ? () => onTodayTask(t.id) : undefined}
              isQueuedToday={(todayPickIds || []).includes(t.id)}
            />
          ))}
          {addingTask ? (
            <div className="dotted-add-row">
              <div className="dotted-add-circle" />
              <input
                ref={taskInputRef}
                className="dotted-add-input"
                placeholder="New task…"
                value={newText}
                autoFocus
                onFocus={e => doScrollIntoView(e.target)}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const t = newText.trim();
                    if (t) { onNewTaskChange(t); onAddTask(); setNewText(""); setTimeout(() => taskInputRef.current?.focus(), 30); }
                  }
                  if (e.key === "Escape") { setAddingTask(false); setNewText(""); }
                }}
                onBlur={() => { const t = newText.trim(); if (t) { onNewTaskChange(t); onAddTask(); } setAddingTask(false); setNewText(""); }}
              />
            </div>
          ) : (
            <div className="dotted-add-row" onClick={() => { setAddingTask(true); setTimeout(() => taskInputRef.current?.focus(), 30); }}>
              <div className="dotted-add-circle" />
              <span className="dotted-add-placeholder">Add task…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectCard;
