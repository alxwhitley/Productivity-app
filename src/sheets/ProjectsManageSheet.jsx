import { useState } from "react";
import { DOMAIN_COLORS } from "../constants.js";
import { uid } from "../utils.js";
import useSwipeDown from "../useSwipeDown.js";

function ProjectsManageSheet({ data, setData, onClose, onAddProject }) {
  const swipe = useSwipeDown(onClose);
  const { domains, projects } = data;
  const COLORS = DOMAIN_COLORS;

  // ── Categories state ──
  const [catEdits, setCatEdits] = useState(domains.map(d => ({ ...d })));
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLORS[0]);

  // ── Project edits ──
  const [projEdits, setProjEdits] = useState(projects.map(p => ({ id: p.id, name: p.name, domainId: p.domainId })));

  const updateCat = (id, field, val) => setCatEdits(cs => cs.map(c => c.id === id ? { ...c, [field]: val } : c));

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name || catEdits.length >= 4) return;
    const newCat = { id: uid(), name, color: newCatColor };
    setCatEdits(cs => [...cs, newCat]);
    setNewCatName("");
  };

  const removeCat = (id) => setCatEdits(cs => cs.filter(c => c.id !== id));

  const updateProjEdit = (id, field, val) => setProjEdits(ps => ps.map(p => p.id === id ? { ...p, [field]: val } : p));

  const saveAll = () => {
    setData(d => ({
      ...d,
      domains: catEdits,
      projects: d.projects.map(p => {
        const edit = projEdits.find(e => e.id === p.id);
        return edit ? { ...p, name: edit.name, domainId: edit.domainId } : p;
      })
    }));
    onClose();
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Manage Projects</div>
        <div className="sheet-scroll">

          {/* ── CATEGORIES ── */}
          <div className="sh" style={{ paddingTop: 8 }}>
            <span className="sh-label">Categories</span>
          </div>
          {catEdits.map((c, i) => (
            <div key={c.id} style={{ padding: "10px 20px", borderBottom: "1px solid var(--border2)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ width:22, height:22, borderRadius:"50%", background:c.color, flexShrink:0, boxShadow: `0 0 0 2px var(--bg2), 0 0 0 3.5px ${c.color}` }} />
                <input className="pm-proj-name" style={{ flex:1 }} value={c.name} onChange={e => updateCat(c.id,"name",e.target.value)} />
                <button style={{ background:"none", border:"none", color:"var(--red)", fontSize:13, cursor:"pointer", padding:"0 4px", fontFamily:"'DM Sans',sans-serif", fontWeight:500 }} onClick={() => removeCat(c.id)}>Remove</button>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingLeft:30 }}>
                {COLORS.map(col => (
                  <div key={col} onClick={() => updateCat(c.id,"color",col)}
                    style={{ width:22, height:22, borderRadius:"50%", background:col, cursor:"pointer", boxShadow: c.color===col ? `0 0 0 2px var(--bg2), 0 0 0 3.5px ${col}` : "none", transition:"box-shadow .1s" }} />
                ))}
              </div>
            </div>
          ))}
          {catEdits.length < 4 && (
            <div style={{ padding: "12px 20px" }}>
              <input className="set-input" placeholder="New category name…" value={newCatName} onChange={e => setNewCatName(e.target.value)} style={{ marginBottom:8 }} />
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                {COLORS.map(col => (
                  <div key={col} onClick={() => setNewCatColor(col)}
                    style={{ width:22, height:22, borderRadius:"50%", background:col, cursor:"pointer", boxShadow: newCatColor===col ? `0 0 0 2px var(--bg2), 0 0 0 3.5px ${col}` : "none", transition:"box-shadow .1s" }} />
                ))}
              </div>
              <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600, cursor:"pointer" }} onClick={addCategory}>+ Add Category</span>
            </div>
          )}

          {/* ── ADD PROJECT ── */}
          {onAddProject && (
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border2)" }}>
              <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600, cursor:"pointer" }} onClick={() => { onClose(); setTimeout(() => onAddProject(), 100); }}>+ Add Project</span>
            </div>
          )}

          {/* ── EDIT EXISTING PROJECTS ── */}
          <div className="sh" style={{ paddingTop: 16 }}>
            <span className="sh-label">Projects</span>
          </div>
          {projEdits.map(pe => {
            const dom = catEdits.find(c => c.id === pe.domainId);
            return (
              <div key={pe.id} className="pm-proj-row" style={{ borderBottom: "1px solid var(--border2)" }}>
                <div className="pm-proj-swatch" style={{ background: dom?.color }} />
                <input className="pm-proj-name" value={pe.name} onChange={e => updateProjEdit(pe.id,"name",e.target.value)} />
                <select style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:7, padding:"5px 8px", color:"var(--text)", fontFamily:"'DM Sans',sans-serif", fontSize:16, outline:"none" }}
                  value={pe.domainId} onChange={e => updateProjEdit(pe.id,"domainId",e.target.value)}>
                  {catEdits.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            );
          })}

          <div style={{ padding: "16px 20px", textAlign: "center" }}>
            <span style={{ fontSize:14, color:"var(--accent)", fontWeight:600, cursor:"pointer" }} onClick={saveAll}>Save All Changes</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProjectsManageSheet;
