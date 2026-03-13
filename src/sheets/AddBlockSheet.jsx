import { useState, useRef } from "react";
import { uid } from "../utils.js";
import useSwipeDown from "../useSwipeDown.js";

function AddBlockSheet({ data, onClose, onAddRoutine }) {
  const swipe = useSwipeDown(onClose);
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  // Routine block state
  const [rtTitle, setRtTitle]       = useState("");
  const [rtDayOfWeek, setRtDayOfWeek] = useState(new Date().getDay());
  const [rtStartHour, setRtStartHour] = useState(9);
  const [rtDuration, setRtDuration] = useState(60);
  const [rtRecurring, setRtRecurring] = useState(true);
  const [rtTasks, setRtTasks]       = useState([]);
  const [rtTaskDraft, setRtTaskDraft] = useState("");
  const rtInputRef = useRef(null);

  const addRtTask = () => {
    const t = rtTaskDraft.trim();
    if (!t) return;
    setRtTasks(prev => [...prev, { id: uid(), text: t }]);
    setRtTaskDraft("");
    setTimeout(() => rtInputRef.current?.focus(), 30);
  };

  const submitRoutine = () => {
    if (!rtTitle.trim()) return;
    const today = new Date();
    let targetDate = null;
    if (!rtRecurring) {
      const d = new Date(today);
      for (let i = 0; i < 7; i++) {
        if (d.getDay() === rtDayOfWeek) { targetDate = d.toDateString(); break; }
        d.setDate(d.getDate() + 1);
      }
    }
    onAddRoutine({
      id: uid(),
      title: rtTitle.trim(),
      dayOfWeek: rtDayOfWeek,
      startHour: rtStartHour,
      startMin: 0,
      durationMin: rtDuration,
      recurring: rtRecurring,
      targetDate,
      tasks: rtTasks,
      completions: {},
    });
    onClose();
  };

  // ── Routine block form ────────────────────────────────────────
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Add Routine Block</div>
        <div className="sheet-scroll">
          <div className="form-row">
            <label className="form-label">Title</label>
            <input className="form-input" placeholder="e.g. Tuesday Admin" value={rtTitle} onChange={e => setRtTitle(e.target.value)} autoFocus />
          </div>
          <div className="form-row">
            <label className="form-label">Day</label>
            <select className="form-select" value={rtDayOfWeek} onChange={e => setRtDayOfWeek(Number(e.target.value))}>
              {DAY_NAMES.map((d,i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="form-row form-row-2">
            <div>
              <label className="form-label">Start Time</label>
              <select className="form-select" value={rtStartHour} onChange={e => setRtStartHour(Number(e.target.value))}>
                {Array.from({length:13},(_,i)=>i+7).map(h => <option key={h} value={h}>{h>12?h-12:h}:00 {h>=12?"PM":"AM"}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Duration</label>
              <select className="form-select" value={rtDuration} onChange={e => setRtDuration(Number(e.target.value))}>
                <option value={25}>25 min</option><option value={45}>45 min</option>
                <option value={60}>60 min</option><option value={90}>90 min</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Recurring toggle */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0 14px", borderBottom:"1px solid var(--border2)", marginBottom:14 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>Repeat weekly</div>
              <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>Shows every {DAY_NAMES[rtDayOfWeek]}</div>
            </div>
            <div
              onClick={() => setRtRecurring(r => !r)}
              style={{
                width:44, height:26, borderRadius:13, cursor:"pointer",
                background: rtRecurring ? "var(--accent)" : "var(--bg4)",
                border: rtRecurring ? "none" : "1px solid var(--border)",
                position:"relative", transition:"background .2s",
              }}
            >
              <div style={{
                position:"absolute", top:3, left: rtRecurring ? 21 : 3,
                width:20, height:20, borderRadius:"50%",
                background:"#fff", transition:"left .2s",
                boxShadow:"0 1px 4px rgba(0,0,0,.3)",
              }} />
            </div>
          </div>

          {/* Tasks */}
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Tasks</div>
          {rtTasks.map((t, i) => (
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:"1px solid var(--border2)" }}>
              <span style={{ fontSize:13, color:"var(--text)", flex:1 }}>{t.text}</span>
              <button onClick={() => setRtTasks(prev => prev.filter(x => x.id !== t.id))} style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer", fontSize:15, padding:0 }}>✕</button>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <input
              ref={rtInputRef}
              className="form-input"
              style={{ flex:1 }}
              placeholder="Add a task…"
              value={rtTaskDraft}
              onChange={e => setRtTaskDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addRtTask()}
            />
            <button onClick={addRtTask} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"0 14px", color:"var(--text)", cursor:"pointer", fontSize:18, fontFamily:"'DM Sans',sans-serif" }}>+</button>
          </div>

          <button className="form-btn" style={{ marginTop:20 }} disabled={!rtTitle.trim()} onClick={submitRoutine}>
            {rtRecurring ? `Add Weekly Routine` : "Add One-Time Routine"}
          </button>
        </div>
      </div>
    </>
  );
}

export default AddBlockSheet;
