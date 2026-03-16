import { useState, useRef } from "react";
import { DOMAIN_COLORS } from "../constants.js";
import { uid } from "../utils.js";
import useSwipeDown from "../useSwipeDown.js";

const COLORS = DOMAIN_COLORS;

function ProjectsManageSheet({ data, setData, onClose }) {
  const swipe = useSwipeDown(onClose);
  const { domains, projects } = data;

  const [expandedDomainId, setExpandedDomainId] = useState(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDomainId, setNewProjectDomainId] = useState(null);
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainColor, setNewDomainColor] = useState(COLORS[0]);

  const addProjInputRef = useRef(null);
  const addDomainInputRef = useRef(null);

  // ── Project swipe state ──
  const [projSwipeId, setProjSwipeId] = useState(null);
  const [projSwipeX, setProjSwipeX] = useState(0);
  const projSwipeStart = useRef(null);

  // ── Add Project ──
  const handleAddProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const domId = newProjectDomainId || (domains[0] && domains[0].id) || null;
    setData(d => ({
      ...d,
      projects: [...d.projects, { id: uid(), name, domainId: domId, status: "active", tasks: [] }],
    }));
    setNewProjectName("");
    setNewProjectDomainId(null);
    setShowAddProject(false);
  };

  // ── Domain CRUD ──
  const saveDomainName = (domainId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setData(d => ({
      ...d,
      domains: d.domains.map(dom => dom.id === domainId ? { ...dom, name: trimmed } : dom),
    }));
  };

  const saveDomainColor = (domainId, color) => {
    setData(d => ({
      ...d,
      domains: d.domains.map(dom => dom.id === domainId ? { ...dom, color } : dom),
    }));
  };

  const deleteDomain = (domainId) => {
    setData(d => ({
      ...d,
      domains: d.domains.filter(dom => dom.id !== domainId),
      projects: d.projects.filter(p => p.domainId !== domainId),
    }));
    setExpandedDomainId(null);
  };

  const handleAddDomain = () => {
    const name = newDomainName.trim();
    if (!name) return;
    setData(d => ({
      ...d,
      domains: [...d.domains, { id: uid(), name, color: newDomainColor }],
    }));
    setNewDomainName("");
    setNewDomainColor(COLORS[0]);
    setShowAddDomain(false);
  };

  // ── Project inline edit ──
  const saveProjectName = (projId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setData(d => ({
      ...d,
      projects: d.projects.map(p => p.id === projId ? { ...p, name: trimmed } : p),
    }));
  };

  const deleteProject = (projId) => {
    setData(d => ({
      ...d,
      projects: d.projects.filter(p => p.id !== projId),
    }));
    setProjSwipeId(null);
    setProjSwipeX(0);
  };

  // ── Project swipe handlers ──
  const onProjTouchStart = (id, e) => {
    projSwipeStart.current = { id, x: e.touches[0].clientX };
    if (projSwipeId && projSwipeId !== id) { setProjSwipeId(null); setProjSwipeX(0); }
  };
  const onProjTouchMove = (e) => {
    if (!projSwipeStart.current) return;
    const dx = e.touches[0].clientX - projSwipeStart.current.x;
    if (dx < 0) { setProjSwipeId(projSwipeStart.current.id); setProjSwipeX(Math.max(dx, -80)); }
  };
  const onProjTouchEnd = () => {
    if (!projSwipeStart.current) return;
    if (projSwipeX < -40) { setProjSwipeX(-72); }
    else { setProjSwipeId(null); setProjSwipeX(0); }
    projSwipeStart.current = null;
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Manage Projects</div>
        <div className="sheet-scroll">

          {/* ── SECTION 1: ADD NEW PROJECT ── */}
          <div style={{ padding: "0 20px" }}>
            <button
              onClick={() => {
                setShowAddProject(true);
                setNewProjectDomainId(domains[0]?.id || null);
                setTimeout(() => addProjInputRef.current?.focus(), 50);
              }}
              style={{
                background: "var(--accent)", color: "#000", fontSize: 15, fontWeight: 700,
                borderRadius: 12, padding: 14, width: "100%", textAlign: "center",
                border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                marginBottom: showAddProject ? 16 : 24,
              }}
            >+ New Project</button>

            {showAddProject && (
              <div style={{ marginBottom: 24 }}>
                <input
                  ref={addProjInputRef}
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddProject(); if (e.key === "Escape") setShowAddProject(false); }}
                  placeholder="Project name"
                  style={{
                    width: "100%", background: "var(--bg3)", border: "none", borderRadius: 10,
                    padding: 12, color: "var(--text)", fontSize: 15, fontFamily: "'DM Sans',sans-serif",
                    outline: "none", marginBottom: 12, boxSizing: "border-box",
                  }}
                />
                {/* Domain pills */}
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 12 }}>
                  {domains.map(d => {
                    const sel = (newProjectDomainId || domains[0]?.id) === d.id;
                    return (
                      <button key={d.id} onClick={() => setNewProjectDomainId(d.id)} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                        borderRadius: 20, border: sel ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                        background: sel ? "var(--accent-s)" : "transparent",
                        cursor: "pointer", flexShrink: 0, fontFamily: "'DM Sans',sans-serif",
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap" }}>{d.name}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={handleAddProject} style={{
                  background: "var(--accent)", color: "#000", fontSize: 15, fontWeight: 700,
                  borderRadius: 12, padding: 14, width: "100%", textAlign: "center",
                  border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginBottom: 8,
                }}>Add Project</button>
                <div style={{ textAlign: "center" }}>
                  <span onClick={() => { setShowAddProject(false); setNewProjectName(""); }}
                    style={{ fontSize: 13, color: "var(--text3)", cursor: "pointer", fontWeight: 500 }}>Cancel</span>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 2: DOMAINS ── */}
          <div style={{ padding: "0 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 12 }}>
              DOMAINS
            </div>

            {domains.map(dom => {
              const isExpanded = expandedDomainId === dom.id;
              const domProjects = projects.filter(p => p.domainId === dom.id);

              return (
                <div key={dom.id}>
                  {/* Collapsed row */}
                  <div
                    onClick={() => setExpandedDomainId(isExpanded ? null : dom.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "14px 0",
                      borderBottom: isExpanded ? "none" : "1px solid var(--border2)",
                      cursor: "pointer", minHeight: 52, boxSizing: "border-box",
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: dom.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{dom.name}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      style={{ color: "var(--text3)", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s", flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {/* Expanded area */}
                  <div style={{
                    maxHeight: isExpanded ? 600 : 0, overflow: "hidden",
                    transition: "max-height 0.2s ease",
                  }}>
                    <div style={{ padding: "12px 0 16px 0" }}>
                      {/* Name input */}
                      <DomainNameInput domain={dom} onSave={saveDomainName} />

                      {/* Color picker */}
                      <div style={{ display: "flex", gap: 10, marginTop: 12, marginBottom: 16 }}>
                        {COLORS.map(col => (
                          <div key={col} onClick={() => saveDomainColor(dom.id, col)}
                            style={{
                              width: 28, height: 28, borderRadius: "50%", background: col, cursor: "pointer",
                              border: dom.color === col ? "2px solid #fff" : "2px solid transparent",
                              transform: dom.color === col ? "scale(1.15)" : "scale(1)",
                              transition: "transform .1s, border-color .1s",
                            }}
                          />
                        ))}
                      </div>

                      {/* Projects under this domain */}
                      {domProjects.map(p => (
                        <div key={p.id} style={{ position: "relative", overflow: "hidden", borderRadius: 6, margin: "4px 0" }}>
                          {/* Delete reveal */}
                          <div style={{
                            position: "absolute", right: 0, top: 0, bottom: 0, width: 72,
                            background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                          }} onClick={() => deleteProject(p.id)}>
                            Delete
                          </div>
                          {/* Sliding content */}
                          <div
                            onTouchStart={e => onProjTouchStart(p.id, e)}
                            onTouchMove={onProjTouchMove}
                            onTouchEnd={onProjTouchEnd}
                            onClick={() => { if (projSwipeId === p.id && projSwipeX < -40) { setProjSwipeId(null); setProjSwipeX(0); } }}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                              background: "var(--bg2)", position: "relative", zIndex: 1,
                              transform: projSwipeId === p.id ? `translateX(${projSwipeX}px)` : "translateX(0)",
                              transition: projSwipeStart.current ? "none" : "transform .2s ease",
                            }}
                          >
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: dom.color, flexShrink: 0 }} />
                            <ProjectNameInput project={p} onSave={saveProjectName} />
                          </div>
                        </div>
                      ))}

                      {domProjects.length === 0 && (
                        <div style={{ fontSize: 13, color: "var(--text3)", padding: "4px 0" }}>No projects</div>
                      )}

                      {/* Delete domain */}
                      <div style={{ textAlign: "right", marginTop: 12 }}>
                        <span onClick={() => deleteDomain(dom.id)}
                          style={{ fontSize: 13, color: "var(--red)", cursor: "pointer", fontWeight: 500 }}>
                          Delete Domain
                        </span>
                      </div>
                    </div>
                    {/* Divider after expanded content */}
                    <div style={{ borderBottom: "1px solid var(--border2)" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── SECTION 3: ADD DOMAIN ── */}
          <div style={{ padding: "0 20px" }}>
            <div
              onClick={() => {
                setShowAddDomain(true);
                setNewDomainName("");
                setNewDomainColor(COLORS[0]);
                setTimeout(() => addDomainInputRef.current?.focus(), 50);
              }}
              style={{
                fontSize: 14, color: "var(--accent)", fontWeight: 500, cursor: "pointer",
                marginTop: 20, padding: "12px 0",
              }}
            >+ Add Domain</div>

            {showAddDomain && (
              <div style={{ paddingBottom: 16 }}>
                <input
                  ref={addDomainInputRef}
                  value={newDomainName}
                  onChange={e => setNewDomainName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleAddDomain();
                    if (e.key === "Escape") { setShowAddDomain(false); setNewDomainName(""); }
                  }}
                  onBlur={() => { if (!newDomainName.trim()) { setShowAddDomain(false); setNewDomainName(""); } }}
                  placeholder="Domain name"
                  style={{
                    width: "100%", background: "var(--bg3)", border: "none", borderRadius: 10,
                    padding: 12, color: "var(--text)", fontSize: 14, fontFamily: "'DM Sans',sans-serif",
                    outline: "none", marginBottom: 12, boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  {COLORS.map(col => (
                    <div key={col} onClick={() => setNewDomainColor(col)}
                      style={{
                        width: 28, height: 28, borderRadius: "50%", background: col, cursor: "pointer",
                        border: newDomainColor === col ? "2px solid #fff" : "2px solid transparent",
                        transform: newDomainColor === col ? "scale(1.15)" : "scale(1)",
                        transition: "transform .1s, border-color .1s",
                      }}
                    />
                  ))}
                </div>
                <span onClick={handleAddDomain}
                  style={{
                    display: "inline-block", background: "var(--accent)", color: "#000",
                    fontSize: 13, fontWeight: 700, borderRadius: 20, padding: "6px 16px",
                    cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                  }}>+ Add</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

// ── Inline editable domain name ──
function DomainNameInput({ domain, onSave }) {
  const [val, setVal] = useState(domain.name);
  const commit = () => { if (val.trim()) onSave(domain.id, val); };
  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") { commit(); e.target.blur(); } }}
      style={{
        width: "100%", background: "var(--bg3)", border: "none", borderRadius: 10,
        padding: 12, color: "var(--text)", fontSize: 14, fontFamily: "'DM Sans',sans-serif",
        outline: "none", boxSizing: "border-box",
      }}
    />
  );
}

// ── Inline editable project name ──
function ProjectNameInput({ project, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(project.name);
  const commit = () => { if (val.trim()) onSave(project.id, val); setEditing(false); };

  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { commit(); } if (e.key === "Escape") { setVal(project.name); setEditing(false); } }}
        onClick={e => e.stopPropagation()}
        style={{
          flex: 1, background: "var(--bg3)", border: "none", borderRadius: 6,
          padding: "4px 8px", color: "var(--text)", fontSize: 14, fontFamily: "'DM Sans',sans-serif",
          outline: "none",
        }}
      />
    );
  }
  return (
    <span
      onClick={e => { e.stopPropagation(); setVal(project.name); setEditing(true); }}
      style={{ flex: 1, fontSize: 14, color: "var(--text2)", cursor: "text" }}
    >{project.name}</span>
  );
}

export default ProjectsManageSheet;
