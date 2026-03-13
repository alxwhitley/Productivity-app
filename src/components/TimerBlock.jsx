import { toISODate } from "../utils.js";

export default function TimerBlock({ onDone, activeTaskLabel, isRunning, isPaused, timerActive, timerProgress, ringStroke, cdStr, elapsedStr, slot, mutateDWSlot, resetTimer, startTimerSlot, pauseTimerSlot }) {
  // Ring geometry
  var RING_SIZE = 80, RING_R = 34, RING_CX = 40, RING_CY = 40;
  var RING_CIRC = 2 * Math.PI * RING_R;
  // Timer tap/long-press handlers
  var _lpTimer = null;
  var onTimerPointerDown = function(e) {
    e.stopPropagation();
    _lpTimer = setTimeout(function() {
      if (isPaused) resetTimer(slot.id);
      _lpTimer = null;
    }, 600);
  };
  var onTimerPointerUp = function(e) {
    e.stopPropagation();
    if (_lpTimer) {
      clearTimeout(_lpTimer);
      _lpTimer = null;
      if (isRunning) pauseTimerSlot(slot.id);
      else startTimerSlot(slot.id);
    }
  };
  var onTimerPointerLeave = function() { clearTimeout(_lpTimer); _lpTimer = null; };

  return (
                        <div onClick={e => e.stopPropagation()} style={{ marginTop:6 }}>

                          {/* ── Pinned active task context ── */}
                          {activeTaskLabel && (
                            <div style={{
                              display:"flex", alignItems:"center", gap:6, marginBottom:10,
                              padding:"6px 10px", borderRadius:8,
                              background:"rgba(155,114,207,.08)",
                              border:"1px solid rgba(155,114,207,.18)",
                            }}>
                              <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--purple)", flexShrink:0 }}/>
                              <span style={{ fontSize:12, fontWeight:600, color:"var(--text2)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {activeTaskLabel}
                              </span>
                            </div>
                          )}

                          {/* ── Secondary ghost actions — top right ── */}
                          <div style={{ display:"flex", justifyContent:"flex-end", gap:6, marginBottom:8 }}>
                            {(isRunning || isPaused) && (
                              <button onClick={e => { e.stopPropagation(); mutateDWSlot(toISODate(), slot.slotIndex, { durationMin: slot.durationMin + 5 }); }}
                                style={{ fontSize:10, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", fontFamily:"'DM Sans',sans-serif", color:"var(--text3)", background:"none", border:"1px solid var(--border)", borderRadius:6, padding:"3px 9px", cursor:"pointer", opacity:.55 }}>
                                +5m
                              </button>
                            )}
                            {isPaused && (
                              <button onClick={e => { e.stopPropagation(); resetTimer(slot.id); }}
                                style={{ fontSize:10, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", fontFamily:"'DM Sans',sans-serif", color:"var(--text3)", background:"none", border:"1px solid var(--border)", borderRadius:6, padding:"3px 9px", cursor:"pointer", opacity:.55 }}>
                                Reset
                              </button>
                            )}
                            {isPaused && (
                              <button onClick={e => { e.stopPropagation(); resetTimer(slot.id); onDone(); }}
                                style={{ fontSize:10, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", fontFamily:"'DM Sans',sans-serif", color:"var(--red)", background:"none", border:"1px solid rgba(224,85,85,.35)", borderRadius:6, padding:"3px 9px", cursor:"pointer", opacity:.55 }}>
                                Discard
                              </button>
                            )}
                          </div>

                          {/* ── Hero: progress ring + countdown ── */}
                          <div
                            onPointerDown={onTimerPointerDown}
                            onPointerUp={onTimerPointerUp}
                            onPointerLeave={onTimerPointerLeave}
                            style={{
                              display:"flex", flexDirection:"column", alignItems:"center",
                              justifyContent:"center", cursor:"pointer", padding:"4px 0 14px",
                              userSelect:"none", WebkitUserSelect:"none",
                            }}
                          >
                            {/* SVG progress ring */}
                            <div style={{ position:"relative", width:RING_SIZE, height:RING_SIZE }}>
                              <svg
                                width={RING_SIZE} height={RING_SIZE}
                                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                                style={{ position:"absolute", top:0, left:0 }}
                              >
                                {/* Track */}
                                <circle cx={RING_CX} cy={RING_CY} r={RING_R}
                                  fill="none" stroke="var(--bg4)" strokeWidth="4"/>
                                {/* Depleting progress arc */}
                                <circle cx={RING_CX} cy={RING_CY} r={RING_R}
                                  fill="none"
                                  stroke={ringStroke}
                                  strokeWidth="4"
                                  strokeDasharray={RING_CIRC}
                                  strokeDashoffset={RING_CIRC * timerProgress}
                                  strokeLinecap="round"
                                  transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                                  style={{ transition:"stroke-dashoffset .9s linear, stroke .3s" }}
                                />
                              </svg>
                              {/* Countdown — centred over ring */}
                              <div style={{
                                position:"absolute", inset:0,
                                display:"flex", flexDirection:"column",
                                alignItems:"center", justifyContent:"center", gap:1,
                              }}>
                                <span style={{
                                  fontSize:22, fontWeight:800,
                                  fontVariantNumeric:"tabular-nums",
                                  letterSpacing:"-.02em",
                                  fontFamily:"'DM Sans',sans-serif",
                                  color: isRunning ? "var(--text)" : isPaused ? "var(--accent)" : "var(--text3)",
                                  lineHeight:1,
                                }}>
                                  {cdStr}
                                </span>
                                {isRunning && (
                                  <div style={{ display:"flex", alignItems:"center", gap:3, marginTop:2 }}>
                                    <div style={{
                                      width:4, height:4, borderRadius:"50%",
                                      background:"var(--purple)",
                                      animation:"pulse-dot 1.2s ease-in-out infinite",
                                    }}/>
                                  </div>
                                )}
                                {isPaused && (
                                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:".06em", color:"var(--accent)", textTransform:"uppercase", marginTop:2 }}>
                                    Paused
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Tap hint — idle only */}
                            {!timerActive && (
                              <span style={{ fontSize:10, color:"var(--text3)", marginTop:6, letterSpacing:".04em" }}>
                                tap to start
                              </span>
                            )}
                          </div>

                          {/* ── State-aware primary button + Done ── */}
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            {isPaused ? (
                              // Paused: Resume is primary, Finish is secondary in-row
                              <button
                                onClick={e => { e.stopPropagation(); startTimerSlot(slot.id); }}
                                style={{
                                  flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                                  background:"var(--purple)", border:"none", borderRadius:22,
                                  padding:"11px 0", fontSize:13, fontWeight:700,
                                  color:"#fff", cursor:"pointer",
                                  fontFamily:"'DM Sans',sans-serif", transition:"opacity .15s",
                                }}
                              >
                                <svg width="10" height="11" viewBox="0 0 16 18" fill="none">
                                  <path d="M1 1l14 8-14 8V1z" fill="currentColor"/>
                                </svg>
                                Resume
                              </button>
                            ) : isRunning ? (
                              <button
                                onClick={e => { e.stopPropagation(); pauseTimerSlot(slot.id); }}
                                style={{
                                  flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                                  background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:22,
                                  padding:"11px 0", fontSize:13, fontWeight:700,
                                  color:"var(--text2)", cursor:"pointer",
                                  fontFamily:"'DM Sans',sans-serif", transition:"all .15s",
                                }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                  <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>
                                  <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>
                                </svg>
                                Pause
                              </button>
                            ) : (
                              // Idle: big purple Start Session
                              <button
                                onClick={e => { e.stopPropagation(); startTimerSlot(slot.id); }}
                                style={{
                                  flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                                  background:"var(--purple)", border:"none", borderRadius:22,
                                  padding:"11px 0", fontSize:13, fontWeight:700,
                                  color:"#fff", cursor:"pointer",
                                  fontFamily:"'DM Sans',sans-serif", transition:"opacity .15s",
                                }}
                              >
                                <svg width="10" height="11" viewBox="0 0 16 18" fill="none">
                                  <path d="M1 1l14 8-14 8V1z" fill="currentColor"/>
                                </svg>
                                Start Session
                              </button>
                            )}

                            {/* Done — always present, lights up green once timer has run */}
                            <button
                              onClick={e => { e.stopPropagation(); onDone(); }}
                              title={timerActive ? `Finish — ${elapsedStr} logged` : "Mark done (full duration logged)"}
                              style={{
                                width:44, height:44, borderRadius:"50%",
                                border: timerActive ? "none" : "1px solid var(--border)",
                                background: timerActive ? "var(--green)" : "var(--bg3)",
                                color: timerActive ? "#fff" : "var(--text3)",
                                display:"flex", alignItems:"center", justifyContent:"center",
                                cursor:"pointer", flexShrink:0,
                                transition:"background .2s, border-color .2s, color .2s",
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
  );
}
