import { useState, useRef, useEffect } from "react";
import { getPct } from "../utils.js";
import { DOMAIN_COLORS } from "../constants.js";
import SwipeTask from "./SwipeTask.jsx";
import WaveIcon from "./WaveIcon.jsx";

const PROJ_COLORS = DOMAIN_COLORS;

function ProjectCard({ proj, domain, isExp, newTaskText,
  onToggleExpand, onToggleStatus, onDelete, onEditSave,
  onToggleTask, onDeleteTask, onSaveTask, onNewTaskChange, onAddTask, autoFocus,
  sessionLog, onModeToggle }) {
  const isSessionMode = proj.mode === "sessions";
  const [addingTask, setAddingTask] = useState(false);
  const taskInputRef = useRef(null);
  const nameInputRef = useRef(null);

  const pct = getPct(proj.tasks);
  const [swipeX, setSwipeX] = useState(0);
  const [showEdit, setShowEdit] = useState(!!autoFocus);
  const [draftName, setDraftName] = useState(proj.name);
  const [draftColor, setDraftColor] = useState(domain?.color || PROJ_COLORS[0]);
  const startX = useRef(null);
  // Two-button reveal: Session toggle(blue) 80px + Delete(red) 80px = 160px
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

  return (
    <div style={{ margin: "0 16px 8px", borderRadius: 14, background: "var(--bg2)", overflow: "hidden" }}>
      {/* Header — swipeable */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: isExp || showEdit ? "14px 14px 0 0" : 14 }}>
        {/* Action bg: Session toggle + Delete */}
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 80, background: "var(--blue)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }} onClick={e => { e.stopPropagation(); onModeToggle(); setSwipeX(0); }}>
            {isSessionMode
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2-5.3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><path d="M20 7v5h-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>{isSessionMode ? "Tasks" : "Session"}</span>
          </div>
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
          onClick={() => { if (swipeX < 0) { setSwipeX(0); return; } onToggleExpand(); }}
        >
          <div className="proj-card-top">
            {/* Mode icon replaces stripe */}
            <div style={{ width:32, height:32, borderRadius:"50%", background: `${domain?.color || "var(--text3)"}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity: proj.status === "active" ? 1 : 0.4 }}>
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
              <span className={`proj-card-badge ${proj.status === "active" ? "badge-active" : "badge-backlog"}`} onClick={e => { e.stopPropagation(); onToggleStatus(e); }}>
                {proj.status === "active" ? "Active" : "Backlog"}
              </span>
              {!showEdit && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color:"var(--text3)", opacity:.4, transform: isExp ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s", flexShrink:0 }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
          {isSessionMode ? (() => {
            const projSessions = (sessionLog || []).filter(s => s.projectId === proj.id);
            const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
            const weekSessions = projSessions.filter(s => new Date(s.date) >= weekStart);
            const weekMins = weekSessions.reduce((a,s) => a + (s.durationMin||0), 0);
            const weekHrs = (weekMins/60).toFixed(1);
            const weekTarget = 10; // soft weekly hours target for session projects
            const barPct = Math.min((weekMins/60) / weekTarget * 100, 100);
            return (
              <>
                <div className="proj-session-bar-wrap">
                  <div className="proj-session-bar-fill" style={{ width:`${barPct}%`, background: domain?.color || "var(--blue)" }} />
                </div>
                <div className="proj-card-meta">
                  <span className="proj-card-tasks">{projSessions.length} sessions total · {weekHrs}h this week</span>
                  <WaveIcon size={13} color={proj.status === "active" ? (domain?.color || "var(--blue)") : "var(--text3)"} />
                </div>
              </>
            );
          })() : (
            <>
              <div className="proj-bar-wrap">
                <div className="proj-bar-fill" style={{ width: `${pct}%`, background: domain?.color }} />
              </div>
              <div className="proj-card-meta">
                <span className="proj-card-tasks">{proj.tasks.filter(t => t.done).length} of {proj.tasks.length} tasks</span>
                <span className="proj-card-pct" style={{ color: proj.status === "active" ? domain?.color : "var(--text3)" }}>{pct}%</span>
              </div>
            </>
          )}
        </div>
      </div>



      {/* Tasks / Session Log */}
      {isExp && (
        <div className="proj-tasks-expand">
          {isSessionMode ? (() => {
            const projSessions = (sessionLog || []).filter(s => s.projectId === proj.id).slice().reverse();
            const recent = projSessions.slice(0, 5);
            return (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 0 10px", borderBottom:"1px solid var(--border2)", marginBottom:8 }}>
                  <WaveIcon size={12} color="var(--blue)" />
                  <span style={{ fontSize:11, color:"var(--text3)", fontWeight:600, letterSpacing:".05em", textTransform:"uppercase" }}>Session Mode</span>
                </div>
                {recent.length === 0 ? (
                  <div style={{ fontSize:12, color:"var(--text3)", padding:"8px 0", textAlign:"center" }}>No sessions logged yet.</div>
                ) : (
                  <div className="proj-session-log">
                    {recent.map(s => (
                      <div key={s.id} className="proj-session-log-item">
                        <div style={{ width:6, height:6, borderRadius:"50%", background: domain?.color || "var(--blue)", flexShrink:0, marginTop:5 }} />
                        <span className="proj-session-log-note">{s.note || <span style={{fontStyle:"italic",opacity:.5}}>No note</span>}</span>
                        <span className="proj-session-log-meta">{s.date} · {s.durationMin}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })() : (
          <>
          {proj.tasks.map(t => (
            <SwipeTask
              key={t.id}
              task={t}
              onToggle={() => onToggleTask(t.id)}
              onDelete={() => onDeleteTask(t.id)}
              onSave={text => onSaveTask(t.id, text)}
            />
          ))}
          {addingTask ? (
            <div className="add-task-inline">
              <input
                ref={taskInputRef}
                className="add-task-inline-input"
                placeholder="New task…"
                value={newTaskText}
                autoFocus
                onChange={e => onNewTaskChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { onAddTask(); setTimeout(() => taskInputRef.current?.focus(), 30); }
                  if (e.key === "Escape") { setAddingTask(false); onNewTaskChange(""); }
                }}
              />
              <button
                onMouseDown={e => { e.preventDefault(); if (newTaskText.trim()) { onAddTask(); setTimeout(() => taskInputRef.current?.focus(), 30); } else { setAddingTask(false); } }}
                style={{ background: "none", border: "none", padding: "0 4px 0 8px", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <circle cx="13" cy="13" r="12" fill="rgba(232,160,48,0.15)" stroke="rgba(232,160,48,0.5)" strokeWidth="1.5"/>
                  <path d="M13 8v10M8 13h10" stroke="#E8A030" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <div
              className="add-task-tap"
              onClick={() => { setAddingTask(true); setTimeout(() => taskInputRef.current?.focus(), 30); }}
            />
          )}

          {/* Work Now button removed — blocks are deep work slots only */}

        </>
        )}
        </div>
      )}
    </div>
  );
}

export default ProjectCard;
