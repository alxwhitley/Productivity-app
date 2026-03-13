import { useState } from "react";
import { uid } from "../utils.js";
import StatusBar from "../components/StatusBar.jsx";
import WaveIcon from "../components/WaveIcon.jsx";

function getQuarterLabel() {
  const m = new Date().getMonth();
  const q = Math.floor(m / 3) + 1;
  const seasons = ["Winter","Spring","Summer","Fall"];
  return `Q${q} · ${seasons[Math.floor(m/3)]} ${new Date().getFullYear()}`;
}

export default function SeasonScreen({ data, setData }) {
  const { domains, projects, seasonGoals = [], reviewData = {} } = data;
  const domainBlocks = reviewData.domainBlocks || {};
  const [newText, setNewText]       = useState("");
  const [newDomainId, setNewDomainId] = useState(domains[0]?.id || "");
  const today     = new Date();
  const months    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const totalTasks = projects.reduce((s,p) => s + p.tasks.filter(t=>t.done).length, 0);
  const totalDW    = Object.values(domainBlocks).reduce((a,b)=>a+b,0);
  const maxBlocks  = Math.max(...Object.values(domainBlocks), 1);
  const getDomain  = id => domains.find(d => d.id === id);

  const toggleGoal = id => setData(d => ({
    ...d, seasonGoals: (d.seasonGoals||[]).map(g => g.id===id ? { ...g, done: !g.done } : g)
  }));
  const deleteGoal = id => setData(d => ({
    ...d, seasonGoals: (d.seasonGoals||[]).filter(g => g.id!==id)
  }));
  const addGoal = () => {
    const text = newText.trim();
    if (!text) return;
    if ((data.seasonGoals||[]).length >= 4) return;
    setData(d => ({
      ...d, seasonGoals: [...(d.seasonGoals||[]), { id: uid(), text, domainId: newDomainId, done: false }]
    }));
    setNewText("");
  };

  const doneCount = seasonGoals.filter(g=>g.done).length;

  return (
    <div className="screen active">
      <StatusBar />
      <div className="ph">
        <div className="ph-eye">{getQuarterLabel()}</div>
        <div className="ph-title">Season</div>
      </div>
      <div className="scroll">
        {/* Season hero */}
        <div className="season-hero">
          <div className="sh-title">
            {doneCount === seasonGoals.length && seasonGoals.length > 0
              ? "Season complete"
              : `${seasonGoals.length - doneCount} goal${seasonGoals.length - doneCount !== 1 ? "s" : ""} in motion`}
          </div>
          <div className="sh-sub">
            {seasonGoals.length === 0
              ? "Set up to 4 big goals for this quarter."
              : doneCount === seasonGoals.length
                ? `All ${seasonGoals.length} goals complete this quarter.`
                : `${doneCount} of ${seasonGoals.length} complete · ${getQuarterLabel()}`}
          </div>
        </div>

        {/* Season goals list */}
        <div className="sh"><span className="sh-label">Season Goals</span></div>
        <div className="sg-card">
          {seasonGoals.length === 0 && (
            <div style={{ padding: "14px 18px", fontSize: 13, color: "var(--text3)" }}>
              No goals yet — add up to 4 below.
            </div>
          )}
          {seasonGoals.map(g => {
            const domain = getDomain(g.domainId);
            return (
              <div key={g.id} className="sg-row">
                <div className="sg-stripe" style={{ background: domain?.color || "var(--bg4)" }} />
                <div className="sg-body">
                  <div className={`sg-text ${g.done ? "done" : ""}`}>{g.text}</div>
                  <div className="sg-domain">{domain?.name || "—"}</div>
                </div>
                <div className={`sg-check ${g.done ? "checked" : ""}`} onClick={() => toggleGoal(g.id)}>✓</div>
                <button className="sg-del" onClick={() => deleteGoal(g.id)}>✕</button>
              </div>
            );
          })}
          {seasonGoals.length < 4 && (
            <div className="add-goal-row">
              <input
                className="add-goal-input"
                placeholder="Add a season goal…"
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addGoal()}
              />
              <select
                className="add-goal-domain"
                value={newDomainId}
                onChange={e => setNewDomainId(e.target.value)}
              >
                {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className="add-goal-btn" onClick={addGoal}>Add</button>
            </div>
          )}
        </div>

        {/* Divider between Season and Review */}
        <div className="season-divider">
          <div className="sdiv-line" />
          <span className="sdiv-label">Week Review</span>
          <div className="sdiv-line" />
        </div>

        {/* Review stats below */}
        <div className="stats-row">
          <div className="stat-box"><div className="stat-n">{totalTasks}</div><div className="stat-lbl">Tasks completed</div></div>
          <div className="stat-box"><div className="stat-n">{totalDW}</div><div className="stat-lbl">Deep work blocks</div></div>
        </div>
        <div className="sh"><span className="sh-label">Domain Coverage</span></div>
        <div className="cov-card">
          {domains.map(d => {
            const count = domainBlocks[d.id] || 0;
            return (
              <div key={d.id} className="cov-row">
                <div className="cov-dot" style={{ background: d.color }} />
                <span className="cov-name">{d.name}</span>
                <div className="cov-bar-wrap"><div className="cov-bar-fill" style={{ width: `${(count/maxBlocks)*100}%`, background: d.color }} /></div>
                <span className={`cov-ct ${count===0?"cov-zero":""}`}>{count} {count===1?"block":"blocks"}</span>
              </div>
            );
          })}
        </div>

        {/* Deep Work this week — bar chart */}
        {(() => {
          const completions = data.blockCompletions || [];
          const now = new Date();
          const dayOfWeek = now.getDay();
          const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); weekStart.setHours(0,0,0,0);
          const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
          const weeklyTarget = data.deepWorkTargets?.weeklyHours || 20;
          const dailyTarget = data.deepWorkTargets?.dailyHours || 4;
          const bars = days.map((label, i) => {
            const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
            const dStr = d.toDateString();
            const mins = completions.filter(c => c.date === dStr).reduce((s,c) => s + (c.durationMin||60), 0);
            const hrs = mins / 60;
            const isToday = dStr === now.toDateString();
            const isPast = d < now && !isToday;
            return { label, hrs, isToday, isPast };
          });
          const weekTotal = bars.reduce((s,b) => s + b.hrs, 0);
          const maxBar = Math.max(...bars.map(b => b.hrs), dailyTarget);
          return (
            <div style={{ margin:"0 16px 8px", padding:"16px", background:"var(--bg2)", borderRadius:16, border:"1px solid var(--border)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>Deep Work This Week</div>
                <div style={{ fontSize:12, color: weekTotal >= weeklyTarget ? "var(--green)" : "var(--text3)", fontWeight:600 }}>
                  {weekTotal % 1 === 0 ? weekTotal : weekTotal.toFixed(1)} / {weeklyTarget}h
                </div>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:72 }}>
                {bars.map(({ label, hrs, isToday, isPast }) => {
                  const pct = hrs / maxBar;
                  const atTarget = hrs >= dailyTarget;
                  return (
                    <div key={label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, height:"100%" }}>
                      <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
                        <div style={{ width:"100%", borderRadius:4, height: hrs > 0 ? `${Math.max(pct*100,6)}%` : "4%", background: atTarget ? "var(--green)" : isToday ? "var(--accent)" : isPast && hrs === 0 ? "var(--bg4)" : "rgba(232,160,48,.35)", opacity: isPast && hrs === 0 ? .4 : 1, transition:"height .3s" }} />
                      </div>
                      <div style={{ fontSize:10, color: isToday ? "var(--accent)" : "var(--text3)", fontWeight: isToday ? 700 : 400 }}>{label}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize:10, color:"var(--text3)", marginTop:6, textAlign:"right" }}>Daily target: {dailyTarget}h · Weekly: {weeklyTarget}h</div>
            </div>
          );
        })()}

        {/* Session projects — season summary */}
        {(() => {
          const sessionProjects = (data.projects || []).filter(p => p.mode === "sessions");
          if (sessionProjects.length === 0) return null;
          const sessionLog = data.sessionLog || [];
          const quarterStart = new Date(); quarterStart.setMonth(Math.floor(quarterStart.getMonth()/3)*3, 1); quarterStart.setHours(0,0,0,0);
          return (
            <>
              <div className="sh"><span className="sh-label">Session Work</span></div>
              <div style={{ margin:"0 16px 16px", background:"var(--bg2)", borderRadius:14, border:"1px solid var(--border2)", overflow:"hidden" }}>
                {sessionProjects.map((p, i) => {
                  const domain = (data.domains||[]).find(d => d.id === p.domainId);
                  const projSessions = sessionLog.filter(s => s.projectId === p.id && new Date(s.date) >= quarterStart);
                  const totalMins = projSessions.reduce((a,s) => a + (s.durationMin||0), 0);
                  const totalHrs = (totalMins/60).toFixed(1);
                  return (
                    <div key={p.id} style={{ padding:"12px 16px", borderBottom: i < sessionProjects.length-1 ? "1px solid var(--border2)" : "none" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background: domain?.color || "var(--blue)", flexShrink:0 }} />
                          <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{p.name}</span>
                          <WaveIcon size={12} color={domain?.color || "var(--blue)"} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color: domain?.color || "var(--blue)" }}>{totalHrs}h</span>
                      </div>
                      <div style={{ fontSize:11, color:"var(--text3)" }}>{projSessions.length} session{projSessions.length !== 1 ? "s" : ""} this season · {domain?.name}</div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        <div className="spacer" />
      </div>
    </div>
  );
}
