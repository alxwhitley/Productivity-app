import { useState, useEffect, useRef } from "react";
import { uid, toISODate } from "../utils.js";
import StatusBar from "../components/StatusBar.jsx";
import TaskRow from "../components/TaskRow.jsx";

export default function TasksScreen({ data, setData }) {
  const [taskFilter, setTaskFilter] = useState("all");
  const [newItemId, setNewItemId] = useState(null);
  const [processedToday, setProcessedToday] = useState(0);
  const [showClearMsg, setShowClearMsg] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  // Tasks checked during this tab visit stay visible in All view until unmount
  const sessionCompletedIds = useRef(new Set());

  const todayISO = toISODate();
  const completedToday = (data.taskCompletions || {})[todayISO] || [];
  const completedSet = new Set(completedToday);

  // Shallow work reset logic on mount
  useEffect(() => {
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
        taskCompletions: {
          ...(d.taskCompletions || {}),
          [todayISO]: ((d.taskCompletions || {})[todayISO] || []).filter(id => id !== itemId),
        },
      }));
    });
    sessionCompletedIds.current.delete(itemId);
  };

  const toggleFabDone = (itemId) => {
    const item = fabQueue.find(i => i.id === itemId);
    if (!item) return;
    const wasDone = completedSet.has(itemId);

    if (wasDone) {
      // Unchecking — remove from completions, restore done: false
      // Reinsert at stored queue position
      const queueOrder = data.taskQueueOrder || [];
      const storedIdx = queueOrder.indexOf(itemId);

      setData(d => {
        const queue = (d.fabQueue || []).map(i =>
          i.id === itemId ? { ...i, done: false } : i
        );
        // Reorder: move task to its stored position if known
        if (storedIdx >= 0) {
          const task = queue.find(i => i.id === itemId);
          const rest = queue.filter(i => i.id !== itemId);
          // Find correct insertion point based on stored order
          let insertAt = rest.length;
          for (let j = 0; j < rest.length; j++) {
            const otherIdx = queueOrder.indexOf(rest[j].id);
            if (otherIdx === -1 || otherIdx > storedIdx) {
              insertAt = j;
              break;
            }
          }
          rest.splice(insertAt, 0, task);
          return {
            ...d,
            fabQueue: rest,
            taskCompletions: {
              ...(d.taskCompletions || {}),
              [todayISO]: ((d.taskCompletions || {})[todayISO] || []).filter(id => id !== itemId),
            },
          };
        }

        return {
          ...d,
          fabQueue: queue,
          taskCompletions: {
            ...(d.taskCompletions || {}),
            [todayISO]: ((d.taskCompletions || {})[todayISO] || []).filter(id => id !== itemId),
          },
        };
      });
      sessionCompletedIds.current.delete(itemId);
    } else {
      // Checking — mark done, add to completions, record queue position
      sessionCompletedIds.current.add(itemId);
      setData(d => {
        const queue = d.fabQueue || [];
        const currentIdx = queue.findIndex(i => i.id === itemId);
        // Build order snapshot: preserve existing order entries, add/update this one
        const prevOrder = d.taskQueueOrder || [];
        const orderSet = new Set(prevOrder);
        let newOrder;
        if (!orderSet.has(itemId)) {
          // Insert at current position in the order array
          newOrder = [...prevOrder];
          newOrder.splice(currentIdx, 0, itemId);
        } else {
          newOrder = prevOrder;
        }

        return {
          ...d,
          fabQueue: queue.map(i =>
            i.id === itemId ? { ...i, done: true } : i
          ),
          taskCompletions: {
            ...(d.taskCompletions || {}),
            [todayISO]: [...((d.taskCompletions || {})[todayISO] || []), itemId],
          },
          taskQueueOrder: newOrder,
        };
      });
    }
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

  // ── Filtered lists ──

  // All view: uncompleted tasks + tasks completed during this session (stay visible until tab change)
  const allTasks = fabQueue.filter(i =>
    !completedSet.has(i.id) || sessionCompletedIds.current.has(i.id)
  );

  const quickWinTasks = fabQueue.filter(i =>
    (i.quickWin ?? false) && !completedSet.has(i.id)
  );

  const completedTasks = fabQueue.filter(i => completedSet.has(i.id));

  const visibleTasks =
    taskFilter === "completed" ? completedTasks :
    taskFilter === "quickwins" ? quickWinTasks :
    allTasks;

  const completedCount = completedToday.length;

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
          <button className={`tasks-filter-pill${taskFilter === "all" ? " active" : ""}`} onClick={() => setTaskFilter("all")}>All</button>
          <button className={`tasks-filter-pill${taskFilter === "quickwins" ? " active" : ""}`} onClick={() => setTaskFilter("quickwins")}>⚡ Quick Wins</button>
          <button className={`tasks-filter-pill${taskFilter === "completed" ? " active" : ""}`} onClick={() => setTaskFilter("completed")}>
            Completed{completedCount > 0 ? ` ${completedCount}` : ""}
          </button>
        </div>

        <div style={{ padding: "0 16px" }}>
          {/* Queue clear message */}
          {fabQueue.length === 0 && showClearMsg && (
            <div className="tasks-clear-msg">Queue clear ✓</div>
          )}

          {/* Empty states */}
          {visibleTasks.length === 0 && !showClearMsg && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "25vh" }}>
              {taskFilter === "completed" ? (
                <div style={{ fontSize: 14, color: "var(--text3)" }}>No completed tasks yet today.</div>
              ) : (
                <>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text2)" }}>Nothing in the queue</div>
                  <div style={{ fontSize: 13, fontWeight: 400, color: "var(--text3)", marginTop: 6 }}>Tap below to capture a task</div>
                </>
              )}
            </div>
          )}

          {visibleTasks.map(item => {
            const isNew = newItemId === item.id;
            const isRemoving = removingId === item.id;
            const isCompleted = completedSet.has(item.id);

            return (
              <div key={item.id} className={isRemoving ? "tasks-removing" : ""} style={isCompleted ? { opacity: 0.6 } : undefined}>
                <TaskRow
                  task={{ ...item, done: isCompleted }}
                  bg="var(--bg)"
                  autoEdit={isNew}
                  onToggle={() => toggleFabDone(item.id)}
                  onEdit={(text) => { saveFabEdit(item.id, text); setNewItemId(null); }}
                  onDelete={() => { deleteFabItem(item.id); setNewItemId(null); }}
                  onQuickWin={taskFilter === "completed" ? () => {} : () => toggleQuickWin(item.id)}
                />
              </div>
            );
          })}
        </div>

        {/* ── TAP EMPTY SPACE TO CAPTURE ── */}
        {taskFilter !== "completed" && (
          <div
            style={{ flex: 1, minHeight: 120, cursor: "pointer" }}
            onClick={handleEmptyTap}
          />
        )}
      </div>
    </div>
  );
}
