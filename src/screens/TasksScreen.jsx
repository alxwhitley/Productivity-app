import { useState, useEffect, useRef } from "react";
import { uid, toISODate } from "../utils.js";
import StatusBar from "../components/StatusBar.jsx";

export default function TasksScreen({ data, setData }) {
  const [captureDraft, setCaptureDraft] = useState("");
  const [organizeId, setOrganizeId] = useState(null);
  const [swDraft, setSwDraft] = useState("");
  const [editingSwId, setEditingSwId] = useState(null);
  const [editingSwText, setEditingSwText] = useState("");

  const todayISO = toISODate();
  const todayTasks = (data.shallowWork || {})[todayISO] || [];

  // Shallow work reset logic on mount
  useEffect(() => {
    const todayISO = toISODate();
    if (data.swClearDate === todayISO) return;
    const allDates = Object.keys(data.shallowWork || {}).filter(d => d < todayISO);
    let movedItems = [];
    const newSW = { ...(data.shallowWork || {}) };
    allDates.forEach(dateKey => {
      const tasks = newSW[dateKey] || [];
      const toMove = tasks.filter(t => !t.done && t.sourceType === "manual" && !t.domainId);
      movedItems = [...movedItems, ...toMove.map(t => ({ id: t.id, text: t.text, createdAt: t.addedAt || Date.now() }))];
      newSW[dateKey] = tasks.filter(t => t.done || t.sourceType !== "manual" || t.domainId);
    });
    if (movedItems.length > 0 || data.swClearDate !== todayISO) {
      setData(d => ({
        ...d,
        fabQueue: [...(d.fabQueue || []), ...movedItems],
        shallowWork: newSW,
        swClearDate: todayISO,
      }));
    }
  }, []);

  // ── Data helpers ──

  const addToFabQueue = (text) => {
    const t = text.trim();
    if (!t) return;
    setData(d => ({
      ...d,
      fabQueue: [...(d.fabQueue || []), { id: uid(), text: t, createdAt: Date.now() }],
    }));
    setCaptureDraft("");
  };

  const routeToToday = (item) => {
    const todayISO = toISODate();
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).filter(i => i.id !== item.id),
      shallowWork: {
        ...(d.shallowWork || {}),
        [todayISO]: [...((d.shallowWork || {})[todayISO] || []), {
          id: item.id, text: item.text, domainId: null,
          sourceType: "manual", sourceId: null, done: false, doneAt: null, addedAt: Date.now(),
        }],
      },
    }));
    setOrganizeId(null);
  };

  const routeToProject = (item, projectId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).filter(i => i.id !== item.id),
      projects: d.projects.map(p => p.id === projectId
        ? { ...p, tasks: [...p.tasks, { id: uid(), text: item.text, done: false }] }
        : p
      ),
    }));
    setOrganizeId(null);
  };

  const routeToLoose = (item, domainId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).filter(i => i.id !== item.id),
      looseTasks: [...(d.looseTasks || []), { id: uid(), domainId, text: item.text, done: false, doneAt: null }],
    }));
    setOrganizeId(null);
  };

  const toggleShallowTask = (taskId) => {
    const todayISO = toISODate();
    setData(d => {
      const sw = { ...(d.shallowWork || {}) };
      const tasks = [...(sw[todayISO] || [])];
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx < 0) return d;
      const task = tasks[idx];
      const nowDone = !task.done;
      tasks[idx] = { ...task, done: nowDone, doneAt: nowDone ? new Date().toISOString() : null };
      sw[todayISO] = tasks;
      let projects = d.projects;
      let looseTasks = d.looseTasks;
      if (task.sourceType === "project" && task.sourceId) {
        projects = d.projects.map(p => ({
          ...p,
          tasks: p.tasks.map(t => t.id === task.sourceId ? { ...t, done: nowDone, doneAt: nowDone ? new Date().toISOString() : null } : t),
        }));
      } else if (task.sourceType === "loose" && task.sourceId) {
        looseTasks = (d.looseTasks || []).map(t => t.id === task.sourceId ? { ...t, done: nowDone, doneAt: nowDone ? new Date().toISOString() : null } : t);
      }
      return { ...d, shallowWork: sw, projects, looseTasks };
    });
  };

  const deleteShallowTask = (taskId) => {
    const todayISO = toISODate();
    setData(d => {
      const sw = { ...(d.shallowWork || {}) };
      sw[todayISO] = (sw[todayISO] || []).filter(t => t.id !== taskId);
      return { ...d, shallowWork: sw };
    });
  };

  const addManualShallowTask = (text) => {
    const t = text.trim();
    if (!t) return;
    const todayISO = toISODate();
    setData(d => ({
      ...d,
      shallowWork: {
        ...(d.shallowWork || {}),
        [todayISO]: [...((d.shallowWork || {})[todayISO] || []), {
          id: uid(), text: t, domainId: null,
          sourceType: "manual", sourceId: null, done: false, doneAt: null, addedAt: Date.now(),
        }],
      },
    }));
    setSwDraft("");
  };

  // ── Render ──

  const fabQueue = data.fabQueue || [];
  const { domains, projects } = data;

  const sortedTasks = [...todayTasks].sort((a, b) => {
    if (a.done && !b.done) return 1;
    if (!a.done && b.done) return -1;
    return 0;
  });

  return (
    <div className="screen active">
      <StatusBar />
      <div className="scroll" style={{ paddingBottom: 100 }}>

        {/* ── SECTION 1: FAB QUEUE (Capture) ── */}
        <div style={{ padding:"14px 16px 0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <div style={{ fontSize:18, fontWeight:800, color:"var(--text)", letterSpacing:"-.02em" }}>Capture</div>
            {fabQueue.length > 0 && (
              <span style={{ fontSize:11, fontWeight:700, background:"var(--accent-s)", color:"var(--accent)", borderRadius:20, padding:"2px 8px" }}>
                {fabQueue.length}
              </span>
            )}
          </div>
          {/* Capture input */}
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <input
              style={{ flex:1, background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 14px", color:"var(--text)", fontSize:16, fontFamily:"'DM Sans',sans-serif", outline:"none" }}
              placeholder="What's on your mind…"
              value={captureDraft}
              onChange={e => setCaptureDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addToFabQueue(captureDraft); }}
            />
            {captureDraft.trim() && (
              <button onClick={() => addToFabQueue(captureDraft)}
                style={{ background:"var(--accent)", color:"#000", border:"none", borderRadius:12, padding:"12px 16px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}>
                Add
              </button>
            )}
          </div>

          {/* FAB Queue items */}
          {fabQueue.length > 0 && (
            <div style={{ marginBottom:8 }}>
              {fabQueue.map(item => (
                <div key={item.id} className="fab-queue-item">
                  <div className="fab-queue-text">{item.text}</div>
                  <div className="fab-queue-actions">
                    <button className="fab-queue-btn today" onClick={() => routeToToday(item)}>→ Today</button>
                    <button className="fab-queue-btn organize" onClick={() => setOrganizeId(organizeId === item.id ? null : item.id)}>
                      Organize →
                    </button>
                  </div>
                  {/* Organize sub-panel */}
                  {organizeId === item.id && (
                    <div className="org-panel">
                      {domains.map(domain => {
                        const domainProjects = projects.filter(p => p.domainId === domain.id && p.status === "active");
                        return (
                          <div key={domain.id}>
                            <div className="org-domain-row" onClick={() => routeToLoose(item, domain.id)}>
                              <div className="org-domain-dot" style={{ background: domain.color }} />
                              <span className="org-domain-name">{domain.name}</span>
                            </div>
                            {domainProjects.map(proj => (
                              <div key={proj.id} className="org-project-row" onClick={() => routeToProject(item, proj.id)}>
                                <span className="org-project-name">{proj.name}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {fabQueue.length === 0 && (
            <div style={{ textAlign:"center", padding:"8px 0 16px", fontSize:13, color:"var(--text3)" }}>
              Capture queue is empty.
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height:1, background:"var(--border)", margin:"4px 16px 0" }} />

        {/* ── SECTION 2: SHALLOW WORK (Today) ── */}
        <div>
          <div className="sw-section-header">Today</div>

          {sortedTasks.length === 0 && (
            <div style={{ textAlign:"center", padding:"16px 0 8px", fontSize:13, color:"var(--text3)" }}>
              Nothing picked for today yet.
            </div>
          )}

          {sortedTasks.map(task => {
            const domain = task.domainId ? domains.find(d => d.id === task.domainId) : null;
            const isEditing = editingSwId === task.id;
            return (
              <div key={task.id} className="sw-task-row">
                {/* Circle toggle */}
                <div
                  onClick={() => toggleShallowTask(task.id)}
                  style={{
                    width:20, height:20, borderRadius:"50%", flexShrink:0, cursor:"pointer",
                    border: task.done ? "none" : "1.5px solid var(--border)",
                    background: task.done ? "var(--green)" : "transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all .15s",
                  }}
                >
                  {task.done && <span style={{ fontSize:10, color:"#fff", fontWeight:700 }}>✓</span>}
                </div>
                {/* Text */}
                {isEditing ? (
                  <input autoFocus
                    style={{ flex:1, background:"transparent", border:"none", borderBottom:"1.5px solid var(--accent)", outline:"none", color:"var(--text)", fontSize:14, fontFamily:"'DM Sans',sans-serif", padding:"1px 0" }}
                    value={editingSwText}
                    onChange={e => setEditingSwText(e.target.value)}
                    onBlur={() => {
                      if (editingSwText.trim()) {
                        const todayISO = toISODate();
                        setData(d => {
                          const sw = { ...(d.shallowWork || {}) };
                          sw[todayISO] = (sw[todayISO] || []).map(t => t.id === task.id ? { ...t, text: editingSwText.trim() } : t);
                          return { ...d, shallowWork: sw };
                        });
                      }
                      setEditingSwId(null);
                    }}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }}
                  />
                ) : (
                  <span
                    onClick={() => { if (!task.done) { setEditingSwId(task.id); setEditingSwText(task.text); } }}
                    style={{
                      flex:1, fontSize:14, color: task.done ? "var(--text3)" : "var(--text)",
                      textDecoration: task.done ? "line-through" : "none",
                      cursor: task.done ? "default" : "text",
                    }}
                  >
                    {task.text}
                  </span>
                )}
                {/* Domain dot */}
                {domain && (
                  <div style={{ width:8, height:8, borderRadius:"50%", background:domain.color, flexShrink:0 }} />
                )}
                {/* Delete button */}
                {!task.done && (
                  <button onClick={() => deleteShallowTask(task.id)}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", color:"var(--text3)", fontSize:16, lineHeight:1, flexShrink:0 }}>
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {/* Add task row */}
          <div className="sw-add-row">
            <span style={{ fontSize:16, color:"var(--text3)", lineHeight:1 }}>+</span>
            <input className="sw-add-input"
              placeholder="Add a task…"
              value={swDraft}
              onChange={e => setSwDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addManualShallowTask(swDraft); }}
            />
            {swDraft.trim() && (
              <button onClick={() => addManualShallowTask(swDraft)}
                style={{ background:"var(--accent)", color:"#000", border:"none", borderRadius:8, padding:"6px 12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                Add
              </button>
            )}
          </div>
        </div>

        <div className="spacer" />
      </div>
    </div>
  );
}
