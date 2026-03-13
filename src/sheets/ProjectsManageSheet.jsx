import { useState } from "react";
import { DOMAIN_COLORS } from "../constants.js";
import { uid } from "../utils.js";
import useSwipeDown from "../useSwipeDown.js";

function ProjectsManageSheet({ data, setData, onClose }) {
  const swipe = useSwipeDown(onClose);
  const { domains, projects } = data;
  const COLORS = DOMAIN_COLORS;

  // ── Categories state ──
  const [catEdits, setCatEdits] = useState(domains.map(d => ({ ...d })));
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLORS[0]);

  // ── New project state ──
  const [newProjName, setNewProjName] = useState("");
  const [newProjDomain, setNewProjDomain] = useState(domains[0]?.id || "");
  const [newProjColor, setNewProjColor] = useState("");

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

  const addProject = () => {
    const name = newProjName.trim();
    if (!name || !newProjDomain) return;
    const newP = { id: uid(), domainId: newProjDomain, name, status: "active", tasks: [] };
    setData(d => ({ ...d, projects: [...d.projects, newP] }));
    setNewProjName("");
  };

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
          <div className="set-section">Categories</div>
          {catEdits.map(c => (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ width:12, height:12, borderRadius:"50%", background:c.color, flexShrink:0 }} />
                <input className="pm-proj-name" style={{ flex:1 }} value={c.name} onChange={e => updateCat(c.id,"name",e.target.value)} />
                <button style={{ background:"none", border:"none", color:"var(--red)", fontSize:16, cursor:"pointer", padding:"0 4px" }} onClick={() => removeCat(c.id)}>✕</button>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingLeft:20 }}>
                {COLORS.map(col => (
                  <div key={col} onClick={() => updateCat(c.id,"color",col)}
                    style={{ width:22, height:22, borderRadius:"50%", background:col, cursor:"pointer", border: c.color===col ? "2px solid #fff" : "2px solid transparent", transform: c.color===col ? "scale(1.2)" : "scale(1)", transition:"transform .1s" }} />
                ))}
              </div>
            </div>
          ))}
          {catEdits.length < 4 && (
            <div style={{ marginTop:8, background:"var(--bg3)", borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Add Category</div>
              <input className="set-input" placeholder="Category name…" value={newCatName} onChange={e => setNewCatName(e.target.value)} style={{ marginBottom:8 }} />
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                {COLORS.map(col => (
                  <div key={col} onClick={() => setNewCatColor(col)}
                    style={{ width:22, height:22, borderRadius:"50%", background:col, cursor:"pointer", border: newCatColor===col ? "2px solid #fff" : "2px solid transparent" }} />
                ))}
              </div>
              <button className="form-btn" style={{ marginTop:0 }} disabled={!newCatName.trim()} onClick={addCategory}>Add Category</button>
            </div>
          )}

          {/* ── ADD PROJECT ── */}
          <div className="set-section" style={{ marginTop:20 }}>Add New Project</div>
          <div style={{ background:"var(--bg3)", borderRadius:10, padding:"10px 12px" }}>
            <input className="set-input" placeholder="Project name…" value={newProjName} onChange={e => setNewProjName(e.target.value)} style={{ marginBottom:8 }} />
            <select className="form-select" value={newProjDomain} onChange={e => setNewProjDomain(e.target.value)} style={{ marginBottom:8 }}>
              {catEdits.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="form-btn" style={{ marginTop:0 }} disabled={!newProjName.trim()} onClick={addProject}>Add Project</button>
          </div>

          {/* ── EDIT EXISTING PROJECTS ── */}
          <div className="set-section" style={{ marginTop:20 }}>Edit Projects</div>
          {projEdits.map(pe => {
            const dom = catEdits.find(c => c.id === pe.domainId);
            return (
              <div key={pe.id} className="pm-proj-row">
                <div className="pm-proj-swatch" style={{ background: dom?.color }} />
                <input className="pm-proj-name" value={pe.name} onChange={e => updateProjEdit(pe.id,"name",e.target.value)} />
                <select style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:7, padding:"5px 8px", color:"var(--text)", fontFamily:"'DM Sans',sans-serif", fontSize:16, outline:"none" }}
                  value={pe.domainId} onChange={e => updateProjEdit(pe.id,"domainId",e.target.value)}>
                  {catEdits.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            );
          })}

          <button className="form-btn" style={{ marginTop:20 }} onClick={saveAll}>Save All Changes</button>
        </div>
      </div>
    </>
  );
}

export default ProjectsManageSheet;
