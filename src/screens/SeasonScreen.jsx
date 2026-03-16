import { useState, useRef, useCallback } from "react";
import { DOMAIN_COLORS } from "../constants.js";
import { uid, toISODate } from "../utils.js";
import StatusBar from "../components/StatusBar.jsx";

const QUARTER_META = [
  { q: 1, label: "Q1", sub: "Jan–Mar" },
  { q: 2, label: "Q2", sub: "Apr–Jun" },
  { q: 3, label: "Q3", sub: "Jul–Sep" },
  { q: 4, label: "Q4", sub: "Oct–Dec" },
];

const MAX_GOALS = 4;

const TYPE_PILLS = {
  essential: { bg: "rgba(232,160,48,0.15)", color: "var(--accent)" },
  maintain:  { bg: "rgba(255,255,255,0.07)", color: "var(--text3)" },
  bonus:     { bg: "rgba(155,114,207,0.15)", color: "var(--purple)" },
};

const TYPE_DESC = {
  essential: "The goal that defines this season. Everything else serves this.",
  maintain:  "Important work that needs to stay alive, but you're not pushing it forward.",
  bonus:     "A stretch goal. Only chase this once your Essential goals are on track.",
};

const PALETTE = ["#6B7A8D","#C47A7A","#B89B6A","#7A9E7E","#8A7AAE","#8A9099"];

function getQuarter(d) { return Math.floor(d.getMonth() / 3) + 1; }

function quarterStartEnd(q, year) {
  const s = new Date(year, (q - 1) * 3, 1);
  const e = new Date(year, q * 3, 0, 23, 59, 59, 999);
  return { start: s, end: e };
}

// ── Radar chart helper ──
function RadarChart({ domainData, size }) {
  const cx = size / 2, cy = size / 2;
  const radius = size / 2 - 30;
  const n = domainData.length;
  if (n === 0) return null;

  const maxVal = Math.max(...domainData.map(d => d.value), 1);
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const pointAt = (i, r) => {
    const a = startAngle + i * angleStep;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  // Reference rings
  const rings = [0.33, 0.66, 1].map(pct => {
    const r = radius * pct;
    const pts = Array.from({ length: n }, (_, i) => pointAt(i, r));
    return pts.map(p => `${p.x},${p.y}`).join(" ");
  });

  // Data polygon
  const dataPoints = domainData.map((d, i) => {
    const r = (d.value / maxVal) * radius;
    return pointAt(i, Math.max(r, 2));
  });
  const polyStr = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  // Axis tip labels
  const tipPoints = domainData.map((d, i) => {
    const p = pointAt(i, radius + 16);
    return { ...p, name: d.name, color: d.color };
  });

  return (
    <svg width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
      {/* Reference rings */}
      {rings.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.5" />
      ))}
      {/* Axis lines */}
      {domainData.map((_, i) => {
        const tip = pointAt(i, radius);
        return <line key={i} x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="var(--border)" strokeWidth="0.5" opacity="0.4" />;
      })}
      {/* Data fill */}
      <polygon points={polyStr} fill="rgba(155,114,207,0.15)" stroke="rgba(155,114,207,0.6)" strokeWidth="2" />
      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={domainData[i].color} />
      ))}
      {/* Labels */}
      {tipPoints.map((t, i) => (
        <text key={i} x={t.x} y={t.y} textAnchor="middle" dominantBaseline="central"
          fill={t.color} fontSize="11" fontWeight="600" fontFamily="'DM Sans',sans-serif">
          {t.name}
        </text>
      ))}
    </svg>
  );
}

