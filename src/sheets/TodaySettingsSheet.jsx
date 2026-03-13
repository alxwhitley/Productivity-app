import { useState } from "react";
import useSwipeDown from "../useSwipeDown.js";

function TodaySettingsSheet({ data, setData, onClose }) {
  const swipe = useSwipeDown(onClose);
  const prefs = data.todayPrefs || {};
  const [name, setName]           = useState(prefs.name || "");
  const [showShutdown, setShowSD] = useState(prefs.showShutdown !== false);
  const [hideTimes, setHideTimes] = useState(prefs.hideTimes === true);
  const [defaultBlock, setDefault] = useState(prefs.defaultBlock || "9");
  const targets = data.deepWorkTargets || { dailyHours: 4, weeklyHours: 20, maxDeepBlocks: 3 };
  const dwCount = (data.deepBlockDefaults || []).length;
  const [dailyHours, setDailyHours]     = useState(String(targets.dailyHours));
  const [weeklyHours, setWeeklyHours]   = useState(String(targets.weeklyHours));
  const [maxDeepBlocks, setMaxDeepBlocks] = useState(String(targets.maxDeepBlocks ?? 3));

  const save = () => {
    setData(d => ({
      ...d,
      todayPrefs: { name: name.trim(), showShutdown, defaultBlock, hideTimes },
      deepWorkTargets: { dailyHours: parseFloat(dailyHours)||4, weeklyHours: parseFloat(weeklyHours)||20, maxDeepBlocks: parseInt(maxDeepBlocks)||3 },
    }));
    onClose();
  };

  const timeOpts = [];
  for (let h = 5; h <= 12; h++) timeOpts.push({ val: String(h), label: `${h > 12 ? h-12 : h}:00 ${h >= 12 ? "PM" : "AM"}` });

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Today Settings</div>
        <div className="sheet-scroll">

          <div className="set-section">Greeting</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 6 }}>Your name (shown in greeting)</div>
            <input className="set-input" placeholder="e.g. Tabb" value={name} onChange={e => setName(e.target.value)} />
            {name.trim() && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>Preview: Good morning, {name.trim()}.</div>}
          </div>

          <div className="set-section">Default First Block</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 6 }}>Start time for your first block of the day</div>
            <select className="form-select" value={defaultBlock} onChange={e => setDefault(e.target.value)}>
              {timeOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>

          <div className="set-section">Deep Work Targets</div>
          <div style={{ display:"flex", gap:12, marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Daily target (hours)</div>
              <input className="set-input" type="number" min="1" max="12" step="0.5" value={dailyHours} onChange={e => setDailyHours(e.target.value)} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Weekly target (hours)</div>
              <input className="set-input" type="number" min="1" max="60" step="1" value={weeklyHours} onChange={e => setWeeklyHours(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Max deep work blocks per day</div>
            <div style={{ display:"flex", gap:8 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setMaxDeepBlocks(String(n))}
                  style={{ flex:1, padding:"9px 0", borderRadius:10, border:`1.5px solid ${String(n) === maxDeepBlocks ? "var(--accent)" : "var(--border)"}`, background: String(n) === maxDeepBlocks ? "var(--accent-s)" : "var(--bg3)", color: String(n) === maxDeepBlocks ? "var(--accent)" : "var(--text2)", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .15s" }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, color:"var(--text3)", marginTop:6 }}>Huberman recommends 1–3 blocks of 90 min each</div>
          </div>

          <div className="set-section">Shutdown Ritual</div>
          <div className="set-row">
            <div>
              <div className="set-row-label">Show Shutdown Ritual</div>
              <div className="set-row-sub">Displays end-of-day ritual on Today tab</div>
            </div>
            <div className={`toggle-pill ${showShutdown ? "on" : ""}`} onClick={() => setShowSD(v => !v)}>
              <div className="toggle-knob" />
            </div>
          </div>

          <div className="set-section">Layout</div>
          <div className="set-row">
            <div>
              <div className="set-row-label">Hide Time Column</div>
              <div className="set-row-sub">Cards fill the full width — no fixed schedule</div>
            </div>
            <div className={`toggle-pill ${hideTimes ? "on" : ""}`} onClick={() => setHideTimes(v => !v)}>
              <div className="toggle-knob" />
            </div>
          </div>

          <button className="form-btn" style={{ marginTop: 20 }} onClick={save}>Save</button>
        </div>
      </div>
    </>
  );
}

export default TodaySettingsSheet;
