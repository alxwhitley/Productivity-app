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
    if (swipeX < -60) {
      setSwipeX(-72);
      setShowDelete(true);
    } else {
      setSwipeX(0);
      setShowDelete(false);
    }
    touchStart.current = null;
  }, [swipeX, readOnly]);

  const resetSwipe = () => { setSwipeX(0); setShowDelete(false); };

  const typeLabel = (goal.type || "essential").toUpperCase();

  return (
    <div ref={rowRef} style={{ position: "relative", overflow: "hidden", borderRadius: 8, marginBottom: 12 }}>
      {/* Delete reveal */}
      {!readOnly && (
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 72,
          background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
          borderRadius: "0 8px 8px 0",
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
          display: "flex", alignItems: "center", gap: 10, padding: "12px 12px",
          transition: "transform .2s, opacity .15s",
          transform: `translateX(${swipeX}px)`, background: "var(--bg3)",
          position: "relative", zIndex: 1, borderRadius: 8,
        }}
      >
        {/* Left: type label + domain dot + text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--text3)", marginBottom: 4, lineHeight: 1,
          }}>{typeLabel}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: dom?.color || "var(--text3)",
            }} />
            <div style={{
              flex: 1, minWidth: 0, fontSize: 17, letterSpacing: "-0.01em",
              color: goal.done ? "var(--text3)" : "var(--text)",
              fontWeight: goal.done ? 500 : 600,
              textDecoration: goal.done ? "line-through" : "none",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {goal.text}
            </div>
          </div>
        </div>
        {/* Checkbox */}
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
    </div>
  );
}

export default function SeasonScreen({ data, setData, onOpenProfile }) {
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
          <button className="tab-gear" onClick={onOpenProfile}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, margin: "0 16px 12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text3)" }}>GOALS</span>
            <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>{goals.length} / {MAX_GOALS}</span>
          </div>

          {isPastQ ? (
            <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>
              No goals recorded for this season.
            </div>
          ) : (
            <>
              {filledSlots.map((g, i) => (
                <GoalRow key={g.id} goal={g} idx={i} total={MAX_GOALS} readOnly={false}
                  getDomain={getDomain} onToggle={toggleDone} onDelete={deleteGoal} />
              ))}

              {Array.from({ length: emptyCount }, (_, i) => {
                const slotIdx = filledSlots.length + i;
                const isAdding = addingSlot === slotIdx;

                return (
                  <div key={`empty-${i}`} ref={isAdding ? addFormRef : null}>
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
        <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, margin: "0 16px 12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text3)" }}>DOMAIN BALANCE</span>
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
          <div style={{ padding: "8px 0 0" }}>
            {radarDomains.length === 0 || !hasRadarData ? (
              <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "24px 0" }}>
                Block time will appear here as you log work sessions.
              </div>
            ) : (
              <RadarChart domainData={radarData} size={260} />
            )}
          </div>
        </div>

        {/* ── DEEP WORK ── */}
        <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, margin: "0 16px 12px 16px" }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text3)" }}>DEEP WORK</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, background: "var(--bg3)", borderRadius: 12, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text)" }}>{fmtHrs(totalDWHrs)}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>hrs</div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>This Season</div>
            </div>
            <div style={{ flex: 1, background: "var(--bg3)", borderRadius: 12, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text)" }}>{fmtHrs(avgDWPerWeek)}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>hrs/wk</div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>Weekly Avg</div>
            </div>
          </div>
        </div>

        {/* ── COMPLETED PROJECTS ── */}
        <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, margin: "0 16px 12px 16px" }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text3)" }}>COMPLETED PROJECTS</span>
          </div>
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

        <div className="spacer" />
      </div>
    </div>
  );
}
