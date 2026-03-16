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
  const [addingInline, setAddingInline] = useState(false);
  const [inlineText, setInlineText] = useState("");
  const inlineInputRef = useRef(null);

  // Tasks checked during this tab visit stay visible in All view until unmount
  const sessionCompletedIds = useRef(new Set());

  const todayISO = toISODate();
  const completedToday = (data.taskCompletions || {})[todayISO] || [];
  const completedSet = new Set(completedToday);
  const todayPickIds = (data.todayLoosePicks || {})[todayISO] || [];

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
      const queueOrder = data.taskQueueOrder || [];
      const storedIdx = queueOrder.indexOf(itemId);

      setData(d => {
        const queue = (d.fabQueue || []).map(i =>
          i.id === itemId ? { ...i, done: false } : i
        );
        if (storedIdx >= 0) {
          const task = queue.find(i => i.id === itemId);
          const rest = queue.filter(i => i.id !== itemId);
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
      sessionCompletedIds.current.add(itemId);
      setData(d => {
        const queue = d.fabQueue || [];
        const currentIdx = queue.findIndex(i => i.id === itemId);
        const prevOrder = d.taskQueueOrder || [];
        const orderSet = new Set(prevOrder);
        let newOrder;
        if (!orderSet.has(itemId)) {
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

  const toggleTodayPick = (taskId) => {
    setData(d => {
      const picks = d.todayLoosePicks || {};
      const current = picks[todayISO] || [];
      const next = current.includes(taskId)
        ? current.filter(id => id !== taskId)
        : [...current, taskId];
      return { ...d, todayLoosePicks: { ...picks, [todayISO]: next } };
    });
  };

  // ── Inline add row ──
  const openInlineAdd = () => {
    setAddingInline(true);
    setInlineText("");
    setTimeout(() => inlineInputRef.current?.focus(), 30);
  };

  const commitInlineAdd = () => {
    const t = inlineText.trim();
    if (t) {
      setData(d => ({
        ...d,
        fabQueue: [...(d.fabQueue || []), { id: uid(), text: t, createdAt: Date.now(), quickWin: false, done: false }],
      }));
    }
    setInlineText("");
    setAddingInline(false);
  };

  const cancelInlineAdd = () => {
    setInlineText("");
    setAddingInline(false);
  };

  // ── Filtered lists ──

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="ph-eye">Tasks</div>
              <div className="ph-title">Tasks</div>
            </div>
            <button className="tab-gear" onClick={() => {}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
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
                  onToday={() => toggleTodayPick(item.id)}
                  isQueuedToday={todayPickIds.includes(item.id)}
                />
              </div>
            );
          })}

          {/* ── INLINE ADD ROW ── */}
          {taskFilter !== "completed" && (
            <div
              onClick={() => { if (!addingInline) openInlineAdd(); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 0", minHeight: 52, cursor: addingInline ? "default" : "pointer",
              }}
            >
              {/* Empty circle */}
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                border: `1.5px solid ${addingInline ? "rgba(232,160,48,0.3)" : "var(--text3)"}`,
                background: "transparent",
                transition: "border-color .15s",
              }} />

              {addingInline ? (
                <input
                  ref={inlineInputRef}
                  value={inlineText}
                  onChange={e => setInlineText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitInlineAdd();
                    if (e.key === "Escape") cancelInlineAdd();
                  }}
                  onBlur={commitInlineAdd}
                  onClick={e => e.stopPropagation()}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    color: "var(--text)", fontSize: 15, fontWeight: 500,
                    fontFamily: "'DM Sans',sans-serif", padding: 0,
                  }}
                />
              ) : null}
            </div>
          )}
        </div>

        {/* Spacer below add row */}
        {taskFilter !== "completed" && (
          <div style={{ flex: 1, minHeight: 80 }} />
        )}
      </div>
    </div>
  );
}
