import { useState } from "react";
import useSwipeDown from "../useSwipeDown.js";

const SD_ITEMS = [
  "Reviewed tomorrow's calendar",
  "Captured all loose tasks",
  "No urgent emails unaddressed",
  "Mind cleared — nothing left open",
];

function ShutdownSheet({ onClose, onComplete, alreadyDone, data, onCategorizeLoose }) {
  const swipe = useSwipeDown(onClose);
  const [checked, setChecked] = useState(alreadyDone ? [0,1,2,3] : []);
  const { projects, domains } = data;

  // Today's date
  const todayStr = new Date().toDateString();
  const todayISO = new Date().toISOString().slice(0,10);

  // Loose tasks picked for today that are still undone
  const todayPickIds = (data.todayLoosePicks || {})[todayISO] || [];
  const undoneToday = todayPickIds
    .map(id => (data.looseTasks||[]).find(t => t.id === id))
    .filter(t => t && !t.done);

  // Uncategorized loose tasks (no domain) added today but NOT in today picks
  const uncategorized = (data.looseTasks || []).filter(t =>
    !t.done && t.domainId === null && t.createdAt && new Date(t.createdAt).toDateString() === todayStr
    && !todayPickIds.includes(t.id)
  );

  // All tasks needing attention in shutdown = undone today picks + uncategorized
  const needsAttention = [...undoneToday, ...uncategorized.filter(t => !undoneToday.find(u => u.id === t.id))];

  const [localDomains, setLocalDomains] = useState(() => {
    const m = {};
    needsAttention.forEach(t => { m[t.id] = t.domainId || null; });
    return m;
  });
  const allCategorized = needsAttention.every(t => localDomains[t.id] !== null && localDomains[t.id] !== undefined);
  const assignDomain = (taskId, domainId) => {
    setLocalDomains(m => ({ ...m, [taskId]: domainId }));
    onCategorizeLoose(taskId, domainId);
  };

  const allDone = checked.length === SD_ITEMS.length && (needsAttention.length === 0 || allCategorized);

  const toggle = i => setChecked(p => p.includes(i) ? p.filter(x=>x!==i) : [...p, i]);

  const getProject = id => projects.find(p => p.id === id);
  const getDomain  = id => domains.find(d => d.id === id);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Shutdown Ritual</div>
        <div className="sheet-sub">Close out your workday with intention.</div>
        <div className="sheet-scroll">

          {/* Deep work summary */}
          {(() => {
            const todayStr = new Date().toDateString();
            const completions = data.blockCompletions || [];
            const todayMins = completions.filter(c => c.date === todayStr).reduce((s,c) => s + (c.durationMin||60), 0);
            const todayHrs = todayMins / 60;
            const dailyTarget = data.deepWorkTargets?.dailyHours || 4;
            const pct = Math.min(todayHrs / dailyTarget, 1);
            const now = new Date();
            const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
            const weekHrs = completions.filter(c => new Date(c.date) >= weekStart).reduce((s,c) => s + (c.durationMin||60), 0) / 60;
            const weeklyTarget = data.deepWorkTargets?.weeklyHours || 20;
            return (
              <div style={{ background:"var(--bg3)", borderRadius:12, padding:"12px 14px", marginBottom:14, border:"1px solid var(--border)" }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Deep Work Today</div>
                <div style={{ display:"flex", gap:12, marginBottom:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:18, fontWeight:700, color: pct>=1 ? "var(--green)" : "var(--text)", lineHeight:1 }}>
                      {todayHrs%1===0 ? todayHrs : todayHrs.toFixed(1)}<span style={{ fontSize:11, color:"var(--text3)", marginLeft:2 }}>/ {dailyTarget}h</span>
                    </div>
                    <div style={{ fontSize:10, color:"var(--text3)", marginTop:2 }}>today</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:18, fontWeight:700, color: weekHrs>=weeklyTarget ? "var(--green)" : "var(--text)", lineHeight:1 }}>
                      {weekHrs%1===0 ? weekHrs : weekHrs.toFixed(1)}<span style={{ fontSize:11, color:"var(--text3)", marginLeft:2 }}>/ {weeklyTarget}h</span>
                    </div>
                    <div style={{ fontSize:10, color:"var(--text3)", marginTop:2 }}>this week</div>
                  </div>
                </div>
                <div style={{ height:4, borderRadius:2, background:"var(--bg4)", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct*100}%`, borderRadius:2, background: pct>=1 ? "var(--green)" : "var(--accent)", transition:"width .4s" }} />
                </div>
                {pct >= 1 && <div style={{ fontSize:11, color:"var(--green)", marginTop:5, fontWeight:600 }}>Daily target hit ✓</div>}
              </div>
            );
          })()}

          {/* steps 1–4 */}
          {SD_ITEMS.map((item,i) => (
            <div key={i} className="sd-item" onClick={() => toggle(i)}>
              <div className={`sd-box ${checked.includes(i)?"done":""}`} />
              <span className="sd-item-txt">{item}</span>
            </div>
          ))}


                    {/* UNFINISHED TODAY PICKS + UNCATEGORIZED LOOSE TASKS */}
          {needsAttention.length > 0 && (
            <div style={{ margin:"4px 0 14px" }}>
              <div style={{ height:1, background:"var(--border2)", marginBottom:14 }} />
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{
                  width:20, height:20, borderRadius:6, flexShrink:0,
                  background: allCategorized ? "var(--green)" : "rgba(232,160,48,0.15)",
                  border: allCategorized ? "none" : "1.5px solid rgba(232,160,48,0.5)",
                  display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s",
                }}>
                  {allCategorized
                    ? <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>
                    : <span style={{fontSize:10,color:"var(--accent)",fontWeight:700}}>{needsAttention.filter(t => !localDomains[t.id]).length}</span>
                  }
                </div>
                <span style={{ fontSize:14, color:"var(--text)", fontWeight:500 }}>
                  Assign unfinished tasks to a domain
                </span>
              </div>
              <div style={{ marginLeft:28, display:"flex", flexDirection:"column", gap:8 }}>
                {needsAttention.map(task => {
                  const assigned = localDomains[task.id];
                  const isFromToday = todayPickIds.includes(task.id);
                  return (
                    <div key={task.id} style={{ background:"var(--bg3)", borderRadius:12, padding:"12px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                        {isFromToday && (
                          <span style={{ fontSize:10, fontWeight:700, color:"var(--accent)", background:"rgba(232,160,48,.1)", border:"1px solid rgba(232,160,48,.25)", borderRadius:6, padding:"2px 6px", flexShrink:0 }}>Today</span>
                        )}
                        <div style={{ fontSize:13, color:"var(--text)", fontWeight:500 }}>{task.text}</div>
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {domains.map(d => (
                          <button key={d.id} onClick={() => assignDomain(task.id, d.id)}
                            style={{
                              display:"flex", alignItems:"center", gap:5,
                              padding:"5px 11px", borderRadius:20,
                              border: assigned === d.id ? `1.5px solid ${d.color}` : "1.5px solid var(--border)",
                              background: assigned === d.id ? `${d.color}22` : "var(--bg4)",
                              color: assigned === d.id ? d.color : "var(--text2)",
                              fontSize:12, fontWeight:600, cursor:"pointer",
                              fontFamily:"'DM Sans',sans-serif", transition:"all .12s",
                            }}
                          >
                            <span style={{ width:6, height:6, borderRadius:"50%", background:d.color, flexShrink:0, display:"inline-block" }} />
                            {d.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* COMPLETED SINCE LAST SHUTDOWN */}
          {(() => {
            // Show tasks completed since the last shutdown (or beginning of today if never shut down)
            const lastShutdown = data.shutdownDate ? new Date(data.shutdownDate + "T00:00:00") : null;
            const isAfterShutdown = (dateVal) => {
              if (!dateVal) return false;
              const d = new Date(dateVal);
              if (lastShutdown) return d > lastShutdown;
              // No prior shutdown — show anything completed today
              return d.toDateString() === new Date().toDateString();
            };
            const completed = [];
            projects.forEach(proj => {
              const dom = domains.find(d => d.id === proj.domainId);
              proj.tasks.forEach(t => {
                if (t.done && isAfterShutdown(t.doneAt)) {
                  completed.push({ text: t.text, projName: proj.name, color: dom?.color });
                }
              });
            });
            (data.looseTasks || []).filter(t => t.done && isAfterShutdown(t.doneAt)).forEach(t => {
              const dom = domains.find(d => d.id === t.domainId);
              completed.push({ text: t.text, projName: dom?.name || "Loose tasks", color: dom?.color });
            });

            if (!completed.length) return null;
            return (
              <div style={{ margin:"16px 0 8px" }}>
                <div style={{ height:1, background:"var(--border2)", marginBottom:16 }} />
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:".09em", textTransform:"uppercase", color:"var(--text3)", marginBottom:4 }}>
                  Completed This Session
                </div>
                <div style={{ fontSize:22, fontWeight:700, color:"var(--text)", marginBottom:12 }}>
                  {completed.length} task{completed.length !== 1 ? "s" : ""} done
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {completed.map((t, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--bg3)", borderRadius:10 }}>
                      <div style={{ width:3, alignSelf:"stretch", borderRadius:2, background: t.color || "var(--border)", flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:"var(--text)", textDecoration:"line-through", opacity:.7 }}>{t.text}</div>
                        <div style={{ fontSize:11, color:"var(--text3)", marginTop:1 }}>{t.projName}</div>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <button
            className="sd-btn"
            disabled={!allDone}
            onClick={() => { onComplete(); onClose(); }}
          >
            {allDone ? "Shutdown Complete ✓" : `${checked.length} of ${SD_ITEMS.length} complete`}
          </button>

        </div>
      </div>
    </>
  );
}

export default ShutdownSheet;
