import { useState } from "react";
import { fmtTime, getPct } from "../utils.js";
import useSwipeDown from "../useSwipeDown.js";

function DWPickerSheet({ data, slot, dateStr, slotIndex, onConfirm, onClose, preSelectedProjectId, preSelectedTasks }) {
  const swipe = useSwipeDown(onClose);
  const { domains, projects } = data;

  const [activeDomainTab, setActiveDomainTab] = useState("all");
  const [selectedProjId, setSelectedProjId] = useState(preSelectedProjectId || null);
  const [selectedTasks, setSelectedTasks] = useState(() => new Set(preSelectedTasks || []));

  const activeProjects = projects.filter(p => p.status === "active");
  const filtered = activeDomainTab === "all"
    ? activeProjects
    : activeProjects.filter(p => p.domainId === activeDomainTab);

  const toggleTaskSelection = (taskId) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectProject = (projId) => {
    if (selectedProjId === projId) {
      setSelectedProjId(null);
      setSelectedTasks(new Set());
    } else {
      setSelectedProjId(projId);
      setSelectedTasks(new Set());
    }
  };

  const handleConfirm = () => {
    onConfirm(dateStr, slotIndex, selectedProjId, [...selectedTasks]);
    onClose();
  };

  const timeLabel = slot ? `${fmtTime(slot.startHour, slot.startMin)} · ${slot.durationMin} min` : "";

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="dwpicker-sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />

        {/* Header */}
        <div style={{ padding: "0 0 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 4 }}>
            Pick a Focus
          </div>
          <div style={{ fontSize: 13, color: "var(--text2)" }}>{timeLabel}</div>
        </div>

        {/* Domain tabs */}
        <div className="dwpicker-tabs">
          <button
            className={`dwpicker-tab${activeDomainTab === "all" ? " active" : ""}`}
            onClick={() => setActiveDomainTab("all")}
          >All</button>
          {domains.map(d => (
            <button
              key={d.id}
              className={`dwpicker-tab${activeDomainTab === d.id ? " active" : ""}`}
              style={activeDomainTab === d.id ? { color: d.color, background: `${d.color}26` } : {}}
              onClick={() => setActiveDomainTab(d.id)}
            >{d.name}</button>
          ))}
        </div>

        {/* Project list */}
        <div className="dwpicker-scroll">
          {filtered.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "var(--text3)" }}>
              No active projects in this domain.
            </div>
          )}

          {filtered.map(proj => {
            const domain = domains.find(d => d.id === proj.domainId);
            const isSelected = selectedProjId === proj.id;
            const incompleteTasks = (proj.tasks || []).filter(t => !t.done);
            const pct = getPct(proj.tasks || []);

            return (
              <div
                key={proj.id}
                className={`dwpicker-card${isSelected ? " selected" : ""}`}
                style={isSelected && domain?.color ? { borderColor: "var(--border)" } : {}}
                onClick={() => selectProject(proj.id)}
              >
                {/* Left color stripe — only when selected */}
                {isSelected && domain?.color && (
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: domain.color, borderRadius: "14px 0 0 14px" }} />
                )}

                {/* Card header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 8px", paddingLeft: isSelected ? 18 : 14 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: domain?.color || "var(--text3)", flexShrink: 0, opacity: isSelected ? 1 : 0.4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isSelected ? "var(--text)" : "var(--text2)", lineHeight: 1.2 }}>{proj.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{domain?.name}</div>
                  </div>
                  {!isSelected && incompleteTasks.length > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>{incompleteTasks.length} tasks</span>
                  )}
                </div>

                {/* Task list */}
                <div style={{ padding: "0 14px 10px", paddingLeft: isSelected ? 18 : 14 }}>
                  {(proj.tasks || []).map((t, i) => {
                    if (t.done && !isSelected) return null;
                    const isChecked = selectedTasks.has(t.id);
                    return (
                      <div
                        key={t.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "7px 0",
                          borderTop: i > 0 || isSelected ? "1px solid var(--border2)" : "none",
                        }}
                        onClick={isSelected && !t.done ? (e) => { e.stopPropagation(); toggleTaskSelection(t.id); } : undefined}
                      >
                        {isSelected && !t.done ? (
                          <div style={{
                            width: 20, height: 20, borderRadius: "50%",
                            border: isChecked ? "none" : "2px solid var(--border)",
                            background: isChecked ? (domain?.color || "var(--accent)") : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, cursor: "pointer", transition: "all .15s",
                          }}>
                            {isChecked && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                          </div>
                        ) : null}
                        <span style={{
                          fontSize: 13,
                          color: t.done ? "var(--text3)" : (isSelected ? "var(--text)" : "var(--text3)"),
                          textDecoration: t.done ? "line-through" : "none",
                          flex: 1,
                        }}>{t.text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Confirm button — only on selected card */}
                {isSelected && (
                  <div style={{ padding: "0 14px 12px", paddingLeft: 18 }}>
                    <button
                      className="dwpicker-confirm"
                      onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
                    >
                      Confirm{selectedTasks.size > 0 ? ` · ${selectedTasks.size} task${selectedTasks.size !== 1 ? "s" : ""}` : ""} →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default DWPickerSheet;
