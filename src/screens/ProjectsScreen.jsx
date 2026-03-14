import { useState, useRef, useEffect, useCallback } from "react";
import { uid } from "../utils.js";
import GearIcon from "../components/GearIcon.jsx";
import StatusBar from "../components/StatusBar.jsx";
import ProjectCard from "../components/ProjectCard.jsx";
import ProjectsManageSheet from "../sheets/ProjectsManageSheet.jsx";

export default function ProjectsScreen({ data, setData }) {
  const { domains, projects } = data;
  const [activeDomain, setActiveDomain] = useState(domains[0]?.id || null);
  const [collapsedProjs, setCollapsedProjs] = useState(new Set());
  const [newTaskText, setNewTaskText] = useState({});
  const [showManage, setShowManage] = useState(false);
  const [newProjId, setNewProjId] = useState(null);
  const [pendingModeProj, setPendingModeProj] = useState(null);

  // Loose task state
  const [looseExpanded, setLooseExpanded] = useState(false);
  const [editingLooseId, setEditingLooseId] = useState(null);
  const [editingLooseText, setEditingLooseText] = useState("");
  const [addingLooseBottom, setAddingLooseBottom] = useState(false);
  const [newLooseBottomText, setNewLooseBottomText] = useState("");
  const looseBottomRef = useRef(null);
  const [addingLooseTop, setAddingLooseTop] = useState(false);
  const [newLooseTopText, setNewLooseTopText] = useState("");
  const looseTopRef = useRef(null);
  const [removingLooseId, setRemovingLooseId] = useState(null);

  const scrollRef = useRef(null);

  // Keyboard scroll behavior — adjust padding when virtual keyboard opens
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const kbHeight = window.innerHeight - vv.height;
      if (scrollRef.current) {
        scrollRef.current.style.paddingBottom = kbHeight > 50 ? `${kbHeight + 20}px` : "";
      }
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

  const scrollIntoView = useCallback((el) => {
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }, []);

  const domainProjects = projects.filter(p => p.domainId === activeDomain);
  const domain = domains.find(d => d.id === activeDomain);
  const activeCount = projects.filter(p => p.status === "active").length;
  const domainLoose = (data.looseTasks || []).filter(t => t.domainId === activeDomain && !t.done);

  const toggleTask = (projectId, taskId) => setData(d => ({
    ...d, projects: d.projects.map(p =>
      p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : p
    )
  }));

  const toggleStatus = (projectId, e) => {
    e.stopPropagation();
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, status: p.status === "active" ? "backlog" : "active" } : p) }));
  };

  const deleteProject = (projectId) => {
    setData(d => ({ ...d, projects: d.projects.filter(p => p.id !== projectId) }));
    setCollapsedProjs(s => { const n = new Set(s); n.delete(projectId); return n; });
  };

  const addTask = (projectId) => {
    const text = (newTaskText[projectId] || "").trim();
    if (!text) return;
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { id: uid(), text, done: false }] } : p) }));
    setNewTaskText(t => ({ ...t, [projectId]: "" }));
  };

  const deleteTask = (projectId, taskId) => setData(d => ({
    ...d, projects: d.projects.map(p =>
      p.id === projectId ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) } : p
    )
  }));

  const saveTask = (projectId, taskId, text) => setData(d => ({
    ...d, projects: d.projects.map(p =>
      p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, text } : t) } : p
    )
  }));

  const saveProjectEdit = (projectId, { name }) => {
    setData(d => ({
      ...d,
      projects: d.projects.map(p => p.id === projectId ? { ...p, name } : p),
      domains: d.domains
    }));
  };

  const addProject = () => {
    setPendingModeProj({ id: uid(), domainId: activeDomain, name: "", status: "backlog", tasks: [] });
  };

  const confirmNewProject = (mode) => {
    if (!pendingModeProj) return;
    const newProj = { ...pendingModeProj, mode };
    setData(d => ({ ...d, projects: [...d.projects, newProj] }));
    setNewProjId(newProj.id);
    setPendingModeProj(null);
  };

  const cancelNewProject = () => setPendingModeProj(null);

  // ── Loose task helpers ──
  const toggleLoose = (id) => {
    setRemovingLooseId(id);
    setTimeout(() => {
      setData(d => ({
        ...d,
        looseTasks: (d.looseTasks || []).map(t =>
          t.id === id ? { ...t, done: true, doneAt: new Date().toISOString() } : t
        ),
      }));
      setRemovingLooseId(null);
    }, 300);
  };

  const saveLooseEdit = (id, text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setData(d => ({ ...d, looseTasks: (d.looseTasks || []).filter(t => t.id !== id) }));
    } else {
      setData(d => ({ ...d, looseTasks: (d.looseTasks || []).map(t => t.id === id ? { ...t, text: trimmed } : t) }));
    }
    setEditingLooseId(null);
    setEditingLooseText("");
  };

  const addLooseTaskBottom = () => {
    const trimmed = newLooseBottomText.trim();
    if (!trimmed) return;
    setData(d => ({
      ...d,
      looseTasks: [...(d.looseTasks || []), { id: uid(), domainId: activeDomain, text: trimmed, done: false, doneAt: null }],
    }));
    setNewLooseBottomText("");
  };

  const addLooseTaskTop = () => {
    const trimmed = newLooseTopText.trim();
    if (!trimmed) return;
    setData(d => ({
      ...d,
      looseTasks: [{ id: uid(), domainId: activeDomain, text: trimmed, done: false, doneAt: null }, ...(d.looseTasks || [])],
    }));
    setNewLooseTopText("");
  };

  const handlePlusTap = (e) => {
    e.stopPropagation();
    setLooseExpanded(true);
    setAddingLooseTop(true);
    setTimeout(() => { looseTopRef.current?.focus(); scrollIntoView(looseTopRef.current); }, 50);
  };

  return (
    <div className="screen active">
      <StatusBar />
      <div className="ph">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="ph-eye">Your Work</div>
            <div className="ph-title">Projects</div>
          </div>
          <button className="tab-gear" onClick={() => setShowManage(true)}><GearIcon size={20} /></button>
        </div>
        <div className="ph-sub">{activeCount} active · {projects.length - activeCount} in backlog</div>
      </div>

      {/* DOMAIN TABS */}
      <div className="domain-tabs" style={{ position:"relative" }}>
        {domains.map(d => (
          <button key={d.id}
            className={`domain-tab ${activeDomain === d.id ? "active" : ""}`}
            style={activeDomain === d.id ? { color: d.color, borderBottomColor: d.color } : {}}
            onClick={() => { setActiveDomain(d.id); setCollapsedProjs(new Set()); setLooseExpanded(false); setEditingLooseId(null); setAddingLooseTop(false); setAddingLooseBottom(false); }}>
            <div className="domain-tab-dot" style={{ background: activeDomain === d.id ? d.color : "var(--border)" }} />
            {d.name}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="scroll" style={{ paddingTop: 16 }}>

        {/* Mode picker for new project */}
        {pendingModeProj && (
          <div style={{ margin:"0 16px 8px", borderRadius:14, background:"var(--bg2)", border:"1px solid var(--border)", padding:"16px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--text3)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:12, textAlign:"center" }}>How will you work on this?</div>
            <div style={{ display:"flex", gap:10 }}>
              <button
                onClick={() => confirmNewProject("tasks")}
                style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 10px", cursor:"pointer", textAlign:"left", fontFamily:"'DM Sans',sans-serif" }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:`${domain?.color || "var(--accent)"}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={domain?.color || "var(--accent)"} strokeWidth="2"/><path d="M9 12l2 2 4-4" stroke={domain?.color || "var(--accent)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>Tasks</span>
                </div>
                <div style={{ fontSize:11, color:"var(--text3)", lineHeight:1.4 }}>Discrete work with a clear finish line. Build a list, check things off, measure progress.</div>
              </button>
              <button
                onClick={() => confirmNewProject("sessions")}
                style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 10px", cursor:"pointer", textAlign:"left", fontFamily:"'DM Sans',sans-serif" }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:`${domain?.color || "var(--accent)"}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2-5.3" stroke={domain?.color || "var(--accent)"} strokeWidth="2.2" strokeLinecap="round"/><path d="M20 7v5h-5" stroke={domain?.color || "var(--accent)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>Sessions</span>
                </div>
                <div style={{ fontSize:11, color:"var(--text3)", lineHeight:1.4 }}>Craft work that compounds over time. Show up, push it forward, log the hours.</div>
              </button>
            </div>
            <button onClick={cancelNewProject} style={{ marginTop:10, width:"100%", background:"none", border:"none", fontSize:12, color:"var(--text3)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"4px 0" }}>Cancel</button>
          </div>
        )}

        {/* ── LOOSE TASKS CARD ── */}
        <div className="loose-card">
          <div className="loose-card-header" onClick={() => setLooseExpanded(!looseExpanded)}>
            <span className="loose-card-label">Loose Tasks{domainLoose.length > 0 ? ` · ${domainLoose.length}` : ""}</span>
            <div className="loose-card-plus" onClick={handlePlusTap}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </div>
          </div>
          {looseExpanded && (
            <div className="loose-card-body">
              {/* Top add row (from + button) */}
              {addingLooseTop && (
                <div className="loose-domain-row">
                  <div className="dotted-add-circle" />
                  <input
                    ref={looseTopRef}
                    className="loose-domain-edit"
                    placeholder="New task…"
                    value={newLooseTopText}
                    autoFocus
                    onChange={e => setNewLooseTopText(e.target.value)}
                    onFocus={e => scrollIntoView(e.target)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        addLooseTaskTop();
                        setTimeout(() => { looseTopRef.current?.focus(); }, 30);
                      }
                      if (e.key === "Escape") { setAddingLooseTop(false); setNewLooseTopText(""); }
                    }}
                    onBlur={() => { if (newLooseTopText.trim()) addLooseTaskTop(); setAddingLooseTop(false); setNewLooseTopText(""); }}
                  />
                </div>
              )}

              {/* Existing loose tasks */}
              {domainLoose.map(t => (
                <div key={t.id} className={`loose-domain-row${removingLooseId === t.id ? " loose-removing" : ""}`}>
                  <div
                    className={`loose-domain-check${removingLooseId === t.id ? " done" : ""}`}
                    onClick={() => toggleLoose(t.id)}
                  >
                    {removingLooseId === t.id && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                  </div>
                  {editingLooseId === t.id ? (
                    <input
                      className="loose-domain-edit"
                      value={editingLooseText}
                      autoFocus
                      onFocus={e => scrollIntoView(e.target)}
                      onChange={e => setEditingLooseText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") saveLooseEdit(t.id, editingLooseText);
                        if (e.key === "Escape") { setEditingLooseId(null); setEditingLooseText(""); }
                      }}
                      onBlur={() => saveLooseEdit(t.id, editingLooseText)}
                    />
                  ) : (
                    <span
                      className={`loose-domain-text${removingLooseId === t.id ? " done" : ""}`}
                      onClick={() => { if (removingLooseId) return; setEditingLooseId(t.id); setEditingLooseText(t.text); }}
                      style={{ cursor: "text" }}
                    >{t.text}</span>
                  )}
                </div>
              ))}

              {/* Bottom dotted circle add row */}
              {addingLooseBottom ? (
                <div className="dotted-add-row">
                  <div className="dotted-add-circle" />
                  <input
                    ref={looseBottomRef}
                    className="dotted-add-input"
                    placeholder="New loose task…"
                    value={newLooseBottomText}
                    autoFocus
                    onFocus={e => scrollIntoView(e.target)}
                    onChange={e => setNewLooseBottomText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        addLooseTaskBottom();
                        setTimeout(() => looseBottomRef.current?.focus(), 30);
                      }
                      if (e.key === "Escape") { setAddingLooseBottom(false); setNewLooseBottomText(""); }
                    }}
                    onBlur={() => { if (newLooseBottomText.trim()) addLooseTaskBottom(); setAddingLooseBottom(false); setNewLooseBottomText(""); }}
                  />
                </div>
              ) : (
                <div className="dotted-add-row" onClick={() => { setAddingLooseBottom(true); setTimeout(() => looseBottomRef.current?.focus(), 30); }}>
                  <div className="dotted-add-circle" />
                  <span className="dotted-add-placeholder">Add task…</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── PROJECT CARDS ── */}
        {domainProjects.map(proj => (
          <ProjectCard
            key={proj.id}
            proj={proj}
            domain={domains.find(d => d.id === proj.domainId)}
            isExp={!collapsedProjs.has(proj.id)}
            newTaskText={newTaskText[proj.id] || ""}
            sessionLog={data.sessionLog || []}
            scrollIntoView={scrollIntoView}
            onModeToggle={() => setData(d => ({ ...d, projects: d.projects.map(p => p.id === proj.id ? { ...p, mode: p.mode === "sessions" ? "tasks" : "sessions" } : p) }))}
            onToggleExpand={() => setCollapsedProjs(s => { const n = new Set(s); n.has(proj.id) ? n.delete(proj.id) : n.add(proj.id); return n; })}
            onToggleStatus={e => toggleStatus(proj.id, e)}
            onDelete={() => deleteProject(proj.id)}
            autoFocus={proj.id === newProjId}
            onEditSave={edits => { if (!edits.name && proj.id === newProjId) { deleteProject(proj.id); } else { saveProjectEdit(proj.id, edits); } setNewProjId(null); }}
            onToggleTask={taskId => toggleTask(proj.id, taskId)}
            onDeleteTask={taskId => deleteTask(proj.id, taskId)}
            onSaveTask={(taskId, text) => saveTask(proj.id, taskId, text)}
            onNewTaskChange={v => setNewTaskText(t => ({ ...t, [proj.id]: v }))}
            onAddTask={() => addTask(proj.id)}
          />
        ))}

        <div className="spacer" />
      </div>

      {showManage && <ProjectsManageSheet data={data} setData={setData} onClose={() => setShowManage(false)} onAddProject={addProject} />}
    </div>
  );
}
