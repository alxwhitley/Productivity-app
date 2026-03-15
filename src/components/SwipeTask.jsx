import { useState, useRef } from "react";

function SwipeTask({ task, onToggle, onDelete, onSave, onToday, scrollIntoView }) {
  const [offset, setOffset]   = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(task.text);
  const [bouncing, setBouncing] = useState(false);
  const startX = useRef(null);
  const hasToday = onToday && !task.done;
  const MAX = hasToday ? 128 : 72;
  const THRESHOLD = hasToday ? 80 : 56;

  const onTouchStart = e => { startX.current = e.touches[0].clientX; };
  const onTouchMove  = e => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setOffset(Math.max(dx, -MAX));
    else if (offset < 0) setOffset(Math.min(0, offset + dx));
  };
  const onTouchEnd = () => {
    if (offset < -THRESHOLD) { setOffset(-MAX); } else { setOffset(0); }
    startX.current = null;
  };

  const commitEdit = () => {
    const t = draft.trim();
    if (!t) { onDelete(); return; }
    if (t !== task.text) onSave(t);
    setEditing(false);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!task.done) {
      setBouncing(true);
      setTimeout(() => setBouncing(false), 400);
    }
    onToggle();
  };

  return (
    <div className={`st-wrap${bouncing ? " flash" : ""}`}>
      <div className="st-delete-bg" style={{ display: "flex" }}>
        {onToday && !task.done && (
          <div style={{ width: 56, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            onClick={() => { onToday(); setOffset(0); }}>
            <span style={{ color: "#000", fontSize: 11, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase" }}>Today</span>
          </div>
        )}
        <div style={{ flex: 1, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={onDelete}>
          <span className="st-delete-ico">Delete</span>
        </div>
      </div>
      <div
        className="st-inner"
        style={{ transform: `translateX(${offset}px)`, transition: startX.current === null ? "transform .2s ease" : "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Circle — toggles done */}
        <div
          className={`t-check ${task.done ? "done" : ""}${bouncing ? " bouncing" : ""}`}
          style={{ flexShrink: 0, marginTop: 2, cursor: "pointer" }}
          onClick={handleToggle}
        />
        {/* Text — tapping opens edit; done tasks show strikethrough, no edit */}
        {editing ? (
          <input
            className="st-edit-input"
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onFocus={e => { if (scrollIntoView) scrollIntoView(e.target); }}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") { setDraft(task.text); setEditing(false); } }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className={`t-text ${task.done ? "done" : ""}`}
            style={{ flex: 1, cursor: task.done ? "default" : "text" }}
            onClick={e => { e.stopPropagation(); if (!task.done) { setDraft(task.text); setEditing(true); } }}
          >
            {task.text}
          </span>
        )}
      </div>
    </div>
  );
}

export default SwipeTask;