// ── Swipeable goal row ──
function GoalRow({ goal, idx, total, readOnly, getDomain, onToggle, onDelete }) {
  const dom = getDomain(goal.domainId);
  const pill = TYPE_PILLS[goal.type] || TYPE_PILLS.essential;
  const rowRef = useRef(null);
  const touchStart = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const [showDelete, setShowDelete] = useState(false);

  const handleTouchStart = useCallback((e) => {
    if (readOnly) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setShowDelete(false);
  }, [readOnly]);

  const handleTouchMove = useCallback((e) => {
    if (!touchStart.current || readOnly) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) {
      e.preventDefault();
      setSwipeX(Math.max(dx, -80));
    }
  }, [readOnly]);

  const handleTouchEnd = useCallback(() => {
    if (readOnly) return;
    if (swipeX < -40) {
      setSwipeX(-72);
      setShowDelete(true);
    } else {
      setSwipeX(0);
      setShowDelete(false);
    }
    touchStart.current = null;
  }, [swipeX, readOnly]);

  const resetSwipe = () => { setSwipeX(0); setShowDelete(false); };

  return (
    <div ref={rowRef} style={{ position: "relative", overflow: "hidden", borderLeft: `4px solid ${dom?.color || "var(--text3)"}` }}>
      {/* Delete reveal */}
      {!readOnly && (
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 72,
          background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
        }} onClick={() => { onDelete(goal.id); resetSwipe(); }}>
          Delete
        </div>
      )}

      {/* Row content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (showDelete) resetSwipe(); }}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "14px 16px",
          transition: "transform .2s, opacity .15s",
          transform: `translateX(${swipeX}px)`, background: "var(--bg)",
          position: "relative", zIndex: 1,
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
          padding: "2px 6px", borderRadius: 4, lineHeight: 1, background: pill.bg, color: pill.color, flexShrink: 0,
        }}>{goal.type}</span>
        <div style={{
          flex: 1, minWidth: 0, fontSize: 17, letterSpacing: "-0.01em",
          color: goal.done ? "var(--text3)" : "var(--text)",
          fontWeight: goal.done ? 500 : 600,
          textDecoration: goal.done ? "line-through" : "none",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {goal.text}
        </div>
        {!readOnly && (
          <div onClick={(e) => { e.stopPropagation(); onToggle(goal.id); }} style={{
            width: 24, height: 24, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
            background: goal.done ? "var(--green)" : "transparent",
            border: goal.done ? "none" : "2px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {goal.done && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        )}
      </div>
      {/* Bottom divider */}
      <div style={{ borderBottom: "1px solid var(--border2)", marginLeft: 16 }} />
    </div>
  );
}

