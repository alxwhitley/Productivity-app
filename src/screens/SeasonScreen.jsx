import { useState, useRef } from "react";
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
  essential: { bg: "rgba(184,155,106,0.15)", color: "#B89B6A" },
  maintain:  { bg: "rgba(138,144,153,0.15)", color: "#8A9099" },
  bonus:     { bg: "rgba(155,114,207,0.15)", color: "var(--purple)" },
};

const TYPE_DESC = {
  essential: "The goal that defines this season. Everything else serves this.",
  maintain:  "Important work that needs to stay alive, but you're not pushing it forward.",
  bonus:     "A stretch goal. Only chase this once your Essential goals are on track.",
};

function getQuarter(d) { return Math.floor(d.getMonth() / 3) + 1; }

function quarterStartEnd(q, year) {
  const s = new Date(year, (q - 1) * 3, 1);
  const e = new Date(year, q * 3, 0, 23, 59, 59, 999);
  return { start: s, end: e };
}

export default function SeasonScreen({ data, setData }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQ = getQuarter(now);

  const [selectedQ, setSelectedQ] = useState(currentQ);
  const [addingSlot, setAddingSlot] = useState(null);
  const [addText, setAddText] = useState("");
  const [addType, setAddType] = useState("essential");
  const [addDomainId, setAddDomainId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const addFormRef = useRef(null);
  const inputRef = useRef(null);

  const { domains, projects, seasonGoals, blockCompletions, deepWorkSlots } = data;
  const goals = seasonGoals || [];

  const isCurrentQ = selectedQ === currentQ;
  const isPastQ = selectedQ < currentQ;

  const getDomain = (id) => domains.find(d => d.id === id);

  const { start: qStart, end: qEnd } = quarterStartEnd(selectedQ, currentYear);
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
    setDeleteConfirm(null);
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

  // ── Domain balance ──
  const domainMins = {};
  let totalMins = 0;
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
    totalMins += (c.durationMin || 0);
  });

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

  // ── Render helpers ──
  const filledSlots = goals.slice(0, MAX_GOALS);
  const emptyCount = MAX_GOALS - filledSlots.length;

  const renderGoalRow = (goal, idx, total, readOnly) => {
    const dom = getDomain(goal.domainId);
    const pill = TYPE_PILLS[goal.type] || TYPE_PILLS.essential;
    const isDeleting = deleteConfirm === goal.id;

    return (
      <div key={goal.id} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 0",
        borderBottom: idx < total - 1 ? "1px solid var(--border)" : "none",
        opacity: goal.done ? 0.5 : 1, transition: "opacity .15s",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dom?.color || "var(--text3)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 2 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
              padding: "2px 6px", borderRadius: 4, background: pill.bg, color: pill.color,
            }}>{goal.type}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", textDecoration: goal.done ? "line-through" : "none" }}>
            {goal.text}
          </div>
        </div>
        {!readOnly && (
          <>
            {isDeleting ? (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => deleteGoal(goal.id)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Delete</button>
                <button onClick={() => setDeleteConfirm(null)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setDeleteConfirm(goal.id)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 12, cursor: "pointer", padding: "4px", flexShrink: 0 }}>✕</button>
            )}
            <div onClick={() => toggleDone(goal.id)} style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
              background: goal.done ? "var(--green)" : "transparent",
              border: goal.done ? "none" : "1.5px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {goal.done && <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>✓</span>}
            </div>
          </>
        )}
      </div>
    );
  };

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

      <div className="scroll" style={{ padding: "0 0 40px" }}>

        {/* ── Quarter row ── */}
        <div style={{ display: "flex", gap: 6, padding: "4px 16px 20px" }}>
          {QUARTER_META.map(({ q, label, sub }) => {
            const isCurr = q === currentQ;
            const past = q < currentQ;
            const future = q > currentQ;
            const sel = q === selectedQ;

            return (
              <div key={q}
                onClick={() => { if (!future) setSelectedQ(q); }}
                style={{
                  flex: 1, textAlign: "center", padding: "10px 4px", borderRadius: 10,
                  background: sel && isCurr ? "rgba(155,114,207,0.15)" : "var(--bg3)",
                  border: sel && isCurr ? "1.5px solid var(--purple)" : sel && past ? "1.5px solid var(--border)" : "1.5px solid transparent",
                  opacity: isCurr ? 1 : past ? 0.45 : 0.35,
                  cursor: future ? "default" : "pointer",
                  transition: "all .15s",
                }}
              >
                <div style={{ fontSize: isCurr ? 15 : 13, fontWeight: 700, color: sel && isCurr ? "var(--text)" : "var(--text2)" }}>{label}</div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{sub}</div>
              </div>
            );
          })}
        </div>

        {/* Past quarter banner */}
        {isPastQ && (
          <div style={{ margin: "0 16px 16px", padding: "12px 16px", background: "var(--bg3)", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>Q{selectedQ} · {currentYear} — Season complete</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", marginTop: 4 }}>READ ONLY</div>
          </div>
        )}

        {/* ── GOALS ── */}
        <div className="sh" style={{ paddingTop: 8 }}>
          <span className="sh-label">GOALS</span>
          <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>{goals.length} / {MAX_GOALS}</span>
        </div>

        <div style={{ padding: "0 16px" }}>
          {/* Filled slots */}
          {filledSlots.map((g, i) => renderGoalRow(g, i, MAX_GOALS, isPastQ))}

          {/* Empty slots — current quarter only */}
          {isCurrentQ && Array.from({ length: emptyCount }, (_, i) => {
            const slotIdx = filledSlots.length + i;
            const isAdding = addingSlot === slotIdx;

            return (
              <div key={`empty-${i}`} ref={isAdding ? addFormRef : null}
                style={{ padding: "12px 0", borderBottom: slotIdx < MAX_GOALS - 1 ? "1px solid var(--border)" : "none" }}>
                {isAdding ? (
                  <div>
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

                    {/* Domain color dots */}
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

                    <span onClick={addGoal}
                      style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}>Add</span>
                  </div>
                ) : (
                  <div onClick={() => openAddSlot(slotIdx)}
                    style={{
                      border: "1.5px dashed var(--border)", borderRadius: 10, padding: "14px 16px",
                      cursor: "pointer", textAlign: "center",
                    }}>
                    <span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>+ Add goal</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Past quarter empty */}
          {isPastQ && goals.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>
              No goals recorded for this quarter
            </div>
          )}
        </div>

        {/* ── DOMAIN BALANCE ── */}
        <div className="sh" style={{ paddingTop: 20 }}>
          <span className="sh-label">DOMAIN BALANCE</span>
        </div>
        <div style={{ padding: "0 16px" }}>
          {(() => {
            const activeDomains = domains.filter(d => projects.some(p => p.domainId === d.id && p.status === "active"));
            if (totalMins === 0) {
              return (
                <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "16px 0" }}>
                  Block time will appear here as you complete work sessions.
                </div>
              );
            }
            return activeDomains.map(d => {
              const mins = domainMins[d.id] || 0;
              const pct = totalMins > 0 ? (mins / totalMins) * 100 : 0;
              const hrs = (mins / 60).toFixed(1);
              return (
                <div key={d.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>{hrs} hrs</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg4)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: d.color, transition: "width .3s" }} />
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* ── DEEP WORK ── */}
        <div className="sh" style={{ paddingTop: 20 }}>
          <span className="sh-label">DEEP WORK</span>
        </div>
        <div style={{ display: "flex", gap: 12, padding: "0 16px" }}>
          <div style={{ flex: 1, background: "var(--bg3)", borderRadius: 12, padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>
              {totalDWHrs > 0 ? (totalDWHrs % 1 === 0 ? totalDWHrs : totalDWHrs.toFixed(1)) : "0"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>hrs this season</div>
          </div>
          <div style={{ flex: 1, background: "var(--bg3)", borderRadius: 12, padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>
              {avgDWPerWeek > 0 ? avgDWPerWeek.toFixed(1) : "0"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>hrs / week avg</div>
          </div>
        </div>

        {/* ── PROJECTS ── */}
        <div className="sh" style={{ paddingTop: 20 }}>
          <span className="sh-label">PROJECTS</span>
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
                  <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500 }}>✓ Complete</span>
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
          {seasonCompletions.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "16px 0" }}>
              Weekly review data will appear as the season progresses.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                {weekDots.map((w, i) => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: w.filled ? "#B89B6A" : "var(--bg4)",
                    opacity: w.past || w.filled ? 1 : 0.4,
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>
                {shutdownWeeks} of {weekDots.filter(w => w.past).length} weeks with a shutdown ritual completed
              </div>
            </>
          )}
        </div>

        <div className="spacer" />
      </div>
    </div>
  );
}
