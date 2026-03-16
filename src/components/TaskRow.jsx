import { useState, useRef } from "react";

/**
 * Universal task row — single interaction standard across all surfaces.
 *
 * Tap checkbox  → toggle done (bounce + green fill)
 * Tap text      → inline edit (Enter/blur saves, Escape cancels)
 * Swipe left    → reveal Delete (~80px)
 * Swipe right   → toggle quickWin
 */
export default function TaskRow({ task, onToggle, onEdit, onDelete, onQuickWin, className, bg, autoEdit }) {
  const [offset, setOffset]     = useState(0);
  const [editing, setEditing]   = useState(!!autoEdit);
  const [draft, setDraft]       = useState(autoEdit ? (task.text || "") : task.text);
  const [bouncing, setBouncing] = useState(false);
  const [qwFlash, setQwFlash]   = useState(false);
  const startRef = useRef(null);

  const isDone     = task.done ?? false;
  const isQuickWin = task.quickWin ?? false;

  // ── Swipe handlers ──
  const handleTouchStart = (e) => {
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: false };
  };

  const handleTouchMove = (e) => {
    const ref = startRef.current;
    if (!ref) return;
    const dx = e.touches[0].clientX - ref.x;
    const dy = e.touches[0].clientY - ref.y;
    if (!ref.locked && Math.abs(dy) > Math.abs(dx)) {
      startRef.current = null;
      setOffset(0);
      return;
    }
    ref.locked = true;
    setOffset(Math.max(-80, Math.min(80, dx)));
  };

  const handleTouchEnd = () => {
    const ref = startRef.current;
    if (!ref) return;
    if (offset > 60) {
      onQuickWin();
      setQwFlash(true);
      setTimeout(() => setQwFlash(false), 400);
      setOffset(0);
    } else if (offset < -60) {
      setOffset(-80);
    } else {
      setOffset(0);
    }
    startRef.current = null;
  };

  // ── Checkbox ──
  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isDone) {
      setBouncing(true);
      setTimeout(() => setBouncing(false), 400);
    }
    onToggle();
  };

  // ── Inline edit ──
  const commitEdit = () => {
    const t = draft.trim();
    if (!t) { onDelete(); return; }
    if (t !== task.text) onEdit(t);
    setEditing(false);
  };

  const isSwiping = startRef.current?.locked;

  return (
    <div className={`tr-wrap${className ? ` ${className}` : ""}`}>
      {/* Quick-win flash overlay */}
      {qwFlash && <div className="tr-qw-flash">★</div>}

      {/* Delete reveal */}
      <div className="tr-delete-bg">
        <span className="tr-delete-label" onClick={() => { onDelete(); setOffset(0); }}>Delete</span>
      </div>

      {/* Sliding row */}
      <div
        className={`tr-inner${isSwiping ? " swiping" : ""}`}
        style={{ transform: `translateX(${Math.min(0, offset)}px)`, background: bg || "var(--bg2)" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (offset < -60) setOffset(0); }}
      >
        {/* Checkbox */}
        <div
          className={`t-check${isDone ? " done" : ""}${bouncing ? " bouncing" : ""}`}
          style={{ flexShrink: 0, cursor: "pointer" }}
          onClick={handleToggle}
        />

        {/* Text / Edit */}
        {editing ? (
          <input
            className="tr-edit-input"
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") {
                if (!task.text && !draft.trim()) { onDelete(); return; }
                setDraft(task.text); setEditing(false);
              }
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className={`t-text${isDone ? " done" : ""}`}
            style={{ flex: 1, cursor: isDone ? "default" : "text" }}
            onClick={e => { e.stopPropagation(); if (!isDone) { setDraft(task.text); setEditing(true); } }}
          >
            {task.text}
          </span>
        )}

        {/* Quick Win bolt badge */}
        {!editing && isQuickWin && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, alignSelf: "center" }}>
            <path d="M13 2L4.09 12.63a1 1 0 0 0 .78 1.62H11l-1 7.25L19.91 11.37a1 1 0 0 0-.78-1.62H13l1-7.75Z" fill="var(--accent)" />
          </svg>
        )}
      </div>
    </div>
  );
}