export default function SeasonScreen({ data, setData }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQ = getQuarter(now);

  const [viewingQuarter, setViewingQuarter] = useState(null);
  const [addingSlot, setAddingSlot] = useState(null);
  const [addText, setAddText] = useState("");
  const [addType, setAddType] = useState("essential");
  const [addDomainId, setAddDomainId] = useState(null);
  const [balanceMode, setBalanceMode] = useState("hours");

  const addFormRef = useRef(null);
  const inputRef = useRef(null);

  const { domains, projects, seasonGoals, blockCompletions, deepWorkSlots } = data;
  const goals = seasonGoals || [];

  const selectedQ = viewingQuarter ? viewingQuarter.q : currentQ;
  const selectedYear = viewingQuarter ? viewingQuarter.year : currentYear;
  const isCurrentQ = !viewingQuarter;
  const isPastQ = !!viewingQuarter;

  const getDomain = (id) => domains.find(d => d.id === id);

  const { start: qStart, end: qEnd } = quarterStartEnd(selectedQ, selectedYear);
  const seasonCap = now < qEnd ? now : qEnd;

  const essentialCount = goals.filter(g => g.type === "essential").length;

  // ── Goal CRUD ──
  const addGoal = () => {
    const text = addText.trim();
    if (!text) return;
    const domId = addDomainId || (domains[0] && domains[0].id) || null;
    setData(d => ({
      ...d,
      seasonGoals: [...(d.seasonGoals || []), { id: uid(), text, type: addType, domainId: domId, done: false }],
    }));
    setAddText("");
    setAddType("essential");
    setAddDomainId(null);
    setAddingSlot(null);
  };

  const toggleDone = (goalId) => {
    setData(d => ({
      ...d,
      seasonGoals: (d.seasonGoals || []).map(g => g.id === goalId ? { ...g, done: !g.done } : g),
    }));
  };

  const deleteGoal = (goalId) => {
    setData(d => ({ ...d, seasonGoals: (d.seasonGoals || []).filter(g => g.id !== goalId) }));
  };

  const openAddSlot = (idx) => {
    setAddingSlot(idx);
    setAddText("");
    setAddType("essential");
    setAddDomainId(domains[0]?.id || null);
    setTimeout(() => {
      inputRef.current?.focus();
      addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  // ── Season block completions ──
  const seasonCompletions = (blockCompletions || []).filter(c => {
    const d = new Date(c.date);
    return d >= qStart && d <= seasonCap;
  });

  // ── Domain hours (from blockCompletions → deepWorkSlots → project → domain) ──
  const domainMins = {};
  seasonCompletions.forEach(c => {
    const dateISO = c.date;
    const slots = (deepWorkSlots || {})[dateISO] || [];
    const slotMatch = slots.find((s, i) => c.blockId === `dw-${dateISO}-${i}`);
    if (slotMatch && slotMatch.projectId) {
      const proj = projects.find(p => p.id === slotMatch.projectId);
      if (proj) {
        domainMins[proj.domainId] = (domainMins[proj.domainId] || 0) + (c.durationMin || 0);
      }
    }
  });

  // ── Domain tasks (from project tasks done this season) ──
  const domainTasks = {};
  projects.forEach(proj => {
    (proj.tasks || []).forEach(t => {
      if (t.done && t.doneAt) {
        const d = new Date(t.doneAt);
        if (d >= qStart && d <= seasonCap) {
          domainTasks[proj.domainId] = (domainTasks[proj.domainId] || 0) + 1;
        }
      }
    });
  });

  // ── Radar chart data ──
  const activeDomains = domains.filter(d =>
    projects.some(p => p.domainId === d.id && (p.status === "active" || p.status === "done"))
  );
  const domainActivity = activeDomains.map(d => ({
    id: d.id, name: d.name, color: d.color,
    hours: (domainMins[d.id] || 0) / 60,
    tasks: domainTasks[d.id] || 0,
  }));
  // Sort by activity descending, cap at 6
  const sortKey = balanceMode === "hours" ? "hours" : "tasks";
  const radarDomains = [...domainActivity].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 6);
  const radarData = radarDomains.map(d => ({ name: d.name, color: d.color, value: d[sortKey] }));
  const hasRadarData = radarData.some(d => d.value > 0);

  // ── Deep work stats ──
  const dwCompletions = seasonCompletions.filter(c => c.blockId && c.blockId.startsWith("dw-"));
  const totalDWMin = dwCompletions.reduce((s, c) => s + (c.durationMin || 0), 0);
  const totalDWHrs = totalDWMin / 60;
  const weeksSoFar = Math.max(1, Math.ceil((seasonCap - qStart) / (7 * 86400000)));
  const avgDWPerWeek = totalDWHrs / weeksSoFar;

  // ── Completed projects ──
  const completedProjects = projects.filter(p => {
    if (p.status !== "done" && !p.done) return false;
    if (p.doneAt) {
      const d = new Date(p.doneAt);
      return d >= qStart && d <= seasonCap;
    }
    return true;
  });

  // ── Weekly review dots ──
  const totalWeeksInQ = Math.ceil((qEnd - qStart) / (7 * 86400000));
  const weekDots = [];
  let shutdownWeeks = 0;
  for (let w = 0; w < totalWeeksInQ; w++) {
    const ws = new Date(qStart);
    ws.setDate(ws.getDate() + w * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const hasActivity = seasonCompletions.some(c => {
      const d = new Date(c.date);
      return d >= ws && d < we;
    });
    const past = we <= now;
    weekDots.push({ filled: hasActivity, past });
    if (hasActivity) shutdownWeeks++;
  }
  const pastWeeks = weekDots.filter(w => w.past).length;

  // ── Render ──
  const filledSlots = goals.slice(0, MAX_GOALS);
  const emptyCount = MAX_GOALS - filledSlots.length;

  const fmtHrs = (h) => h > 0 ? (h % 1 === 0 ? String(h) : h.toFixed(1)) : "0";

  return (
    <div className="screen active">
      <StatusBar />

      {/* ── Page header ── */}
      <div className="ph">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="ph-eye">SEASON</div>
            <div className="ph-title">Q{currentQ} {currentYear}</div>
          </div>
          <button className="tab-gear" onClick={() => {}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="scroll" style={{ padding: "0 0 120px" }}>

        {/* ── Quarter row ── */}
        <div style={{ display: "flex", gap: 6, padding: "4px 16px 20px" }}>
          {QUARTER_META.map(({ q, label, sub }) => {
            const isCurr = q === currentQ;
            const past = q < currentQ;
            const future = q > currentQ;
            const sel = (isCurrentQ && isCurr) || (isPastQ && q === selectedQ);

            return (
              <div key={q}
                onClick={() => {
                  if (future) return;
                  if (isCurr) { setViewingQuarter(null); }
                  else if (past) { setViewingQuarter({ q, year: currentYear }); }
                }}
                style={{
                  flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10,
                  background: sel && isCurr ? "rgba(155,114,207,0.15)" : "var(--bg3)",
                  border: sel && isCurr ? "1px solid rgba(155,114,207,0.4)" : sel && past ? "1px solid var(--border)" : "1px solid transparent",
                  opacity: isCurr ? 1 : past ? 0.45 : 0.35,
                  cursor: future ? "default" : "pointer",
                  transition: "all .15s",
                }}
              >
                <div style={{ fontSize: isCurr ? 15 : 13, fontWeight: 700, color: sel && isCurr ? "var(--purple)" : "var(--text2)" }}>{label}</div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{sub}</div>
              </div>
            );
          })}
        </div>

        {/* Past quarter banner */}
        {isPastQ && (
          <div style={{ margin: "0 16px 16px", padding: "12px 16px", background: "var(--bg3)", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>Q{selectedQ} {selectedYear} · Season complete</div>
          </div>
        )}

        {/* ── GOALS ── */}
        <div className="sh" style={{ paddingTop: 8 }}>
          <span className="sh-label">GOALS</span>
          <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>{goals.length} / {MAX_GOALS}</span>
        </div>

        <div style={{ padding: "0 16px" }}>
          {isPastQ ? (
            /* Past quarter: read-only, currently no historical storage */
            <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>
              No goals recorded for this season.
            </div>
          ) : (
            <>
              {/* Filled slots */}
              {filledSlots.map((g, i) => (
                <GoalRow key={g.id} goal={g} idx={i} total={MAX_GOALS} readOnly={false}
                  getDomain={getDomain} onToggle={toggleDone} onDelete={deleteGoal} />
              ))}

              {/* Empty slots */}
              {Array.from({ length: emptyCount }, (_, i) => {
                const slotIdx = filledSlots.length + i;
                const isAdding = addingSlot === slotIdx;

                return (
                  <div key={`empty-${i}`} ref={isAdding ? addFormRef : null}>
                    {/* "+ Add goal" row */}
                    <div
                      onClick={() => { if (!isAdding) openAddSlot(slotIdx); }}
                      style={{
                        display: "flex", alignItems: "center", padding: "13px 0",
                        borderBottom: "1px solid var(--border2)",
                        cursor: isAdding ? "default" : "pointer",
                      }}
                    >
                      <span style={{ fontSize: 14, color: "var(--accent)", fontWeight: 700, marginRight: 6 }}>+</span>
                      <span style={{ fontSize: 14, color: "var(--text3)" }}>Add goal</span>
                    </div>

                    {/* Inline add form — expands below the row */}
                    {isAdding && (
                      <div style={{ padding: "12px 0 8px" }}>
                        <input ref={inputRef}
                          className="set-input"
                          placeholder="What's the goal?"
                          value={addText}
                          onChange={e => setAddText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") addGoal();
                            if (e.key === "Escape") setAddingSlot(null);
                          }}
                          style={{ marginBottom: 10 }}
                        />

                        {/* Type selector */}
                        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                          {["essential", "maintain", "bonus"].map(t => {
                            const sel = addType === t;
                            const pill = TYPE_PILLS[t];
                            const disabled = t === "essential" && essentialCount >= 2 && addType !== "essential";
                            return (
                              <button key={t}
                                onClick={() => { if (!disabled) setAddType(t); }}
                                style={{
                                  flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 11, fontWeight: 700,
                                  textTransform: "uppercase", letterSpacing: ".04em",
                                  cursor: disabled ? "default" : "pointer",
                                  border: sel ? `1.5px solid ${pill.color}` : "1.5px solid var(--border)",
                                  background: sel ? pill.bg : "var(--bg3)",
                                  color: disabled ? "var(--text3)" : pill.color,
                                  opacity: disabled ? 0.4 : 1,
                                  fontFamily: "'DM Sans',sans-serif", transition: "all .12s",
                                }}
                              >{t}</button>
                            );
                          })}
                        </div>
                        {essentialCount >= 2 && addType !== "essential" && (
                          <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 6 }}>2 of 2 Essential goals set</div>
                        )}
                        <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10, lineHeight: 1.4 }}>
                          {TYPE_DESC[addType]}
                        </div>

                        {/* Domain color picker — locked palette */}
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          {domains.map(d => (
                            <div key={d.id}
                              onClick={() => setAddDomainId(d.id)}
                              style={{
                                width: 22, height: 22, borderRadius: "50%", background: d.color, cursor: "pointer",
                                boxShadow: (addDomainId || domains[0]?.id) === d.id ? `0 0 0 2px var(--bg2), 0 0 0 3.5px ${d.color}` : "none",
                                transition: "box-shadow .1s",
                              }}
                            />
                          ))}
                        </div>

                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span onClick={addGoal}
                            style={{ fontSize: 13, color: "#E8A030", fontWeight: 600, cursor: "pointer" }}>Add</span>
                          <span onClick={() => setAddingSlot(null)}
                            style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500, cursor: "pointer" }}>Cancel</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* ── DOMAIN BALANCE — RADAR CHART ── */}
        <div className="sh" style={{ paddingTop: 20 }}>
          <span className="sh-label">DOMAIN BALANCE</span>
          <div style={{ display: "flex", gap: 2 }}>
            {["hours", "tasks"].map(m => (
              <button key={m} onClick={() => setBalanceMode(m)}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: "2px 8px",
                  fontSize: 12, fontWeight: balanceMode === m ? 700 : 500,
                  color: balanceMode === m ? "#E8A030" : "var(--text3)",
                  fontFamily: "'DM Sans',sans-serif", transition: "color .15s",
                }}>
                {m === "hours" ? "Hours" : "Tasks"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: "16px 0" }}>
          {radarDomains.length === 0 || !hasRadarData ? (
            <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "32px 16px" }}>
              Block time will appear here as you log work sessions.
            </div>
          ) : (
            <RadarChart domainData={radarData} size={260} />
          )}
        </div>

        {/* ── DEEP WORK ── */}
        <div className="sh" style={{ paddingTop: 20 }}>
          <span className="sh-label">DEEP WORK</span>
        </div>
        <div style={{ display: "flex", gap: 12, padding: "0 16px" }}>
          <div style={{ flex: 1, background: "var(--bg2)", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text)" }}>{fmtHrs(totalDWHrs)}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>hrs</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>This Season</div>
          </div>
          <div style={{ flex: 1, background: "var(--bg2)", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text)" }}>{fmtHrs(avgDWPerWeek)}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>hrs/wk</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>Weekly Avg</div>
          </div>
        </div>

        {/* ── COMPLETED PROJECTS ── */}
        <div className="sh" style={{ paddingTop: 20 }}>
          <span className="sh-label">COMPLETED PROJECTS</span>
        </div>
        <div style={{ padding: "0 16px" }}>
          {completedProjects.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "16px 0" }}>
              Completed projects will appear here.
            </div>
          ) : (
            completedProjects.map(p => {
              const dom = getDomain(p.domainId);
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: dom?.color || "var(--text3)" }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 500 }}>✓ Complete</span>
                </div>
              );
            })
          )}
        </div>

        {/* ── WEEKLY REVIEWS ── */}
        <div className="sh" style={{ paddingTop: 20 }}>
          <span className="sh-label">WEEKLY REVIEWS</span>
        </div>
        <div style={{ padding: "0 16px" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {weekDots.map((w, i) => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: "50%",
                background: w.filled ? "#B89B6A" : "transparent",
                border: w.filled ? "none" : "1.5px solid var(--border)",
                opacity: w.past || w.filled ? 1 : 0.4,
              }} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            {shutdownWeeks} of {pastWeeks} weeks with a shutdown completed
          </div>
        </div>

        <div className="spacer" />
      </div>
    </div>
  );
}
