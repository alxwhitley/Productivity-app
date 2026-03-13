import { useState, useRef } from "react";

function SwipeTask({ task, onToggle, onDelete, onSave }) {
  const [offset, setOffset]   = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(task.text);
  const [bouncing, setBouncing] = useState(false);
  const startX = useRef(null);
  const THRESHOLD = 56;
  const MAX = 72;

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
      <div className="st-delete-bg" onClick={onDelete}>
        <span className="st-delete-ico">Delete</span>
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
