import { useState, useRef } from "react";
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

  // Loose task inline editing
  const [editingLooseId, setEditingLooseId] = useState(null);
  const [editingLooseText, setEditingLooseText] = useState("");
  // Adding loose task
  const [addingLoose, setAddingLoose] = useState(false);
  const [newLooseText, setNewLooseText] = useState("");
  const looseInputRef = useRef(null);

  const domainProjects = projects.filter(p => p.domainId === activeDomain);
  const domain = domains.find(d => d.id === activeDomain);
  const activeCount = projects.filter(p => p.status === "active").length;
  const domainLoose = (data.looseTasks || []).filter(t => t.domainId === activeDomain && !t.done);

  const allCollapsed = domainProjects.length > 0 && domainProjects.every(p => collapsedProjs.has(p.id));
  const toggleAllCollapsed = () => {
    if (allCollapsed) {
      setCollapsedProjs(s => { const n = new Set(s); domainProjects.forEach(p => n.delete(p.id)); return n; });
    } else {
      setCollapsedProjs(s => { const n = new Set(s); domainProjects.forEach(p => n.add(p.id)); return n; });
    }
  };

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
    setData(d => ({
      ...d,
      looseTasks: (d.looseTasks || []).map(t =>
        t.id === id ? { ...t, done: true, doneAt: new Date().toISOString() } : t
      ),
    }));
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

  const addLooseTask = () => {
    const trimmed = newLooseText.trim();
    if (!trimmed) return;
    setData(d => ({
      ...d,
      looseTasks: [...(d.looseTasks || []), { id: uid(), domainId: activeDomain, text: trimmed, done: false, doneAt: null }],
    }));
    setNewLooseText("");
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
            onClick={() => { setActiveDomain(d.id); setCollapsedProjs(new Set()); setAddingLoose(false); setEditingLooseId(null); }}>
            <div className="domain-tab-dot" style={{ background: activeDomain === d.id ? d.color : "var(--border)" }} />
            {d.name}
          </button>
        ))}
        {domainProjects.length > 0 && (
          <button
            onClick={toggleAllCollapsed}
            title={allCollapsed ? "Expand all" : "Collapse all"}
            style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", padding:"0 14px", color:"var(--text3)", opacity:.7, flexShrink:0, display:"flex", alignItems:"center" }}
          >
            {allCollapsed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}
      </div>

      <div className="scroll" style={{ paddingTop: 16 }}>

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

        {/* Project cards */}
        {domainProjects.map(proj => (
          <ProjectCard
            key={proj.id}
            proj={proj}
            domain={domains.find(d => d.id === proj.domainId)}
            isExp={!collapsedProjs.has(proj.id)}
            newTaskText={newTaskText[proj.id] || ""}
            sessionLog={data.sessionLog || []}
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

        {/* Loose Tasks for this domain — rendered after project cards */}
        {(domainLoose.length > 0 || addingLoose) && (
          <div className="loose-domain-label">Loose Tasks</div>
        )}
        {domainLoose.map(t => (
          <div key={t.id} className="loose-domain-row" style={{ margin: "0 16px" }}>
            <div className="loose-domain-check" onClick={() => toggleLoose(t.id)} />
            {editingLooseId === t.id ? (
              <input
                className="loose-domain-edit"
                value={editingLooseText}
                autoFocus
                onChange={e => setEditingLooseText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") saveLooseEdit(t.id, editingLooseText);
                  if (e.key === "Escape") { setEditingLooseId(null); setEditingLooseText(""); }
                }}
                onBlur={() => saveLooseEdit(t.id, editingLooseText)}
              />
            ) : (
              <span
                className="loose-domain-text"
                onClick={() => { setEditingLooseId(t.id); setEditingLooseText(t.text); }}
                style={{ cursor: "text" }}
              >{t.text}</span>
            )}
          </div>
        ))}

        {/* Dotted circle add row for loose tasks */}
        {addingLoose ? (
          <div className="dotted-add-row" style={{ margin: "0 16px" }}>
            <div className="dotted-add-circle" />
            <input
              ref={looseInputRef}
              className="dotted-add-input"
              placeholder="New loose task…"
              value={newLooseText}
              autoFocus
              onChange={e => setNewLooseText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  addLooseTask();
                  setTimeout(() => looseInputRef.current?.focus(), 30);
                }
                if (e.key === "Escape") { setAddingLoose(false); setNewLooseText(""); }
              }}
              onBlur={() => { if (newLooseText.trim()) addLooseTask(); setAddingLoose(false); setNewLooseText(""); }}
            />
          </div>
        ) : (
          <div className="dotted-add-row" style={{ margin: "0 16px" }} onClick={() => { setAddingLoose(true); setTimeout(() => looseInputRef.current?.focus(), 30); }}>
            <div className="dotted-add-circle" />
            <span className="dotted-add-placeholder">Add loose task…</span>
          </div>
        )}

        {/* Add project button */}
        <div className="add-proj-row" onClick={addProject}>
          <span className="add-proj-ico">+</span>
          <span className="add-proj-txt">Add project</span>
        </div>

        <div className="spacer" />
      </div>

      {showManage && <ProjectsManageSheet data={data} setData={setData} onClose={() => setShowManage(false)} />}
    </div>
  );
}
