import { useState, useEffect, useRef } from "react";
import { uid, toISODate } from "../utils.js";
import StatusBar from "../components/StatusBar.jsx";

const SWIPE_HINT_KEY = "cw_swipe_hint_seen";

export default function TasksScreen({ data, setData }) {
  const [sortPanelId, setSortPanelId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [qwFlashId, setQwFlashId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [newItemId, setNewItemId] = useState(null);
  const [processedToday, setProcessedToday] = useState(0);
  const [showClearMsg, setShowClearMsg] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  // Swipe state per row
  const swipeRefs = useRef({});
  const [swipingId, setSwipingId] = useState(null);
  const [swipeX, setSwipeX] = useState(0);

  // Swipe hint — show once on first load
  useEffect(() => {
    try {
      if (!localStorage.getItem(SWIPE_HINT_KEY)) {
        setShowSwipeHint(true);
        const timer = setTimeout(() => {
          setShowSwipeHint(false);
          localStorage.setItem(SWIPE_HINT_KEY, "1");
        }, 4000);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const dismissSwipeHint = () => {
    setShowSwipeHint(false);
    try { localStorage.setItem(SWIPE_HINT_KEY, "1"); } catch {}
  };

  // Shallow work reset logic on mount
  useEffect(() => {
    const todayISO = toISODate();
    if (data.swClearDate === todayISO) return;
    const allDates = Object.keys(data.shallowWork || {}).filter(d => d < todayISO);
    let movedItems = [];
    const newSW = { ...(data.shallowWork || {}) };
    allDates.forEach(dateKey => {
      const tasks = newSW[dateKey] || [];
      const toMove = tasks.filter(t => !t.done && t.sourceType === "manual" && !t.domainId);
      movedItems = [...movedItems, ...toMove.map(t => ({ id: t.id, text: t.text, createdAt: t.addedAt || Date.now(), quickWin: false }))];
      newSW[dateKey] = tasks.filter(t => t.done || t.sourceType !== "manual" || t.domainId);
    });
    if (movedItems.length > 0 || data.swClearDate !== todayISO) {
      setData(d => ({
        ...d,
        fabQueue: [...(d.fabQueue || []), ...movedItems],
        shallowWork: newSW,
        swClearDate: todayISO,
      }));
    }
  }, []);

  // Show "Queue clear" when queue empties
  const fabQueue = data.fabQueue || [];
  const prevLenRef = useRef(fabQueue.length);
  useEffect(() => {
    if (prevLenRef.current > 0 && fabQueue.length === 0) {
      setShowClearMsg(true);
      const t = setTimeout(() => setShowClearMsg(false), 2000);
      return () => clearTimeout(t);
    }
    prevLenRef.current = fabQueue.length;
  }, [fabQueue.length]);

  // ── Swipe handlers ──
  const handleTouchStart = (id, e) => {
    if (editingId || newItemId) return;
    const touch = e.touches[0];
    swipeRefs.current[id] = { startX: touch.clientX, startY: touch.clientY, moved: false };
    setSwipingId(id);
    setSwipeX(0);
  };

  const handleTouchMove = (id, e) => {
    const ref = swipeRefs.current[id];
    if (!ref) return;
    const touch = e.touches[0];
    const dx = touch.clientX - ref.startX;
    const dy = touch.clientY - ref.startY;
    if (!ref.moved && Math.abs(dy) > Math.abs(dx)) {
      swipeRefs.current[id] = null;
      setSwipingId(null);
      setSwipeX(0);
      return;
    }
    ref.moved = true;
    if (swipingId === id) setSwipeX(dx);
  };

  const handleTouchEnd = (id, e) => {
    const ref = swipeRefs.current[id];
    if (!ref) return;
    const dx = swipeX;
    if (ref.moved && showSwipeHint) dismissSwipeHint();

    if (dx > 60) {
      toggleQuickWin(id);
      setQwFlashId(id);
      setTimeout(() => setQwFlashId(null), 400);
      setSwipingId(null);
      setSwipeX(0);
    } else if (dx < -40) {
      setSwipeX(-220);
    } else {
      setSwipingId(null);
      setSwipeX(0);
    }
    swipeRefs.current[id] = null;
  };

  const closeSwipe = () => {
    setSwipingId(null);
    setSwipeX(0);
    setSortPanelId(null);
  };

  // ── Animate-out helper ──
  const animateOut = (itemId, callback) => {
    setRemovingId(itemId);
    setTimeout(() => {
      callback();
      setRemovingId(null);
      setProcessedToday(c => c + 1);
    }, 300);
  };

  // ── Data helpers ──

  const deleteFabItem = (itemId) => {
    closeSwipe();
    animateOut(itemId, () => {
      setData(d => ({
        ...d,
        fabQueue: (d.fabQueue || []).filter(i => i.id !== itemId),
      }));
    });
  };

  const toggleQuickWin = (itemId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).map(i =>
        i.id === itemId ? { ...i, quickWin: !(i.quickWin ?? false) } : i
      ),
    }));
  };

  const routeToToday = (item) => {
    closeSwipe();
    const todayISO = toISODate();
    animateOut(item.id, () => {
      setData(d => ({
        ...d,
        fabQueue: (d.fabQueue || []).filter(i => i.id !== item.id),
        shallowWork: {
          ...(d.shallowWork || {}),
          [todayISO]: [...((d.shallowWork || {})[todayISO] || []), {
            id: item.id, text: item.text, domainId: null,
            sourceType: "manual", sourceId: null, done: false, doneAt: null, addedAt: Date.now(),
          }],
        },
      }));
    });
  };

  const routeToProject = (item, projectId) => {
    setSortPanelId(null);
    closeSwipe();
    animateOut(item.id, () => {
      setData(d => ({
        ...d,
        fabQueue: (d.fabQueue || []).filter(i => i.id !== item.id),
        projects: d.projects.map(p => p.id === projectId
          ? { ...p, tasks: [...p.tasks, { id: uid(), text: item.text, done: false }] }
          : p
        ),
      }));
    });
  };

  const routeToLoose = (item, domainId) => {
    setSortPanelId(null);
    closeSwipe();
    animateOut(item.id, () => {
      setData(d => ({
        ...d,
        fabQueue: (d.fabQueue || []).filter(i => i.id !== item.id),
        looseTasks: [...(d.looseTasks || []), { id: uid(), domainId, text: item.text, done: false, doneAt: null }],
      }));
    });
  };

  // ── Tap empty space to capture ──
  const handleEmptyTap = () => {
    if (editingId || newItemId) return;
    const id = uid();
    setData(d => ({
      ...d,
      fabQueue: [...(d.fabQueue || []), { id, text: "", createdAt: Date.now(), quickWin: false }],
    }));
    setNewItemId(id);
    setEditingId(id);
    setEditingText("");
  };

  const saveEdit = (itemId, text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      // Discard empty items
      setData(d => ({
        ...d,
        fabQueue: (d.fabQueue || []).filter(i => i.id !== itemId),
      }));
    } else {
      setData(d => ({
        ...d,
        fabQueue: (d.fabQueue || []).map(i =>
          i.id === itemId ? { ...i, text: trimmed } : i
        ),
      }));
    }
    setEditingId(null);
    setEditingText("");
    setNewItemId(null);
  };

  const startEditing = (item) => {
    if (editingId) return;
    setEditingId(item.id);
    setEditingText(item.text);
  };

  // ── Render ──

  const { domains, projects } = data;

  const filteredFab = filter === "quickwins"
    ? fabQueue.filter(i => i.quickWin ?? false)
    : fabQueue;

  const totalProcessed = fabQueue.length + processedToday;

  return (
    <div className="screen active" style={{ display: "flex", flexDirection: "column" }} onClick={() => { if (swipingId) closeSwipe(); }}>
      <StatusBar />
      <div className="scroll" style={{ flex: 1, display: "flex", flexDirection: "column", paddingBottom: 100 }}>

        {/* ── HEADER ── */}
        <div className="ph">
          <div className="ph-eye">Tasks</div>
          <div className="ph-title">Tasks</div>
        </div>

        {/* ── PILL FILTERS ── */}
        <div className="tasks-filter-row">
          <button className={`tasks-filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
          <button className={`tasks-filter-pill ${filter === "quickwins" ? "active" : ""}`} onClick={() => setFilter("quickwins")}>⚡ Quick Wins</button>
        </div>

        {/* ── SECTION: QUEUE ── */}
        <div className="sh" style={{ paddingTop: 4 }}>
          <span className="sh-label">
            Queue
            {fabQueue.length > 0 && <span className="tasks-count-badge">{fabQueue.length}</span>}
          </span>
        </div>
        {processedToday > 0 && fabQueue.length > 0 && (
          <div style={{ padding: "0 16px 4px 26px", fontSize: 12, color: "var(--text3)" }}>
            Processed {processedToday} of {totalProcessed} today
          </div>
        )}

        <div style={{ padding: "0 16px" }}>
          {/* Queue clear message */}
          {fabQueue.length === 0 && showClearMsg && (
            <div className="tasks-clear-msg">Queue clear ✓</div>
          )}

          {filteredFab.map((item, idx) => {
            const isQuickWin = item.quickWin ?? false;
            const isSwiping = swipingId === item.id;
            const dx = isSwiping ? swipeX : 0;
            const showActions = dx < -40;
            const isSortOpen = sortPanelId === item.id;
            const isFlashing = qwFlashId === item.id;
            const isEditing = editingId === item.id;
            const isRemoving = removingId === item.id;

            return (
              <div key={item.id}
                className={`tasks-row-divider ${isRemoving ? "tasks-removing" : ""}`}
                onClick={e => e.stopPropagation()}>
                <div className="tasks-swipe-wrap">
                  {isFlashing && (
                    <div className="tasks-qw-flash">★</div>
                  )}

                  <div className="tasks-swipe-actions-right" style={{ opacity: showActions ? 1 : 0 }}>
                    <button className="tasks-swipe-btn sort" onClick={() => { setSortPanelId(isSortOpen ? null : item.id); setSwipingId(null); setSwipeX(0); }}>Sort</button>
                    <button className="tasks-swipe-btn today" onClick={() => routeToToday(item)}>Today</button>
                    <button className="tasks-swipe-btn delete" onClick={() => deleteFabItem(item.id)}>Delete</button>
                  </div>

                  <div
                    className={`tasks-row ${isSwiping ? "swiping" : ""}`}
                    style={{ transform: `translateX(${Math.min(0, dx)}px)` }}
                    onTouchStart={e => handleTouchStart(item.id, e)}
                    onTouchMove={e => handleTouchMove(item.id, e)}
                    onTouchEnd={e => handleTouchEnd(item.id, e)}
                  >
                    <div className="tasks-circle" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <input
                          autoFocus
                          className="tasks-inline-input"
                          value={editingText}
                          onChange={e => setEditingText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveEdit(item.id, editingText);
                            if (e.key === "Escape") {
                              if (newItemId === item.id) {
                                // Discard new empty item
                                setData(d => ({ ...d, fabQueue: (d.fabQueue || []).filter(i => i.id !== item.id) }));
                              }
                              setEditingId(null);
                              setEditingText("");
                              setNewItemId(null);
                            }
                          }}
                          onBlur={() => saveEdit(item.id, editingText)}
                          placeholder="What's on your mind…"
                        />
                      ) : (
                        <div className="tasks-text"
                          onClick={() => startEditing(item)}
                          style={{ cursor: "text" }}>
                          {item.text}
                        </div>
                      )}
                      {(() => {
                        const dom = item.domainId ? domains.find(d => d.id === item.domainId) : null;
                        return dom ? <div className="tasks-domain-dot" style={{ background: dom.color }} /> : null;
                      })()}
                    </div>
                    {!isEditing && isQuickWin && (
                      <span style={{ fontSize: 16, flexShrink: 0, alignSelf: "center" }}>⚡</span>
                    )}
                  </div>
                </div>

                {idx === 0 && showSwipeHint && (
                  <div className="tasks-swipe-hint">{"\u2192"} Quick Win  ·  Sort  Today  Delete {"\u2190"}</div>
                )}

                {isSortOpen && (
                  <div className="tasks-sort-panel">
                    {domains.map(domain => (
                      <div key={domain.id} className="tasks-sort-row" onClick={() => routeToLoose(item, domain.id)}>
                        <div className="tasks-sort-dot" style={{ background: domain.color }} />
                        <span className="tasks-sort-name">{domain.name}</span>
                      </div>
                    ))}
                    {projects.filter(p => p.status === "active").map(proj => {
                      const dom = domains.find(d => d.id === proj.domainId);
                      return (
                        <div key={proj.id} className="tasks-sort-row" onClick={() => routeToProject(item, proj.id)}>
                          <div className="tasks-sort-dot" style={{ background: dom?.color || "var(--text3)" }} />
                          <div style={{ flex: 1 }}>
                            <span className="tasks-sort-name">{proj.name}</span>
                            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 1 }}>{dom?.name}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── TAP EMPTY SPACE TO CAPTURE ── */}
        <div
          style={{ flex: 1, minHeight: 120, cursor: "pointer" }}
          onClick={handleEmptyTap}
        />
      </div>
    </div>
  );
}
