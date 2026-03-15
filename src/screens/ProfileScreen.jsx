import { useState } from "react";
import { toISODate } from "../utils.js";

export default function ProfileScreen({ data, setData, onClose }) {
  // ── This Week stats ──
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // Tasks completed this week (across all projects)
  let tasksCompleted = 0;
  (data.projects || []).forEach(proj => {
    proj.tasks.forEach(t => {
      if (t.done && t.doneAt) {
        const d = new Date(t.doneAt);
        if (d >= weekStart && d < weekEnd) tasksCompleted++;
      }
    });
  });

  // Deep work hours this week
  const deepWorkHours = data.deepWorkHours || {};
  let weekMinutes = 0;
  for (let d = new Date(weekStart); d < weekEnd; d.setDate(d.getDate() + 1)) {
    const key = toISODate(d);
    weekMinutes += deepWorkHours[key] || 0;
  }
  // Also count from blockCompletions as fallback
  const completions = data.blockCompletions || [];
  completions.forEach(c => {
    const cd = new Date(c.date);
    if (cd >= weekStart && cd < weekEnd) {
      weekMinutes += c.durationMin || 0;
    }
  });
  const weekHrs = weekMinutes / 60;

  // ── Settings state ──
  const [nameVal, setNameVal] = useState(data.todayPrefs?.name || "");
  const prefs = data.todayPrefs || { name: "", showShutdown: true, hideTimes: false, defaultBlock: "9" };

  const updatePref = (key, value) => {
    setData(d => ({
      ...d,
      todayPrefs: { ...(d.todayPrefs || {}), [key]: value },
    }));
  };

  return (
    <div className="profile-screen">
      {/* Header */}
      <div className="profile-header">
        <span className="profile-title">Profile</span>
        <button onClick={onClose}
          style={{ background:"none", border:"none", cursor:"pointer", padding:4, color:"var(--text3)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="scroll" style={{ padding:"0 0 40px" }}>
        {/* ── This Week ── */}
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--text3)", padding:"20px 16px 8px" }}>
          This Week
        </div>
        <div className="profile-stat-row">
          <div className="profile-stat-card">
            <div className="profile-stat-number">{tasksCompleted}</div>
            <div className="profile-stat-label">tasks completed</div>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-number">{weekHrs % 1 === 0 ? weekHrs : weekHrs.toFixed(1)}</div>
            <div className="profile-stat-label">hours of deep work</div>
          </div>
        </div>

        {/* ── Settings ── */}
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--text3)", padding:"16px 16px 8px" }}>
          Settings
        </div>
        <div style={{ padding:"0 16px" }}>
          {/* Name */}
          <div className="set-row">
            <div>
              <div className="set-row-label">Display Name</div>
              <div className="set-row-sub">Shown in your greeting</div>
            </div>
          </div>
          <input className="set-input"
            placeholder="Your name"
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={() => updatePref("name", nameVal.trim())}
            onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
          />

          {/* Show Shutdown */}
          <div className="set-row" style={{ marginTop:12 }}>
            <div>
              <div className="set-row-label">Shutdown Ritual</div>
              <div className="set-row-sub">End-of-day checklist</div>
            </div>
            <div className={`toggle-pill ${prefs.showShutdown !== false ? "on" : ""}`}
              onClick={() => updatePref("showShutdown", prefs.showShutdown === false)}>
              <div className="toggle-knob" />
            </div>
          </div>

          {/* Hide Times */}
          <div className="set-row">
            <div>
              <div className="set-row-label">Hide Block Times</div>
              <div className="set-row-sub">Show blocks without time labels</div>
            </div>
            <div className={`toggle-pill ${prefs.hideTimes ? "on" : ""}`}
              onClick={() => updatePref("hideTimes", !prefs.hideTimes)}>
              <div className="toggle-knob" />
            </div>
          </div>

          {/* Default First Block */}
          <div className="set-row" style={{ marginTop:12 }}>
            <div>
              <div className="set-row-label">Default First Block</div>
              <div className="set-row-sub">Start time for your first block</div>
            </div>
            <select className="form-select" style={{ width:"auto", minWidth:90 }}
              value={prefs.defaultBlock || "9"}
              onChange={e => updatePref("defaultBlock", e.target.value)}>
              {[5,6,7,8,9,10,11,12].map(h => (
                <option key={h} value={String(h)}>{h > 12 ? h-12 : h}:00 {h >= 12 ? "PM" : "AM"}</option>
              ))}
            </select>
          </div>

          {/* Deep Work Targets */}
          <div style={{ marginTop:16 }}>
            <div className="set-section">Deep Work Targets</div>
            <div style={{ display:"flex", gap:12 }}>
              <div style={{ flex:1 }}>
                <div className="set-row-sub" style={{ marginBottom:4 }}>Daily hours</div>
                <input className="set-input"
                  type="number" min="1" max="12"
                  value={data.deepWorkTargets?.dailyHours || 4}
                  onChange={e => setData(d => ({
                    ...d,
                    deepWorkTargets: { ...(d.deepWorkTargets || {}), dailyHours: parseInt(e.target.value) || 4 },
                  }))}
                />
              </div>
              <div style={{ flex:1 }}>
                <div className="set-row-sub" style={{ marginBottom:4 }}>Weekly hours</div>
                <input className="set-input"
                  type="number" min="1" max="60"
                  value={data.deepWorkTargets?.weeklyHours || 20}
                  onChange={e => setData(d => ({
                    ...d,
                    deepWorkTargets: { ...(d.deepWorkTargets || {}), weeklyHours: parseInt(e.target.value) || 20 },
                  }))}
                />
              </div>
            </div>
            <div style={{ marginTop:12 }}>
              <div className="set-row-sub" style={{ marginBottom:6 }}>Max deep work blocks per day</div>
              <div style={{ display:"flex", gap:8 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setData(d => ({
                    ...d,
                    deepWorkTargets: { ...(d.deepWorkTargets || {}), maxDeepBlocks: n },
                  }))}
                    style={{ flex:1, padding:"9px 0", borderRadius:10, border:`1.5px solid ${n === (data.deepWorkTargets?.maxDeepBlocks ?? 3) ? "var(--accent)" : "var(--border)"}`, background: n === (data.deepWorkTargets?.maxDeepBlocks ?? 3) ? "var(--accent-s)" : "var(--bg3)", color: n === (data.deepWorkTargets?.maxDeepBlocks ?? 3) ? "var(--accent)" : "var(--text2)", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .15s" }}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ fontSize:11, color:"var(--text3)", marginTop:6 }}>Huberman recommends 1–3 blocks of 90 min each</div>
            </div>
          </div>
        </div>

        <div className="spacer" />
      </div>
    </div>
  );
}
