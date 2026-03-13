import { useState } from "react";
import { fmtRange } from "../utils.js";

function RoutineBlockView({ routine, dateKey, data, setData, compact }) {
  const [open, setOpen] = useState(false);
  const completions = (routine.completions || {})[dateKey] || {};
  const allDone = routine.tasks.length > 0 && routine.tasks.every(t => completions[t.id]);

  const toggleTask = (taskId) => {
    setData(d => {
      const rbs = (d.routineBlocks || []).map(rb => {
        if (rb.id !== routine.id) return rb;
        const prev = (rb.completions || {})[dateKey] || {};
        const updated = { ...prev, [taskId]: !prev[taskId] };
        return { ...rb, completions: { ...(rb.completions || {}), [dateKey]: updated } };
      });
      return { ...d, routineBlocks: rbs };
    });
  };

  return (
    <div className="routine-block" style={{ borderRadius: compact ? 0 : 12, margin: compact ? 0 : "0 0 8px" }}>
      <div className="routine-block-header" onClick={() => setOpen(o => !o)}>
        <div className="routine-stripe" style={{ opacity: allDone ? 1 : 0.5, background: allDone ? "var(--green)" : "var(--text3)" }} />
        <div className="routine-info">
          <div className="routine-title">{routine.title}</div>
          <div className="routine-meta">
            {fmtRange(routine.startHour, routine.startMin, routine.durationMin)}
            {routine.recurring ? " · Weekly" : " · One-time"}
            {" · "}{routine.tasks.filter(t => completions[t.id]).length}/{routine.tasks.length} done
          </div>
        </div>
        <span className="routine-badge">Routine</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, color:"var(--text3)", opacity:.4, marginLeft:4, transform: open ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s" }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      {open && (
        <div className="routine-tasks">
          {routine.tasks.map(t => (
            <div key={t.id} className="routine-task-row">
              <div className={`routine-check ${completions[t.id] ? "done" : ""}`} onClick={() => toggleTask(t.id)}>
                {completions[t.id] && <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>}
              </div>
              <span className={`routine-task-text ${completions[t.id] ? "done" : ""}`}>{t.text}</span>
            </div>
          ))}
          {routine.tasks.length === 0 && (
            <div style={{ padding:"10px 28px", fontSize:12, color:"var(--text3)" }}>No tasks added yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default RoutineBlockView;
