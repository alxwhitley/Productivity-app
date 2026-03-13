import { useState } from "react";
import { fmtTime } from "../utils.js";
import useSwipeDown from "../useSwipeDown.js";

function WorkWeekSheet({ workWeek, data, onClose, onSave, lightMode, onToggleTheme }) {
  const swipe = useSwipeDown(onClose);
  const [selected, setSelected] = useState([...workWeek]);
  const liveSlots = getDeepSlots(data);

  // Local editable copy of the 3 deep block defaults
  const [defs, setDefs] = useState(liveSlots.map(s => ({
    startHour: s.startHour, startMin: s.startMin, durationMin: s.durationMin
  })));

  const dayLabels  = ["S","M","T","W","T","F","S"];
  const dayNames   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const toggle = d => setSelected(s => s.includes(d) ? s.filter(x=>x!==d) : [...s,d]);
  const preset = days => setSelected(days);

  const updateDef = (i, field, val) => setDefs(ds => ds.map((d,j) => j===i ? {...d,[field]:Number(val)} : d));

  const timeOptions = [];
  for (let h = 6; h <= 20; h++) for (let m of [0,15,30,45]) timeOptions.push({h,m});

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Work Week</div>
        <div className="sheet-sub">Set your work days and default deep work times</div>
        <div className="sheet-scroll">

          <div className="ww-days">
            {dayLabels.map((l,i) => (
              <div key={i} className={`ww-day ${selected.includes(i)?"on":""}`} onClick={() => toggle(i)} title={dayNames[i]}>{l}</div>
            ))}
          </div>

          <div className="ww-presets">
            <button className="ww-preset" onClick={() => preset([1,2,3,4,5])}>Mon – Fri</button>
            <button className="ww-preset" onClick={() => preset([2,3,4,5,6])}>Tue – Sat</button>
            <button className="ww-preset" onClick={() => preset([0,1,2,3,4])}>Sun – Thu</button>
            <button className="ww-preset" onClick={() => preset([1,2,3,4])}>Mon – Thu</button>
          </div>

          <div className="sh" style={{ paddingLeft:0, paddingTop:8 }}>
            <span className="sh-label">Default Deep Work Times</span>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:"auto" }}>
              <button onClick={() => setDefs(d => d.length > 1 ? d.slice(0,-1) : d)} style={{ width:26, height:26, borderRadius:8, background:"var(--bg4)", border:"1px solid var(--border)", color:"var(--text)", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"DM Sans,sans-serif" }}>−</button>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text)", minWidth:8, textAlign:"center" }}>{defs.length}</span>
              <button onClick={() => setDefs(d => d.length < 6 ? [...d, { startHour:16, startMin:0, durationMin:90 }] : d)} style={{ width:26, height:26, borderRadius:8, background:"var(--bg4)", border:"1px solid var(--border)", color:"var(--text)", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"DM Sans,sans-serif" }}>+</button>
            </div>
          </div>

          <div className="ww-times">
            {defs.map((slot, i) => (
              <div key={i} className="ww-slot-row">
                <div style={{ flex:1 }}>
                  <div className="ww-slot-num">Block {i+1}</div>

                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                  <select className="ww-slot-select"
                    value={`${defs[i].startHour}:${defs[i].startMin}`}
                    onChange={e => { const [h,m] = e.target.value.split(":").map(Number); updateDef(i,"startHour",h); updateDef(i,"startMin",m); }}>
                    {timeOptions.map(({h,m}) => (
                      <option key={`${h}:${m}`} value={`${h}:${m}`}>{fmtTime(h,m)}</option>
                    ))}
                  </select>
                  <select className="ww-slot-select"
                    value={defs[i].durationMin}
                    onChange={e => updateDef(i,"durationMin",e.target.value)}>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="theme-toggle-row">
            <div>
              <div className="theme-toggle-label">Appearance</div>
              <div className="theme-toggle-sub">{lightMode ? "Light mode" : "Dark mode"}</div>
            </div>
            <div className={`toggle-pill ${lightMode ? "on" : ""}`} onClick={onToggleTheme}>
              <div className="toggle-knob" />
            </div>
          </div>

          <button className="form-btn" style={{ marginTop:16 }} onClick={() => onSave(selected, defs)}>Save</button>
        </div>
      </div>
    </>
  );
}

// Resolve the live slot definitions: user's saved deepBlockDefaults override the built-in defaults
const DEFAULT_DEEP_SLOTS = [
  { slotIndex: 0, startHour: 9,  startMin: 0,  durationMin: 90, blockType: "analytical",
    hint: "Block 1", hintDetail: "Peak neurochemical window — best for hard analysis, complex decisions, and deep problem-solving." },
  { slotIndex: 1, startHour: 12, startMin: 0,  durationMin: 90, blockType: "creative",
    hint: "Block 2",   hintDetail: "Post-peak window — excellent for generative work, writing, and ideation." },
  { slotIndex: 2, startHour: 15, startMin: 0,  durationMin: 90, blockType: "generative",
    hint: "Block 3", hintDetail: "Third block — strong for execution-focused work: building, shipping, tasks you know well." },
];

function getDeepSlots(data) {
  const saved = data.deepBlockDefaults;
  if (!saved || !saved.length) return DEFAULT_DEEP_SLOTS;
  return saved.map((s, i) => ({ ...(DEFAULT_DEEP_SLOTS[i] || DEFAULT_DEEP_SLOTS[0]), ...s, slotIndex: i }));
}

export default WorkWeekSheet;
