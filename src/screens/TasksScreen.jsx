import { useState, useEffect, useRef } from "react";
import { uid, toISODate } from "../utils.js";
import StatusBar from "../components/StatusBar.jsx";

const SWIPE_HINT_KEY = "cw_swipe_hint_seen";

export default function TasksScreen({ data, setData }) {
  const [sortPanelId, setSortPanelId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [qwFlashId, setQwFlashId] = useState(null);

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

  // Shallow work reset logic on mount (moves undone manual tasks back to fabQueue)
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

  // ── Swipe handlers ──
  // Swipe LEFT (negative dx) → reveal action buttons on RIGHT
  // Swipe RIGHT (positive dx) → toggle quickWin

  const handleTouchStart = (id, e) => {
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
    if (swipingId === id) {
      setSwipeX(dx);
    }
  };

  const handleTouchEnd = (id, e) => {
    const ref = swipeRefs.current[id];
    if (!ref) return;
    const dx = swipeX;

    // Any swipe dismisses the hint
    if (ref.moved && showSwipeHint) dismissSwipeHint();

    if (dx > 60) {
      // Swipe right → toggle quickWin with flash
      toggleQuickWin(id);
      setQwFlashId(id);
      setTimeout(() => setQwFlashId(null), 400);
      setSwipingId(null);
      setSwipeX(0);
    } else if (dx < -40) {
      // Swipe left → snap open to show action buttons on right
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

  // ── Data helpers ──

  const deleteFabItem = (itemId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).filter(i => i.id !== itemId),
    }));
    closeSwipe();
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
    const todayISO = toISODate();
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
    closeSwipe();
  };

  const routeToProject = (item, projectId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).filter(i => i.id !== item.id),
      projects: d.projects.map(p => p.id === projectId
        ? { ...p, tasks: [...p.tasks, { id: uid(), text: item.text, done: false }] }
        : p
      ),
    }));
    setSortPanelId(null);
    closeSwipe();
  };

  const routeToLoose = (item, domainId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).filter(i => i.id !== item.id),
      looseTasks: [...(d.looseTasks || []), { id: uid(), domainId, text: item.text, done: false, doneAt: null }],
    }));
    setSortPanelId(null);
    closeSwipe();
  };

  // ── Render ──

  const fabQueue = data.fabQueue || [];
  const { domains, projects } = data;

  const filteredFab = filter === "quickwins"
    ? fabQueue.filter(i => i.quickWin ?? false)
    : fabQueue;

  return (
    <div className="screen active" onClick={() => { if (swipingId) closeSwipe(); }}>
      <StatusBar />
      <div className="scroll" style={{ paddingBottom: 100 }}>

        {/* ── PILL FILTERS ── */}
        <div className="tasks-filter-row">
          <button className={`tasks-filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
          <button className={`tasks-filter-pill ${filter === "quickwins" ? "active" : ""}`} onClick={() => setFilter("quickwins")}>Quick Wins</button>
        </div>

        {/* ── SECTION: QUEUE ── */}
        <div className="sh" style={{ paddingTop: 4 }}>
          <span className="sh-label">
            Queue
            {fabQueue.length > 0 && <span className="tasks-count-badge">{fabQueue.length}</span>}
          </span>
        </div>

        <div style={{ padding: "0 16px" }}>
          {filteredFab.map((item, idx) => {
            const isQuickWin = item.quickWin ?? false;
            const isSwiping = swipingId === item.id;
            const dx = isSwiping ? swipeX : 0;
            const showActions = dx < -40;
            const isSortOpen = sortPanelId === item.id;
            const isFlashing = qwFlashId === item.id;

            return (
              <div key={item.id} className="tasks-row-divider" onClick={e => e.stopPropagation()}>
                <div className="tasks-swipe-wrap">
                  {/* Quick Win flash indicator — left side */}
                  {isFlashing && (
                    <div className="tasks-qw-flash">★</div>
                  )}

                  {/* Action buttons revealed on RIGHT side */}
                  <div className="tasks-swipe-actions-right" style={{ opacity: showActions ? 1 : 0 }}>
                    <button className="tasks-swipe-btn sort" onClick={() => { setSortPanelId(isSortOpen ? null : item.id); setSwipingId(null); setSwipeX(0); }}>Sort</button>
                    <button className="tasks-swipe-btn today" onClick={() => routeToToday(item)}>Today</button>
                    <button className="tasks-swipe-btn delete" onClick={() => deleteFabItem(item.id)}>Delete</button>
                  </div>

                  {/* Row content */}
                  <div
                    className={`tasks-row ${isSwiping ? "swiping" : ""}`}
                    style={{ transform: `translateX(${Math.min(0, dx)}px)` }}
                    onTouchStart={e => handleTouchStart(item.id, e)}
                    onTouchMove={e => handleTouchMove(item.id, e)}
                    onTouchEnd={e => handleTouchEnd(item.id, e)}
                  >
                    <div className="tasks-circle" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tasks-text">{item.text}</div>
                    </div>
                    {isQuickWin && (
                      <span className="tasks-qw-badge">Quick Win</span>
                    )}
                  </div>
                </div>

                {/* Swipe hint — beneath first queue item only */}
                {idx === 0 && showSwipeHint && (
                  <div className="tasks-swipe-hint">{"\u2192"} Quick Win  ·  Sort Today Delete {"\u2190"}</div>
                )}

                {/* Sort panel — inline below row */}
                {isSortOpen && (
                  <div className="tasks-sort-panel">
                    <div className="tasks-sort-section">Domains</div>
                    {domains.map(domain => (
                      <div key={domain.id} className="tasks-sort-row" onClick={() => routeToLoose(item, domain.id)}>
                        <div className="tasks-sort-dot" style={{ background: domain.color }} />
                        <span className="tasks-sort-name">{domain.name}</span>
                      </div>
                    ))}
                    <div className="tasks-sort-section" style={{ marginTop: 8 }}>Projects</div>
                    {projects.filter(p => p.status === "active").map(proj => {
                      const dom = domains.find(d => d.id === proj.domainId);
                      return (
                        <div key={proj.id} className="tasks-sort-row" onClick={() => routeToProject(item, proj.id)}>
                          <div className="tasks-sort-dot" style={{ background: dom?.color || "var(--text3)" }} />
                          <div style={{ flex: 1 }}>
                            <span className="tasks-sort-name">{proj.name}</span>
                            <span className="tasks-sort-domain">{dom?.name}</span>
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

        <div className="spacer" />
      </div>
    </div>
  );
}
