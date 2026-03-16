import { useState } from "react";
import { toISODate, fmtTime } from "../utils.js";

const SHUTDOWN_QUOTES = [
  { quote: "Shutdown complete. Protect your rest — it's what makes tomorrow's depth possible.", author: "Cal Newport" },
  { quote: "The ability to perform deep work is becoming increasingly rare. You did it today.", author: "Cal Newport" },
  { quote: "Stress + rest = growth. The rest is not optional.", author: "Andrew Huberman" },
  { quote: "Your work is done. The mind that rests well is the mind that focuses well.", author: "Cal Newport" },
  { quote: "Dopamine is not just about pleasure — it's about the anticipation of tomorrow's work. Rest now.", author: "Andrew Huberman" },
  { quote: "A deep life is a good life. Today you lived it.", author: "Cal Newport" },
  { quote: "Sleep is the foundation of all mental performance. Shutdown complete.", author: "Andrew Huberman" },
];

const FIXED_DW_SLOTS = [
  { slotIndex: 0, startHour: 9, startMin: 0, durationMin: 90 },
  { slotIndex: 1, startHour: 11, startMin: 0, durationMin: 90 },
  { slotIndex: 2, startHour: 13, startMin: 0, durationMin: 90 },
];

export default function ShutdownRitualScreen({ data, setData, onClose }) {
  const [step, setStep] = useState(0);
  const [leadText, setLeadText] = useState(data.leadDomino || "");
  const [pickerSlot, setPickerSlot] = useState(null); // slot index being picked

  const todayISO = toISODate();
  const todayStr = new Date().toDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = toISODate(tomorrow);

  const { domains, projects } = data;
  const getDomain = id => domains.find(d => d.id === id);

  // ── Step 0: Today's activity ──
  const todayCompletions = (data.blockCompletions || []).filter(c => c.date === todayStr);
  const activeProjects = projects.filter(proj => {
    const hasCompletion = todayCompletions.some(c => {
      const slots = (data.deepWorkSlots || {})[todayISO] || [];
      return slots.some(s => s && s.projectId === proj.id);
    });
    const hasTasks = proj.tasks.some(t => t.done && t.doneAt && new Date(t.doneAt).toDateString() === todayStr);
    return hasCompletion || hasTasks;
  });

  // ── Step 1: Tomorrow's DW slots ──
  const savedTomorrowSlots = (data.deepWorkSlots || {})[tomorrowISO] || [];
  const tomorrowSlots = FIXED_DW_SLOTS.map((def, i) => {
    const saved = savedTomorrowSlots[i] || {};
    return {
      slotIndex: i,
      startHour: saved.startHour ?? def.startHour,
      startMin: saved.startMin ?? def.startMin,
      durationMin: saved.durationMin ?? def.durationMin,
      projectId: saved.projectId || null,
    };
  });

  const assignSlot = (slotIndex, projectId) => {
    setData(d => {
      const existing = [...((d.deepWorkSlots || {})[tomorrowISO] || [])];
      while (existing.length <= slotIndex) existing.push({});
      existing[slotIndex] = { ...existing[slotIndex], projectId };
      return { ...d, deepWorkSlots: { ...(d.deepWorkSlots || {}), [tomorrowISO]: existing } };
    });
    setPickerSlot(null);
  };

  // ── Step 2: Tomorrow's shallow tasks ──
  const tomorrowPicks = (data.todayLoosePicks || {})[tomorrowISO] || [];
  const undoneLoose = (data.looseTasks || []).filter(t => !t.done);

  const togglePick = (taskId) => {
    setData(d => {
      const picks = { ...(d.todayLoosePicks || {}) };
      const existing = picks[tomorrowISO] || [];
      if (existing.includes(taskId)) {
        picks[tomorrowISO] = existing.filter(id => id !== taskId);
      } else {
        picks[tomorrowISO] = [...existing, taskId];
      }
      return { ...d, todayLoosePicks: picks };
    });
  };

  // ── Step 4: Quote ──
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const quote = SHUTDOWN_QUOTES[dayOfYear % SHUTDOWN_QUOTES.length];

  const handleDone = () => {
    setData(d => ({ ...d, shutdownDone: true, shutdownDate: todayISO, leadDomino: leadText.trim(), taskCompletions: { ...(d.taskCompletions || {}), [todayISO]: [] } }));
    onClose();
  };

  const totalSteps = 5;
  const isLastStep = step === 4;

  const renderStep = () => {
    if (step === 0) {
      // Reflect on today
      const todayDate = new Date();
      const dateLabel = todayDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      return (
        <div style={{ flex: 1, overflow: "auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Today's Work</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>{dateLabel}</div>
          </div>
          {activeProjects.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 14, padding: "32px 0" }}>
              No blocks logged today
            </div>
          ) : (
            activeProjects.map((proj, i) => {
              const dom = getDomain(proj.domainId);
              const isSession = (proj.type || proj.mode) === "sessions";
              let detail = "";
              if (isSession) {
                const todayMins = todayCompletions.reduce((sum, c) => {
                  const slots = (data.deepWorkSlots || {})[todayISO] || [];
                  const match = slots.some(s => s && s.projectId === proj.id);
                  return match ? sum + (c.durationMin || 0) : sum;
                }, 0);
                const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
                const weekMins = (data.blockCompletions || []).reduce((sum, c) => {
                  if (new Date(c.date) < weekStart) return sum;
                  const slots = (data.deepWorkSlots || {})[c.date] || [];
                  const match = slots.some(s => s && s.projectId === proj.id);
                  return match ? sum + (c.durationMin || 0) : sum;
                }, 0);
                detail = `${todayMins} min logged today · ${(weekMins / 60).toFixed(1)} hrs this week`;
              } else {
                const todayDone = proj.tasks.filter(t => t.done && t.doneAt && new Date(t.doneAt).toDateString() === todayStr).length;
                const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
                const weekDone = proj.tasks.filter(t => t.done && t.doneAt && new Date(t.doneAt) >= weekStart).length;
                detail = `${todayDone} tasks completed today · ${weekDone}/${proj.tasks.length} done this week`;
              }
              return (
                <div key={proj.id} style={{ padding: "14px 0", borderBottom: i < activeProjects.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{proj.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{dom?.name || ""}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{detail}</div>
                </div>
              );
            })
          )}
        </div>
      );
    }

    if (step === 1) {
      // Tomorrow's DW blocks
      const activeProjs = projects.filter(p => p.status === "active");
      return (
        <div style={{ flex: 1, overflow: "auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Tomorrow's Deep Work</div>
          </div>
          {tomorrowSlots.map((slot, i) => {
            const proj = slot.projectId ? projects.find(p => p.id === slot.projectId) : null;
            const dom = proj ? getDomain(proj.domainId) : null;
            const timeLabel = fmtTime(slot.startHour, slot.startMin);
            const isPicking = pickerSlot === i;

            return (
              <div key={i} style={{ marginBottom: 12 }}>
                {proj ? (
                  <div
                    onClick={() => setPickerSlot(isPicking ? null : i)}
                    style={{ background: "var(--bg3)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", border: "1px solid var(--border)" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{proj.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{timeLabel} · {slot.durationMin} min</div>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: dom?.color || "var(--text3)" }} />
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setPickerSlot(isPicking ? null : i)}
                    style={{ border: "1.5px dashed var(--border)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "center" }}
                  >
                    <div style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>+ Assign project</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, opacity: 0.6 }}>{timeLabel} · {slot.durationMin} min</div>
                  </div>
                )}
                {isPicking && (
                  <div style={{ background: "var(--bg3)", borderRadius: "0 0 12px 12px", marginTop: -2, padding: "8px", border: "1px solid var(--border)", borderTop: "none" }}>
                    {activeProjs.map(p => {
                      const d = getDomain(p.domainId);
                      return (
                        <div key={p.id}
                          onClick={() => assignSlot(i, p.id)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 8, cursor: "pointer" }}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: d?.color || "var(--text3)" }} />
                          <span style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{p.name}</span>
                        </div>
                      );
                    })}
                    {slot.projectId && (
                      <div
                        onClick={() => assignSlot(i, null)}
                        style={{ padding: "10px 8px", fontSize: 12, color: "var(--red)", cursor: "pointer", borderTop: "1px solid var(--border)", marginTop: 4 }}
                      >Unassign</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (step === 2) {
      // Tomorrow's shallow tasks
      const picked = new Set(tomorrowPicks);
      const sorted = [...undoneLoose].sort((a, b) => {
        const ap = picked.has(a.id) ? 0 : 1;
        const bp = picked.has(b.id) ? 0 : 1;
        return ap - bp;
      });
      return (
        <div style={{ flex: 1, overflow: "auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Tomorrow's Tasks</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>quick tasks · emails · admin</div>
          </div>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 14, padding: "32px 0" }}>
              No loose tasks available
            </div>
          ) : (
            sorted.map(t => {
              const isPicked = picked.has(t.id);
              return (
                <div key={t.id}
                  onClick={() => togglePick(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: isPicked ? "var(--purple)" : "transparent",
                    border: isPicked ? "none" : "1.5px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isPicked && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 14, color: "var(--text)" }}>{t.text}</span>
                </div>
              );
            })
          )}
        </div>
      );
    }

    if (step === 3) {
      // Lead domino
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Most Important Tomorrow</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 6 }}>One thing. The work that matters most.</div>
          </div>
          <input
            value={leadText}
            onChange={e => setLeadText(e.target.value)}
            placeholder="What's the one thing?"
            style={{
              width: "100%", maxWidth: 320, background: "transparent", border: "none",
              borderBottom: "1px solid var(--border)", fontSize: 18, color: "var(--text)",
              textAlign: "center", padding: "12px 0", outline: "none",
              fontFamily: "'DM Sans',sans-serif",
            }}
          />
        </div>
      );
    }

    if (step === 4) {
      // Shutdown complete
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ maxWidth: "80%", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text)", lineHeight: 1.6, marginBottom: 16 }}>
              "{quote.quote}"
            </div>
            <div style={{ fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>
              — {quote.author}
            </div>
          </div>
          <button
            onClick={handleDone}
            style={{
              marginTop: 40, background: "var(--purple)", color: "var(--text)", border: "none",
              borderRadius: 12, padding: "12px 32px", fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
            }}
          >Done</button>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "#1A1320",
      display: "flex", flexDirection: "column",
      animation: "sd-slide-down .35s ease forwards",
    }}>
      {/* Close button */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 20px 0", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: 16 }}>
        {renderStep()}
      </div>

      {/* Bottom bar — dots + next */}
      {!isLastStep && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px 24px", flexShrink: 0 }}>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: totalSteps - 1 }, (_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: i === step ? "var(--purple)" : i < step ? "var(--text3)" : "var(--bg4)",
              }} />
            ))}
          </div>
          {/* Next button */}
          <button
            onClick={() => setStep(s => s + 1)}
            style={{
              background: "var(--purple)", color: "var(--text)", border: "none",
              borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
            }}
          >Next →</button>
        </div>
      )}
    </div>
  );
}
