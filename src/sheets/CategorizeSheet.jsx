import { useState } from "react";
import useSwipeDown from "../useSwipeDown.js";

function CategorizeSheet({ data, onClose, onCategorize, onDismiss, onDoToday }) {
  const swipe = useSwipeDown(onClose);
  const { inbox, projects, domains } = data;

  // assignments: { [itemId]: projectId | "today" | "dismiss" }
  const [assignments, setAssignments] = useState({});

  const activeProjects = projects.filter(p => p.status === "active");
  const assignedCount = Object.keys(assignments).length;

  const assign = (itemId, value) => setAssignments(prev => {
    // Toggle off if tapping same value again
    if (prev[itemId] === value) { const n = {...prev}; delete n[itemId]; return n; }
    return { ...prev, [itemId]: value };
  });

  const commitAll = () => {
    Object.entries(assignments).forEach(([itemId, value]) => {
      if (value === "today") onDoToday(itemId);
      else if (value === "dismiss") onDismiss(itemId);
      else onCategorize(itemId, value, false);
    });
    if (assignedCount === inbox.length) onClose();
  };

  if (!inbox.length) return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Captured</div>
        <div className="inbox-empty">✓ Nothing left to categorize</div>
      </div>
    </>
  );

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div style={{ padding:"14px 20px 10px", display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
          <div className="sheet-title" style={{ margin:0 }}>Categorize</div>
          <div style={{ fontSize:12, color:"var(--text3)" }}>{inbox.length} item{inbox.length!==1?"s":""}</div>
        </div>
        <div className="sheet-scroll" style={{ paddingBottom:100 }}>
          {inbox.map(item => {
            const pickedId = assignments[item.id];
            return (
              <div key={item.id} style={{ marginBottom:14, background:"var(--bg2)", borderRadius:16, border: pickedId ? "1.5px solid var(--border)" : "1px solid var(--border)", overflow:"hidden" }}>
                {/* Item text */}
                <div style={{ padding:"12px 14px 8px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                  <span style={{ fontSize:15, fontWeight:600, color: pickedId ? "var(--text2)" : "var(--text)", lineHeight:1.4, flex:1 }}>{item.text}</span>
                  {pickedId && (
                    <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:5 }}>
                      {pickedId === "today" && <span style={{ fontSize:11, fontWeight:700, color:"var(--accent)" }}>Today</span>}
                      {pickedId === "dismiss" && <span style={{ fontSize:11, fontWeight:700, color:"var(--text3)" }}>Dismiss</span>}
                      {pickedId !== "today" && pickedId !== "dismiss" && (() => {
                        const p = projects.find(p => p.id === pickedId);
                        const dom = domains.find(d => d.id === p?.domainId);
                        return <span style={{ fontSize:11, fontWeight:700, color: dom?.color||"var(--text3)" }}>→ {p?.name}</span>;
                      })()}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </div>

                {/* Project grid — always visible, tiles show selected state */}
                <div style={{ padding:"0 10px 10px" }}>
                  {/* Do Today pill */}
                  <div onClick={() => assign(item.id, "today")}
                    style={{ marginBottom:8, borderRadius:22, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer",
                      background: pickedId === "today" ? "var(--accent)" : "var(--accent-s)",
                      color: pickedId === "today" ? "#000" : "var(--accent)",
                      border: pickedId === "today" ? "none" : "1.5px solid rgba(232,160,48,.3)",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                    {pickedId === "today" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#000" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    Do Today
                  </div>

                  {/* 2-col project grid */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                    {activeProjects.map(p => {
                      const dom = domains.find(d => d.id === p.domainId);
                      const isSelected = pickedId === p.id;
                      return (
                        <div key={p.id} onClick={() => assign(item.id, p.id)}
                          style={{ borderRadius:11, padding:"9px 11px", cursor:"pointer", display:"flex", flexDirection:"column", gap:3,
                            background: isSelected ? (dom?.color ? dom.color+"22" : "var(--bg3)") : "var(--bg3)",
                            border: isSelected ? `1.5px solid ${dom?.color||"var(--accent)"}` : "1.5px solid var(--border2)",
                            transition:"border-color .12s, background .12s" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:7, height:7, borderRadius:"50%", background:dom?.color||"var(--text3)", flexShrink:0 }} />
                            <span style={{ fontSize:12, fontWeight:700, color: isSelected ? "var(--text)" : "var(--text)", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
                            {isSelected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ marginLeft:"auto", flexShrink:0 }}><path d="M20 6L9 17l-5-5" stroke={dom?.color||"var(--accent)"} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <div style={{ fontSize:10, color:"var(--text3)", paddingLeft:13 }}>{dom?.name}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dismiss link */}
                  <div onClick={() => assign(item.id, "dismiss")}
                    style={{ marginTop:8, textAlign:"center", fontSize:11, color: pickedId === "dismiss" ? "var(--red)" : "var(--text3)", cursor:"pointer", padding:"4px 0", fontWeight: pickedId === "dismiss" ? 700 : 400 }}>
                    Dismiss
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Single confirm bar — sticky at bottom */}
        {assignedCount > 0 && (
          <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"12px 16px 28px", background:"linear-gradient(to bottom, transparent, var(--bg2) 30%)", pointerEvents:"none" }}>
            <button onClick={commitAll}
              style={{ width:"100%", background:"var(--accent)", border:"none", borderRadius:22, padding:"13px", fontSize:15, fontWeight:800, color:"#000", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", pointerEvents:"all" }}>
              Confirm {assignedCount} {assignedCount === 1 ? "assignment" : "assignments"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default CategorizeSheet;
