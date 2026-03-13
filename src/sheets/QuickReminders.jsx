import { useState, useEffect, useRef } from "react";
import { uid } from "../utils.js";

function QuickReminders({ onClose, onAddCaptured, existingCaptured }) {
  const [draft, setDraft] = useState("");
  const [localItems, setLocalItems] = useState([]); // items added this session
  const taRef = useRef(null);

  useEffect(() => { setTimeout(() => taRef.current?.focus(), 80); }, []);

  // Auto-resize textarea
  const autoResize = (el) => { if (!el) return; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };

  const commitLine = () => {
    const t = draft.trim();
    if (!t) { onClose(); return; }
    const item = { id: uid(), text: t, createdAt: Date.now() };
    onAddCaptured(item);
    setLocalItems(prev => [...prev, item]);
    setDraft("");
    setTimeout(() => { if (taRef.current) { taRef.current.style.height = "auto"; taRef.current.focus(); } }, 0);
  };

  const finish = () => {
    const t = draft.trim();
    if (t) { const item = { id: uid(), text: t, createdAt: Date.now() }; onAddCaptured(item); setLocalItems(prev => [...prev, item]); }
    onClose();
  };

  const totalCount = (existingCaptured?.length || 0) + localItems.length;

  return (
    <>
      <div className="cap-backdrop" onClick={finish} />
      <div className="cap-panel" onClick={e => e.stopPropagation()}>
        <div className="cap-handle-row"><div className="cap-handle" /></div>
        <div className="cap-header">
          <span className="cap-title">Captured</span>
          <button className="cap-close" onClick={finish}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Items captured so far this session */}
        {localItems.length > 0 && (
          <div className="cap-items">
            {localItems.map(item => (
              <div key={item.id} className="cap-item">
                <div className="cap-item-dot" />
                <span className="cap-item-text">{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Input — feels like Notes */}
        <div className="cap-textarea-row">
          <textarea
            ref={taRef}
            className="cap-textarea"
            placeholder={localItems.length === 0 ? "What's on your mind… (Enter to save each line)" : "Keep going…"}
            value={draft}
            rows={2}
            onChange={e => { setDraft(e.target.value); autoResize(e.target); }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitLine(); }
              if (e.key === "Escape") finish();
            }}
          />
        </div>

        <div className="cap-footer">
          <span className="cap-count">
            {totalCount > 0 ? `${totalCount} captured` : "Enter to save each thought"}
          </span>
          <button className="cap-done-btn" onClick={finish}>Done</button>
        </div>
      </div>
    </>
  );
}

export default QuickReminders;
