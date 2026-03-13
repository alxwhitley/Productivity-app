import { useState, useRef } from "react";
import { uid } from "../utils.js";

function LooseTasksSection({ domainId, domain, data, setData, onAddProject }) {
  const { looseTasks = [], projects } = data;
  const [adding, setAdding]         = useState(false);
  const [newText, setNewText]       = useState("");
  const [assigningId, setAssigningId] = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editDraft, setEditDraft]   = useState("");
  const inputRef = useRef(null);

  const today = new Date().toDateString();
  const visible = looseTasks.filter(t => {
    if (t.domainId !== domainId) return false;
    if (t.done && t.doneAt && new Date(t.doneAt).toDateString() !== today) return false;
    return true;
  });

  const domainProjects = projects.filter(p => p.domainId === domainId);

  const openAdd = () => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 60); };

  const addTask = () => {
    const text = newText.trim();
    if (!text) { setAdding(false); return; }
    setData(d => ({ ...d, looseTasks: [...(d.looseTasks||[]), { id: uid(), domainId, text, done: false, doneAt: null }] }));
    setNewText("");
    setAdding(false);
  };

  const toggleTask = (id) => {
    setData(d => ({
      ...d,
      looseTasks: (d.looseTasks||[]).map(t =>
        t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t
      )
    }));
  };

  const deleteTask = (id) => {
    setData(d => ({ ...d, looseTasks: (d.looseTasks||[]).filter(t => t.id !== id) }));
  };

  const saveLooseEdit = (id) => {
    const text = editDraft.trim();
    if (!text) {
      setData(d => ({ ...d, looseTasks: (d.looseTasks||[]).filter(t => t.id !== id) }));
    } else {
      setData(d => ({ ...d, looseTasks: (d.looseTasks||[]).map(t => t.id === id ? { ...t, text } : t) }));
    }
    setEditingId(null);
  };

  const assignToProject = (taskId, projectId) => {
    const task = looseTasks.find(t => t.id === taskId);
    if (!task || !projectId) return;
    setData(d => ({
      ...d,
      looseTasks: (d.looseTasks||[]).filter(t => t.id !== taskId),
      projects: d.projects.map(p => p.id === projectId
        ? { ...p, tasks: [...p.tasks, { id: uid(), text: task.text, done: false }] }
        : p
      )
    }));
    setAssigningId(null);
  };

  const undone = visible.filter(t => !t.done);
  const done   = visible.filter(t => t.done);
  const hasTasks = visible.length > 0;

  const inlineInput = (
    <div className="loose-add-inline" onClick={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="loose-inline-input"
        placeholder="Add a loose task…"
        value={newText}
        onChange={e => setNewText(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") addTask();
          if (e.key === "Escape") { setAdding(false); setNewText(""); }
        }}
        onBlur={() => { if (!newText.trim()) setAdding(false); }}
      />
    </div>
  );

  return (
    <div
      className="loose-zone"
      onClick={!hasTasks && !adding ? openAdd : undefined}
      style={{ cursor: !hasTasks && !adding ? "pointer" : "default" }}
    >
      {/* Empty state — split action bar */}
      {!hasTasks && !adding && (
        <div className="loose-split-bar">
          <button className="loose-split-btn" onClick={onAddProject}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add Project
          </button>
          <div className="loose-split-divider" />
          <button className="loose-split-btn" onClick={openAdd}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add Task
          </button>
        </div>
      )}

      {/* Empty + adding: input only */}
      {!hasTasks && adding && inlineInput}

      {/* Task list */}
      {hasTasks && (
        <div className="loose-tasks-list">
          {undone.map(t => (
            <div key={t.id} className="loose-task-row">
              <div className="loose-check" onClick={() => toggleTask(t.id)} />
              {editingId === t.id ? (
                <input
                  className="loose-inline-input"
                  style={{ flex:1, borderBottom:"1px solid var(--accent)" }}
                  value={editDraft}
                  autoFocus
                  onChange={e => setEditDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveLooseEdit(t.id); if (e.key === "Escape") setEditingId(null); }}
                  onBlur={() => saveLooseEdit(t.id)}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="loose-task-text"
                  style={{ cursor: "text" }}
                  onClick={e => { e.stopPropagation(); setEditingId(t.id); setEditDraft(t.text); }}
                >{t.text}</span>
              )}
              {false && assigningId === t.id && (
                <div className="loose-assign-pop" onClick={e => e.stopPropagation()}>
                  <div className="lap-title">Move to project</div>
                  {domainProjects.map(p => {
                    const dom = (data.domains||[]).find(d => d.id === p.domainId);
                    return (
                      <div key={p.id} className="lap-proj" onClick={() => assignToProject(t.id, p.id)}>
                        <div className="lap-dot" style={{ background: dom?.color }} />
                        {p.name}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

{/* done loose tasks are hidden — celebrated in shutdown ritual */}

          {/* Single input at bottom — tap zone or active input */}
          {adding ? inlineInput : (
            <div className="loose-split-bar" style={{ borderRadius:0, borderTop:"1px solid var(--border2)" }}>
              <button className="loose-split-btn" onClick={onAddProject}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Add Project
              </button>
              <div className="loose-split-divider" />
              <button className="loose-split-btn" onClick={openAdd}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Add Task
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LooseTasksSection;
