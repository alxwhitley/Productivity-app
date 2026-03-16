import { useState, useEffect, useRef } from "react";
import { uid, toISODate } from "../utils.js";
import StatusBar from "../components/StatusBar.jsx";
import TaskRow from "../components/TaskRow.jsx";

export default function TasksScreen({ data, setData }) {
  const [filter, setFilter] = useState("all");
  const [newItemId, setNewItemId] = useState(null);
  const [processedToday, setProcessedToday] = useState(0);
  const [showClearMsg, setShowClearMsg] = useState(false);
  const [removingId, setRemovingId] = useState(null);

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
      movedItems = [...movedItems, ...toMove.map(t => ({ id: t.id, text: t.text, createdAt: t.addedAt || Date.now(), quickWin: false, done: false }))];
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
    animateOut(itemId, () => {
      setData(d => ({
        ...d,
        fabQueue: (d.fabQueue || []).filter(i => i.id !== itemId),
      }));
    });
  };

  const toggleFabDone = (itemId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).map(i =>
        i.id === itemId ? { ...i, done: !(i.done ?? false) } : i
      ),
    }));
  };

  const toggleQuickWin = (itemId) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).map(i =>
        i.id === itemId ? { ...i, quickWin: !(i.quickWin ?? false) } : i
      ),
    }));
  };

  const saveFabEdit = (itemId, text) => {
    setData(d => ({
      ...d,
      fabQueue: (d.fabQueue || []).map(i =>
        i.id === itemId ? { ...i, text } : i
      ),
    }));
  };

  // ── Tap empty space to capture ──
  const handleEmptyTap = () => {
    if (newItemId) return;
    const id = uid();
    setData(d => ({
      ...d,
      fabQueue: [...(d.fabQueue || []), { id, text: "", createdAt: Date.now(), quickWin: false, done: false }],
    }));
    setNewItemId(id);
  };

  // ── Render ──

  const filteredFab = filter === "quickwins"
    ? fabQueue.filter(i => i.quickWin ?? false)
    : fabQueue;

  return (
    <div className="screen active" style={{ display: "flex", flexDirection: "column" }}>
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

        <div style={{ padding: "0 16px" }}>
          {/* Queue clear message */}
          {fabQueue.length === 0 && showClearMsg && (
            <div className="tasks-clear-msg">Queue clear ✓</div>
          )}

          {/* Empty state */}
          {filteredFab.length === 0 && !showClearMsg && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "25vh" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text2)" }}>Nothing in the queue</div>
              <div style={{ fontSize: 13, fontWeight: 400, color: "var(--text3)", marginTop: 6 }}>Tap below to capture a task</div>
            </div>
          )}

          {filteredFab.map(item => {
            const isNew = newItemId === item.id;
            const isRemoving = removingId === item.id;

            return (
              <div key={item.id} className={isRemoving ? "tasks-removing" : ""}>
                <TaskRow
                  task={item}
                  bg="var(--bg)"
                  autoEdit={isNew}
                  onToggle={() => toggleFabDone(item.id)}
                  onEdit={(text) => { saveFabEdit(item.id, text); setNewItemId(null); }}
                  onDelete={() => { deleteFabItem(item.id); setNewItemId(null); }}
                  onQuickWin={() => toggleQuickWin(item.id)}
                />
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
