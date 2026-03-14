import { useState, useEffect, useRef } from "react";
import { uid, toISODate } from "../utils.js";
import StatusBar from "../components/StatusBar.jsx";

export default function TasksScreen({ data, setData }) {
  const [captureDraft, setCaptureDraft] = useState("");
  const [sortPanelId, setSortPanelId] = useState(null); // fabQueue item id with sort panel open
  const [swDraft, setSwDraft] = useState("");
  const [editingSwId, setEditingSwId] = useState(null);
  const [editingSwText, setEditingSwText] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "quickwins"

  // Swipe state per row
  const swipeRefs = useRef({});
  const [swipingId, setSwipingId] = useState(null);
  const [swipeX, setSwipeX] = useState(0);

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
      movedItems = [...movedItems, ...toMove.map(t => ({ id: t.id, text: t.text, createdAt: t.addedAt || Date.now(), quickWin: false }))];
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

  // ── Swipe handlers ──
  const handleTouchStart = (id, e) => {
    const touch = e.touches[0];
    swipeRefs.current[id] = { startX: touch.clientX, startY: touch.clientY, moved: false };
    setSwipingId(id);
    setSwipeX(0);
  };

  const handleTouchMove = (id, e) => {
    const ref = swipeRefs.current[id];
    if (!ref) return;
    const touch = e.touches[0];
    const dx = touch.clientX - ref.startX;
    const dy = touch.clientY - ref.startY;
    if (!ref.moved && Math.abs(dy) > Math.abs(dx)) {
      // Vertical scroll, cancel swipe
      swipeRefs.current[id] = null;
      setSwipingId(null);
      setSwipeX(0);
      return;
    }
    ref.moved = true;
    if (swipingId === id) {
      setSwipeX(dx);
    }
  };

  const handleTouchEnd = (id, e) => {
    const ref = swipeRefs.current[id];
    if (!ref) return;
    const dx = swipeX;

    if (dx < -60) {
      // Swipe left → toggle quickWin
      toggleQuickWin(id);
      setSwipingId(null);
      setSwipeX(0);
    } else if (dx > 160) {
      // Full swipe right — snap open to show action buttons
      setSwipeX(220);
      // Keep open — user taps a button
    } else if (dx > 40) {
      // Partial swipe right — snap open
      setSwipeX(220);
    } else {
      setSwipingId(null);
      setSwipeX(0);
    }
    swipeRefs.current[id] = null;
  };

  const closeSwipe = () => {
    setSwipingId(null);
    setSwipeX(0);
    setSortPanelId(null);
  };

  // ── Data helpers ──

  const addToFabQueue = (text) => {
    const t = text.trim();
    if (!t) return;
    setData(d => ({
      ...d,
      fabQueue: [...(d.fabQueue || []), { id: uid(), text: t, createdAt: Date.now(), quickWin: false }],
    }));
    setCaptureDraft("");
  };

  const deleteFabItem = (itemId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).filter(i => i.id !== itemId),
    }));
    closeSwipe();
  };

  const toggleQuickWin = (itemId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).map(i =>
        i.id === itemId ? { ...i, quickWin: !(i.quickWin ?? false) } : i
      ),
    }));
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
    closeSwipe();
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
    setSortPanelId(null);
    closeSwipe();
  };

  const routeToLoose = (item, domainId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).filter(i => i.id !== item.id),
      looseTasks: [...(d.looseTasks || []), { id: uid(), domainId, text: item.text, done: false, doneAt: null }],
    }));
    setSortPanelId(null);
    closeSwipe();
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

  // Filter FAB queue
  const filteredFab = filter === "quickwins"
    ? fabQueue.filter(i => i.quickWin ?? false)
    : fabQueue;

  const sortedTasks = [...todayTasks].sort((a, b) => {
    if (a.done && !b.done) return 1;
    if (!a.done && b.done) return -1;
    return 0;
  });

  return (
    <div className="screen active" onClick={() => { if (swipingId) closeSwipe(); }}>
      <StatusBar />
      <div className="scroll" style={{ paddingBottom: 100 }}>

        {/* ── PILL FILTERS ── */}
        <div className="tasks-filter-row">
          <button className={`tasks-filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
          <button className={`tasks-filter-pill ${filter === "quickwins" ? "active" : ""}`} onClick={() => setFilter("quickwins")}>Quick Wins</button>
        </div>

        {/* ── CAPTURE INPUT ── */}
        <div style={{ padding:"0 16px 12px" }}>
          <div style={{ display:"flex", gap:8 }}>
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
        </div>

        {/* ── SECTION: CAPTURE ── */}
        <div className="sh" style={{ paddingTop:4 }}>
          <span className="sh-label">
            Capture
            {fabQueue.length > 0 && <span style={{ marginLeft:6, fontSize:11, fontWeight:700, color:"var(--accent)" }}>{fabQueue.length}</span>}
          </span>
        </div>

        <div style={{ padding:"0 16px" }}>
          {filteredFab.length === 0 && (
            <div style={{ textAlign:"center", padding:"12px 0", fontSize:13, color:"var(--text3)" }}>
              {filter === "quickwins" ? "No quick wins." : "Capture queue is empty."}
            </div>
          )}

          {filteredFab.map(item => {
            const isQuickWin = item.quickWin ?? false;
            const isSwiping = swipingId === item.id;
            const dx = isSwiping ? swipeX : 0;
            const showActions = dx > 40;
            const isSortOpen = sortPanelId === item.id;

            return (
              <div key={item.id} onClick={e => e.stopPropagation()}>
                <div className="tasks-swipe-wrap">
                  {/* Action buttons revealed behind (left side) */}
                  <div className="tasks-swipe-actions" style={{ opacity: showActions ? 1 : 0 }}>
                    <button className="tasks-swipe-btn sort" onClick={() => { setSortPanelId(isSortOpen ? null : item.id); setSwipingId(null); setSwipeX(0); }}>Sort</button>
                    <button className="tasks-swipe-btn today" onClick={() => routeToToday(item)}>Today</button>
                    <button className="tasks-swipe-btn delete" onClick={() => deleteFabItem(item.id)}>Delete</button>
                  </div>

                  {/* Row content */}
                  <div
                    className={`tasks-row ${isSwiping ? "swiping" : ""}`}
                    style={{ transform: `translateX(${Math.max(0, dx)}px)` }}
                    onTouchStart={e => handleTouchStart(item.id, e)}
                    onTouchMove={e => handleTouchMove(item.id, e)}
                    onTouchEnd={e => handleTouchEnd(item.id, e)}
                  >
                    {/* Large circle (empty — not a checkbox for fab items) */}
                    <div className="tasks-circle" />
                    {/* Text + domain dot */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="tasks-text">{item.text}</div>
                    </div>
                    {/* Quick Win badge */}
                    {isQuickWin && (
                      <span className="tasks-qw-badge">Quick Win</span>
                    )}
                  </div>
                </div>

                {/* Sort panel — inline below row */}
                {isSortOpen && (
                  <div className="tasks-sort-panel">
                    <div className="tasks-sort-section">Domains</div>
                    {domains.map(domain => (
                      <div key={domain.id} className="tasks-sort-row" onClick={() => routeToLoose(item, domain.id)}>
                        <div className="tasks-sort-dot" style={{ background: domain.color }} />
                        <span className="tasks-sort-name">{domain.name}</span>
                      </div>
                    ))}
                    <div className="tasks-sort-section" style={{ marginTop:8 }}>Projects</div>
                    {projects.filter(p => p.status === "active").map(proj => {
                      const dom = domains.find(d => d.id === proj.domainId);
                      return (
                        <div key={proj.id} className="tasks-sort-row" onClick={() => routeToProject(item, proj.id)}>
                          <div className="tasks-sort-dot" style={{ background: dom?.color || "var(--text3)" }} />
                          <div style={{ flex:1 }}>
                            <span className="tasks-sort-name">{proj.name}</span>
                            <span className="tasks-sort-domain">{dom?.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── SECTION: TODAY ── */}
        <div className="sh">
          <span className="sh-label">Today</span>
        </div>

        <div style={{ padding:"0 16px" }}>
          {sortedTasks.length === 0 && (
            <div style={{ textAlign:"center", padding:"12px 0", fontSize:13, color:"var(--text3)" }}>
              Nothing picked for today yet.
            </div>
          )}

          {sortedTasks.map(task => {
            const domain = task.domainId ? domains.find(d => d.id === task.domainId) : null;
            const isEditing = editingSwId === task.id;
            return (
              <div key={task.id} className="tasks-row-divider">
                <div className="tasks-row">
                  {/* Circle toggle */}
                  <div
                    className={`tasks-circle clickable ${task.done ? "done" : ""}`}
                    onClick={() => toggleShallowTask(task.id)}
                  >
                    {task.done && <span style={{ fontSize:11, color:"#fff", fontWeight:700 }}>✓</span>}
                  </div>
                  {/* Text */}
                  <div style={{ flex:1, minWidth:0 }}>
                    {isEditing ? (
                      <input autoFocus
                        style={{ width:"100%", background:"transparent", border:"none", borderBottom:"1.5px solid var(--accent)", outline:"none", color:"var(--text)", fontSize:15, fontFamily:"'DM Sans',sans-serif", padding:"1px 0" }}
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
                      <>
                        <div
                          className={`tasks-text ${task.done ? "done" : ""}`}
                          onClick={() => { if (!task.done) { setEditingSwId(task.id); setEditingSwText(task.text); } }}
                          style={{ cursor: task.done ? "default" : "text" }}
                        >
                          {task.text}
                        </div>
                        {domain && (
                          <div className="tasks-domain-dot" style={{ background: domain.color }} />
                        )}
                      </>
                    )}
                  </div>
                  {/* Delete */}
                  {!task.done && !isEditing && (
                    <button onClick={() => deleteShallowTask(task.id)}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", color:"var(--text3)", fontSize:16, lineHeight:1, flexShrink:0 }}>
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add task row */}
          <div className="tasks-row" style={{ opacity:.6 }}>
            <div className="tasks-circle" style={{ borderStyle:"dashed" }} />
            <input
              style={{ flex:1, background:"none", border:"none", outline:"none", color:"var(--text)", fontSize:15, fontFamily:"'DM Sans',sans-serif", padding:0 }}
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
