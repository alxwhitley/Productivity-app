import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const DOMAIN_COLORS = ["#5B8AF0","#9B72CF","#45C17A","#E8A030","#E05555","#4BAABB"];

const INITIAL_DATA = {
  domains: [
    { id: "church", name: "Church", color: "#5B8AF0" },
    { id: "work",   name: "Work",   color: "#9B72CF" },
    { id: "life",   name: "Life",   color: "#45C17A" },
  ],
  projects: [
    { id: "podcast",     domainId: "church", name: "Podcast",        status: "active",  tasks: [
      { id: "t1", text: "Make intros",                    done: false },
      { id: "t2", text: "Create script",                  done: true  },
      { id: "t3", text: "Record intro segment",           done: false },
      { id: "t4", text: "Send file to editor",            done: false },
    ]},
    { id: "socialmedia", domainId: "church", name: "Social Media",   status: "backlog", tasks: [
      { id: "t5", text: "YouTube thumbnails",             done: false },
      { id: "t6", text: "Schedule week posts",            done: false },
      { id: "t7", text: "Algorithm research",             done: false },
    ]},
    { id: "afterhours",  domainId: "church", name: "After Hours",    status: "backlog", tasks: [
      { id: "t8",  text: "Create way to give",            done: false },
      { id: "t9",  text: "Visitor card design",           done: false },
      { id: "t10", text: "Pizza poster scripts",          done: false },
      { id: "t11", text: "Justin's testimony",            done: false },
    ]},
    { id: "freelance",   domainId: "work",   name: "Freelance",      status: "active",  tasks: [
      { id: "t12", text: "Create remix link for landing page", done: true },
      { id: "t13", text: "Reach out to Becky",            done: false },
      { id: "t14", text: "Check in colleges to pitch",   done: false },
    ]},
    { id: "davidv",      domainId: "work",   name: "David Ventures", status: "backlog", tasks: [
      { id: "t15", text: "Get into Wix",                  done: false },
      { id: "t16", text: "Brand update",                  done: false },
    ]},
    { id: "personal",    domainId: "life",   name: "Personal Admin", status: "active",  tasks: [
      { id: "t17", text: "Buy journal",                   done: true  },
      { id: "t18", text: "Real ID",                       done: false },
    ]},
  ],
  blocks: [
    { id: "b1", projectId: "podcast",    startHour: 9,  startMin: 0,  durationMin: 90, dayOffset: 0 },
    { id: "b3", projectId: "freelance",  startHour: 13, startMin: 0,  durationMin: 90, dayOffset: 0 },
    { id: "b5", projectId: "socialmedia",startHour: 9,  startMin: 0,  durationMin: 90, dayOffset: 1 },
  ],
  inbox: [],
  looseTasks: [], // [{id, domainId, text, done, doneAt}]
  weekIntention: "Ship Podcast episode. At least one Freelance deliverable. Get Church Social Media unblocked.",
  shutdownDone: false,
  seasonGoals: [
    { id: "sg1", text: "Launch Podcast to 100 listeners", domainId: "church", done: false },
    { id: "sg2", text: "Land 2 new Freelance clients",    domainId: "work",   done: false },
    { id: "sg3", text: "Rebuild After Hours community",   domainId: "church", done: false },
  ],
  workWeek: [2,3,4,5,6], // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  emptyBlocks: [], // template ghost blocks: {id, dayOfWeek, startHour, startMin, durationMin, slotIndex, blockType}
  reviewData: {
    domainBlocks: { church: 5, work: 3, life: 1 },
    projectProgress: { podcast: { pct: 65, delta: 45 }, freelance: { pct: 40, delta: 20 } },
    daysWorked: [true, true, "half", true, true, false, false],
  }
};

function fmtTime(h, m) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hh}:${m.toString().padStart(2,"0")} ${ampm}`;
}
function fmtRange(h, m, dur) {
  const end = h * 60 + m + dur;
  return `${fmtTime(h, m)} – ${fmtTime(Math.floor(end/60), end%60)}`;
}
function getPct(tasks) {
  if (!tasks.length) return 0;
  return Math.round(tasks.filter(t=>t.done).length / tasks.length * 100);
}
function uid() { return `id${Date.now()}${Math.random().toString(36).slice(2,6)}`; }

function getRoutinesForDate(routineBlocks, date) {
  const dow = date.getDay();
  const dateKey = date.toDateString();
  return (routineBlocks || []).filter(rb => {
    if (!rb.recurring) {
      // one-time: show only on its specific date
      return rb.targetDate === dateKey;
    }
    return rb.dayOfWeek === dow;
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// DATA LAYER — versioned, migration-safe, Supabase-ready
//
// HOW TO ADD A NEW FIELD IN FUTURE:
//   1. Add it to SCHEMA_VERSION (bump the number)
//   2. Add a default value in FIELD_DEFAULTS
//   3. Add a migration step in MIGRATIONS if needed
//   4. That's it — existing user data is preserved automatically
//
// HOW TO SWAP IN SUPABASE LATER:
//   1. Set USE_SUPABASE = true
//   2. Fill in SUPABASE_URL and SUPABASE_ANON_KEY
//   3. The rest of the app is unchanged
// ═══════════════════════════════════════════════════════════════════════════

const SCHEMA_VERSION = 1;
const STORAGE_KEY    = "nave_data_v1";       // new key — clean break from momentum_v2
const THEME_KEY      = "nave_theme";

// ── Supabase config (fill in when ready) ────────────────────────────────────
const USE_SUPABASE    = true;
const SUPABASE_URL    = "https://fezgmuhrgbtzlworbsep.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlemdtdWhyZ2J0emx3b3Jic2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjgyNTEsImV4cCI6MjA4ODc0NDI1MX0.YxHafnW1m287XRDiiRWTIPF2rKA1xEsQ4ArCeJO0ul8";

// ── Field defaults — merged over any saved data so new fields always exist ──
const FIELD_DEFAULTS = {
  schemaVersion:  SCHEMA_VERSION,
  domains:        INITIAL_DATA.domains,
  projects:       INITIAL_DATA.projects,
  blocks:         INITIAL_DATA.blocks,
  inbox:          [],
  looseTasks:     [],
  weekIntention:  "",
  shutdownDone:   false,
  seasonGoals:    INITIAL_DATA.seasonGoals,
  workWeek:       [2,3,4,5,6],
  deepBlockDefaults: [
    { startHour:9,  startMin:0, durationMin:90 },
    { startHour:13, startMin:0, durationMin:90 },
    { startHour:15, startMin:0, durationMin:60 },
  ],
  emptyBlocks:    [],
  routineBlocks:  [],
  reviewData:     INITIAL_DATA.reviewData,
  todayPrefs:     { name:"", showShutdown:true, defaultBlock:"9" },
  blockCompletions: [], // [{ blockId, date, durationMin }] — "I did this" / Done logs
  deepWorkTargets: { dailyHours: 4, weeklyHours: 20 }, // user-configurable
  todayLoosePicks: {}, // { [dateStr]: [looseTaskId, ...] } — tasks picked for today's loose block
};

// ── Migrations — run in order when schema version is behind ─────────────────
// Each entry: { version: N, up: (data) => newData }
// Add a new entry here whenever SCHEMA_VERSION bumps.
const MIGRATIONS = [
  // v1: initial version — migrate from old "momentum_v2" key if present
  {
    version: 1,
    up: (data) => {
      // Pull in any data saved under the old Momentum key
      try {
        const old = localStorage.getItem("momentum_v2");
        if (old) {
          const parsed = JSON.parse(old);
          // Merge old user data over defaults (preserves their projects/tasks)
          return { ...FIELD_DEFAULTS, ...parsed, schemaVersion: 1 };
        }
      } catch {}
      return { ...FIELD_DEFAULTS, schemaVersion: 1 };
    }
  },
  // Future migrations go here, e.g.:
  // { version: 2, up: (data) => ({ ...data, newField: "default", schemaVersion: 2 }) },
];

// ── Deep merge: add missing keys from defaults without touching existing ones ─
function applyDefaults(saved, defaults) {
  const result = { ...saved };
  for (const key of Object.keys(defaults)) {
    if (result[key] === undefined || result[key] === null) {
      result[key] = defaults[key];
    }
    // Ensure nested objects also get new keys (one level deep)
    if (
      typeof defaults[key] === "object" &&
      !Array.isArray(defaults[key]) &&
      defaults[key] !== null &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key]) &&
      result[key] !== null
    ) {
      result[key] = { ...defaults[key], ...result[key] };
    }
  }
  return result;
}

// ── Load: run migrations then apply any missing defaults ────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let data = raw ? JSON.parse(raw) : null;

    if (!data) {
      // First ever load — run v1 migration which may import momentum_v2
      data = MIGRATIONS[0].up({});
    } else {
      // Run any migrations the saved data hasn't seen yet
      const savedVersion = data.schemaVersion || 0;
      for (const migration of MIGRATIONS) {
        if (migration.version > savedVersion) {
          data = migration.up(data);
        }
      }
    }

    // Always fill in any fields added since last save
    return applyDefaults(data, FIELD_DEFAULTS);
  } catch (e) {
    console.warn("Data load failed, using defaults:", e);
    return { ...FIELD_DEFAULTS };
  }
}

// ── Save: localStorage cache + Supabase sync ────────────────────────────────
async function saveData(data, userId) {
  // Always write to localStorage as cache
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  // Sync to Supabase if logged in
  if (userId) {
    try {
      await supabase.from("user_data").upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    } catch (e) { console.warn("Supabase save failed:", e); }
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
function useData(userId) {
  const [data, setData] = useState(() => loadData());
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Load from Supabase on login
  useEffect(() => {
    if (!userId) return;
    supabase.from("user_data").select("data").eq("user_id", userId).single()
      .then(({ data: row, error }) => {
        if (row?.data) {
          const migrated = applyDefaults(row.data, FIELD_DEFAULTS);
          setData(migrated);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch {}
        }
      });
  }, [userId]);

  // Debounced save on every data change
  const saveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveData(data, userIdRef.current);
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  return [data, setData];
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  :root{
    --bg:#181A1B;--bg2:#1E2122;--bg3:#252829;--bg4:#2C3032;
    --border:#2E3235;--border2:#252829;
    --accent:#E8A030;--accent-s:rgba(232,160,48,0.12);
    --green:#45C17A;--red:#E05555;
    --text:#EDEAE5;--text2:#9A9591;--text3:#555250;
  }

  /* ── LIGHT MODE ── */
  .light{
    --bg:#F5F2EE;--bg2:#EDEAE5;--bg3:#E4E0DA;--bg4:#D8D3CC;
    --border:#D0CBC3;--border2:#DDD9D3;
    --accent:#C07818;--accent-s:rgba(192,120,24,0.10);
    --green:#2E9E5B;--red:#C43C3C;
    --text:#1A1714;--text2:#5C5550;--text3:#9A938C;
  }
  .light .phone{background:var(--bg);}
  .light .nav{background:var(--bg);border-top-color:var(--border2);}
  .light .sheet{background:var(--bg2);}
  .light .form-select,.light .blk-edit-select,.light .ww-slot-select,.light .add-goal-domain,.light .ii-select{background:var(--bg3);color:var(--text);}
  .light .intent-textarea,.light .add-task-input,.light .loose-add-input,.light .add-goal-input{background:var(--bg3);color:var(--text);}
  .light .now-block,.light .card,.light .week-card,.light .cov-card,.light .dw-card,.light .moved-card,.light .stat-box,.light .intention-card,.light .season-hero,.light .sg-card,.light .season-pull-card,.light .loose-zone{background:var(--bg2);} .light .loose-section{background:var(--bg2);}
  .light .blk-edit-panel,.light .blk-swipe-content{background:var(--bg2);}
  .light .ghost-block{background:transparent;}
  .light .ww-day{border-color:var(--border);color:var(--text2);}
  .light .ww-day.on{background:var(--accent);border-color:var(--accent);color:#fff;}
  .light .coach-card{background:rgba(192,120,24,0.07);border-color:rgba(192,120,24,0.2);}
  .light .nb-dur,.light .br-dur{background:var(--bg3);}

  /* theme toggle row */
  .theme-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border2);margin-top:4px;}
  .theme-toggle-label{font-size:14px;font-weight:500;color:var(--text);}
  .theme-toggle-sub{font-size:12px;color:var(--text3);margin-top:1px;}
  .toggle-pill{width:46px;height:26px;border-radius:13px;background:var(--bg3);border:1.5px solid var(--border);position:relative;cursor:pointer;transition:background .2s,border-color .2s;flex-shrink:0;}
  .toggle-pill.on{background:var(--accent);border-color:var(--accent);}
  .toggle-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s ease;box-shadow:0 1px 3px rgba(0,0,0,.2);}
  .toggle-pill.on .toggle-knob{transform:translateX(20px);}

  html,body,#root{height:100%;background:var(--bg);font-family:'DM Sans',sans-serif;overflow:hidden;}
  .phone{width:100%;height:100%;background:var(--bg);overflow:hidden;position:relative;display:flex;flex-direction:column;}
  @media(min-width:500px){
    html,body,#root{background:#101213;}
    .phone{width:390px;height:844px;border-radius:44px;box-shadow:0 40px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.05);}
  }

  /* STATUS */
  .status{padding:16px 24px 0;display:flex;justify-content:flex-end;align-items:center;flex-shrink:0;}
  .status-icons{font-size:12px;opacity:.5;display:flex;gap:5px;}

  /* SCREEN */
  .screen{display:none;flex-direction:column;flex:1;overflow:hidden;}
  .screen.active{display:flex;}

  /* SCROLL */
  .scroll{flex:1;overflow-y:auto;overflow-x:hidden;padding-bottom:8px;scrollbar-width:none;}
  .scroll::-webkit-scrollbar{display:none;}

  /* PAGE HEADER */
  .ph{padding:14px 24px 10px;flex-shrink:0;}
  .ph-eye{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);margin-bottom:3px;}
  .ph-title{font-size:26px;font-weight:700;color:var(--text);letter-spacing:-.03em;line-height:1.1;}
  .ph-sub{font-size:13px;color:var(--text2);margin-top:2px;}

  /* SECTION HEAD */
  .sh{padding:14px 24px 8px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
  .sh-label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
  .sh-btn{font-size:13px;color:var(--accent);font-weight:500;cursor:pointer;background:none;border:none;}

  /* CARD */
  .card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;overflow:hidden;}

  /* DIVIDER */
  .divider{height:1px;background:var(--border2);}

  /* ── TODAY ── */
  .now-block{margin:0 16px 8px;background:var(--bg2);border-radius:16px;overflow:hidden;padding:18px 20px;position:relative;cursor:pointer;}
  .nb-stripe{position:absolute;left:0;top:0;bottom:0;width:4px;}
  .nb-inner{padding-left:12px;}
  .nb-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;}
  .nb-label{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--accent);}
  .nb-dur{font-size:12px;color:var(--text2);background:var(--bg3);padding:3px 10px;border-radius:20px;font-weight:500;}
  .nb-project{font-size:22px;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:2px;}
  .nb-domain{font-size:13px;margin-bottom:3px;}
  .nb-time{font-size:13px;color:var(--text3);margin-bottom:14px;font-variant-numeric:tabular-nums;}
  .task-list{border-top:1px solid var(--border2);padding-top:12px;}
  .task-row{display:flex;align-items:flex-start;gap:12px;padding:7px 0;cursor:pointer;}
  .t-check{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s;margin-top:1px;}
  .t-check.done{background:var(--green);border-color:var(--green);}
  .t-check.done::after{content:'✓';font-size:10px;color:#fff;font-weight:700;}
  .t-text{font-size:14px;color:var(--text);line-height:1.4;}
  .t-text.done{color:var(--text3);text-decoration:line-through;}
  /* TIMELINE */
  .tl-wrap{margin:0 16px;display:flex;flex-direction:column;gap:0;}
  .tl-item{display:flex;gap:12px;position:relative;}
  .tl-left{display:flex;flex-direction:column;align-items:center;width:52px;flex-shrink:0;}
  .tl-time{font-size:11px;color:var(--text3);font-variant-numeric:tabular-nums;white-space:nowrap;padding-top:14px;font-weight:500;}
  .tl-line-wrap{display:flex;flex-direction:column;align-items:center;flex:1;width:100%;}
  .tl-dot{width:8px;height:8px;border-radius:50%;background:var(--border);flex-shrink:0;margin-top:18px;transition:background .2s;}
  .tl-dot.now{background:var(--accent);box-shadow:0 0 0 3px rgba(232,160,48,.2);}
  .tl-dot.done{background:var(--green);}
  .tl-connector{width:1px;flex:1;min-height:8px;background:var(--border2);}

  .tl-swipe-wrap{position:relative;overflow:hidden;border-radius:14px;margin:8px 0 6px;touch-action:pan-y;}
  .tl-swipe-bg{position:absolute;inset:0;display:flex;align-items:center;border-radius:14px;transition:opacity .15s;}
  .tl-swipe-bg.complete{background:var(--green);justify-content:flex-start;padding-left:20px;}
  .tl-swipe-bg.reschedule{background:#4A90D9;justify-content:flex-end;padding-right:20px;}
  .tl-swipe-bg-lbl{font-size:12px;font-weight:700;color:#fff;letter-spacing:.05em;text-transform:uppercase;}
  .tl-swipe-card{position:relative;z-index:1;transition:transform .25s cubic-bezier(.25,.46,.45,.94);}
  .tl-swipe-card.swiping{transition:none;}
  .tl-drag-handle{width:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:grab;opacity:.35;flex-shrink:0;padding:14px 0;}
  .tl-drag-handle:active{cursor:grabbing;opacity:.7;}
  .tl-drag-handle span{display:block;width:14px;height:2px;background:var(--text3);border-radius:2px;}
  .tl-item.dragging{opacity:.4;border:1px dashed var(--border);}
  .tl-item.drag-over{border-top:2px solid var(--accent);}

  .tl-card{flex:1;background:var(--bg2);border-radius:14px;margin:8px 0 6px;overflow:hidden;transition:opacity .2s,border-color .2s,box-shadow .2s;}
  .tl-card.done-card{opacity:.42;filter:saturate(0.15);}
  .tl-card.missed-card{border:1px solid var(--domain-color, rgba(255,255,255,.18));box-shadow:0 0 16px rgba(0,0,0,.1);}
  .tl-card.now-card{border:1px solid rgba(232,160,48,.25);box-shadow:0 0 24px rgba(232,160,48,.09);}
  .tl-card.active-card{border:1px solid rgba(232,160,48,.25);box-shadow:0 0 24px rgba(232,160,48,.09);}
  .tl-card.upcoming-card{border:1px solid var(--domain-color, rgba(255,255,255,.12));box-shadow:0 0 18px rgba(0,0,0,.06);}
  .tl-check-icon.missed{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .tl-card-head{display:flex;align-items:center;gap:10px;padding:13px 14px;cursor:pointer;}
  .tl-stripe{width:3px;border-radius:2px;align-self:stretch;min-height:28px;flex-shrink:0;}
  .tl-info{flex:1;min-width:0;}
  .tl-name{font-size:15px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .tl-meta{font-size:11px;color:var(--text3);margin-top:2px;}
  .tl-dur{font-size:11px;font-weight:500;background:var(--bg3);color:var(--text3);padding:3px 8px;border-radius:6px;white-space:nowrap;flex-shrink:0;}
  .tl-prime-pill{font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:20px;background:rgba(232,160,48,.12);color:var(--accent);border:1px solid rgba(232,160,48,.25);flex-shrink:0;white-space:nowrap;}
  .tl-now-pill{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:rgba(232,160,48,.15);color:var(--accent);border:1px solid rgba(232,160,48,.3);padding:2px 7px;border-radius:20px;flex-shrink:0;}
  .tl-tasks{border-top:1px solid var(--border2);padding:10px 14px 14px 14px;}
  .tl-task-row{display:flex;align-items:center;gap:10px;padding:6px 0;}
  .tl-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
  .tl-check.done{background:var(--green);border-color:var(--green);}
  .tl-task-txt{font-size:13px;color:var(--text);flex:1;}
  .tl-task-txt.done{text-decoration:line-through;opacity:.45;}
  .tl-add-task{display:flex;gap:8px;margin-top:6px;padding-top:8px;border-top:1px solid var(--border2);}
  .tl-add-input{flex:1;background:var(--bg3);border:none;border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;}
  /* LOOSE TASKS BLOCK */
  .lt-block-wrap{padding:0 16px 8px;}
  .lt-block{background:var(--bg2);border-radius:14px;overflow:hidden;border:1px solid var(--border);}
  .lt-block-head{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;}
  .lt-stripe{width:3px;border-radius:2px;align-self:stretch;min-height:18px;background:var(--text3);opacity:.35;flex-shrink:0;}
  .lt-info{flex:1;min-width:0;}
  .lt-title{font-size:14px;font-weight:600;color:var(--text);}
  .lt-meta{font-size:11px;color:var(--text3);margin-top:1px;}
  .lt-body{border-top:1px solid var(--border2);padding:8px 0;}
  .lt-task-row{display:flex;align-items:center;gap:10px;padding:9px 14px;}
  .lt-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .lt-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all .15s;}
  .lt-check.done{background:var(--green);border-color:var(--green);}
  .lt-task-text{flex:1;font-size:13px;color:var(--text);}
  .lt-task-text.done{color:var(--text3);text-decoration:line-through;}
  .lt-picker{padding:10px 14px;border-top:1px solid var(--border2);}
  .lt-picker-title{font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;}
  .lt-pick-row{display:flex;align-items:center;gap:10px;padding:7px 0;cursor:pointer;}
  .lt-pick-check{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .lt-pick-check.sel{background:var(--accent);border-color:var(--accent);}
  .lt-empty{font-size:12px;color:var(--text3);padding:12px 14px;font-style:italic;}
  /* TIME PICKER POPOVER */
  .time-pick-wrap{position:relative;display:inline-block;}
  .tl-time-btn{font-size:11px;color:var(--text3);font-variant-numeric:tabular-nums;white-space:nowrap;padding-top:14px;font-weight:500;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;text-align:center;transition:color .15s;-webkit-tap-highlight-color:transparent;}
  .tl-time-btn:hover,.tl-time-btn.open{color:var(--accent);}
  .tl-time-btn.open{text-decoration:underline;text-underline-offset:2px;}
  .time-popover{position:absolute;left:50%;transform:translateX(-50%);top:calc(100% + 4px);background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:50;overflow:hidden;width:96px;}
  .time-popover-inner{max-height:200px;overflow-y:auto;overscroll-behavior:contain;}
  .time-slot{padding:9px 12px;font-size:12px;font-variant-numeric:tabular-nums;color:var(--text2);cursor:pointer;text-align:center;transition:background .1s;}
  .time-slot:hover{background:var(--bg3);}
  .time-slot.current{color:var(--accent);font-weight:700;background:rgba(232,160,48,.08);}
  /* TODAY TASK PICKER */
  .picker-wrap{padding:12px 14px 14px;}
  .picker-heading{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;}
  .picker-task{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2);cursor:pointer;}
  .picker-task:last-of-type{border-bottom:none;}
  .picker-box{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .picker-box.checked{background:var(--accent);border-color:var(--accent);}
  .picker-box.checked::after{content:'✓';font-size:9px;color:#000;font-weight:800;}
  .picker-task-txt{font-size:13px;color:var(--text);flex:1;}
  .picker-add{display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border2);}
  .picker-input{flex:1;background:var(--bg3);border:none;border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;}
  .picker-confirm{width:100%;margin-top:12px;background:var(--accent);color:#000;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .picker-confirm:disabled{opacity:.4;cursor:not-allowed;}
  /* LATE START */
  .tl-missed-badge{font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:20px;background:rgba(224,85,85,.1);color:var(--red);border:1px solid rgba(224,85,85,.2);flex-shrink:0;}
  .tl-start-btn{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 10px;border-radius:20px;background:rgba(232,160,48,.15);color:var(--accent);border:1px solid rgba(232,160,48,.3);cursor:pointer;font-family:'DM Sans',sans-serif;flex-shrink:0;}
  .tl-start-btn:active{background:rgba(232,160,48,.28);}
  .tl-countdown{font-size:12px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;flex-shrink:0;}
  .tl-check-icon{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .tl-check-icon.full{background:var(--green);}
  .tl-check-icon.partial{background:var(--bg3);border:1.5px solid var(--border);}
  .tl-conflict-warn{margin:0 0 6px;padding:8px 12px;background:rgba(224,85,85,.08);border:1px solid rgba(224,85,85,.2);border-radius:8px;font-size:11px;color:#E05555;display:flex;align-items:center;gap:8px;}
  /* NOW marker line */
  .now-marker{display:flex;align-items:center;gap:8px;margin:4px 16px 4px;position:relative;}
  .now-marker-line{flex:1;height:1px;background:var(--accent);opacity:.4;}
  .now-marker-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);opacity:.7;white-space:nowrap;}
  /* clock */
  .today-clock{font-size:28px;font-weight:700;color:var(--text);letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1;}
  .today-clock-ampm{font-size:13px;font-weight:500;color:var(--text3);margin-left:4px;}
  .shutdown-row{margin:4px 16px 0;background:var(--bg2);border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:12px;cursor:pointer;}
  .sd-ico{font-size:17px;}
  .sd-txt{font-size:14px;font-weight:500;color:var(--text2);}
  .sd-arr{margin-left:auto;font-size:16px;color:var(--text3);}

  /* ── PROJECTS NEW LAYOUT ── */
  .domain-tabs{display:flex;flex-shrink:0;border-bottom:2px solid var(--border2);}
  .domain-tab{
    flex:1;padding:13px 4px 11px;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer;
    font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
    background:transparent;color:var(--text3);transition:color .15s,border-color .15s;
    display:flex;align-items:center;justify-content:center;gap:6px;
  }
  .domain-tab.active{color:var(--text);}
  .domain-tab-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .domain-tab-edit{
    width:36px;height:36px;border-radius:12px;border:1.5px dashed var(--border);
    background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;
    color:var(--text3);font-size:18px;flex-shrink:0;
  }


  /* LOOSE TASKS */
  /* LOOSE ZONE — minimal tap-to-add */
  .loose-zone{margin:0 16px 10px;min-height:72px;border-radius:14px;display:flex;flex-direction:column;position:relative;background:var(--bg2);}
  .loose-empty{flex:1;min-height:72px;display:flex;align-items:center;justify-content:center;color:var(--text3);opacity:.35;}
  .loose-split-bar{display:flex;min-height:56px;border-radius:14px;overflow:hidden;}
  .loose-split-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;color:var(--text3);font-size:13px;font-weight:500;opacity:.45;transition:opacity .15s,background .15s;border:none;background:none;font-family:'DM Sans',sans-serif;}
  .loose-split-btn:active{opacity:.9;background:var(--bg3);}
  .loose-split-divider{width:1px;background:var(--border2);align-self:stretch;margin:10px 0;flex-shrink:0;}
  .loose-tasks-list{display:flex;flex-direction:column;}
  .loose-add-inline{padding:10px 14px 4px;}
  .loose-inline-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);padding:6px 2px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;}
  .loose-inline-input::placeholder{color:var(--text3);}
  .loose-add-more{display:flex;align-items:center;gap:6px;padding:8px 14px 12px;color:var(--text3);font-size:12px;cursor:pointer;opacity:.5;}
  .loose-add-more:active{opacity:1;}
  .loose-section{margin:0 16px 10px;background:var(--bg2);border-radius:14px;overflow:hidden;}
  .loose-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;}
  .loose-title{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text3);}
  .loose-count{font-size:11px;color:var(--text3);background:var(--bg3);border-radius:20px;padding:2px 8px;}
  .loose-task-row{display:flex;align-items:center;gap:10px;padding:9px 16px;border-top:1px solid var(--border2);cursor:pointer;position:relative;}
  .loose-task-row:hover{background:var(--bg3);}
  .loose-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:transparent;transition:all .15s;}
  .loose-check.done{background:var(--green);border-color:var(--green);color:#fff;}
  .loose-task-text{flex:1;font-size:13px;color:var(--text);line-height:1.4;}
  .loose-task-text.done{color:var(--text3);text-decoration:line-through;}
  .loose-assign-btn{font-size:11px;color:var(--text3);background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:3px 9px;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;flex-shrink:0;}
  .loose-add-row{display:flex;align-items:center;gap:8px;padding:8px 16px 12px;border-top:1px solid var(--border2);}
  .loose-add-input{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;}
  .loose-add-btn{background:var(--accent);color:#000;border:none;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}

  /* LOOSE TASK ASSIGN POPOVER */
  .loose-assign-pop{position:absolute;right:16px;top:36px;background:var(--bg4);border:1px solid var(--border);border-radius:12px;padding:10px 12px;z-index:20;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.4);}
  .lap-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;}
  .lap-proj{padding:7px 10px;font-size:13px;color:var(--text2);cursor:pointer;border-radius:8px;display:flex;align-items:center;gap:8px;}
  .lap-proj:hover{background:var(--bg3);color:var(--text);}
  .lap-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}

  /* SWIPEABLE PROJECT ROW */
  .swipe-wrapper{position:relative;overflow:hidden;margin:0 16px 8px;border-radius:14px;}
  .swipe-content{background:var(--bg2);border-radius:14px;transition:transform .2s ease;position:relative;z-index:1;}
  .swipe-delete-bg{
    position:absolute;right:0;top:0;bottom:0;width:80px;
    background:var(--red);border-radius:14px;
    display:flex;align-items:center;justify-content:center;
    color:#fff;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
    z-index:0;
  }

  .proj-card{padding:14px 16px;cursor:pointer;}
  .proj-card-top{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
  .proj-card-stripe{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:20px;}
  .proj-card-name{font-size:15px;font-weight:600;color:var(--text);flex:1;}
  .proj-card-name-input{
    font-size:15px;font-weight:600;color:var(--text);flex:1;background:transparent;
    border:none;border-bottom:1.5px solid var(--accent);outline:none;font-family:'DM Sans',sans-serif;
    padding:2px 0;
  }
  .proj-card-badge{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:20px;flex-shrink:0;cursor:pointer;}
  .badge-active{background:var(--accent-s);color:var(--accent);}
  .badge-backlog{background:var(--bg3);color:var(--text3);}
  .proj-bar-wrap{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-bottom:6px;}
  .proj-bar-fill{height:100%;border-radius:2px;transition:width .4s;}
  .proj-card-meta{display:flex;justify-content:space-between;}
  .proj-card-tasks{font-size:11px;color:var(--text3);}
  .proj-card-pct{font-size:11px;font-weight:600;}

  /* EXPANDED TASKS */


  /* ROUTINE BLOCKS */
  .routine-block{margin:0 0 1px;background:var(--bg2);cursor:pointer;}
  .routine-block-header{display:flex;align-items:center;gap:10px;padding:10px 14px;}
  .routine-stripe{width:3px;border-radius:2px;align-self:stretch;min-height:28px;flex-shrink:0;background:var(--text3);opacity:.5;}
  .routine-info{flex:1;}
  .routine-title{font-size:14px;font-weight:600;color:var(--text);}
  .routine-meta{font-size:11px;color:var(--text3);margin-top:1px;}
  .routine-badge{font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:20px;background:rgba(232,160,48,.12);color:var(--accent);border:1px solid rgba(232,160,48,.25);flex-shrink:0;}
  .routine-tasks{border-top:1px solid var(--border2);}
  .routine-task-row{display:flex;align-items:center;gap:10px;padding:9px 14px 9px 28px;}
  .routine-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
  .routine-check.done{background:var(--green);border-color:var(--green);}
  .routine-task-text{font-size:13px;color:var(--text);flex:1;transition:opacity .15s;}
  .routine-task-text.done{text-decoration:line-through;opacity:.45;}

  /* PROJECT EDIT PANEL */
  .proj-edit-panel{padding:14px 16px 16px;border-top:1px solid var(--border2);background:var(--bg2);}
  .proj-edit-row{display:flex;gap:8px;margin-bottom:12px;}
  .proj-edit-input{flex:1;background:var(--bg3);border:1.5px solid var(--accent);border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;outline:none;}
  .proj-edit-swatches{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
  .proj-swatch{width:28px;height:28px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .1s,border-color .15s;flex-shrink:0;}
  .proj-swatch.selected{border-color:#fff;transform:scale(1.15);}
  .proj-edit-save{background:var(--accent);color:#000;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}


  /* GEAR ICON (consistent across tabs) */
  .tab-gear{background:none;border:none;color:var(--text3);cursor:pointer;padding:6px;line-height:0;flex-shrink:0;opacity:.7;border-radius:8px;transition:opacity .15s,background .15s;}
  .tab-gear:active{opacity:1;background:var(--bg3);}

  /* SETTINGS SECTION HEADER */
  .set-section{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text3);margin:16px 0 8px;}

  /* SETTINGS ROW */
  .set-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border2);}
  .set-row:last-child{border-bottom:none;}
  .set-row-label{font-size:14px;color:var(--text);}
  .set-row-sub{font-size:12px;color:var(--text3);margin-top:2px;}
  .set-input{background:var(--bg3);border:1.5px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;width:100%;margin-top:6px;}
  .set-input:focus{border-color:var(--accent);}

  /* PROJECTS MANAGE SHEET */
  .pm-proj-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border2);}
  .pm-proj-row:last-child{border-bottom:none;}
  .pm-proj-swatch{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
  .pm-proj-name{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:6px 9px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;}
  .pm-proj-name:focus{border-color:var(--accent);}


  /* PROJECT PILLS — assign ghost sheet */
  .proj-pills-group{margin-bottom:14px;}
  .proj-pills-domain-label{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;}
  .proj-pills-row{display:flex;flex-wrap:wrap;gap:7px;}
  .proj-pill{padding:7px 13px;border-radius:20px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;border:1.5px solid transparent;transition:all .15s;background:transparent;}
  .proj-pill.selected{color:#000 !important;}
  .proj-pill:active{transform:scale(.96);}

  /* SWIPEABLE TASK ROW */
  .st-wrap{position:relative;overflow:hidden;border-bottom:1px solid var(--border2);}
  .st-wrap:last-of-type{border-bottom:none;}
  .st-delete-bg{position:absolute;right:0;top:0;bottom:0;width:72px;background:var(--red);display:flex;align-items:center;justify-content:center;cursor:pointer;}
  .st-delete-ico{font-size:13px;font-weight:700;color:#fff;letter-spacing:.04em;text-transform:uppercase;}
  .st-inner{display:flex;align-items:flex-start;gap:12px;padding:9px 0;background:var(--bg2);position:relative;z-index:1;}
  .st-edit-input{flex:1;background:var(--bg3);border:1.5px solid var(--accent);border-radius:8px;padding:4px 8px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;line-height:1.4;}

  .proj-tasks-expand{border-top:1px solid var(--border2);padding:4px 16px 14px;}
  .pte-task{display:flex;align-items:flex-start;gap:12px;padding:8px 0;cursor:pointer;border-bottom:1px solid var(--border2);}
  .pte-task:last-of-type{border-bottom:none;}

  /* ADD PROJECT */
  .add-proj-row{padding:11px 16px;display:flex;align-items:center;gap:8px;cursor:pointer;border-top:1px solid var(--border2);}
  .add-proj-ico{font-size:15px;color:var(--text3);}
  .add-proj-txt{font-size:13px;color:var(--text3);}

  /* DOMAIN EDIT SHEET */
  .domain-edit-list{margin-bottom:12px;}
  .domain-edit-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border2);}
  .domain-edit-row:last-child{border-bottom:none;}
  .domain-color-dot{width:24px;height:24px;border-radius:50%;flex-shrink:0;cursor:pointer;border:2px solid transparent;}
  .domain-color-dot.selected{border-color:var(--text);}
  .domain-name-input{
    flex:1;background:transparent;border:none;border-bottom:1px solid var(--border);
    padding:4px 0;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;
  }
  .domain-del-btn{background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:4px;flex-shrink:0;}
  .color-picker-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
  .color-swatch{width:28px;height:28px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .1s;}
  .color-swatch.sel{border-color:#fff;transform:scale(1.15);}
  .add-domain-btn{width:100%;background:var(--bg3);border:1.5px dashed var(--border);border-radius:12px;padding:12px;color:var(--text3);font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:8px;}

  /* ── PLAN ── */
  .intention-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;padding:16px 18px;}
  .ic-text{font-size:14px;color:var(--text2);line-height:1.65;}
  .ic-edit{font-size:12px;color:var(--accent);font-weight:500;margin-top:10px;cursor:pointer;background:none;border:none;display:block;}
  .intent-textarea{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.6;resize:none;margin-top:10px;outline:none;}
  .intent-save{margin-top:8px;background:var(--accent);color:#000;border:none;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}


  /* WEEK PLAN CARDS */
  .week-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;overflow:hidden;}
  .wc-head{padding:13px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border2);}
  .wc-day{font-size:14px;font-weight:600;color:var(--text);}
  .wc-day.today{color:var(--accent);}
  .wc-date{font-size:12px;color:var(--text3);}

  /* SWIPEABLE BLOCK ROW */
  .blk-swipe-wrap{position:relative;overflow:hidden;}
  .blk-swipe-content{display:flex;gap:12px;align-items:center;padding:10px 18px;border-bottom:1px solid var(--border2);background:var(--bg2);transition:transform .2s ease;position:relative;z-index:1;cursor:pointer;}
  .blk-swipe-content:last-of-type{}
  .blk-del-bg{position:absolute;right:0;top:0;bottom:0;width:80px;background:var(--red);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;z-index:0;}
  .blk-swipe-content.editing{background:var(--bg3);}
  .wcb-time{font-size:12px;color:var(--text3);min-width:80px;font-variant-numeric:tabular-nums;}
  .wcb-stripe{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:24px;}
  .wcb-info{flex:1;}
  .wcb-proj{font-size:13px;font-weight:500;color:var(--text);}
  .wcb-meta{font-size:11px;color:var(--text3);margin-top:2px;}
  .wc-add{padding:11px 18px;display:flex;align-items:center;gap:8px;cursor:pointer;}
  .wca-ico{font-size:15px;color:var(--text3);}
  .wca-txt{font-size:13px;color:var(--text3);}


  /* GHOST / EMPTY DEEP WORK BLOCKS */
  .ghost-block{display:flex;gap:12px;align-items:center;padding:10px 18px;border-bottom:1px solid var(--border2);cursor:pointer;background:transparent;transition:background .15s;}
  .ghost-block:hover{background:rgba(232,160,48,0.04);}
  .ghost-stripe{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:36px;border:1.5px dashed var(--border);background:transparent;}
  .ghost-inner{flex:1;}
  .ghost-time{font-size:12px;color:var(--text3);font-variant-numeric:tabular-nums;min-width:80px;}
  .ghost-label{font-size:13px;font-weight:500;color:var(--text3);}
  .ghost-hint{font-size:11px;color:var(--accent);opacity:.7;margin-top:2px;}
  .ghost-assign{font-size:11px;color:var(--text3);padding:4px 10px;border:1px dashed var(--border);border-radius:20px;white-space:nowrap;}
  .missed-block{display:flex;gap:12px;align-items:center;padding:9px 18px;border-bottom:1px solid var(--border2);background:rgba(224,85,85,0.03);}
  .missed-stripe{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:30px;background:var(--red);opacity:.35;}
  .missed-inner{flex:1;}
  .missed-time{font-size:11px;color:var(--text3);font-variant-numeric:tabular-nums;}
  .missed-label{font-size:12px;color:var(--text3);opacity:.6;}
  .missed-tag{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--red);opacity:.6;padding:2px 7px;border:1px solid rgba(224,85,85,.25);border-radius:20px;white-space:nowrap;}

  /* WORK WEEK CUSTOMIZER SHEET */
  .ww-days{display:flex;gap:8px;justify-content:center;margin:12px 0 6px;}
  .ww-day{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid var(--border);color:var(--text3);transition:all .15s;font-family:'DM Sans',sans-serif;}
  .ww-day.on{background:var(--accent);border-color:var(--accent);color:#000;}
  .ww-presets{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
  .ww-preset{background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:7px 14px;font-size:12px;font-weight:600;color:var(--text2);cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
  .ww-preset:hover{border-color:var(--accent);color:var(--accent);}
  .ww-times{margin-top:4px;}
  .ww-slot-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2);}
  .ww-slot-row:last-child{border-bottom:none;}
  .ww-slot-num{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);min-width:60px;}
  .ww-slot-type{font-size:12px;color:var(--text2);flex:1;}
  .ww-slot-select{background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:12px;outline:none;appearance:none;}
  .plan-gear{background:none;border:none;color:var(--text3);cursor:pointer;padding:6px;line-height:0;opacity:.7;border-radius:8px;transition:opacity .15s,background .15s;}

  /* ASSIGN BLOCK SHEET coach card */
  .coach-card{background:rgba(232,160,48,0.07);border:1px solid rgba(232,160,48,0.2);border-radius:12px;padding:12px 14px;margin-bottom:14px;}
  .coach-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:4px;}
  .coach-body{font-size:13px;color:var(--text2);line-height:1.55;}

  /* BLOCK INLINE EDIT */
  .blk-edit-panel{padding:10px 18px 14px;background:var(--bg3);border-bottom:1px solid var(--border2);}
  .blk-edit-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;}
  .blk-edit-select{width:100%;background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:12px;outline:none;appearance:none;}
  .blk-edit-label{font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);margin-bottom:4px;}
  .blk-edit-actions{display:flex;gap:8px;margin-top:4px;}
  .blk-edit-save{flex:1;background:var(--accent);color:#000;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .blk-edit-del{background:rgba(224,85,85,0.15);color:var(--red);border:none;border-radius:8px;padding:9px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;}

  /* ── REVIEW ── */
  .stats-row{margin:0 16px 8px;display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .stat-box{background:var(--bg2);border-radius:14px;padding:16px;}
  .stat-n{font-size:38px;font-weight:700;color:var(--text);letter-spacing:-.03em;line-height:1;}
  .stat-lbl{font-size:12px;color:var(--text2);margin-top:5px;}
  .cov-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;padding:16px 18px;}
  .cov-row{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
  .cov-row:last-child{margin-bottom:0;}
  .cov-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .cov-name{font-size:13px;font-weight:500;color:var(--text);min-width:74px;}
  .cov-bar-wrap{flex:1;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;}
  .cov-bar-fill{height:100%;border-radius:2px;}
  .cov-ct{font-size:12px;color:var(--text2);min-width:50px;text-align:right;}
  .cov-zero{color:var(--red)!important;}
  .dw-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;padding:16px 18px;}
  .dw-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}
  .dw-col{display:flex;flex-direction:column;align-items:center;gap:5px;}
  .dw-lbl{font-size:9px;font-weight:600;letter-spacing:.1em;color:var(--text3);text-transform:uppercase;}
  .dw-sq{width:100%;aspect-ratio:1;border-radius:8px;background:var(--bg3);}
  .dw-sq.full{background:var(--accent);}
  .dw-sq.half{background:rgba(232,160,48,.3);}
  .moved-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;overflow:hidden;}
  .mv-row{padding:13px 18px;display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border2);}
  .mv-row:last-child{border-bottom:none;}
  .mv-stripe{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:30px;}
  .mv-info{flex:1;}
  .mv-name{font-size:14px;font-weight:500;color:var(--text);margin-bottom:6px;}
  .mv-bar-wrap{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;}
  .mv-bar-fill{height:100%;border-radius:2px;}
  .mv-delta{font-size:13px;font-weight:600;color:var(--green);}

  /* ── SEASON ── */
  .season-pull-card{margin:0 16px 8px;border-radius:16px;overflow:hidden;border:1px solid rgba(232,160,48,0.2);background:rgba(232,160,48,0.04);}
  .spc-head{padding:13px 18px 10px;display:flex;justify-content:space-between;align-items:center;}
  .spc-eyebrow{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);opacity:.75;}
  .spc-edit{font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;opacity:.8;}
  .spc-goal{display:flex;align-items:center;gap:10px;padding:7px 18px;}
  .spc-goal:last-child{padding-bottom:13px;}
  .spc-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
  .spc-text{font-size:13px;color:var(--text2);line-height:1.4;flex:1;}
  .spc-text.done{color:var(--text3);text-decoration:line-through;}
  .spc-check{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;font-size:9px;color:transparent;transition:all .15s;}
  .spc-check.checked{background:var(--green);border-color:var(--green);color:#fff;}
  .spc-empty{padding:10px 18px 14px;font-size:12px;color:var(--text3);}
  .season-hero{margin:0 16px 8px;background:var(--bg2);border-radius:16px;padding:18px;}
  .sh-quarter{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:6px;}
  .sh-title{font-size:20px;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:4px;}
  .sh-sub{font-size:12px;color:var(--text3);}
  .sg-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;overflow:hidden;}
  .sg-row{display:flex;align-items:flex-start;gap:14px;padding:13px 18px;border-bottom:1px solid var(--border2);}
  .sg-row:last-child{border-bottom:none;}
  .sg-stripe{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:30px;}
  .sg-body{flex:1;}
  .sg-text{font-size:14px;font-weight:500;color:var(--text);line-height:1.4;}
  .sg-text.done{color:var(--text3);text-decoration:line-through;}
  .sg-domain{font-size:11px;color:var(--text3);margin-top:3px;}
  .sg-check{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;font-size:12px;color:transparent;transition:all .15s;margin-top:1px;}
  .sg-check.checked{background:var(--green);border-color:var(--green);color:#fff;}
  .sg-del{background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;padding:2px 0 2px 4px;flex-shrink:0;margin-top:1px;}
  .add-goal-row{padding:12px 18px;display:flex;align-items:flex-start;gap:8px;border-top:1px solid var(--border2);flex-wrap:wrap;}
  .add-goal-input{flex:1;min-width:0;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;}
  .add-goal-domain{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;appearance:none;}
  .add-goal-btn{background:var(--accent);color:#000;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .season-divider{margin:8px 16px 4px;display:flex;align-items:center;gap:10px;}
  .sdiv-line{flex:1;height:1px;background:var(--border2);}
  .sdiv-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);}
  /* ── NAV ── */
  .nav{flex-shrink:0;height:78px;background:var(--bg);border-top:1px solid var(--border2);display:flex;align-items:flex-end;padding-bottom:10px;position:relative;z-index:25;overflow:visible;}
  .nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;padding-top:10px;}
  .nav-ico{font-size:20px;line-height:1;color:var(--text3);transition:color .15s;}
  .nav-lbl{font-size:10px;font-weight:500;letter-spacing:.04em;color:var(--text3);text-transform:uppercase;transition:color .15s;}
  .nav-btn.on .nav-ico,.nav-btn.on .nav-lbl{color:var(--accent);}
  .nav-dot{position:absolute;top:8px;right:calc(50% - 14px);width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px rgba(232,160,48,.6);}
  .nav-btn{position:relative;}

  /* ── SHEETS ── */
  .backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);z-index:50;}
  .sheet{position:absolute;bottom:0;left:0;right:0;background:var(--bg2);border-radius:24px 24px 0 0;z-index:60;padding:12px 20px 34px;max-height:85%;display:flex;flex-direction:column;animation:slideUp .28s cubic-bezier(.32,.72,0,1);}
  @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
  .sheet-pull{width:36px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 18px;}
  .sheet-title{font-size:20px;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:4px;}
  .sheet-sub{font-size:13px;color:var(--text2);margin-bottom:18px;}
  .sheet-scroll{flex:1;overflow-y:auto;scrollbar-width:none;}
  .sheet-scroll::-webkit-scrollbar{display:none;}
  .sd-item{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border2);cursor:pointer;}
  .sd-item:last-of-type{border-bottom:none;}
  .sd-box{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .sd-box.done{background:var(--green);border-color:var(--green);}
  .sd-box.done::after{content:'✓';font-size:10px;color:#fff;font-weight:700;}
  .sd-item-txt{font-size:14px;color:var(--text);}
  .sd-btn{margin-top:18px;width:100%;background:var(--accent);color:#000;border:none;border-radius:14px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .sd-btn:disabled{opacity:.5;cursor:not-allowed;}

  /* FORM */
  .form-row{margin-bottom:14px;}
  .form-label{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;display:block;}
  .form-select,.form-input{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;appearance:none;}
  .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .form-btn{width:100%;background:var(--accent);color:#000;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:6px;}

  /* ADD TASK */
  .add-task-tap{min-height:36px;cursor:pointer;}
  .add-task-tap:active{background:var(--bg3);}
  .add-task-inline{display:flex;align-items:center;border-top:1px solid var(--border2);padding:0 14px;}
  .add-task-inline-input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;padding:10px 0;}
  .add-task-inline-input::placeholder{color:var(--text3);}
  /* keep old classes for TodayScreen usage */
  .add-task-row{display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--border2);}
  .add-task-input{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:9px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;}
  .add-task-input::placeholder{color:var(--text3);}
  .add-task-btn{background:var(--accent);color:#000;border:none;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}

  /* INBOX */
  .inbox-banner{margin:0 16px 10px;background:var(--accent);border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;}
  .ib-icon{font-size:18px;flex-shrink:0;}
  .ib-info{flex:1;}
  .ib-title{font-size:14px;font-weight:700;color:#000;line-height:1.2;}
  .ib-sub{font-size:12px;color:rgba(0,0,0,.6);margin-top:2px;}
  .ib-arrow{font-size:18px;color:rgba(0,0,0,.5);}
  .inbox-swipe-wrap{position:relative;overflow:hidden;border-radius:12px;margin-bottom:8px;}
  .inbox-action-left{position:absolute;left:0;top:0;bottom:0;width:90px;background:var(--green);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;border-radius:12px;}
  .inbox-action-right{position:absolute;right:0;top:0;bottom:0;width:90px;background:var(--red);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;border-radius:12px;}
  .inbox-action-lbl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;}
  .inbox-action-ico{font-size:18px;line-height:1;}
  .inbox-item{background:var(--bg3);border-radius:12px;padding:14px 16px;position:relative;z-index:1;}
  .ii-text{font-size:14px;color:var(--text);font-weight:500;margin-bottom:10px;}
  .ii-label{font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;}
  .ii-select{width:100%;background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;appearance:none;margin-bottom:8px;}
  .ii-actions{display:flex;gap:8px;}
  .ii-save{flex:1;background:var(--accent);color:#000;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .ii-save:disabled{opacity:.4;cursor:not-allowed;}
  .ii-dismiss{background:var(--bg4);color:var(--text3);border:none;border-radius:8px;padding:9px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .inbox-empty{text-align:center;padding:30px 0;color:var(--text3);font-size:14px;}


  /* QUICK REMINDERS MODAL */
  .qr-backdrop{position:absolute;inset:0;z-index:24;background:rgba(0,0,0,.6);backdrop-filter:blur(2px);}
  .qr-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(100% - 40px);max-width:320px;background:var(--bg2);border-radius:20px;box-shadow:0 16px 48px rgba(0,0,0,.6);z-index:25;overflow:hidden;animation:qr-in .2s cubic-bezier(.34,1.3,.64,1);}
  @keyframes qr-in{from{opacity:0;transform:translate(-50%,-46%) scale(.94);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}
  .qr-header{padding:18px 18px 12px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
  .qr-items{max-height:220px;overflow-y:auto;}
  .qr-item{display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid var(--border2);}
  .qr-item-text{flex:1;font-size:14px;color:var(--text);}
  .qr-item-del{background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;opacity:.5;}
  .qr-item-del:active{opacity:1;color:var(--red);}
  .qr-input-row{display:flex;align-items:center;padding:12px 18px 16px;}
  .qr-input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:'DM Sans',sans-serif;font-size:15px;}
  .qr-input::placeholder{color:var(--text3);}

  /* FAB */
  .fab{width:50px;height:50px;border-radius:50%;background:rgba(232,160,48,0.18);border:1.5px solid rgba(232,160,48,0.35);color:var(--accent);font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;bottom:14px;z-index:26;flex-shrink:0;transition:transform .15s,background .15s;font-family:'DM Sans',sans-serif;box-shadow:0 2px 16px rgba(0,0,0,.3);}
  .fab.open{background:rgba(232,160,48,0.28);border-color:rgba(232,160,48,0.6);transform:scale(1.05);}
  .fab:active{transform:scale(.93);}
  .capture-input{width:100%;background:var(--bg3);border:1.5px solid var(--accent);border-radius:12px;padding:14px 16px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;margin-bottom:14px;}
  .capture-input::placeholder{color:var(--text3);}
  .capture-btn{width:100%;background:var(--accent);color:#000;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .capture-hint{font-size:12px;color:var(--text3);text-align:center;margin-top:10px;}

  .spacer{height:16px;}
`;

// ─── STATUS BAR (no time) ─────────────────────────────────────────────────────
function StatusBar() {
  return (
    <div className="status">
      
    </div>
  );
}

// ─── SWIPEABLE ROW ────────────────────────────────────────────────────────────
function SwipeRow({ onDelete, children, className = "" }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(null);
  const revealed = offset < -60;

  const onTouchStart = e => { startX.current = e.touches[0].clientX; };
  const onTouchMove = e => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setOffset(Math.max(dx, -80));
    else if (offset < 0) setOffset(Math.min(0, offset + dx));
  };
  const onTouchEnd = () => {
    if (revealed) setOffset(-80); else setOffset(0);
    startX.current = null;
  };

  return (
    <div className={`swipe-wrapper ${className}`} style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", cursor: "pointer" }} onClick={onDelete}>
        Delete
      </div>
      <div
        style={{ transform: `translateX(${offset}px)`, transition: startX.current === null ? "transform .2s ease" : "none", position: "relative", zIndex: 1 }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

// ─── TODAY SCREEN ─────────────────────────────────────────────────────────────
function TodayScreen({ data, setData, openShutdown, openAddBlock, focusMode: focusModeprop, setFocusMode: setFocusModeApp, onSignOut }) {
  const [showTodaySettings, setShowTodaySettings] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [swapBlockId, setSwapBlockId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const swipeState = useRef({});

  const rescheduleToTomorrow = (blockId) => {
    setData(d => ({ ...d, blocks: d.blocks.map(b => b.id === blockId ? { ...b, dayOffset: (b.dayOffset || 0) + 1 } : b) }));
  };

  const handleDragStart = (e, blockId) => {
    setDragId(blockId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, blockId) => {
    e.preventDefault();
    setDragOverId(blockId);
  };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    setData(d => {
      const blocks = [...d.blocks];
      const fromIdx = blocks.findIndex(b => b.id === dragId);
      const toIdx = blocks.findIndex(b => b.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return d;
      const fromBlk = blocks[fromIdx];
      const toBlk = blocks[toIdx];
      // Swap times
      const newBlocks = blocks.map(b => {
        if (b.id === dragId) return { ...b, startHour: toBlk.startHour, startMin: toBlk.startMin };
        if (b.id === targetId) return { ...b, startHour: fromBlk.startHour, startMin: fromBlk.startMin };
        return b;
      });
      return { ...d, blocks: newBlocks };
    });
    setDragId(null); setDragOverId(null);
  };

  const initSwipe = (e, blockId, onComplete, onReschedule) => {
    const touch = e.touches[0];
    swipeState.current[blockId] = { startX: touch.clientX, startY: touch.clientY, swiping: false };
  };
  const moveSwipe = (e, blockId, el) => {
    const s = swipeState.current[blockId];
    if (!s) return;
    const touch = e.touches[0];
    const dx = touch.clientX - s.startX;
    const dy = touch.clientY - s.startY;
    if (!s.swiping && Math.abs(dy) > Math.abs(dx)) { delete swipeState.current[blockId]; return; }
    if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
    if (!s.swiping) return;
    e.preventDefault();
    s.dx = dx;
    if (el) { el.style.transform = `translateX(${Math.max(-120, Math.min(120, dx))}px)`; el.classList.add("swiping"); }
  };
  const endSwipe = (e, blockId, el, onComplete, onReschedule) => {
    const s = swipeState.current[blockId];
    if (!s || !s.swiping) { delete swipeState.current[blockId]; return; }
    const dx = s.dx || 0;
    delete swipeState.current[blockId];
    if (el) { el.style.transform = ""; el.classList.remove("swiping"); }
    if (dx > 80) onComplete();
    else if (dx < -80) onReschedule();
  };
  const [newTaskText, setNewTaskText] = useState({});
  const [tick, setTick] = useState(0);
  // lateStarted: { [blockId]: { startedAt: ISO string } }
  const [lateStarted, setLateStarted] = useState({});
  const [conflictWarning, setConflictWarning] = useState(null); // blockId with conflict
  // focusBlockId: which block is in focus mode (null = none)
  const [focusBlockId, setFocusBlockId] = useState(null);
  // pickerState: { blockId, projectId, selected: Set<taskId>, newText }
  const [pickerState, setPickerState] = useState(null);
  // manualCompleted derived from persisted data (today's date only)
  const todayStr = new Date().toDateString();
  const manualCompleted = new Set(
    (data.blockCompletions || []).filter(c => c.date === todayStr).map(c => c.blockId)
  );
  // editingTime: blockId whose time picker is open
  const [editingTime, setEditingTime] = useState(null);
  // looseBlockExp: is the loose tasks block expanded
  const [looseBlockExp, setLooseBlockExp] = useState(false);
  // loosePickerOpen: is the task picker open inside loose block
  const [loosePickerOpen, setLoosePickerOpen] = useState(false);
  const { domains, projects, blocks, shutdownDone } = data;

  const [focusModeLocal, setFocusModeLocal] = useState(false);
  const focusMode = focusModeprop !== undefined ? focusModeprop : focusModeLocal;
  const setFocusMode = setFocusModeApp || setFocusModeLocal;

  // Live tick every second (powers clock + countdowns)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now   = new Date();
  const today = new Date();
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const isAfter4 = now.getHours() >= 16;

  const getProject = id => projects.find(p => p.id === id);
  const getDomain  = id => domains.find(d => d.id === id);

  const toggleTask = (projectId, taskId) => setData(d => ({
    ...d, projects: d.projects.map(p =>
      p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t) } : p
    )
  }));

  const addTask = (projectId) => {
    const text = (newTaskText[projectId] || "").trim();
    if (!text) return;
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { id: uid(), text, done: false }] } : p) }));
    setNewTaskText(t => ({ ...t, [projectId]: "" }));
  };

  // Save the chosen todayTask IDs onto a block
  // If block was completed and new tasks were added, remove the completion
  const saveTodayTasks = (blockId, taskIds) => {
    const todayStr = new Date().toDateString();
    setData(d => {
      const wasCompleted = (d.blockCompletions || []).some(c => c.blockId === blockId && c.date === todayStr);
      const blk = d.blocks.find(b => b.id === blockId);
      const prevIds = Array.isArray(blk?.todayTasks) ? blk.todayTasks : [];
      const hasNewTasks = taskIds.some(id => !prevIds.includes(id));
      // Auto-uncheck if completed and new tasks were added
      const blockCompletions = wasCompleted && hasNewTasks
        ? (d.blockCompletions || []).filter(c => !(c.blockId === blockId && c.date === todayStr))
        : d.blockCompletions;
      return {
        ...d,
        blocks: d.blocks.map(b => b.id === blockId ? { ...b, todayTasks: taskIds } : b),
        blockCompletions,
      };
    });
  };

  const unmarkManualDone = (blockId, projectId, todayTaskIds) => {
    setData(d => {
      // Uncheck today's tasks on the project
      let projects = d.projects;
      if (projectId) {
        const proj = d.projects.find(p => p.id === projectId);
        if (proj) {
          const idsToUncheck = (Array.isArray(todayTaskIds) && todayTaskIds.length > 0)
            ? todayTaskIds
            : proj.tasks.map(t => t.id);
          projects = d.projects.map(p => p.id === projectId
            ? { ...p, tasks: p.tasks.map(t => idsToUncheck.includes(t.id) ? { ...t, done: false, doneAt: undefined } : t) }
            : p
          );
        }
      }
      // Remove from blockCompletions
      const todayStr = new Date().toDateString();
      const blockCompletions = (d.blockCompletions || []).filter(c => !(c.blockId === blockId && c.date === todayStr));
      return { ...d, projects, blockCompletions };
    });
  };

  const rescheduleBlock = (blockId, newHour, newMin) => {
    setData(d => ({ ...d, blocks: d.blocks.map(b => b.id === blockId ? { ...b, startHour: newHour, startMin: newMin } : b) }));
    setEditingTime(null);
  };

  const markManualDone = (blockId, projectId, todayTaskIds) => {
    setData(d => {
      // Mark today's tasks done on the project
      let projects = d.projects;
      if (projectId) {
        const proj = d.projects.find(p => p.id === projectId);
        if (proj) {
          const idsToCheck = (Array.isArray(todayTaskIds) && todayTaskIds.length > 0)
            ? todayTaskIds
            : proj.tasks.map(t => t.id);
          projects = d.projects.map(p => p.id === projectId
            ? { ...p, tasks: p.tasks.map(t => idsToCheck.includes(t.id) ? { ...t, done: true, doneAt: new Date().toISOString() } : t) }
            : p
          );
        }
      }
      // Persist the completion (skip if already logged today)
      const todayStr = new Date().toDateString();
      const existing = d.blockCompletions || [];
      const alreadyLogged = existing.some(c => c.blockId === blockId && c.date === todayStr);
      const blk = (d.blocks || []).find(b => b.id === blockId);
      const durationMin = blk?.durationMin || 60;
      const blockCompletions = alreadyLogged ? existing : [...existing, { blockId, date: todayStr, durationMin }];
      return { ...d, projects, blockCompletions };
    });
    setExpandedId(null); // collapse the card
  };

  // Add a brand-new task to project AND return its id so caller can also select it
  const addTaskToProject = (projectId, text) => {
    const newId = uid();
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { id: newId, text, done: false }] } : p) }));
    return newId;
  };

  const startBlock = (blkId) => {
    // Check for overlap with next block
    const blk = blocks.find(b => b.id === blkId);
    if (!blk) return;
    const startMins = now.getHours() * 60 + now.getMinutes();
    const endMins = startMins + blk.durationMin;
    const conflict = todayBlocksSorted.find(b => b.id !== blkId && b.startHour * 60 + b.startMin < endMins && b.startHour * 60 + b.startMin > startMins);
    if (conflict && conflictWarning !== blkId) {
      const proj = conflict.projectId ? projects.find(p => p.id === conflict.projectId) : null;
      setConflictWarning({ id: blkId, conflictName: proj?.name || conflict.label || "another block" });
      return;
    }
    setConflictWarning(null);
    setLateStarted(prev => ({ ...prev, [blkId]: { startedAt: new Date().toISOString() } }));
    // Go straight into focus mode
    setFocusBlockId(blkId);
    setFocusMode(true);
  };

  // Today's loose task picks — can be loose tasks OR project tasks
  const todayDateStr = today.toDateString();
  const todayLoosePicks = (data.todayLoosePicks || {})[todayDateStr] || [];
  const looseTasks = data.looseTasks || [];

  // Build a flat lookup of ALL tasks (loose + project) by id
  const allTasksById = {};
  (data.looseTasks||[]).forEach(t => { allTasksById[t.id] = { ...t, _type: "loose" }; });
  (data.projects||[]).forEach(proj => {
    const domain = (data.domains||[]).find(d => d.id === proj.domainId);
    proj.tasks.forEach(t => { allTasksById[t.id] = { ...t, domainId: proj.domainId, domainColor: domain?.color, projectName: proj.name, projId: proj.id, _type: "project" }; });
  });

  const pickedLooseTasks = todayLoosePicks.map(id => allTasksById[id]).filter(Boolean);
  const loosePickedDone = pickedLooseTasks.filter(t => t.done).length;

  const saveLoosPicks = (ids) => {
    setData(d => ({
      ...d,
      todayLoosePicks: { ...(d.todayLoosePicks||{}), [todayDateStr]: ids }
    }));
  };

  const toggleLooseTask = (taskId) => {
    const task = allTasksById[taskId];
    if (!task) return;
    if (task._type === "loose") {
      setData(d => ({
        ...d,
        looseTasks: (d.looseTasks||[]).map(t =>
          t.id === taskId ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t
        )
      }));
    } else {
      // project task
      setData(d => ({
        ...d,
        projects: (d.projects||[]).map(p =>
          p.id === task.projId
            ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t) }
            : p
        )
      }));
    }
  };

  // Build unified timeline: project blocks + routine blocks for today, sorted by time
  const todayBlocks = blocks.filter(b => b.dayOffset === 0);
  const todayBlocksSorted = [...todayBlocks].sort((a,b) => a.startHour*60+a.startMin - (b.startHour*60+b.startMin));
  const todayRoutines = getRoutinesForDate(data.routineBlocks || [], today);
  const dateKey = today.toDateString();

  const timeline = [
    ...todayBlocks.map(b => ({ type: "block", id: b.id, mins: b.startHour * 60 + b.startMin, data: b })),
    ...todayRoutines.map(r => ({ type: "routine", id: r.id, mins: r.startHour * 60 + r.startMin, data: r })),
  ].sort((a, b) => a.mins - b.mins);

  // Prime window — first project block of the day, if it starts between 6am–11am
  const firstProjectItem = timeline.find(item => item.type === "block");
  const primeWindowBlockId = (() => {
    if (!firstProjectItem) return null;
    const startMins = firstProjectItem.mins;
    // Only flag as prime window if it's a morning block (6am=360 to 11am=660)
    return startMins >= 360 && startMins <= 660 ? firstProjectItem.id : null;
  })();

  // Find the "current" block — started and not yet ended
  const currentItem = timeline.find(item => {
    const endMins = item.mins + (item.data.durationMin || 60);
    return item.mins <= nowMins && nowMins < endMins;
  });
  // Next upcoming
  const nextItem = timeline.find(item => item.mins > nowMins);

  // Clock display
  const clockH = now.getHours() > 12 ? now.getHours() - 12 : now.getHours() === 0 ? 12 : now.getHours();
  const clockM = now.getMinutes().toString().padStart(2, "0");
  const clockAmpm = now.getHours() >= 12 ? "PM" : "AM";

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const name = data.todayPrefs?.name;

  return (
    <div className="screen active" style={{ background: focusMode ? "#111314" : "var(--bg)", transition: "background .4s ease" }}>
      <StatusBar />

      {/* HEADER */}
      {!focusMode && (
        <div className="ph" style={{ paddingBottom: 12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div className="ph-eye">{days[today.getDay()]}, {months[today.getMonth()]} {today.getDate()}</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:2, marginTop:2 }}>
                <span className="today-clock">{clockH}:{clockM}</span>
                <span className="today-clock-ampm">{clockAmpm}</span>
              </div>
              <div style={{ fontSize:13, color:"var(--text3)", marginTop:4 }}>
                {greeting}{name ? `, ${name}` : ""}.
                {currentItem ? ` You're in a block.` : nextItem ? ` Next up at ${fmtTime(nextItem.data.startHour, nextItem.data.startMin)}.` : " No more blocks today."}
              </div>
            </div>
<button className="tab-gear" onClick={() => setShowTodaySettings(true)} onContextMenu={e => { e.preventDefault(); if(onSignOut) onSignOut(); }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.36.07-.72.07-1.08s-.03-.73-.07-1.08l2.32-1.82c.21-.16.27-.46.13-.7l-2.2-3.81a.55.55 0 0 0-.67-.24l-2.74 1.1c-.57-.44-1.18-.81-1.86-1.08l-.42-2.9A.55.55 0 0 0 14 2h-4a.55.55 0 0 0-.54.46l-.42 2.9c-.68.27-1.3.64-1.86 1.08L4.44 5.35a.54.54 0 0 0-.67.24L1.57 9.4c-.14.24-.08.54.13.7l2.32 1.82C3.98 12.27 3.95 12.63 3.95 13s.03.73.07 1.08L1.7 15.9c-.21.16-.27.46-.13.7l2.2 3.81c.13.24.43.32.67.24l2.74-1.1c.57.44 1.18.81 1.86 1.08l.42 2.9c.08.28.29.47.54.47h4c.25 0 .46-.19.54-.46l.42-2.9c.68-.27 1.3-.64 1.86-1.08l2.74 1.1c.24.09.54 0 .67-.24l2.2-3.81c.14-.24.08-.54-.13-.7l-2.32-1.82Z" fill="currentColor"/></svg></button>
          </div>
        </div>
      )}

      {/* Focus mode — full screen for the active block */}
      {focusMode && (() => {
        const focusBlk = focusBlockId ? blocks.find(b => b.id === focusBlockId) : null;
        if (!focusBlk) { setFocusMode(false); setFocusBlockId(null); return null; }
        const proj = focusBlk.projectId ? getProject(focusBlk.projectId) : null;
        const domain = proj ? getDomain(proj.domainId) : null;
        const lateInfo = lateStarted[focusBlk.id];
        // Countdown from actual start time
        const startMs = lateInfo ? new Date(lateInfo.startedAt).getTime() : Date.now();
        const totalSec = focusBlk.durationMin * 60;
        const remSec = Math.max(0, totalSec - Math.floor((Date.now() - startMs) / 1000));
        const rm = Math.floor(remSec / 60), rs = remSec % 60;
        const focusCountdown = `${rm}:${rs.toString().padStart(2,"0")}`;
        const pct = Math.round(((totalSec - remSec) / totalSec) * 100);
        // Today tasks in focus mode
        const ftids = focusBlk.todayTasks;
        const focusTasks = Array.isArray(ftids) && ftids.length > 0
          ? ftids.map(id => proj?.tasks.find(t => t.id === id)).filter(Boolean)
          : (proj?.tasks || []);
        const markDoneAndExit = () => {
          const proj = focusBlk.projectId ? getProject(focusBlk.projectId) : null;
          markManualDone(focusBlk.id, proj?.id, focusBlk.todayTasks);
          setLateStarted(prev => { const n={...prev}; delete n[focusBlk.id]; return n; });
          setFocusMode(false); setFocusBlockId(null);
        };
        const stopAndExit = () => {
          setLateStarted(prev => { const n={...prev}; delete n[focusBlk.id]; return n; });
          setFocusMode(false); setFocusBlockId(null);
        };
        return (
          <div style={{ padding:"24px 16px 0", display:"flex", flexDirection:"column", height:"100%", background:"#111314" }}>
            {/* Header row */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color: domain?.color || "var(--accent)", marginBottom:6 }}>● IN SESSION</div>
                <div style={{ fontSize:24, fontWeight:700, color:"var(--text)", letterSpacing:"-.02em" }}>{proj?.name || focusBlk.label}</div>
                <div style={{ fontSize:12, color:"var(--text3)", marginTop:3 }}>{domain?.name}{domain ? " · " : ""}{focusBlk.durationMin} min</div>
              </div>
              {/* Big countdown */}
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:36, fontWeight:700, color:"var(--accent)", fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{focusCountdown}</div>
                <div style={{ fontSize:10, color:"var(--text3)", marginTop:4 }}>{pct}% done</div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height:2, background:"var(--bg3)", borderRadius:2, marginBottom:20, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct}%`, background:"var(--accent)", borderRadius:2, transition:"width 1s linear" }} />
            </div>
            {/* Tasks */}
            {focusTasks.length > 0 && (
              <div style={{ flex:1, overflowY:"auto" }}>
                {focusTasks.map(t => (
                  <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:"1px solid var(--border2)", cursor:"pointer" }} onClick={() => toggleTask(proj.id, t.id)}>
                    <div className={`tl-check ${t.done ? "done" : ""}`} style={{ flexShrink:0 }}>
                      {t.done && <span style={{fontSize:9,color:"#fff",fontWeight:700}}>✓</span>}
                    </div>
                    <span style={{ fontSize:15, color: t.done ? "var(--text3)" : "var(--text)", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Buttons */}
            <div style={{ display:"flex", gap:10, marginTop:"auto", paddingTop:16, paddingBottom:20 }}>
              <button onClick={stopAndExit}
                style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:12, padding:"13px", color:"var(--red)", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                Stop
              </button>
              <button onClick={markDoneAndExit}
                style={{ flex:2, background:"var(--accent)", border:"none", borderRadius:12, padding:"13px", color:"#000", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                Done ✓
              </button>
            </div>
          </div>
        );
      })()}

      {!focusMode && (
        <div className="scroll" onClick={() => setEditingTime(null)}>
          {/* TIMELINE */}
          {timeline.length === 0 && (
            <div style={{ margin:"16px", padding:"20px", background:"var(--bg2)", borderRadius:14, textAlign:"center" }}>
              <div style={{ fontSize:13, color:"var(--text3)" }}>No blocks scheduled today.</div>
              <button onClick={openAddBlock} style={{ marginTop:10, background:"var(--accent)", color:"#000", border:"none", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>+ Add Block</button>
            </div>
          )}

          <div className="tl-wrap" style={{ paddingTop: 4 }}>
            {timeline.map((item, idx) => {
              const isPast = (item.mins + (item.data.durationMin || 60)) <= nowMins;
              const isNow = currentItem?.id === item.id;
              const isExp = expandedId === item.id;

              // Project block
              if (item.type === "block") {
                const blk = item.data;
                const proj = blk.projectId ? getProject(blk.projectId) : null;
                const domain = proj ? getDomain(proj.domainId) : null;
                const doneTasks = proj?.tasks.filter(t=>t.done).length || 0;
                const totalTasks = proj?.tasks.length || 0;
                // For completion indicator: use todayTasks if set, else all tasks
                const todayTaskIds = blk.todayTasks;
                const hasTodayTasks = Array.isArray(todayTaskIds) && todayTaskIds.length > 0;
                const relevantTasks = hasTodayTasks
                  ? todayTaskIds.map(id => proj?.tasks.find(t => t.id === id)).filter(Boolean)
                  : (proj?.tasks || []);
                const relevantDone = relevantTasks.filter(t => t.done).length;
                const allTasksDone = relevantTasks.length > 0 && relevantDone === relevantTasks.length;

                // Late start state
                const lateInfo = lateStarted[blk.id];
                const isLateActive = !!lateInfo;

                // Countdown for late-started or current block
                let countdownStr = null;
                let countdownExpired = false;
                if (isLateActive || isNow) {
                  const startMs = isLateActive
                    ? new Date(lateInfo.startedAt).getTime()
                    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), blk.startHour, blk.startMin).getTime();
                  const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
                  const totalSec = blk.durationMin * 60;
                  const remSec = totalSec - elapsedSec;
                  if (remSec <= 0) {
                    countdownExpired = true;
                    countdownStr = "Done";
                  } else {
                    const rm = Math.floor(remSec / 60);
                    const rs = remSec % 60;
                    countdownStr = `${rm}:${rs.toString().padStart(2,"0")}`;
                  }
                }

                // Completion indicator — manual, timer-expired, or time-window-passed
                const isManualDone = manualCompleted.has(blk.id);
                const isCompleted = isManualDone || countdownExpired;
                const isPastUnworked = isPast && !isNow && !isLateActive && !isManualDone;
                const isMissedAndNotStarted = isPastUnworked;
                const dotState = isLateActive || isNow ? "now" : isCompleted ? "done" : "";
                const isUpcoming = !isNow && !isLateActive && !isMissedAndNotStarted && !isManualDone && !countdownExpired && !isPast;
                const domainCardColor = domain?.color || "rgba(255,255,255,.18)";

                // Three clear states (when not active/expanded):
                // 1. done-card   — past + completed → greyed out, green check
                // 2. missed-card — past + not completed → colored border, empty circle
                // 3. upcoming-card — future → domain-colored border (unchanged)
                const cardClass = [
                  "tl-card",
                  isCompleted && !isExp ? "done-card" : "",
                  isMissedAndNotStarted && !isExp ? "missed-card" : "",
                  (isNow || isLateActive) ? "now-card" : "",
                  isExp ? "active-card" : "",
                  isUpcoming && !isExp ? "upcoming-card" : "",
                ].filter(Boolean).join(" ");

                const showConflict = conflictWarning?.id === blk.id;

                return (
                  <div
                    key={item.id}
                    className={["tl-item", dragId===blk.id?"dragging":"", dragOverId===blk.id?"drag-over":""].filter(Boolean).join(" ")}
                    draggable={!isCompleted && !isNow && !isLateActive}
                    onDragStart={e => handleDragStart(e, blk.id)}
                    onDragOver={e => handleDragOver(e, blk.id)}
                    onDrop={e => handleDrop(e, blk.id)}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  >
                    <div className="tl-left">
                      {isLateActive ? (
                        <div className="tl-time" style={{ color:"var(--accent)", paddingTop:14 }}>
                          {fmtTime(new Date(lateInfo.startedAt).getHours(), new Date(lateInfo.startedAt).getMinutes())}
                        </div>
                      ) : (
                        <div className="time-pick-wrap">
                          <button
                            className={`tl-time-btn${editingTime === blk.id ? " open" : ""}`}
                            onClick={e => { e.stopPropagation(); setEditingTime(editingTime === blk.id ? null : blk.id); }}
                            title="Tap to reschedule"
                          >
                            {fmtTime(blk.startHour, blk.startMin)}
                          </button>
                          {editingTime === blk.id && (() => {
                            // Full range 8am–10pm, scroll anchored to current time on open
                            const slots = [];
                            for (let h = 8; h <= 22; h++) {
                              for (let m of [0, 30]) {
                                if (h === 22 && m === 30) continue;
                                slots.push({ h, m });
                              }
                            }
                            const currentIdx = slots.findIndex(s => s.h === blk.startHour && s.m === blk.startMin);
                            return (
                              <div className="time-popover" onClick={e => e.stopPropagation()}>
                                <div className="time-popover-inner" ref={el => {
                                  if (el && currentIdx >= 0) {
                                    // Scroll so current time is at top
                                    el.scrollTop = currentIdx * 35;
                                  }
                                }}>
                                  {slots.map(({h, m}) => {
                                    const isCurrent = h === blk.startHour && m === blk.startMin;
                                    return (
                                      <div
                                        key={`${h}-${m}`}
                                        className={`time-slot${isCurrent ? " current" : ""}`}
                                        onClick={() => rescheduleBlock(blk.id, h, m)}
                                      >
                                        {fmtTime(h, m)}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      <div className={`tl-dot ${dotState}`} style={
                        isCompleted ? { background:"var(--green)", opacity:.45 } :
                        isMissedAndNotStarted ? { background: domain?.color ? domain.color + "99" : "var(--border)" } :
                        isUpcoming ? { background: domain?.color ? domain.color + "88" : "var(--border)" } :
                        undefined
                      } />
                      <div className="tl-connector" />
                    </div>
                    <div className="tl-swipe-wrap"
                      onTouchStart={e => !isCompleted && initSwipe(e, blk.id)}
                      onTouchMove={e => { if(isCompleted) return; const el = e.currentTarget.querySelector(".tl-swipe-card"); moveSwipe(e, blk.id, el); }}
                      onTouchEnd={e => { if(isCompleted) return; const el = e.currentTarget.querySelector(".tl-swipe-card"); endSwipe(e, blk.id, el, () => markManualDone(blk.id, proj?.id, blk.todayTasks), () => rescheduleToTomorrow(blk.id)); }}
                    >
                      {/* Swipe right = complete (only for non-completed blocks) */}
                      {!isCompleted && <div className="tl-swipe-bg complete"><span className="tl-swipe-bg-lbl">✓ Done</span></div>}
                      {/* Swipe left = reschedule to tomorrow (only for missed/upcoming) */}
                      {(isMissedAndNotStarted || isUpcoming) && <div className="tl-swipe-bg reschedule"><span className="tl-swipe-bg-lbl">Tomorrow →</span></div>}
                      <div className={`tl-swipe-card ${cardClass}`} style={{ "--domain-color": domainCardColor + "50" }}>
                      {/* Conflict warning */}
                      {showConflict && (
                        <div className="tl-conflict-warn">
                          <span>⚠️</span>
                          <span>Overlaps with <strong>{conflictWarning.conflictName}</strong>. Start anyway?</span>
                          <button onClick={e => { e.stopPropagation(); setConflictWarning(null); setLateStarted(prev => ({ ...prev, [blk.id]: { startedAt: new Date().toISOString() } })); setFocusBlockId(blk.id); setFocusMode(true); }} style={{ marginLeft:"auto", background:"var(--accent)", color:"#000", border:"none", borderRadius:6, padding:"3px 9px", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}>Start</button>
                          <button onClick={e => { e.stopPropagation(); setConflictWarning(null); }} style={{ background:"var(--bg3)", color:"var(--text3)", border:"none", borderRadius:6, padding:"3px 8px", fontSize:10, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}>Cancel</button>
                        </div>
                      )}
                      <div className="tl-card-head" onClick={() => setExpandedId(isExp ? null : item.id)}>
                        <div className="tl-stripe" style={{ background: domain?.color || "var(--bg4)" }} />
                        <div className="tl-info">
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div className="tl-name">{proj?.name || blk.label || "Block"}</div>
                            {proj && !isCompleted && isExp && (
                              <button
                                onClick={e => { e.stopPropagation(); setSwapBlockId(swapBlockId === blk.id ? null : blk.id); }}
                                style={{ background:"none", border:"1px solid var(--border)", borderRadius:6, padding:"1px 6px", fontSize:10, color:"var(--text3)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}
                              >swap</button>
                            )}
                          </div>
                          {swapBlockId === blk.id && (
                            <div style={{ marginTop:4, background:"var(--bg3)", borderRadius:10, padding:6, display:"flex", flexDirection:"column", gap:2 }} onClick={e => e.stopPropagation()}>
                              {data.projects.filter(p => p.status === "active" && p.id !== proj?.id).map(p => {
                                const d2 = data.domains?.find(d => d.id === p.domainId);
                                return (
                                  <button key={p.id} onClick={() => {
                                    setData(d => ({ ...d, blocks: d.blocks.map(b => b.id === blk.id ? { ...b, projectId: p.id, todayTasks: undefined } : b) }));
                                    setSwapBlockId(null);
                                  }} style={{ background:"none", border:"none", textAlign:"left", padding:"7px 10px", borderRadius:8, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"var(--text)", display:"flex", alignItems:"center", gap:8 }}>
                                    <span style={{ width:8, height:8, borderRadius:"50%", background: d2?.color || "var(--text3)", flexShrink:0, display:"inline-block" }} />
                                    {p.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="tl-meta">
                            {domain ? `${domain.name} · ` : ""}{blk.durationMin} min
                            {(() => {
                              const tids = blk.todayTasks;
                              if (Array.isArray(tids) && tids.length > 0) {
                                const todayObjs = tids.map(id => proj?.tasks.find(t => t.id === id)).filter(Boolean);
                                const doneToday = todayObjs.filter(t => t.done).length;
                                return ` · ${doneToday}/${todayObjs.length} today`;
                              }
                              return totalTasks > 0 ? ` · ${doneTasks}/${totalTasks} tasks` : "";
                            })()}
                            {isLateActive ? ` · Started ${fmtTime(new Date(lateInfo.startedAt).getHours(), new Date(lateInfo.startedAt).getMinutes())}` : ""}
                          </div>
                        </div>
                        {/* Right side indicators */}
                        {isNow && !isLateActive && <span className="tl-now-pill">Now</span>}
                        {!isNow && !isCompleted && !isMissedAndNotStarted && primeWindowBlockId === blk.id && (
                          <span className="tl-prime-pill">Prime Window</span>
                        )}
                        {isLateActive && countdownStr && !countdownExpired && (
                          <span className="tl-countdown">{countdownStr}</span>
                        )}
                        {/* Done: green check — tappable to toggle */}
                        {isCompleted && (
                          <div
                            className="tl-check-icon full"
                            onClick={e => { e.stopPropagation(); unmarkManualDone(blk.id, proj?.id, blk.todayTasks); }}
                            style={{ cursor:"pointer" }}
                            title="Tap to unmark"
                          >
                            <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>
                          </div>
                        )}
                        {/* Missed (past, not done): tappable empty circle — tap to mark complete */}
                        {isMissedAndNotStarted && !isExp && (
                          <div className="tl-check-icon missed" onClick={e => { e.stopPropagation(); markManualDone(blk.id, proj?.id, blk.todayTasks); }} style={{ cursor:"pointer" }} />
                        )}

                        <span style={{ fontSize:13, color:"var(--text3)", marginLeft:4, transform: isExp ? "rotate(90deg)" : "none", transition:"transform .2s", display:"inline-block" }}>›</span>
                      </div>
                      {isExp && proj && (() => {
                        const todayTaskIds = blk.todayTasks; // undefined or array
                        const hasPicked = Array.isArray(todayTaskIds) && todayTaskIds.length > 0;
                        const isPicking = pickerState?.blockId === blk.id;

                        // PICKER MODE — choosing what to work on today
                        if (isPicking) {
                          const ps = pickerState;
                          const confirmPick = () => {
                            let finalIds = [...ps.selected];
                            if (ps.newText.trim()) {
                              const newId = addTaskToProject(proj.id, ps.newText.trim());
                              finalIds.push(newId);
                            }
                            saveTodayTasks(blk.id, finalIds);
                            setPickerState(null);
                          };
                          return (
                            <div className="picker-wrap" onClick={e => e.stopPropagation()}>
                              <div className="picker-heading">What are you working on today?</div>
                              {proj.tasks.filter(t => !t.done).map(t => {
                                const checked = ps.selected.has(t.id);
                                return (
                                  <div key={t.id} className="picker-task" onClick={() => {
                                    setPickerState(prev => {
                                      const s = new Set(prev.selected);
                                      checked ? s.delete(t.id) : s.add(t.id);
                                      return { ...prev, selected: s };
                                    });
                                  }}>
                                    <div className={`picker-box ${checked ? "checked" : ""}`} />
                                    <span className="picker-task-txt">{t.text}</span>
                                  </div>
                                );
                              })}
                              <div className="picker-add">
                                <input className="picker-input" placeholder="Add a new task…"
                                  value={ps.newText}
                                  onChange={e => setPickerState(prev => ({ ...prev, newText: e.target.value }))}
                                  onKeyDown={e => { if (e.key === "Enter" && ps.newText.trim()) confirmPick(); }}
                                />
                              </div>
                              <button className="picker-confirm"
                                disabled={ps.selected.size === 0 && !ps.newText.trim()}
                                onClick={confirmPick}>
                                {ps.selected.size + (ps.newText.trim() ? 1 : 0) > 0
                                  ? `Focus on ${ps.selected.size + (ps.newText.trim() ? 1 : 0)} task${ps.selected.size + (ps.newText.trim() ? 1 : 0) > 1 ? "s" : ""} today`
                                  : "Select at least one task"}
                              </button>
                            </div>
                          );
                        }

                        // NO TASKS PICKED YET — show prompt
                        if (!hasPicked) {
                          return (
                            <div className="tl-tasks" onClick={e => e.stopPropagation()}>
                              <div style={{ padding:"4px 0 10px", textAlign:"center" }}>
                                <div style={{ fontSize:12, color:"var(--text3)", marginBottom:10 }}>What are you working on today?</div>
                                <button onClick={() => setPickerState({ blockId: blk.id, projectId: proj.id, selected: new Set(), newText: "" })}
                                  style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:600, color:"var(--text2)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                                  Pick tasks
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // TASKS PICKED — show only today's tasks
                        const todayTaskObjs = todayTaskIds.map(id => proj.tasks.find(t => t.id === id)).filter(Boolean);
                        return (
                          <div className="tl-tasks">
                            {todayTaskObjs.map(t => (
                              <div key={t.id} className="tl-task-row">
                                <div className={`tl-check ${t.done ? "done" : ""}`} onClick={e => { e.stopPropagation(); toggleTask(proj.id, t.id); }}>
                                  {t.done && <span style={{fontSize:9,color:"#fff",fontWeight:700}}>✓</span>}
                                </div>
                                <span className={`tl-task-txt ${t.done ? "done" : ""}`}>{t.text}</span>
                              </div>
                            ))}
                            {/* Edit picks link */}
                            <div style={{ paddingTop:8, borderTop:"1px solid var(--border2)", marginTop:4 }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => setPickerState({ blockId: blk.id, projectId: proj.id, selected: new Set(todayTaskIds), newText: "" })}
                                style={{ background:"none", border:"none", fontSize:11, color:"var(--text3)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
                                ✎ Change today's tasks
                              </button>
                            </div>
                            {/* Action buttons */}
                            {!isCompleted && (
                              <div style={{ display:"flex", gap:8, marginTop:10 }} onClick={e => e.stopPropagation()}>
                                {/* "I did this" — log as done without timer */}
                                {!isLateActive && (
                                  <button onClick={() => markManualDone(blk.id, proj?.id, blk.todayTasks)}
                                    style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, padding:"9px", fontSize:12, fontWeight:600, color:"var(--text2)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                                    I did this ✓
                                  </button>
                                )}
                                {/* Start timer → focus mode */}
                                {!isLateActive && (
                                  <button onClick={() => startBlock(blk.id)}
                                    style={{ flex:1, background:"var(--accent)", border:"none", borderRadius:10, padding:"9px", fontSize:12, fontWeight:700, color:"#000", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                                    Start →
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    </div>
                  </div>
                );
              }

              // Routine block
              if (item.type === "routine") {
                const rb = item.data;
                const comp = (rb.completions || {})[dateKey] || {};
                const doneCt = rb.tasks.filter(t => comp[t.id]).length;
                const toggleRtTask = (taskId) => {
                  setData(d => ({
                    ...d,
                    routineBlocks: (d.routineBlocks||[]).map(r => {
                      if (r.id !== rb.id) return r;
                      const prev = (r.completions||{})[dateKey] || {};
                      return { ...r, completions: { ...(r.completions||{}), [dateKey]: { ...prev, [taskId]: !prev[taskId] } } };
                    })
                  }));
                };
                return (
                  <div
                    key={item.id}
                    className={["tl-item", dragId===rb.id?"dragging":"", dragOverId===rb.id?"drag-over":""].filter(Boolean).join(" ")}
                    draggable={!isPast}
                    onDragStart={e => handleDragStart(e, rb.id)}
                    onDragOver={e => handleDragOver(e, rb.id)}
                    onDrop={e => handleDrop(e, rb.id)}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  >
                    <div className="tl-left">
                      <div className="tl-time">{fmtTime(rb.startHour, rb.startMin)}</div>
                      <div className={`tl-dot ${isNow ? "now" : isPast ? "done" : ""}`} />
                      <div className="tl-connector" />
                    </div>
                    <div className={[
                      "tl-card",
                      isPast && !isExp ? "past" : "",
                      isNow ? "now-card" : "",
                      isExp && !isNow ? "active-card" : "",
                      !isNow && !isPast && !isExp ? "upcoming-card" : "",
                    ].filter(Boolean).join(" ")} style={{ "--domain-color": "rgba(255,255,255,.15)" }}>
                      <div className="tl-card-head" onClick={() => setExpandedId(isExp ? null : item.id)}>
                        <div className="tl-stripe" style={{ background:"var(--text3)", opacity: isExp || isNow ? .7 : .4 }} />
                        <div className="tl-info">
                          <div className="tl-name">{rb.title}</div>
                          <div className="tl-meta">Routine · {rb.durationMin} min · {doneCt}/{rb.tasks.length} done</div>
                        </div>
                        {isNow && <span className="tl-now-pill">Now</span>}
                        {!isNow && <span className="tl-dur">{rb.durationMin}m</span>}
                        <span style={{ fontSize:13, color:"var(--text3)", marginLeft:4, transform: isExp ? "rotate(90deg)" : "none", transition:"transform .2s", display:"inline-block" }}>›</span>
                      </div>
                      {isExp && (
                        <div className="tl-tasks">
                          {rb.tasks.map(t => (
                            <div key={t.id} className="tl-task-row">
                              <div className={`tl-check ${comp[t.id] ? "done" : ""}`} onClick={() => toggleRtTask(t.id)}>
                                {comp[t.id] && <span style={{fontSize:9,color:"#fff",fontWeight:700}}>✓</span>}
                              </div>
                              <span className={`tl-task-txt ${comp[t.id] ? "done" : ""}`}>{t.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })}

            {/* End connector cap */}
            {timeline.length > 0 && (
              <div className="tl-item">
                <div className="tl-left">
                  <div className="tl-dot" style={{ opacity:.3, marginTop:0 }} />
                </div>
                <div style={{ flex:1 }} />
              </div>
            )}
          </div>

          {/* + Add block link */}
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 16px 14px", opacity:.5 }}>
            <button onClick={openAddBlock} style={{ background:"none", border:"none", color:"var(--text3)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:16 }}>＋</span> Add block
            </button>
          </div>

          {/* LOOSE TASKS BLOCK */}
          {(() => {
            const allLoose = data.looseTasks || [];
            const incomplete = allLoose.filter(t => !t.done);
            const isExp = looseBlockExp;
            const isPicking = loosePickerOpen;
            const doneCount = pickedLooseTasks.filter(t => t.done).length;
            const totalCount = pickedLooseTasks.length;

            return (
              <div className="lt-block-wrap">
                <div className="lt-block">
                  <div className="lt-block-head" onClick={() => { setLooseBlockExp(v => !v); setLoosePickerOpen(false); }}>
                    {/* Icon instead of time */}
                    <div style={{ width:32, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="lt-stripe" />
                    <div className="lt-info">
                      <div className="lt-title">Loose Tasks</div>
                      <div className="lt-meta">
                        {totalCount === 0 ? "No tasks picked for today" : `${doneCount}/${totalCount} done`}
                      </div>
                    </div>
                    {totalCount > 0 && doneCount === totalCount && (
                      <div className="tl-check-icon full" style={{ marginRight:4 }}><span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span></div>
                    )}
                    <span style={{ fontSize:13, color:"var(--text3)", marginLeft:4, transform: isExp ? "rotate(90deg)" : "none", transition:"transform .2s", display:"inline-block" }}>›</span>
                  </div>

                  {isExp && (
                    <>
                      {/* Picked tasks list */}
                      {pickedLooseTasks.length > 0 && (
                        <div className="lt-body">
                          {pickedLooseTasks.map(task => {
                            const domain = (data.domains||[]).find(d => d.id === task.domainId);
                            return (
                              <div key={task.id} className="lt-task-row">
                                <div
                                  className={`lt-check ${task.done ? "done" : ""}`}
                                  onClick={() => toggleLooseTask(task.id)}
                                >
                                  {task.done && <span style={{fontSize:9,color:"#fff",fontWeight:700}}>✓</span>}
                                </div>
                                <div className="lt-dot" style={{ background: task.domainColor || domain?.color || "var(--text3)" }} />
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div className={`lt-task-text ${task.done ? "done" : ""}`}>{task.text}</div>
                                  {task.projectName && <div style={{ fontSize:10, color:"var(--text3)" }}>{task.projectName}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Pick tasks button / picker */}
                      {!isPicking ? (
                        <div style={{ padding:"10px 14px", borderTop: pickedLooseTasks.length > 0 ? "1px solid var(--border2)" : "none" }}>
                          <button
                            onClick={e => { e.stopPropagation(); setLoosePickerOpen(true); }}
                            style={{ background:"none", border:"none", color:"var(--accent)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:5 }}
                          >
                            <span style={{ fontSize:15 }}>✎</span> {pickedLooseTasks.length > 0 ? "Change today's tasks" : "Pick tasks for today"}
                          </button>
                        </div>
                      ) : (
                        <div className="lt-picker" onClick={e => e.stopPropagation()}>
                          <div className="lt-picker-title">Pick tasks for today</div>
                          {(() => {
                            // All incomplete tasks across loose + all projects, grouped by domain
                            const groups = (data.domains||[]).map(domain => {
                              const projTasks = (data.projects||[])
                                .filter(p => p.domainId === domain.id)
                                .flatMap(p => p.tasks.filter(t => !t.done).map(t => ({ ...t, domainColor: domain.color, projName: p.name, projId: p.id, _type:"project", domainId: domain.id })));
                              const loose = (data.looseTasks||[])
                                .filter(t => t.domainId === domain.id && !t.done)
                                .map(t => ({ ...t, domainColor: domain.color, _type:"loose" }));
                              return { domain, tasks: [...projTasks, ...loose] };
                            }).filter(g => g.tasks.length > 0);

                            if (groups.length === 0) return (
                              <div className="lt-empty">No incomplete tasks found.</div>
                            );

                            return groups.map(({ domain, tasks }) => (
                              <div key={domain.id}>
                                <div style={{ fontSize:10, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color: domain.color, padding:"6px 0 4px", opacity:.8 }}>{domain.name}</div>
                                {tasks.map(task => {
                                  const isPicked = todayLoosePicks.includes(task.id);
                                  return (
                                    <div key={task.id} className="lt-pick-row" onClick={() => {
                                      const next = isPicked
                                        ? todayLoosePicks.filter(id => id !== task.id)
                                        : [...todayLoosePicks, task.id];
                                      saveLoosPicks(next);
                                    }}>
                                      <div className={`lt-pick-check ${isPicked ? "sel" : ""}`}>
                                        {isPicked && <span style={{fontSize:9,color:"#000",fontWeight:700}}>✓</span>}
                                      </div>
                                      <div className="lt-dot" style={{ background: domain.color }} />
                                      <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ fontSize:13, color:"var(--text)" }}>{task.text}</div>
                                        {task._type === "project" && <div style={{ fontSize:10, color:"var(--text3)" }}>{task.projName}</div>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ));
                          })()}
                          <button
                            onClick={() => setLoosePickerOpen(false)}
                            style={{ marginTop:10, width:"100%", padding:"9px", background:"var(--accent)", color:"#000", border:"none", borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* END OF DAY */}
          {(data.todayPrefs?.showShutdown !== false) && (
            <>
              <div className="sh"><span className="sh-label">End of Day</span></div>
              <div className="shutdown-row" style={{ opacity: isAfter4 || shutdownDone ? 1 : 0.45 }} onClick={openShutdown}>
                <span className="sd-ico">{shutdownDone ? "✅" : "🔒"}</span>
                <span className="sd-txt">{shutdownDone ? "Shutdown Complete" : "Shutdown Ritual"}</span>
                {!shutdownDone && <span className="sd-arr">›</span>}
              </div>
            </>
          )}
          <div className="spacer" />
        </div>
      )}
      {focusMode && <div className="spacer" />}
      {showTodaySettings && <TodaySettingsSheet data={data} setData={setData} onClose={() => setShowTodaySettings(false)} />}
    </div>
  );
}

// ─── LOOSE TASKS SECTION ─────────────────────────────────────────────────────
function LooseTasksSection({ domainId, domain, data, setData, onAddProject }) {
  const { looseTasks = [], projects } = data;
  const [adding, setAdding]         = useState(false);
  const [newText, setNewText]       = useState("");
  const [assigningId, setAssigningId] = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editDraft, setEditDraft]   = useState("");
  const inputRef = useRef(null);

  const today = new Date().toDateString();
  const visible = looseTasks.filter(t => {
    if (t.domainId !== domainId) return false;
    if (t.done && t.doneAt && new Date(t.doneAt).toDateString() !== today) return false;
    return true;
  });

  const domainProjects = projects.filter(p => p.domainId === domainId);

  const openAdd = () => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 60); };

  const addTask = () => {
    const text = newText.trim();
    if (!text) { setAdding(false); return; }
    setData(d => ({ ...d, looseTasks: [...(d.looseTasks||[]), { id: uid(), domainId, text, done: false, doneAt: null }] }));
    setNewText("");
    setAdding(false);
  };

  const toggleTask = (id) => {
    setData(d => ({
      ...d,
      looseTasks: (d.looseTasks||[]).map(t =>
        t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t
      )
    }));
  };

  const deleteTask = (id) => {
    setData(d => ({ ...d, looseTasks: (d.looseTasks||[]).filter(t => t.id !== id) }));
  };

  const saveLooseEdit = (id) => {
    const text = editDraft.trim();
    if (!text) {
      setData(d => ({ ...d, looseTasks: (d.looseTasks||[]).filter(t => t.id !== id) }));
    } else {
      setData(d => ({ ...d, looseTasks: (d.looseTasks||[]).map(t => t.id === id ? { ...t, text } : t) }));
    }
    setEditingId(null);
  };

  const assignToProject = (taskId, projectId) => {
    const task = looseTasks.find(t => t.id === taskId);
    if (!task || !projectId) return;
    setData(d => ({
      ...d,
      looseTasks: (d.looseTasks||[]).filter(t => t.id !== taskId),
      projects: d.projects.map(p => p.id === projectId
        ? { ...p, tasks: [...p.tasks, { id: uid(), text: task.text, done: false }] }
        : p
      )
    }));
    setAssigningId(null);
  };

  const undone = visible.filter(t => !t.done);
  const done   = visible.filter(t => t.done);
  const hasTasks = visible.length > 0;

  const inlineInput = (
    <div className="loose-add-inline" onClick={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="loose-inline-input"
        placeholder="Add a loose task…"
        value={newText}
        onChange={e => setNewText(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") addTask();
          if (e.key === "Escape") { setAdding(false); setNewText(""); }
        }}
        onBlur={() => { if (!newText.trim()) setAdding(false); }}
      />
    </div>
  );

  return (
    <div
      className="loose-zone"
      onClick={!hasTasks && !adding ? openAdd : undefined}
      style={{ cursor: !hasTasks && !adding ? "pointer" : "default" }}
    >
      {/* Empty state — split action bar */}
      {!hasTasks && !adding && (
        <div className="loose-split-bar">
          <button className="loose-split-btn" onClick={onAddProject}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add Project
          </button>
          <div className="loose-split-divider" />
          <button className="loose-split-btn" onClick={openAdd}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add Task
          </button>
        </div>
      )}

      {/* Empty + adding: input only */}
      {!hasTasks && adding && inlineInput}

      {/* Task list */}
      {hasTasks && (
        <div className="loose-tasks-list">
          {undone.map(t => (
            <div key={t.id} className="loose-task-row">
              <div className="loose-check" onClick={() => toggleTask(t.id)} />
              {editingId === t.id ? (
                <input
                  className="loose-inline-input"
                  style={{ flex:1, borderBottom:"1px solid var(--accent)" }}
                  value={editDraft}
                  autoFocus
                  onChange={e => setEditDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveLooseEdit(t.id); if (e.key === "Escape") setEditingId(null); }}
                  onBlur={() => saveLooseEdit(t.id)}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="loose-task-text"
                  style={{ cursor: "text" }}
                  onClick={e => { e.stopPropagation(); setEditingId(t.id); setEditDraft(t.text); }}
                >{t.text}</span>
              )}
              {domainProjects.length > 0 && editingId !== t.id && (
                <button className="loose-assign-btn" onClick={e => { e.stopPropagation(); setAssigningId(assigningId === t.id ? null : t.id); }}>
                  → Project
                </button>
              )}
              {assigningId === t.id && (
                <div className="loose-assign-pop" onClick={e => e.stopPropagation()}>
                  <div className="lap-title">Move to project</div>
                  {domainProjects.map(p => {
                    const dom = data.domains.find(d => d.id === p.domainId);
                    return (
                      <div key={p.id} className="lap-proj" onClick={() => assignToProject(t.id, p.id)}>
                        <div className="lap-dot" style={{ background: dom?.color }} />
                        {p.name}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

{/* done loose tasks are hidden — celebrated in shutdown ritual */}

          {/* Single input at bottom — tap zone or active input */}
          {adding ? inlineInput : (
            <div className="loose-split-bar" style={{ borderRadius:0, borderTop:"1px solid var(--border2)" }}>
              <button className="loose-split-btn" onClick={onAddProject}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Add Project
              </button>
              <div className="loose-split-divider" />
              <button className="loose-split-btn" onClick={openAdd}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Add Task
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SWIPE TASK ──────────────────────────────────────────────────────────────
// circle tap = toggle done | text tap = inline edit | swipe left = delete
function SwipeTask({ task, onToggle, onDelete, onSave }) {
  const [offset, setOffset]   = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(task.text);
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

  return (
    <div className="st-wrap">
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
          className={`t-check ${task.done ? "done" : ""}`}
          style={{ flexShrink: 0, marginTop: 2, cursor: "pointer" }}
          onClick={e => { e.stopPropagation(); onToggle(); }}
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

// ─── PROJECT CARD ────────────────────────────────────────────────────────────
const PROJ_COLORS = ["#5B8AF0","#9B72CF","#45C17A","#E8A030","#E05555","#38BDF8","#F472B6","#A3E635","#FB923C","#94A3B8"];

function ProjectCard({ proj, domain, isExp, newTaskText,
  onToggleExpand, onToggleStatus, onDelete, onEditSave,
  onToggleTask, onDeleteTask, onSaveTask, onNewTaskChange, onAddTask, autoFocus }) {
  const [addingTask, setAddingTask] = useState(false);
  const taskInputRef = useRef(null);
  const nameInputRef = useRef(null);

  const pct = getPct(proj.tasks);
  const [swipeX, setSwipeX] = useState(0);
  const [showEdit, setShowEdit] = useState(!!autoFocus);
  const [draftName, setDraftName] = useState(proj.name);
  const [draftColor, setDraftColor] = useState(domain?.color || PROJ_COLORS[0]);
  const startX = useRef(null);
  // Two-button reveal: Edit(amber) 80px + Delete(red) 80px = 160px total
  const MAX = 160; const SNAP = 60;

  const onTouchStart = e => { startX.current = e.touches[0].clientX; };
  const onTouchMove  = e => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -MAX));
    else if (swipeX < 0) setSwipeX(Math.min(0, swipeX + dx));
  };
  const onTouchEnd = () => {
    setSwipeX(swipeX < -SNAP ? -MAX : 0);
    startX.current = null;
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    setDraftName(proj.name);
    setDraftColor(domain?.color || PROJ_COLORS[0]);
    setShowEdit(true);
    setSwipeX(0);
    setTimeout(() => nameInputRef.current?.focus(), 60);
  };

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => { nameInputRef.current?.focus(); nameInputRef.current?.select(); }, 80);
    }
  }, []);

  const handleSaveEdit = () => {
    if (showEdit) {
      onEditSave({ name: draftName.trim() || proj.name });
      setShowEdit(false);
    }
  };

  return (
    <div style={{ margin: "0 16px 8px", borderRadius: 14, background: "var(--bg2)", overflow: "hidden" }}>
      {/* Header — swipeable */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: isExp || showEdit ? "14px 14px 0 0" : 14 }}>
        {/* Action bg: Edit + Delete */}
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 80, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={handleEdit}>
            <span style={{ color: "#000", fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>Edit</span>
          </div>
          <div style={{ width: 80, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={onDelete}>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>Delete</span>
          </div>
        </div>
        {/* Sliding content */}
        <div
          className="proj-card"
          style={{ transform: `translateX(${swipeX}px)`, transition: startX.current === null ? "transform .2s ease" : "none", position: "relative", background: "var(--bg2)", borderRadius: 0, zIndex: 1 }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={() => { if (swipeX < 0) { setSwipeX(0); return; } onToggleExpand(); }}
        >
          <div className="proj-card-top">
            <div className="proj-card-stripe" style={{ background: domain?.color, opacity: proj.status === "active" ? 1 : 0.35 }} />
            {showEdit ? (
              <input
                ref={nameInputRef}
                className="proj-card-name-input"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setShowEdit(false); }}
                onBlur={handleSaveEdit}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="proj-card-name"
                style={{ cursor: "text" }}
                onClick={e => { e.stopPropagation(); if (swipeX < 0) return; setDraftName(proj.name); setShowEdit(true); setTimeout(() => { nameInputRef.current?.focus(); nameInputRef.current?.select(); }, 60); }}
              >{proj.name || <span style={{color:"var(--text3)"}}>Untitled</span>}</span>
            )}
            <span className={`proj-card-badge ${proj.status === "active" ? "badge-active" : "badge-backlog"}`} onClick={e => { e.stopPropagation(); onToggleStatus(e); }}>
              {proj.status === "active" ? "Active" : "Backlog"}
            </span>
          </div>
          <div className="proj-bar-wrap">
            <div className="proj-bar-fill" style={{ width: `${pct}%`, background: domain?.color }} />
          </div>
          <div className="proj-card-meta">
            <span className="proj-card-tasks">{proj.tasks.filter(t => t.done).length} of {proj.tasks.length} tasks</span>
            <span className="proj-card-pct" style={{ color: proj.status === "active" ? domain?.color : "var(--text3)" }}>{pct}%</span>
          </div>
        </div>
      </div>



      {/* Tasks */}
      {isExp && (
        <div className="proj-tasks-expand">
          {proj.tasks.map(t => (
            <SwipeTask
              key={t.id}
              task={t}
              onToggle={() => onToggleTask(t.id)}
              onDelete={() => onDeleteTask(t.id)}
              onSave={text => onSaveTask(t.id, text)}
            />
          ))}
          {addingTask ? (
            <div className="add-task-inline">
              <input
                ref={taskInputRef}
                className="add-task-inline-input"
                placeholder="New task…"
                value={newTaskText}
                autoFocus
                onChange={e => onNewTaskChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { onAddTask(); setTimeout(() => taskInputRef.current?.focus(), 30); }
                  if (e.key === "Escape") { setAddingTask(false); onNewTaskChange(""); }
                }}
                onBlur={() => { if (!newTaskText.trim()) setAddingTask(false); }}
              />
            </div>
          ) : (
            <div
              className="add-task-tap"
              onClick={() => { setAddingTask(true); setTimeout(() => taskInputRef.current?.focus(), 30); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── ROUTINE BLOCK VIEW ──────────────────────────────────────────────────────
function RoutineBlockView({ routine, dateKey, data, setData, compact }) {
  const [open, setOpen] = useState(false);
  const completions = (routine.completions || {})[dateKey] || {};
  const allDone = routine.tasks.length > 0 && routine.tasks.every(t => completions[t.id]);

  const toggleTask = (taskId) => {
    setData(d => {
      const rbs = (d.routineBlocks || []).map(rb => {
        if (rb.id !== routine.id) return rb;
        const prev = (rb.completions || {})[dateKey] || {};
        const updated = { ...prev, [taskId]: !prev[taskId] };
        return { ...rb, completions: { ...(rb.completions || {}), [dateKey]: updated } };
      });
      return { ...d, routineBlocks: rbs };
    });
  };

  return (
    <div className="routine-block" style={{ borderRadius: compact ? 0 : 12, margin: compact ? 0 : "0 0 8px" }}>
      <div className="routine-block-header" onClick={() => setOpen(o => !o)}>
        <div className="routine-stripe" style={{ opacity: allDone ? 1 : 0.5, background: allDone ? "var(--green)" : "var(--text3)" }} />
        <div className="routine-info">
          <div className="routine-title">{routine.title}</div>
          <div className="routine-meta">
            {fmtRange(routine.startHour, routine.startMin, routine.durationMin)}
            {routine.recurring ? " · Weekly" : " · One-time"}
            {" · "}{routine.tasks.filter(t => completions[t.id]).length}/{routine.tasks.length} done
          </div>
        </div>
        <span className="routine-badge">Routine</span>
        <span style={{ fontSize:13, color:"var(--text3)", marginLeft:4, transform: open ? "rotate(90deg)" : "none", transition:"transform .2s", display:"inline-block" }}>›</span>
      </div>
      {open && (
        <div className="routine-tasks">
          {routine.tasks.map(t => (
            <div key={t.id} className="routine-task-row">
              <div className={`routine-check ${completions[t.id] ? "done" : ""}`} onClick={() => toggleTask(t.id)}>
                {completions[t.id] && <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>}
              </div>
              <span className={`routine-task-text ${completions[t.id] ? "done" : ""}`}>{t.text}</span>
            </div>
          ))}
          {routine.tasks.length === 0 && (
            <div style={{ padding:"10px 28px", fontSize:12, color:"var(--text3)" }}>No tasks added yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PROJECTS SCREEN ──────────────────────────────────────────────────────────
function ProjectsScreen({ data, setData, openCategorize }) {
  const { domains, projects } = data;
  const [activeDomain, setActiveDomain] = useState(domains[0]?.id || null);
  const [collapsedProjs, setCollapsedProjs] = useState(new Set());
  const [newTaskText, setNewTaskText] = useState({});
  const [showManage, setShowManage] = useState(false);
  const [newProjId, setNewProjId] = useState(null);

  const domainProjects = projects.filter(p => p.domainId === activeDomain);
  const domain = domains.find(d => d.id === activeDomain);
  const activeCount = projects.filter(p => p.status === "active").length;

  const allCollapsed = domainProjects.length > 0 && domainProjects.every(p => collapsedProjs.has(p.id));
  const toggleAllCollapsed = () => {
    if (allCollapsed) {
      // expand all — remove all domain projects from collapsed set
      setCollapsedProjs(s => { const n = new Set(s); domainProjects.forEach(p => n.delete(p.id)); return n; });
    } else {
      // collapse all — add all domain projects to collapsed set
      setCollapsedProjs(s => { const n = new Set(s); domainProjects.forEach(p => n.add(p.id)); return n; });
    }
  };

  const toggleTask = (projectId, taskId) => setData(d => ({
    ...d, projects: d.projects.map(p =>
      p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : p
    )
  }));

  const toggleStatus = (projectId, e) => {
    e.stopPropagation();
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, status: p.status === "active" ? "backlog" : "active" } : p) }));
  };

  const deleteProject = (projectId) => {
    setData(d => ({ ...d, projects: d.projects.filter(p => p.id !== projectId) }));
    setCollapsedProjs(s => { const n = new Set(s); n.delete(projectId); return n; });
  };

  const addTask = (projectId) => {
    const text = (newTaskText[projectId] || "").trim();
    if (!text) return;
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { id: uid(), text, done: false }] } : p) }));
    setNewTaskText(t => ({ ...t, [projectId]: "" }));
  };

  const deleteTask = (projectId, taskId) => setData(d => ({
    ...d, projects: d.projects.map(p =>
      p.id === projectId ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) } : p
    )
  }));

  const saveTask = (projectId, taskId, text) => setData(d => ({
    ...d, projects: d.projects.map(p =>
      p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, text } : t) } : p
    )
  }));

  const saveProjectEdit = (projectId, { name }) => {
    setData(d => ({
      ...d,
      projects: d.projects.map(p => p.id === projectId ? { ...p, name } : p),
      domains: d.domains
    }));
  };

  const addProject = () => {
    const newProj = { id: uid(), domainId: activeDomain, name: "", status: "backlog", tasks: [] };
    setData(d => ({ ...d, projects: [...d.projects, newProj] }));
    setNewProjId(newProj.id);
  };

  return (
    <div className="screen active">
      <StatusBar />
      <div className="ph">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="ph-title">Projects</div>
          <button className="tab-gear" onClick={() => setShowManage(true)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.36.07-.72.07-1.08s-.03-.73-.07-1.08l2.32-1.82c.21-.16.27-.46.13-.7l-2.2-3.81a.55.55 0 0 0-.67-.24l-2.74 1.1c-.57-.44-1.18-.81-1.86-1.08l-.42-2.9A.55.55 0 0 0 14 2h-4a.55.55 0 0 0-.54.46l-.42 2.9c-.68.27-1.3.64-1.86 1.08L4.44 5.35a.54.54 0 0 0-.67.24L1.57 9.4c-.14.24-.08.54.13.7l2.32 1.82C3.98 12.27 3.95 12.63 3.95 13s.03.73.07 1.08L1.7 15.9c-.21.16-.27.46-.13.7l2.2 3.81c.13.24.43.32.67.24l2.74-1.1c.57.44 1.18.81 1.86 1.08l.42 2.9c.08.28.29.47.54.47h4c.25 0 .46-.19.54-.46l.42-2.9c.68-.27 1.3-.64 1.86-1.08l2.74 1.1c.24.09.54 0 .67-.24l2.2-3.81c.14-.24.08-.54-.13-.7l-2.32-1.82Z" fill="currentColor"/></svg></button>
        </div>
        <div className="ph-sub">{activeCount} active · {projects.length - activeCount} in backlog</div>
      </div>

      {/* DOMAIN TABS — edge-to-edge nav */}
      <div className="domain-tabs" style={{ position:"relative" }}>
        {domains.map(d => (
          <button key={d.id}
            className={`domain-tab ${activeDomain === d.id ? "active" : ""}`}
            style={activeDomain === d.id ? { color: d.color, borderBottomColor: d.color } : {}}
            onClick={() => { setActiveDomain(d.id); setCollapsedProjs(new Set()); }}>
            <div className="domain-tab-dot" style={{ background: activeDomain === d.id ? d.color : "var(--border)" }} />
            {d.name}
          </button>
        ))}
        {domainProjects.length > 0 && (
          <button
            onClick={toggleAllCollapsed}
            title={allCollapsed ? "Expand all" : "Collapse all"}
            style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", padding:"0 14px", color:"var(--text3)", opacity:.7, flexShrink:0, display:"flex", alignItems:"center" }}
          >
            {allCollapsed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}
      </div>

      <div className="scroll" style={{ paddingTop: 16 }} onClick={() => {}}>
        {data.inbox.length > 0 && (
          <div className="inbox-banner" onClick={openCategorize}>
            <span className="ib-icon">📥</span>
            <div className="ib-info">
              <div className="ib-title">Categorize {data.inbox.length} item{data.inbox.length !== 1 ? "s" : ""}</div>
              <div className="ib-sub">Tap to assign them to projects</div>
            </div>
            <span className="ib-arrow">›</span>
          </div>
        )}



        {domainProjects.map(proj => (
          <ProjectCard
            key={proj.id}
            proj={proj}
            domain={domains.find(d => d.id === proj.domainId)}
            isExp={!collapsedProjs.has(proj.id)}
            newTaskText={newTaskText[proj.id] || ""}
            onToggleExpand={() => setCollapsedProjs(s => { const n = new Set(s); n.has(proj.id) ? n.delete(proj.id) : n.add(proj.id); return n; })}
            onToggleStatus={e => toggleStatus(proj.id, e)}
            onDelete={() => deleteProject(proj.id)}
            autoFocus={proj.id === newProjId}
            onEditSave={edits => { if (!edits.name && proj.id === newProjId) { deleteProject(proj.id); } else { saveProjectEdit(proj.id, edits); } setNewProjId(null); }}
            onToggleTask={taskId => toggleTask(proj.id, taskId)}
            onDeleteTask={taskId => deleteTask(proj.id, taskId)}
            onSaveTask={(taskId, text) => saveTask(proj.id, taskId, text)}
            onNewTaskChange={v => setNewTaskText(t => ({ ...t, [proj.id]: v }))}
            onAddTask={() => addTask(proj.id)}
          />
        ))}

        <LooseTasksSection domainId={activeDomain} domain={domain} data={data} setData={setData} onAddProject={addProject} />

        <div className="spacer" />
      </div>

      {showManage && <ProjectsManageSheet data={data} setData={setData} onClose={() => setShowManage(false)} />}
    </div>
  );
}

// ─── DOMAIN EDIT SHEET ────────────────────────────────────────────────────────
function DomainEditSheet({ data, setData, onClose, activeDomain, setActiveDomain }) {
  const swipe = useSwipeDown(onClose);
  const { domains, projects } = data;
  const [localDomains, setLocalDomains] = useState(domains.map(d => ({ ...d })));
  const [pickingColorFor, setPickingColorFor] = useState(null);

  const save = () => {
    setData(d => ({ ...d, domains: localDomains }));
    onClose();
  };

  const updateName = (id, name) => setLocalDomains(ds => ds.map(d => d.id === id ? { ...d, name } : d));
  const updateColor = (id, color) => { setLocalDomains(ds => ds.map(d => d.id === id ? { ...d, color } : d)); setPickingColorFor(null); };
  const deleteDomain = (id) => {
    if (localDomains.length <= 1) return;
    setLocalDomains(ds => ds.filter(d => d.id !== id));
    if (activeDomain === id) setActiveDomain(localDomains.find(d => d.id !== id)?.id);
  };
  const addDomain = () => {
    if (localDomains.length >= 4) return;
    const newD = { id: uid(), name: "New Category", color: DOMAIN_COLORS[localDomains.length % DOMAIN_COLORS.length] };
    setLocalDomains(ds => [...ds, newD]);
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Edit Categories</div>
        <div className="sheet-sub">Tap name to rename · Tap dot to change color</div>
        <div className="sheet-scroll">
          <div className="domain-edit-list">
            {localDomains.map(d => (
              <div key={d.id}>
                <div className="domain-edit-row">
                  <div className="domain-color-dot" style={{ background: d.color }} onClick={() => setPickingColorFor(pickingColorFor === d.id ? null : d.id)} />
                  <input className="domain-name-input" value={d.name} onChange={e => updateName(d.id, e.target.value)} />
                  <button className="domain-del-btn" onClick={() => deleteDomain(d.id)} disabled={localDomains.length <= 1}>✕</button>
                </div>
                {pickingColorFor === d.id && (
                  <div className="color-picker-row">
                    {DOMAIN_COLORS.map(c => (
                      <div key={c} className={`color-swatch ${d.color === c ? "sel" : ""}`} style={{ background: c }} onClick={() => updateColor(d.id, c)} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {localDomains.length < 4 && (
            <button className="add-domain-btn" onClick={addDomain}>＋ Add Category (max 4)</button>
          )}
          <button className="form-btn" style={{ marginTop: 16 }} onClick={save}>Save Changes</button>
        </div>
      </div>
    </>
  );
}

// ─── PLAN SCREEN ──────────────────────────────────────────────────────────────
// ─── HUBERMAN SLOT DEFINITIONS ────────────────────────────────────────────────
// 3 deep work slots — defaults used when no user customisation saved
const DEFAULT_DEEP_SLOTS = [
  { slotIndex: 0, startHour: 9,  startMin: 0,  durationMin: 90, blockType: "analytical",
    hint: "Block 1", hintDetail: "Peak neurochemical window — best for hard analysis, complex decisions, and deep problem-solving." },
  { slotIndex: 1, startHour: 12, startMin: 0,  durationMin: 90, blockType: "creative",
    hint: "Block 2",   hintDetail: "Post-peak window — excellent for generative work, writing, and ideation." },
  { slotIndex: 2, startHour: 15, startMin: 0,  durationMin: 90, blockType: "generative",
    hint: "Block 3", hintDetail: "Third block — strong for execution-focused work: building, shipping, tasks you know well." },
];

// Resolve the live slot definitions: user's saved deepBlockDefaults override the built-in defaults
function getDeepSlots(data) {
  const saved = data.deepBlockDefaults; // [{startHour,startMin,durationMin}] length 3
  if (!saved || saved.length !== 3) return DEFAULT_DEEP_SLOTS;
  return DEFAULT_DEEP_SLOTS.map((s, i) => ({ ...s, ...saved[i] }));
}

function PlanScreen({ data, setData, openAddBlock, onGoToSeason, lightMode, toggleTheme }) {
  const { domains, projects, blocks, weekIntention, workWeek = [2,3,4,5,6] } = data;
  const [editingIntention, setEditingIntention] = useState(false);
  const [intentionDraft, setIntentionDraft] = useState(weekIntention);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [assigningGhost, setAssigningGhost] = useState(null); // {dayOffset, slot}
  const [showWorkWeek, setShowWorkWeek] = useState(false);

  const getProject = id => projects.find(p => p.id === id);
  const getDomain  = id => domains.find(d => d.id === id);
  const today      = new Date();
  const days       = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const saveIntention = () => { setData(d => ({ ...d, weekIntention: intentionDraft })); setEditingIntention(false); };
  const deleteBlock   = id => setData(d => ({ ...d, blocks: d.blocks.filter(b => b.id !== id) }));
  const updateBlock   = (id, changes) => { setData(d => ({ ...d, blocks: d.blocks.map(b => b.id===id?{...b,...changes}:b) })); setEditingBlockId(null); };

  // Live slot definitions for this user
  const deepSlots = getDeepSlots(data);

  // For a given dayOffset, build the merged sorted list of real blocks + ghost slots
  const getMergedRows = (offset) => {
    const dayDate = new Date(today); dayDate.setDate(today.getDate() + offset);
    const dow = dayDate.getDay();
    const isWorkDay = workWeek.includes(dow);
    const realBlocks = blocks.filter(b => b.dayOffset === offset)
      .sort((a,b) => a.startHour*60+a.startMin-(b.startHour*60+b.startMin));

    if (!isWorkDay) return realBlocks.map(b => ({ type: "real", block: b }));

    const allItems = [];

    // Add ghost slots for any deep work slot not covered by a real block
    deepSlots.forEach(slot => {
      const slotMin = slot.startHour*60+slot.startMin;
      const slotEnd = slotMin + slot.durationMin;
      const covered = realBlocks.some(b => {
        const bMin = b.startHour*60+b.startMin;
        return bMin < slotEnd && (bMin+b.durationMin) > slotMin;
      });
      if (!covered) allItems.push({ type: "ghost", slot, origSlot: slot, dayOffset: offset });
    });

    realBlocks.forEach(b => allItems.push({ type: "real", block: b }));

    allItems.sort((a, b) => {
      const aMin = a.type === "real" ? a.block.startHour*60+a.block.startMin : a.slot.startHour*60+a.slot.startMin;
      const bMin = b.type === "real" ? b.block.startHour*60+b.block.startMin : b.slot.startHour*60+b.slot.startMin;
      return aMin - bMin;
    });

    return allItems;
  };

  // Determine if a ghost is in the past
  const isGhostPast = (offset, slot) => {
    if (offset > 0) return false;
    if (offset < 0) return true;
    const now = new Date();
    return (now.getHours()*60+now.getMinutes()) > (slot.startHour*60+slot.startMin+slot.durationMin);
  };

  return (
    <div className="screen active">
      <StatusBar />
      <div className="ph">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div className="ph-eye">Week of {months[today.getMonth()]} {today.getDate()}</div>
            <div className="ph-title">Weekly Plan</div>
          </div>
          <button className="plan-gear" onClick={() => setShowWorkWeek(true)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.36.07-.72.07-1.08s-.03-.73-.07-1.08l2.32-1.82c.21-.16.27-.46.13-.7l-2.2-3.81a.55.55 0 0 0-.67-.24l-2.74 1.1c-.57-.44-1.18-.81-1.86-1.08l-.42-2.9A.55.55 0 0 0 14 2h-4a.55.55 0 0 0-.54.46l-.42 2.9c-.68.27-1.3.64-1.86 1.08L4.44 5.35a.54.54 0 0 0-.67.24L1.57 9.4c-.14.24-.08.54.13.7l2.32 1.82C3.98 12.27 3.95 12.63 3.95 13s.03.73.07 1.08L1.7 15.9c-.21.16-.27.46-.13.7l2.2 3.81c.13.24.43.32.67.24l2.74-1.1c.57.44 1.18.81 1.86 1.08l.42 2.9c.08.28.29.47.54.47h4c.25 0 .46-.19.54-.46l.42-2.9c.68-.27 1.3-.64 1.86-1.08l2.74 1.1c.24.09.54 0 .67-.24l2.2-3.81c.14-.24.08-.54-.13-.7l-2.32-1.82Z" fill="currentColor"/></svg></button>
        </div>
      </div>
      <div className="scroll">
        <ThisSeasonCard data={data} setData={setData} onGoToSeason={onGoToSeason} />
        <div className="sh" style={{ paddingTop: 8 }}><span className="sh-label">This Week's Intention</span></div>
        <div className="intention-card">
          {editingIntention ? (
            <>
              <textarea className="intent-textarea" rows={4} value={intentionDraft} onChange={e => setIntentionDraft(e.target.value)} autoFocus />
              <button className="intent-save" onClick={saveIntention}>Save</button>
            </>
          ) : (
            <>
              <div className="ic-text">"{weekIntention}"</div>
              <button className="ic-edit" onClick={() => { setIntentionDraft(weekIntention); setEditingIntention(true); }}>Edit intention</button>
            </>
          )}
        </div>

        <div className="sh"><span className="sh-label">Schedule</span></div>

        {[0,1,2,3,4,5,6].map(offset => {
          const dayDate = new Date(today); dayDate.setDate(today.getDate() + offset);
          const dow = dayDate.getDay();
          const isWorkDay = workWeek.includes(dow);
          const isToday = offset === 0;
          const mergedRows = getMergedRows(offset);

          return (
            <div key={offset} className="week-card">
              <div className="wc-head">
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span className={`wc-day ${isToday ? "today" : ""}`}>{days[dow]}</span>
                  {!isWorkDay && <span style={{ fontSize:10, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"var(--text3)", opacity:.6, padding:"2px 7px", border:"1px solid var(--border2)", borderRadius:20 }}>Rest</span>}
                </div>
                <span className="wc-date">{months[dayDate.getMonth()]} {dayDate.getDate()}{isToday ? " · Today" : ""}</span>
              </div>

              {(() => {
                const routinesForDay = getRoutinesForDate(data.routineBlocks, dayDate);
                const allRows = [
                  ...routinesForDay.map(rb => ({ type: "routine", routine: rb })),
                  ...mergedRows.map(r => ({ ...r }))
                ].sort((a, b) => {
                  const aH = a.type === "routine" ? a.routine.startHour * 60 + a.routine.startMin : (a.block || a.slot)?.startHour * 60 + (a.block || a.slot)?.startMin;
                  const bH = b.type === "routine" ? b.routine.startHour * 60 + b.routine.startMin : (b.block || b.slot)?.startHour * 60 + (b.block || b.slot)?.startMin;
                  return aH - bH;
                });
                return allRows.map((row, i) => {
                if (row.type === "routine") {
                  return (
                    <RoutineBlockView
                      key={row.routine.id + dayDate.toDateString()}
                      routine={row.routine}
                      dateKey={dayDate.toDateString()}
                      data={data}
                      setData={setData}
                      compact
                    />
                  );
                }
                if (row.type === "real") {
                  const blk = row.block;
                  const proj = blk.projectId ? getProject(blk.projectId) : null;
                  const domain = proj ? getDomain(proj.domainId) : null;
                  const isEditingThis = editingBlockId === blk.id;
                  return (
                    <SwipeRow key={blk.id} onDelete={() => deleteBlock(blk.id)}>
                      <div style={{ background: "var(--bg2)" }}>
                        <div className="blk-swipe-content" onClick={() => setEditingBlockId(isEditingThis ? null : blk.id)}>
                          <span className="wcb-time">{fmtRange(blk.startHour, blk.startMin, blk.durationMin)}</span>
                          <div className="wcb-stripe" style={{ background: domain?.color || "var(--bg4)" }} />
                          <div className="wcb-info">
                            <div className="wcb-proj">{proj?.name || blk.label}</div>
                            <div className="wcb-meta">{domain ? `${domain.name} · ` : ""}{blk.durationMin} min</div>
                          </div>
                          <span style={{ fontSize:13, color:"var(--text3)" }}>›</span>
                        </div>
                        {isEditingThis && (
                          <BlockEditPanel blk={blk} data={data} onSave={changes => updateBlock(blk.id, changes)} onDelete={() => { deleteBlock(blk.id); setEditingBlockId(null); }} />
                        )}
                      </div>
                    </SwipeRow>
                  );
                }

                // ghost deep work block
                const s = row.slot;
                const past = isGhostPast(offset, s);
                return (
                  <div key={`ghost_${offset}_${s.slotIndex}`}
                    className="ghost-block"
                    style={{ opacity: past ? .35 : 1 }}
                    onClick={past ? undefined : () => setAssigningGhost({ dayOffset: offset, slot: s, origSlot: row.origSlot || s })}
                  >
                    <span className="ghost-time">{fmtRange(s.startHour, s.startMin, s.durationMin)}</span>
                    <div className="ghost-stripe" />
                    <div className="ghost-inner">
                      <div className="ghost-label" style={{ color: past ? "var(--text3)" : "var(--text2)" }}>
                        {past ? "Deep Work — missed" : "Deep Work — open"}
                      </div>
                      <div className="ghost-hint">{s.durationMin} min</div>
                    </div>
                    {!past && <span className="ghost-assign">+ Assign</span>}
                    {past && <span style={{ fontSize:10, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--red)", opacity:.5, padding:"2px 7px", border:"1px solid rgba(224,85,85,.2)", borderRadius:20 }}>Missed</span>}
                  </div>
                );
              })})()}

              <div className="wc-add" onClick={openAddBlock}>
                <span className="wca-ico">＋</span>
                <span className="wca-txt">Add block</span>
              </div>
            </div>
          );
        })}
        <div className="spacer" />
      </div>

      {assigningGhost && (
        <AssignGhostSheet
          data={data}
          ghost={assigningGhost}
          onClose={() => setAssigningGhost(null)}
          onAssign={(block) => {
            setData(d => ({ ...d, blocks: [...d.blocks, block] }));
            setAssigningGhost(null);
          }}
          onUpdateSlotDefault={(slotIndex, override) => {
            setData(d => {
              const current = d.deepBlockDefaults || DEFAULT_DEEP_SLOTS.map(s => ({ startHour: s.startHour, startMin: s.startMin, durationMin: s.durationMin }));
              const next = current.map((s, i) => i === slotIndex ? { ...s, ...override } : s);
              return { ...d, deepBlockDefaults: next };
            });
          }}
          onCreateProject={(newProj, onDone) => {
            setData(d => ({ ...d, projects: [...d.projects, newProj] }));
            onDone(newProj.id);
          }}
        />
      )}

      {showWorkWeek && (
        <WorkWeekSheet
          workWeek={workWeek}
          data={data}
          onClose={() => setShowWorkWeek(false)}
          onSave={(ww, defs) => {
            setData(d => ({ ...d, workWeek: ww, deepBlockDefaults: defs }));
            setShowWorkWeek(false);
          }}
          lightMode={lightMode}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}

// ─── ASSIGN GHOST SHEET ───────────────────────────────────────────────────────
function AssignGhostSheet({ data, ghost, onClose, onAssign, onUpdateSlotDefault, onCreateProject }) {
  const swipe = useSwipeDown(onClose);
  const { projects, domains } = data;
  const { dayOffset, slot, origSlot } = ghost;
  const today = new Date();
  const dayDate = new Date(today); dayDate.setDate(today.getDate() + dayOffset);
  const dow = dayDate.getDay();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const activeProjects = projects.filter(p => p.status === "active");
  const [projectId, setProjectId] = useState(activeProjects[0]?.id || projects[0]?.id || "");
  const [startHour, setStartHour] = useState(slot.startHour);
  const [startMin,  setStartMin]  = useState(slot.startMin);
  const [duration,  setDuration]  = useState(slot.durationMin);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // New project inline creation
  const [addingNew, setAddingNew] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjDomain, setNewProjDomain] = useState(domains[0]?.id || "");

  const timeChanged = startHour !== slot.startHour || startMin !== slot.startMin || duration !== slot.durationMin;
  const is90 = duration === 90;
  const proj = projects.find(p => p.id === projectId);
  const domain = proj ? domains.find(d => d.id === proj.domainId) : null;

  const createAndSelect = (onProjectCreated) => {
    const name = newProjName.trim();
    if (!name || !newProjDomain) return;
    const newId = uid();
    onProjectCreated({ id: newId, domainId: newProjDomain, name, status: "active", tasks: [] });
    setProjectId(newId);
    setAddingNew(false);
    setNewProjName("");
  };

  const submit = () => {
    if (timeChanged && saveAsDefault) {
      onUpdateSlotDefault(origSlot.slotIndex, { startHour, startMin, durationMin: duration });
    }
    onAssign({ id: uid(), projectId, startHour, startMin, durationMin: duration, dayOffset, isAdmin: false });
  };

  const timeOptions = [];
  for (let h = 6; h <= 20; h++) {
    for (let m of [0, 15, 30, 45]) {
      timeOptions.push({ h, m });
    }
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-pull" />
        <div className="sheet-title">Assign Deep Work</div>
        <div className="sheet-sub">{days[dow]} · {fmtTime(slot.startHour, slot.startMin)} slot</div>
        <div className="sheet-scroll">

          <div className="form-row">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <label className="form-label" style={{ marginBottom:0 }}>Project</label>
              <button
                style={{ background:"none", border:"none", color:"var(--accent)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"2px 0" }}
                onClick={() => { setAddingNew(v => !v); setNewProjName(""); }}
              >
                {addingNew ? "Cancel" : "＋ New Project"}
              </button>
            </div>

            {addingNew ? (
              <div style={{ background:"var(--bg3)", borderRadius:10, padding:"12px", display:"flex", flexDirection:"column", gap:8 }}>
                <input
                  className="form-input"
                  placeholder="Project name…"
                  value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  autoFocus
                  style={{ marginBottom:0 }}
                />
                <select className="form-select" value={newProjDomain} onChange={e => setNewProjDomain(e.target.value)} style={{ marginBottom:0 }}>
                  {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button
                  className="form-btn"
                  style={{ marginTop:0, opacity: newProjName.trim() ? 1 : 0.4 }}
                  disabled={!newProjName.trim()}
                  onClick={() => onCreateProject && onCreateProject({ id: uid(), domainId: newProjDomain, name: newProjName.trim(), status: "active", tasks: [] }, (newId) => { setProjectId(newId); setAddingNew(false); setNewProjName(""); })}
                >
                  Create &amp; Select
                </button>
              </div>
            ) : (
              <div>
                {domains.map(domain => {
                  const domProjects = projects.filter(p => p.domainId === domain.id);
                  if (!domProjects.length) return null;
                  return (
                    <div key={domain.id} className="proj-pills-group">
                      <div className="proj-pills-domain-label" style={{ color: domain.color }}>{domain.name}</div>
                      <div className="proj-pills-row">
                        {domProjects.map(p => {
                          const selected = projectId === p.id;
                          return (
                            <div
                              key={p.id}
                              className={`proj-pill ${selected ? "selected" : ""}`}
                              style={{
                                borderColor: domain.color,
                                background: selected ? domain.color : `${domain.color}18`,
                                color: selected ? "#000" : domain.color,
                                opacity: p.status === "backlog" ? 0.6 : 1,
                              }}
                              onClick={() => setProjectId(p.id)}
                            >
                              {p.name}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="form-row">
            <label className="form-label">Start Time</label>
            <select className="form-select" value={`${startHour}:${startMin}`} onChange={e => { const [h,m] = e.target.value.split(":").map(Number); setStartHour(h); setStartMin(m); }}>
              {timeOptions.map(({h,m}) => {
                const label = fmtTime(h,m);
                const isDefault = h===slot.startHour && m===slot.startMin;
                return <option key={`${h}:${m}`} value={`${h}:${m}`}>{label}</option>;
              })}
            </select>
          </div>

          <div className="form-row">
            <label className="form-label">Duration</label>
            <select className="form-select" value={duration} onChange={e => setDuration(Number(e.target.value))}>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          {timeChanged && (
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0 4px", marginBottom:4, cursor:"pointer" }} onClick={() => setSaveAsDefault(v=>!v)}>
              <div style={{ width:18, height:18, borderRadius:5, border:`1.5px solid ${saveAsDefault?"var(--accent)":"var(--border)"}`, background:saveAsDefault?"var(--accent)":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s" }}>
                {saveAsDefault && <span style={{ fontSize:11, color:"#000", fontWeight:700 }}>✓</span>}
              </div>
              <span style={{ fontSize:12, color:"var(--text2)" }}>Save as my default time for Block {origSlot.slotIndex+1}</span>
            </div>
          )}

          <button className="form-btn" onClick={submit}>
            Assign to {proj?.name || "—"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── WORK WEEK SHEET ──────────────────────────────────────────────────────────
function WorkWeekSheet({ workWeek, data, onClose, onSave, lightMode, onToggleTheme }) {
  const swipe = useSwipeDown(onClose);
  const [selected, setSelected] = useState([...workWeek]);
  const liveSlots = getDeepSlots(data);

  // Local editable copy of the 3 deep block defaults
  const [defs, setDefs] = useState(liveSlots.map(s => ({
    startHour: s.startHour, startMin: s.startMin, durationMin: s.durationMin
  })));

  const dayLabels  = ["S","M","T","W","T","F","S"];
  const dayNames   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const toggle = d => setSelected(s => s.includes(d) ? s.filter(x=>x!==d) : [...s,d]);
  const preset = days => setSelected(days);

  const updateDef = (i, field, val) => setDefs(ds => ds.map((d,j) => j===i ? {...d,[field]:Number(val)} : d));

  const timeOptions = [];
  for (let h = 6; h <= 20; h++) for (let m of [0,15,30,45]) timeOptions.push({h,m});

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Work Week</div>
        <div className="sheet-sub">Set your work days and default deep work times</div>
        <div className="sheet-scroll">

          <div className="ww-days">
            {dayLabels.map((l,i) => (
              <div key={i} className={`ww-day ${selected.includes(i)?"on":""}`} onClick={() => toggle(i)} title={dayNames[i]}>{l}</div>
            ))}
          </div>

          <div className="ww-presets">
            <button className="ww-preset" onClick={() => preset([1,2,3,4,5])}>Mon – Fri</button>
            <button className="ww-preset" onClick={() => preset([2,3,4,5,6])}>Tue – Sat</button>
            <button className="ww-preset" onClick={() => preset([0,1,2,3,4])}>Sun – Thu</button>
            <button className="ww-preset" onClick={() => preset([1,2,3,4])}>Mon – Thu</button>
          </div>

          <div className="sh" style={{ paddingLeft:0, paddingTop:8 }}><span className="sh-label">Default Deep Work Times</span></div>


          <div className="ww-times">
            {DEFAULT_DEEP_SLOTS.map((slot, i) => (
              <div key={i} className="ww-slot-row">
                <div style={{ flex:1 }}>
                  <div className="ww-slot-num">Block {i+1}</div>

                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                  <select className="ww-slot-select"
                    value={`${defs[i].startHour}:${defs[i].startMin}`}
                    onChange={e => { const [h,m] = e.target.value.split(":").map(Number); updateDef(i,"startHour",h); updateDef(i,"startMin",m); }}>
                    {timeOptions.map(({h,m}) => (
                      <option key={`${h}:${m}`} value={`${h}:${m}`}>{fmtTime(h,m)}</option>
                    ))}
                  </select>
                  <select className="ww-slot-select"
                    value={defs[i].durationMin}
                    onChange={e => updateDef(i,"durationMin",e.target.value)}>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="theme-toggle-row">
            <div>
              <div className="theme-toggle-label">Appearance</div>
              <div className="theme-toggle-sub">{lightMode ? "Light mode" : "Dark mode"}</div>
            </div>
            <div className={`toggle-pill ${lightMode ? "on" : ""}`} onClick={onToggleTheme}>
              <div className="toggle-knob" />
            </div>
          </div>

          <button className="form-btn" style={{ marginTop:16 }} onClick={() => onSave(selected, defs)}>Save</button>
        </div>
      </div>
    </>
  );
}

// ─── BLOCK EDIT PANEL (inline) ────────────────────────────────────────────────
function BlockEditPanel({ blk, data, onSave, onDelete }) {
  const { projects, domains } = data;
  const [projectId, setProjectId] = useState(blk.projectId || "");
  const [isAdmin, setIsAdmin] = useState(blk.isAdmin || false);
  const [label, setLabel] = useState(blk.label || "Admin & Communication");
  const [startHour, setStartHour] = useState(blk.startHour);
  const [duration, setDuration] = useState(blk.durationMin);

  return (
    <div className="blk-edit-panel">
      <div className="blk-edit-row">
        <div>
          <div className="blk-edit-label">Type</div>
          <select className="blk-edit-select" value={isAdmin ? "admin" : "project"} onChange={e => setIsAdmin(e.target.value === "admin")}>
            <option value="project">Project Work</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <div className="blk-edit-label">Start Time</div>
          <select className="blk-edit-select" value={startHour} onChange={e => setStartHour(Number(e.target.value))}>
            {Array.from({length:13},(_,i)=>i+7).map(h => (
              <option key={h} value={h}>{h>12?h-12:h}:00 {h>=12?"PM":"AM"}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="blk-edit-row">
        <div>
          <div className="blk-edit-label">{isAdmin ? "Label" : "Project"}</div>
          {isAdmin ? (
            <input className="blk-edit-select" style={{fontFamily:"'DM Sans',sans-serif"}} value={label} onChange={e => setLabel(e.target.value)} />
          ) : (
            <select className="blk-edit-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">— none —</option>
              {projects.map(p => {
                const d = domains.find(d => d.id === p.domainId);
                return <option key={p.id} value={p.id}>{p.name} ({d?.name})</option>;
              })}
            </select>
          )}
        </div>
        <div>
          <div className="blk-edit-label">Duration</div>
          <select className="blk-edit-select" value={duration} onChange={e => setDuration(Number(e.target.value))}>
            <option value={25}>25 min</option><option value={45}>45 min</option>
            <option value={60}>60 min</option><option value={90}>90 min</option>
            <option value={120}>2 hours</option>
          </select>
        </div>
      </div>
      <div className="blk-edit-actions">
        <button className="blk-edit-save" onClick={() => onSave({ projectId: isAdmin ? null : projectId || null, isAdmin, label: isAdmin ? label : undefined, startHour, durationMin: duration })}>Save</button>
        <button className="blk-edit-del" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}


// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getQuarterLabel() {
  const m = new Date().getMonth();
  const q = Math.floor(m / 3) + 1;
  const seasons = ["Winter","Spring","Summer","Fall"];
  return `Q${q} · ${seasons[Math.floor(m/3)]} ${new Date().getFullYear()}`;
}

// ─── THIS SEASON CARD (Plan tab pull-forward widget) ──────────────────────────
function ThisSeasonCard({ data, setData, onGoToSeason }) {
  const { seasonGoals = [], domains } = data;
  const getDomain = id => domains.find(d => d.id === id);
  const activeGoals = seasonGoals.filter(g => !g.done);
  const doneCount   = seasonGoals.filter(g => g.done).length;

  const toggleGoal = id => setData(d => ({
    ...d,
    seasonGoals: (d.seasonGoals||[]).map(g => g.id === id ? { ...g, done: !g.done } : g)
  }));

  if (seasonGoals.length === 0) {
    return (
      <div className="season-pull-card" style={{ cursor: "pointer" }} onClick={onGoToSeason}>
        <div className="spc-head">
          <span className="spc-eyebrow">This Season</span>
          <button className="spc-edit" onClick={e => { e.stopPropagation(); onGoToSeason(); }}>Set goals →</button>
        </div>
        <div className="spc-empty">No season goals set yet. Tap to add some.</div>
      </div>
    );
  }

  return (
    <div className="season-pull-card">
      <div className="spc-head">
        <span className="spc-eyebrow">This Season · {getQuarterLabel()}</span>
        <button className="spc-edit" onClick={onGoToSeason}>
          {doneCount}/{seasonGoals.length} done →
        </button>
      </div>
      {activeGoals.slice(0,3).map(g => {
        const domain = getDomain(g.domainId);
        return (
          <div key={g.id} className="spc-goal">
            <div className="spc-dot" style={{ background: domain?.color || "var(--text3)" }} />
            <span className="spc-text">{g.text}</span>
            <div
              className={`spc-check ${g.done ? "checked" : ""}`}
              onClick={() => toggleGoal(g.id)}
            >✓</div>
          </div>
        );
      })}
      {activeGoals.length === 0 && (
        <div className="spc-empty">🎉 All season goals complete!</div>
      )}
    </div>
  );
}

// ─── SEASON SCREEN ────────────────────────────────────────────────────────────
function SeasonScreen({ data, setData }) {
  const { domains, projects, seasonGoals = [], reviewData } = data;
  const [newText, setNewText]       = useState("");
  const [newDomainId, setNewDomainId] = useState(domains[0]?.id || "");
  const today     = new Date();
  const months    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const totalTasks = projects.reduce((s,p) => s + p.tasks.filter(t=>t.done).length, 0);
  const totalDW    = Object.values(reviewData.domainBlocks).reduce((a,b)=>a+b,0);
  const maxBlocks  = Math.max(...Object.values(reviewData.domainBlocks), 1);
  const getDomain  = id => domains.find(d => d.id === id);

  const toggleGoal = id => setData(d => ({
    ...d, seasonGoals: (d.seasonGoals||[]).map(g => g.id===id ? { ...g, done: !g.done } : g)
  }));
  const deleteGoal = id => setData(d => ({
    ...d, seasonGoals: (d.seasonGoals||[]).filter(g => g.id!==id)
  }));
  const addGoal = () => {
    const text = newText.trim();
    if (!text) return;
    if ((data.seasonGoals||[]).length >= 4) return;
    setData(d => ({
      ...d, seasonGoals: [...(d.seasonGoals||[]), { id: uid(), text, domainId: newDomainId, done: false }]
    }));
    setNewText("");
  };

  const doneCount = seasonGoals.filter(g=>g.done).length;

  return (
    <div className="screen active">
      <StatusBar />
      <div className="ph">
        <div className="ph-eye">{getQuarterLabel()}</div>
        <div className="ph-title">Season</div>
      </div>
      <div className="scroll">

        {/* Season hero */}
        <div className="season-hero">
          <div className="sh-quarter">{getQuarterLabel()}</div>
          <div className="sh-title">
            {doneCount === seasonGoals.length && seasonGoals.length > 0
              ? "Season complete 🎉"
              : `${seasonGoals.length - doneCount} goal${seasonGoals.length - doneCount !== 1 ? "s" : ""} in motion`}
          </div>
          <div className="sh-sub">
            {seasonGoals.length === 0
              ? "Set up to 4 big goals for this quarter."
              : `${doneCount} of ${seasonGoals.length} complete`}
          </div>
        </div>

        {/* Season goals list */}
        <div className="sh"><span className="sh-label">Season Goals</span></div>
        <div className="sg-card">
          {seasonGoals.length === 0 && (
            <div style={{ padding: "14px 18px", fontSize: 13, color: "var(--text3)" }}>
              No goals yet — add up to 4 below.
            </div>
          )}
          {seasonGoals.map(g => {
            const domain = getDomain(g.domainId);
            return (
              <div key={g.id} className="sg-row">
                <div className="sg-stripe" style={{ background: domain?.color || "var(--bg4)" }} />
                <div className="sg-body">
                  <div className={`sg-text ${g.done ? "done" : ""}`}>{g.text}</div>
                  <div className="sg-domain">{domain?.name || "—"}</div>
                </div>
                <div className={`sg-check ${g.done ? "checked" : ""}`} onClick={() => toggleGoal(g.id)}>✓</div>
                <button className="sg-del" onClick={() => deleteGoal(g.id)}>✕</button>
              </div>
            );
          })}
          {seasonGoals.length < 4 && (
            <div className="add-goal-row">
              <input
                className="add-goal-input"
                placeholder="Add a season goal…"
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addGoal()}
              />
              <select
                className="add-goal-domain"
                value={newDomainId}
                onChange={e => setNewDomainId(e.target.value)}
              >
                {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className="add-goal-btn" onClick={addGoal}>Add</button>
            </div>
          )}
        </div>

        {/* Divider between Season and Review */}
        <div className="season-divider">
          <div className="sdiv-line" />
          <span className="sdiv-label">Week Review</span>
          <div className="sdiv-line" />
        </div>

        {/* Review stats below */}
        <div className="stats-row">
          <div className="stat-box"><div className="stat-n">{totalTasks}</div><div className="stat-lbl">Tasks completed</div></div>
          <div className="stat-box"><div className="stat-n">{totalDW}</div><div className="stat-lbl">Deep work blocks</div></div>
        </div>
        <div className="sh"><span className="sh-label">Domain Coverage</span></div>
        <div className="cov-card">
          {domains.map(d => {
            const count = reviewData.domainBlocks[d.id] || 0;
            return (
              <div key={d.id} className="cov-row">
                <div className="cov-dot" style={{ background: d.color }} />
                <span className="cov-name">{d.name}</span>
                <div className="cov-bar-wrap"><div className="cov-bar-fill" style={{ width: `${(count/maxBlocks)*100}%`, background: d.color }} /></div>
                <span className={`cov-ct ${count===0?"cov-zero":""}`}>{count} {count===1?"block":"blocks"}</span>
              </div>
            );
          })}
        </div>

        {/* Deep Work this week — bar chart */}
        {(() => {
          const completions = data.blockCompletions || [];
          const now = new Date();
          const dayOfWeek = now.getDay();
          const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); weekStart.setHours(0,0,0,0);
          const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
          const weeklyTarget = data.deepWorkTargets?.weeklyHours || 20;
          const dailyTarget = data.deepWorkTargets?.dailyHours || 4;
          const bars = days.map((label, i) => {
            const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
            const dStr = d.toDateString();
            const mins = completions.filter(c => c.date === dStr).reduce((s,c) => s + (c.durationMin||60), 0);
            const hrs = mins / 60;
            const isToday = dStr === now.toDateString();
            const isPast = d < now && !isToday;
            return { label, hrs, isToday, isPast };
          });
          const weekTotal = bars.reduce((s,b) => s + b.hrs, 0);
          const maxBar = Math.max(...bars.map(b => b.hrs), dailyTarget);
          return (
            <div style={{ margin:"0 16px 8px", padding:"16px", background:"var(--bg2)", borderRadius:16, border:"1px solid var(--border)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>Deep Work This Week</div>
                <div style={{ fontSize:12, color: weekTotal >= weeklyTarget ? "var(--green)" : "var(--text3)", fontWeight:600 }}>
                  {weekTotal % 1 === 0 ? weekTotal : weekTotal.toFixed(1)} / {weeklyTarget}h
                </div>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:72 }}>
                {bars.map(({ label, hrs, isToday, isPast }) => {
                  const pct = hrs / maxBar;
                  const atTarget = hrs >= dailyTarget;
                  return (
                    <div key={label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, height:"100%" }}>
                      <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
                        <div style={{ width:"100%", borderRadius:4, height: hrs > 0 ? `${Math.max(pct*100,6)}%` : "4%", background: atTarget ? "var(--green)" : isToday ? "var(--accent)" : isPast && hrs === 0 ? "var(--bg4)" : "rgba(232,160,48,.35)", opacity: isPast && hrs === 0 ? .4 : 1, transition:"height .3s" }} />
                      </div>
                      <div style={{ fontSize:10, color: isToday ? "var(--accent)" : "var(--text3)", fontWeight: isToday ? 700 : 400 }}>{label}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize:10, color:"var(--text3)", marginTop:6, textAlign:"right" }}>Daily target: {dailyTarget}h · Weekly: {weeklyTarget}h</div>
            </div>
          );
        })()}

        <div className="sh"><span className="sh-label">Projects Moved</span></div>
        <div className="moved-card">
          {Object.entries(reviewData.projectProgress).map(([projId, info]) => {
            const proj = data.projects.find(p => p.id === projId);
            if (!proj) return null;
            const domain = data.domains.find(d => d.id === proj.domainId);
            return (
              <div key={projId} className="mv-row">
                <div className="mv-stripe" style={{ background: domain?.color }} />
                <div className="mv-info">
                  <div className="mv-name">{proj.name}</div>
                  <div className="mv-bar-wrap"><div className="mv-bar-fill" style={{ width: `${info.pct}%`, background: domain?.color }} /></div>
                </div>
                <span className="mv-delta">+{info.delta}%</span>
              </div>
            );
          })}
        </div>
        <div className="spacer" />
      </div>
    </div>
  );
}

// ─── SWIPE DOWN TO CLOSE ─────────────────────────────────────────────────────
function useSwipeDown(onClose) {
  const startY = useRef(null);
  const [dy, setDy] = useState(0);

  const onTouchStart = e => { startY.current = e.touches[0].clientY; };
  const onTouchMove  = e => {
    if (startY.current === null) return;
    const d = e.touches[0].clientY - startY.current;
    if (d > 0) { e.preventDefault(); setDy(d); }
  };
  const onTouchEnd = () => {
    if (dy > 80) onClose();
    setDy(0);
    startY.current = null;
  };

  const style = {
    transform: `translateY(${dy}px)`,
    transition: dy === 0 ? "transform .25s ease" : "none",
  };

  return { onTouchStart, onTouchMove, onTouchEnd, style };
}

// ─── SHUTDOWN SHEET ───────────────────────────────────────────────────────────
const SD_ITEMS = [
  "Reviewed tomorrow's calendar",
  "Captured all loose tasks",
  "No urgent emails unaddressed",
  "Mind cleared — nothing left open",
];

function ShutdownSheet({ onClose, onComplete, alreadyDone, data, onAddBlock }) {
  const swipe = useSwipeDown(onClose);
  const [checked, setChecked]       = useState(alreadyDone ? [0,1,2,3] : []);
  const [addingBlock, setAddingBlock] = useState(false);
  // inline quick-block form state
  const { projects, domains, blocks } = data;
  const [projectId, setProjectId]   = useState(projects.find(p=>p.status==="active")?.id || projects[0]?.id || "");
  const [startHour, setStartHour]   = useState(9);
  const [duration, setDuration]     = useState(90);

  const tomorrowBlocks = blocks
    .filter(b => b.dayOffset === 1)
    .sort((a,b) => a.startHour*60+a.startMin - (b.startHour*60+b.startMin));

  const firstBlock   = tomorrowBlocks[0];
  const hasTomorrow  = !!firstBlock;

  // step 5 is auto-checked if tomorrow already has a block
  const step5Done    = hasTomorrow || addingBlock === "saved";
  const allDone      = checked.length === SD_ITEMS.length && step5Done;

  const toggle = i => setChecked(p => p.includes(i) ? p.filter(x=>x!==i) : [...p, i]);

  const saveBlock = () => {
    const proj = projects.find(p => p.id === projectId);
    onAddBlock({
      id: uid(),
      projectId,
      startHour,
      startMin: 0,
      durationMin: duration,
      dayOffset: 1,
      isAdmin: false,
    });
    setAddingBlock("saved");
  };

  const getProject = id => projects.find(p => p.id === id);
  const getDomain  = id => domains.find(d => d.id === id);

  const tomorrowPreviewProj   = firstBlock ? getProject(firstBlock.projectId) : null;
  const tomorrowPreviewDomain = tomorrowPreviewProj ? getDomain(tomorrowPreviewProj.domainId) : null;

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Shutdown Ritual</div>
        <div className="sheet-sub">Close out your workday with intention.</div>
        <div className="sheet-scroll">

          {/* Deep work summary */}
          {(() => {
            const todayStr = new Date().toDateString();
            const completions = data.blockCompletions || [];
            const todayMins = completions.filter(c => c.date === todayStr).reduce((s,c) => s + (c.durationMin||60), 0);
            const todayHrs = todayMins / 60;
            const dailyTarget = data.deepWorkTargets?.dailyHours || 4;
            const pct = Math.min(todayHrs / dailyTarget, 1);
            const now = new Date();
            const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
            const weekHrs = completions.filter(c => new Date(c.date) >= weekStart).reduce((s,c) => s + (c.durationMin||60), 0) / 60;
            const weeklyTarget = data.deepWorkTargets?.weeklyHours || 20;
            return (
              <div style={{ background:"var(--bg3)", borderRadius:12, padding:"12px 14px", marginBottom:14, border:"1px solid var(--border)" }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Deep Work Today</div>
                <div style={{ display:"flex", gap:12, marginBottom:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:18, fontWeight:700, color: pct>=1 ? "var(--green)" : "var(--text)", lineHeight:1 }}>
                      {todayHrs%1===0 ? todayHrs : todayHrs.toFixed(1)}<span style={{ fontSize:11, color:"var(--text3)", marginLeft:2 }}>/ {dailyTarget}h</span>
                    </div>
                    <div style={{ fontSize:10, color:"var(--text3)", marginTop:2 }}>today</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:18, fontWeight:700, color: weekHrs>=weeklyTarget ? "var(--green)" : "var(--text)", lineHeight:1 }}>
                      {weekHrs%1===0 ? weekHrs : weekHrs.toFixed(1)}<span style={{ fontSize:11, color:"var(--text3)", marginLeft:2 }}>/ {weeklyTarget}h</span>
                    </div>
                    <div style={{ fontSize:10, color:"var(--text3)", marginTop:2 }}>this week</div>
                  </div>
                </div>
                <div style={{ height:4, borderRadius:2, background:"var(--bg4)", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct*100}%`, borderRadius:2, background: pct>=1 ? "var(--green)" : "var(--accent)", transition:"width .4s" }} />
                </div>
                {pct >= 1 && <div style={{ fontSize:11, color:"var(--green)", marginTop:5, fontWeight:600 }}>Daily target hit ✓</div>}
              </div>
            );
          })()}

          {/* steps 1–4 */}
          {SD_ITEMS.map((item,i) => (
            <div key={i} className="sd-item" onClick={() => toggle(i)}>
              <div className={`sd-box ${checked.includes(i)?"done":""}`} />
              <span className="sd-item-txt">{item}</span>
            </div>
          ))}

          {/* divider */}
          <div style={{ height: 1, background: "var(--border2)", margin: "10px 0" }} />

          {/* step 5 — tomorrow's first block */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <div style={{
                width:20, height:20, borderRadius:6, flexShrink:0,
                background: step5Done ? "var(--green)" : "transparent",
                border: step5Done ? "none" : "1.5px solid var(--border)",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all .15s",
              }}>
                {step5Done && <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>}
              </div>
              <span style={{ fontSize:14, color:"var(--text)", fontWeight: step5Done ? 400 : 500 }}>
                Tomorrow's first block is set
              </span>
            </div>

            {/* CASE A: has a block already */}
            {hasTomorrow && (
              <div style={{
                background:"var(--bg3)", borderRadius:12, padding:"12px 14px",
                display:"flex", alignItems:"center", gap:12, marginLeft:28,
              }}>
                <div style={{
                  width:3, borderRadius:2, alignSelf:"stretch", minHeight:28, flexShrink:0,
                  background: tomorrowPreviewDomain?.color || "var(--bg4)",
                }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>
                    {tomorrowPreviewProj?.name || firstBlock.label || "Block"}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>
                    {fmtTime(firstBlock.startHour, firstBlock.startMin)} · {firstBlock.durationMin} min
                    {tomorrowPreviewDomain ? ` · ${tomorrowPreviewDomain.name}` : ""}
                  </div>
                </div>
                {tomorrowBlocks.length > 1 && (
                  <span style={{ fontSize:11, color:"var(--text3)" }}>+{tomorrowBlocks.length-1} more</span>
                )}
              </div>
            )}

            {/* CASE B: no block — prompt to add */}
            {!hasTomorrow && addingBlock !== "saved" && (
              <div style={{ marginLeft:28 }}>
                {!addingBlock ? (
                  <div style={{
                    background:"rgba(224,85,85,0.08)", border:"1px solid rgba(224,85,85,0.25)",
                    borderRadius:12, padding:"11px 14px", display:"flex", alignItems:"center", gap:10,
                  }}>
                    <span style={{fontSize:16}}>⚠️</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#E05555",marginBottom:2}}>No blocks scheduled</div>
                      <div style={{fontSize:12,color:"var(--text2)"}}>Set tomorrow's first deep work block before you close out.</div>
                    </div>
                    <button
                      onClick={() => setAddingBlock("open")}
                      style={{
                        background:"var(--accent)", color:"#000", border:"none",
                        borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:700,
                        cursor:"pointer", fontFamily:"'DM Sans',sans-serif", flexShrink:0,
                      }}>
                      + Add
                    </button>
                  </div>
                ) : (
                  /* inline mini form */
                  <div style={{
                    background:"var(--bg3)", border:"1px solid var(--border)",
                    borderRadius:12, padding:"14px",
                  }}>
                    <div style={{fontSize:11,fontWeight:600,letterSpacing:".07em",textTransform:"uppercase",color:"var(--text3)",marginBottom:10}}>
                      Tomorrow's First Block
                    </div>
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:11,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--text3)",marginBottom:4}}>Project</div>
                      <select
                        style={{width:"100%",background:"var(--bg4)",border:"1px solid var(--border)",borderRadius:8,padding:"9px 10px",color:"var(--text)",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",appearance:"none"}}
                        value={projectId} onChange={e => setProjectId(e.target.value)}>
                        {projects.map(p => {
                          const d = getDomain(p.domainId);
                          return <option key={p.id} value={p.id}>{p.name}{d ? ` (${d.name})` : ""}</option>;
                        })}
                      </select>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--text3)",marginBottom:4}}>Start Time</div>
                        <select
                          style={{width:"100%",background:"var(--bg4)",border:"1px solid var(--border)",borderRadius:8,padding:"9px 10px",color:"var(--text)",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",appearance:"none"}}
                          value={startHour} onChange={e => setStartHour(Number(e.target.value))}>
                          {Array.from({length:13},(_,i)=>i+7).map(h => (
                            <option key={h} value={h}>{h>12?h-12:h}:00 {h>=12?"PM":"AM"}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--text3)",marginBottom:4}}>Duration</div>
                        <select
                          style={{width:"100%",background:"var(--bg4)",border:"1px solid var(--border)",borderRadius:8,padding:"9px 10px",color:"var(--text)",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",appearance:"none"}}
                          value={duration} onChange={e => setDuration(Number(e.target.value))}>
                          <option value={25}>25 min</option>
                          <option value={45}>45 min</option>
                          <option value={60}>60 min</option>
                          <option value={90}>90 min</option>
                          <option value={120}>2 hours</option>
                        </select>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={saveBlock} style={{flex:1,background:"var(--accent)",color:"#000",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                        Set Block
                      </button>
                      <button onClick={() => setAddingBlock(null)} style={{background:"var(--bg4)",color:"var(--text3)",border:"none",borderRadius:8,padding:"10px 14px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CASE C: just saved */}
            {addingBlock === "saved" && (() => {
              const savedProj   = getProject(projectId);
              const savedDomain = savedProj ? getDomain(savedProj.domainId) : null;
              return (
                <div style={{
                  background:"rgba(69,193,122,0.08)", border:"1px solid rgba(69,193,122,0.2)",
                  borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, marginLeft:28,
                }}>
                  <div style={{width:3,borderRadius:2,alignSelf:"stretch",minHeight:28,flexShrink:0,background:savedDomain?.color||"var(--bg4)"}} />
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{savedProj?.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>
                      {fmtTime(startHour, 0)} · {duration} min{savedDomain ? ` · ${savedDomain.name}` : ""}
                    </div>
                  </div>
                  <span style={{fontSize:13,color:"var(--green)",fontWeight:600}}>Set ✓</span>
                </div>
              );
            })()}
          </div>

          {/* COMPLETED TODAY */}
          {(() => {
            const today = new Date().toDateString();
            const completedToday = [];
            projects.forEach(proj => {
              const dom = domains.find(d => d.id === proj.domainId);
              proj.tasks.forEach(t => {
                if (t.done && t.doneAt && new Date(t.doneAt).toDateString() === today) {
                  completedToday.push({ text: t.text, projName: proj.name, color: dom?.color });
                }
              });
            });
            // Also include loose tasks completed today
            const looseDone = (data.looseTasks || []).filter(t =>
              t.done && t.doneAt && new Date(t.doneAt).toDateString() === today
            );
            looseDone.forEach(t => {
              const dom = domains.find(d => d.id === t.domainId);
              completedToday.push({ text: t.text, projName: dom?.name || "Loose", color: dom?.color });
            });
            // Routine block tasks completed today
            (data.routineBlocks || []).forEach(rb => {
              const comp = (rb.completions || {})[today] || {};
              rb.tasks.forEach(t => {
                if (comp[t.id]) completedToday.push({ text: t.text, projName: rb.title, color: "var(--text3)" });
              });
            });

            if (!completedToday.length) return null;
            return (
              <div style={{ margin:"16px 0 8px" }}>
                <div style={{ height:1, background:"var(--border2)", marginBottom:16 }} />
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:".09em", textTransform:"uppercase", color:"var(--text3)", marginBottom:4 }}>
                  Tasks Completed Today
                </div>
                <div style={{ fontSize:22, fontWeight:700, color:"var(--text)", marginBottom:12 }}>
                  {completedToday.length} task{completedToday.length !== 1 ? "s" : ""} done 🎉
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {completedToday.map((t, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--bg3)", borderRadius:10 }}>
                      <div style={{ width:3, alignSelf:"stretch", borderRadius:2, background: t.color || "var(--border)", flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:"var(--text)", textDecoration:"line-through", opacity:.7 }}>{t.text}</div>
                        <div style={{ fontSize:11, color:"var(--text3)", marginTop:1 }}>{t.projName}</div>
                      </div>
                      <span style={{ fontSize:14 }}>✓</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <button
            className="sd-btn"
            disabled={!allDone}
            onClick={() => { onComplete(); onClose(); }}
          >
            {allDone ? "Shutdown Complete ✓" : `${checked.length + (step5Done ? 1 : 0)} of 5 complete`}
          </button>

        </div>
      </div>
    </>
  );
}

// ─── TIME-OF-DAY HINT ─────────────────────────────────────────────────────────
function getTimeHint(hour, isAdmin) {
  if (isAdmin) {
    if (hour < 12) return { icon: "⚠️", text: "Admin before noon uses your peak cognitive window — consider shifting to after 3pm.", tone: "warn" };
    if (hour < 15) return { icon: "💡", text: "Early afternoon works for lighter admin — energy is good but not at its peak.", tone: "neutral" };
    return { icon: "✓", text: "After 3pm is ideal for admin and communication — your analytical peak has passed.", tone: "good" };
  }
  // deep work
  if (hour < 12) return { icon: "🔥", text: "Before noon — your best window for deep analytical work. Neurochemicals are at peak.", tone: "good" };
  if (hour < 15) return { icon: "💡", text: "Early afternoon — solid for creative or generative work. Less ideal for hard analysis.", tone: "neutral" };
  return { icon: "⚠️", text: "After 3pm — cognitive resources are winding down. Better suited for admin than deep work.", tone: "warn" };
}

// ─── ADD BLOCK SHEET ──────────────────────────────────────────────────────────
function AddBlockSheet({ data, onClose, onAdd, onAddRoutine }) {
  const swipe = useSwipeDown(onClose);
  const { projects, domains } = data;
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  // Step 1: type selection
  const [blockType, setBlockType] = useState(null); // null | "project" | "routine"

  // Project block state
  const [projectId, setProjectId]   = useState(projects[0]?.id || "");
  const [startHour, setStartHour]   = useState(9);
  const [duration, setDuration]     = useState(90);
  const [dayOffset, setDayOffset]   = useState(0);

  // Routine block state
  const [rtTitle, setRtTitle]       = useState("");
  const [rtDayOfWeek, setRtDayOfWeek] = useState(new Date().getDay());
  const [rtStartHour, setRtStartHour] = useState(9);
  const [rtDuration, setRtDuration] = useState(60);
  const [rtRecurring, setRtRecurring] = useState(true);
  const [rtTasks, setRtTasks]       = useState([]);
  const [rtTaskDraft, setRtTaskDraft] = useState("");
  const rtInputRef = useRef(null);

  const addRtTask = () => {
    const t = rtTaskDraft.trim();
    if (!t) return;
    setRtTasks(prev => [...prev, { id: uid(), text: t }]);
    setRtTaskDraft("");
    setTimeout(() => rtInputRef.current?.focus(), 30);
  };

  const submitProject = () => {
    onAdd({ id: uid(), projectId, startHour, startMin: 0, durationMin: duration, dayOffset, isAdmin: false });
    onClose();
  };

  const submitRoutine = () => {
    if (!rtTitle.trim()) return;
    const today = new Date();
    let targetDate = null;
    if (!rtRecurring) {
      // one-time: find next occurrence of rtDayOfWeek within next 7 days
      const d = new Date(today);
      for (let i = 0; i < 7; i++) {
        if (d.getDay() === rtDayOfWeek) { targetDate = d.toDateString(); break; }
        d.setDate(d.getDate() + 1);
      }
    }
    onAddRoutine({
      id: uid(),
      title: rtTitle.trim(),
      dayOfWeek: rtDayOfWeek,
      startHour: rtStartHour,
      startMin: 0,
      durationMin: rtDuration,
      recurring: rtRecurring,
      targetDate,
      tasks: rtTasks,
      completions: {},
    });
    onClose();
  };

  // ── Type picker ───────────────────────────────────────────────
  if (!blockType) return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Add Block</div>
        <div className="sheet-sub">What kind of block is this?</div>
        <div className="sheet-scroll">
          <div style={{ display:"flex", flexDirection:"column", gap:10, padding:"8px 0 16px" }}>
            <button onClick={() => setBlockType("project")} style={{
              background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:14,
              padding:"16px 18px", textAlign:"left", cursor:"pointer", color:"var(--text)", fontFamily:"'DM Sans',sans-serif"
            }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:3 }}>Project Block</div>
              <div style={{ fontSize:12, color:"var(--text3)" }}>Focused work on a specific project</div>
            </button>
            <button onClick={() => setBlockType("routine")} style={{
              background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:14,
              padding:"16px 18px", textAlign:"left", cursor:"pointer", color:"var(--text)", fontFamily:"'DM Sans',sans-serif"
            }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:3 }}>Routine Block</div>
              <div style={{ fontSize:12, color:"var(--text3)" }}>Recurring tasks like admin, reviews, or check-ins</div>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // ── Project block form ────────────────────────────────────────
  if (blockType === "project") return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"16px 20px 4px" }}>
          <button onClick={() => setBlockType(null)} style={{ background:"none", border:"none", color:"var(--text3)", fontSize:18, cursor:"pointer", padding:0, lineHeight:1 }}>‹</button>
          <div className="sheet-title" style={{ margin:0 }}>Project Block</div>
        </div>
        <div className="sheet-scroll">
          <div className="form-row">
            <label className="form-label">Project</label>
            <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
              {projects.map(p => { const d = domains.find(d=>d.id===p.domainId); return <option key={p.id} value={p.id}>{p.name} ({d?.name})</option>; })}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Day</label>
            <select className="form-select" value={dayOffset} onChange={e => setDayOffset(Number(e.target.value))}>
              {["Today","Tomorrow","In 2 days","In 3 days","In 4 days","In 5 days","In 6 days"].map((d,i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="form-row form-row-2">
            <div>
              <label className="form-label">Start Time</label>
              <select className="form-select" value={startHour} onChange={e => setStartHour(Number(e.target.value))}>
                {Array.from({length:13},(_,i)=>i+7).map(h => <option key={h} value={h}>{h>12?h-12:h}:00 {h>=12?"PM":"AM"}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Duration</label>
              <select className="form-select" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                <option value={25}>25 min</option><option value={45}>45 min</option>
                <option value={60}>60 min</option><option value={90}>90 min</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>
          <button className="form-btn" onClick={submitProject}>Add Block</button>
        </div>
      </div>
    </>
  );

  // ── Routine block form ────────────────────────────────────────
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"16px 20px 4px" }}>
          <button onClick={() => setBlockType(null)} style={{ background:"none", border:"none", color:"var(--text3)", fontSize:18, cursor:"pointer", padding:0, lineHeight:1 }}>‹</button>
          <div className="sheet-title" style={{ margin:0 }}>Routine Block</div>
        </div>
        <div className="sheet-scroll">
          <div className="form-row">
            <label className="form-label">Title</label>
            <input className="form-input" placeholder="e.g. Tuesday Admin" value={rtTitle} onChange={e => setRtTitle(e.target.value)} autoFocus />
          </div>
          <div className="form-row">
            <label className="form-label">Day</label>
            <select className="form-select" value={rtDayOfWeek} onChange={e => setRtDayOfWeek(Number(e.target.value))}>
              {DAY_NAMES.map((d,i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="form-row form-row-2">
            <div>
              <label className="form-label">Start Time</label>
              <select className="form-select" value={rtStartHour} onChange={e => setRtStartHour(Number(e.target.value))}>
                {Array.from({length:13},(_,i)=>i+7).map(h => <option key={h} value={h}>{h>12?h-12:h}:00 {h>=12?"PM":"AM"}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Duration</label>
              <select className="form-select" value={rtDuration} onChange={e => setRtDuration(Number(e.target.value))}>
                <option value={25}>25 min</option><option value={45}>45 min</option>
                <option value={60}>60 min</option><option value={90}>90 min</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Recurring toggle */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0 14px", borderBottom:"1px solid var(--border2)", marginBottom:14 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>Repeat weekly</div>
              <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>Shows every {DAY_NAMES[rtDayOfWeek]}</div>
            </div>
            <div
              onClick={() => setRtRecurring(r => !r)}
              style={{
                width:44, height:26, borderRadius:13, cursor:"pointer",
                background: rtRecurring ? "var(--accent)" : "var(--bg4)",
                border: rtRecurring ? "none" : "1px solid var(--border)",
                position:"relative", transition:"background .2s",
              }}
            >
              <div style={{
                position:"absolute", top:3, left: rtRecurring ? 21 : 3,
                width:20, height:20, borderRadius:"50%",
                background:"#fff", transition:"left .2s",
                boxShadow:"0 1px 4px rgba(0,0,0,.3)",
              }} />
            </div>
          </div>

          {/* Tasks */}
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Tasks</div>
          {rtTasks.map((t, i) => (
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:"1px solid var(--border2)" }}>
              <span style={{ fontSize:13, color:"var(--text)", flex:1 }}>{t.text}</span>
              <button onClick={() => setRtTasks(prev => prev.filter(x => x.id !== t.id))} style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer", fontSize:15, padding:0 }}>✕</button>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <input
              ref={rtInputRef}
              className="form-input"
              style={{ flex:1 }}
              placeholder="Add a task…"
              value={rtTaskDraft}
              onChange={e => setRtTaskDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addRtTask()}
            />
            <button onClick={addRtTask} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"0 14px", color:"var(--text)", cursor:"pointer", fontSize:18, fontFamily:"'DM Sans',sans-serif" }}>+</button>
          </div>

          <button className="form-btn" style={{ marginTop:20 }} disabled={!rtTitle.trim()} onClick={submitRoutine}>
            {rtRecurring ? `Add Weekly Routine` : "Add One-Time Routine"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── QUICK CAPTURE ────────────────────────────────────────────────────────────
function QuickReminders({ onClose, onAddAll }) {
  const [items, setItems]   = useState([]);
  const [draft, setDraft]   = useState("");
  const inputRef            = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

  const commitDraft = () => {
    const t = draft.trim();
    if (!t) return;
    setItems(prev => [...prev, { id: uid(), text: t }]);
    setDraft("");
    // keep focus on input for rapid entry
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

  const finish = () => {
    // commit any unsaved draft first
    const finalItems = [...items];
    const t = draft.trim();
    if (t) finalItems.push({ id: uid(), text: t });
    finalItems.forEach(i => onAddAll({ id: i.id, text: i.text, createdAt: Date.now() }));
    onClose();
  };

  return (
    <>
      {/* Tap-outside backdrop — dismisses without saving */}
      <div className="qr-backdrop" onClick={finish} />
      <div className="qr-panel" onClick={e => e.stopPropagation()}>
        <div className="qr-header">Quick Reminders</div>

        {/* Stacked items */}
        {items.length > 0 && (
          <div className="qr-items">
            {items.map(i => (
              <div key={i.id} className="qr-item">
                <span className="qr-item-text">{i.text}</span>
                <button className="qr-item-del" onClick={() => removeItem(i.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="qr-input-row">
          <input
            ref={inputRef}
            className="qr-input"
            placeholder="Add a reminder…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitDraft(); if (e.key === "Escape") onClose(); }}
          />
        </div>
      </div>
    </>
  );
}

// ─── CATEGORIZE SHEET ─────────────────────────────────────────────────────────
// ─── TODAY SETTINGS SHEET ────────────────────────────────────────────────────
function TodaySettingsSheet({ data, setData, onClose }) {
  const swipe = useSwipeDown(onClose);
  const prefs = data.todayPrefs || {};
  const [name, setName]           = useState(prefs.name || "");
  const [showShutdown, setShowSD] = useState(prefs.showShutdown !== false);
  const [defaultBlock, setDefault] = useState(prefs.defaultBlock || "9");
  const targets = data.deepWorkTargets || { dailyHours: 4, weeklyHours: 20 };
  const [dailyHours, setDailyHours]   = useState(String(targets.dailyHours));
  const [weeklyHours, setWeeklyHours] = useState(String(targets.weeklyHours));

  const save = () => {
    setData(d => ({
      ...d,
      todayPrefs: { name: name.trim(), showShutdown, defaultBlock },
      deepWorkTargets: { dailyHours: parseFloat(dailyHours)||4, weeklyHours: parseFloat(weeklyHours)||20 },
    }));
    onClose();
  };

  const timeOpts = [];
  for (let h = 5; h <= 12; h++) timeOpts.push({ val: String(h), label: `${h > 12 ? h-12 : h}:00 ${h >= 12 ? "PM" : "AM"}` });

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Today Settings</div>
        <div className="sheet-scroll">

          <div className="set-section">Greeting</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 6 }}>Your name (shown in greeting)</div>
            <input className="set-input" placeholder="e.g. Tabb" value={name} onChange={e => setName(e.target.value)} />
            {name.trim() && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>Preview: Good morning, {name.trim()}.</div>}
          </div>

          <div className="set-section">Default First Block</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 6 }}>Start time for your first block of the day</div>
            <select className="form-select" value={defaultBlock} onChange={e => setDefault(e.target.value)}>
              {timeOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>

          <div className="set-section">Deep Work Targets</div>
          <div style={{ display:"flex", gap:12, marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Daily target (hours)</div>
              <input className="set-input" type="number" min="1" max="12" step="0.5" value={dailyHours} onChange={e => setDailyHours(e.target.value)} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Weekly target (hours)</div>
              <input className="set-input" type="number" min="1" max="60" step="1" value={weeklyHours} onChange={e => setWeeklyHours(e.target.value)} />
            </div>
          </div>

          <div className="set-section">Shutdown Ritual</div>
          <div className="set-row">
            <div>
              <div className="set-row-label">Show Shutdown Ritual</div>
              <div className="set-row-sub">Displays end-of-day ritual on Today tab</div>
            </div>
            <div className={`toggle-pill ${showShutdown ? "on" : ""}`} onClick={() => setShowSD(v => !v)}>
              <div className="toggle-knob" />
            </div>
          </div>

          <button className="form-btn" style={{ marginTop: 20 }} onClick={save}>Save</button>
        </div>
      </div>
    </>
  );
}

// ─── PROJECTS MANAGE SHEET ───────────────────────────────────────────────────
function ProjectsManageSheet({ data, setData, onClose }) {
  const swipe = useSwipeDown(onClose);
  const { domains, projects } = data;
  const COLORS = ["#5B8AF0","#9B72CF","#45C17A","#E8A030","#E05555","#38BDF8","#F472B6","#A3E635","#FB923C","#94A3B8"];

  // ── Categories state ──
  const [catEdits, setCatEdits] = useState(domains.map(d => ({ ...d })));
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLORS[0]);

  // ── New project state ──
  const [newProjName, setNewProjName] = useState("");
  const [newProjDomain, setNewProjDomain] = useState(domains[0]?.id || "");
  const [newProjColor, setNewProjColor] = useState("");

  // ── Project edits ──
  const [projEdits, setProjEdits] = useState(projects.map(p => ({ id: p.id, name: p.name, domainId: p.domainId })));

  const updateCat = (id, field, val) => setCatEdits(cs => cs.map(c => c.id === id ? { ...c, [field]: val } : c));

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name || catEdits.length >= 4) return;
    const newCat = { id: uid(), name, color: newCatColor };
    setCatEdits(cs => [...cs, newCat]);
    setNewCatName("");
  };

  const removeCat = (id) => setCatEdits(cs => cs.filter(c => c.id !== id));

  const addProject = () => {
    const name = newProjName.trim();
    if (!name || !newProjDomain) return;
    const newP = { id: uid(), domainId: newProjDomain, name, status: "active", tasks: [] };
    setData(d => ({ ...d, projects: [...d.projects, newP] }));
    setNewProjName("");
  };

  const updateProjEdit = (id, field, val) => setProjEdits(ps => ps.map(p => p.id === id ? { ...p, [field]: val } : p));

  const saveAll = () => {
    setData(d => ({
      ...d,
      domains: catEdits,
      projects: d.projects.map(p => {
        const edit = projEdits.find(e => e.id === p.id);
        return edit ? { ...p, name: edit.name, domainId: edit.domainId } : p;
      })
    }));
    onClose();
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Manage Projects</div>
        <div className="sheet-scroll">

          {/* ── CATEGORIES ── */}
          <div className="set-section">Categories</div>
          {catEdits.map(c => (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ width:12, height:12, borderRadius:"50%", background:c.color, flexShrink:0 }} />
                <input className="pm-proj-name" style={{ flex:1 }} value={c.name} onChange={e => updateCat(c.id,"name",e.target.value)} />
                <button style={{ background:"none", border:"none", color:"var(--red)", fontSize:16, cursor:"pointer", padding:"0 4px" }} onClick={() => removeCat(c.id)}>✕</button>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingLeft:20 }}>
                {COLORS.map(col => (
                  <div key={col} onClick={() => updateCat(c.id,"color",col)}
                    style={{ width:22, height:22, borderRadius:"50%", background:col, cursor:"pointer", border: c.color===col ? "2px solid #fff" : "2px solid transparent", transform: c.color===col ? "scale(1.2)" : "scale(1)", transition:"transform .1s" }} />
                ))}
              </div>
            </div>
          ))}
          {catEdits.length < 4 && (
            <div style={{ marginTop:8, background:"var(--bg3)", borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Add Category</div>
              <input className="set-input" placeholder="Category name…" value={newCatName} onChange={e => setNewCatName(e.target.value)} style={{ marginBottom:8 }} />
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                {COLORS.map(col => (
                  <div key={col} onClick={() => setNewCatColor(col)}
                    style={{ width:22, height:22, borderRadius:"50%", background:col, cursor:"pointer", border: newCatColor===col ? "2px solid #fff" : "2px solid transparent" }} />
                ))}
              </div>
              <button className="form-btn" style={{ marginTop:0 }} disabled={!newCatName.trim()} onClick={addCategory}>Add Category</button>
            </div>
          )}

          {/* ── ADD PROJECT ── */}
          <div className="set-section" style={{ marginTop:20 }}>Add New Project</div>
          <div style={{ background:"var(--bg3)", borderRadius:10, padding:"10px 12px" }}>
            <input className="set-input" placeholder="Project name…" value={newProjName} onChange={e => setNewProjName(e.target.value)} style={{ marginBottom:8 }} />
            <select className="form-select" value={newProjDomain} onChange={e => setNewProjDomain(e.target.value)} style={{ marginBottom:8 }}>
              {catEdits.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="form-btn" style={{ marginTop:0 }} disabled={!newProjName.trim()} onClick={addProject}>Add Project</button>
          </div>

          {/* ── EDIT EXISTING PROJECTS ── */}
          <div className="set-section" style={{ marginTop:20 }}>Edit Projects</div>
          {projEdits.map(pe => {
            const dom = catEdits.find(c => c.id === pe.domainId);
            return (
              <div key={pe.id} className="pm-proj-row">
                <div className="pm-proj-swatch" style={{ background: dom?.color }} />
                <input className="pm-proj-name" value={pe.name} onChange={e => updateProjEdit(pe.id,"name",e.target.value)} />
                <select style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:7, padding:"5px 8px", color:"var(--text)", fontFamily:"'DM Sans',sans-serif", fontSize:12, outline:"none" }}
                  value={pe.domainId} onChange={e => updateProjEdit(pe.id,"domainId",e.target.value)}>
                  {catEdits.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            );
          })}

          <button className="form-btn" style={{ marginTop:20 }} onClick={saveAll}>Save All Changes</button>
        </div>
      </div>
    </>
  );
}

// ─── INBOX SWIPE ROW ─────────────────────────────────────────────────────────
// swipe right → mark done (add to project as completed task)
// swipe left  → delete from inbox
function InboxSwipeRow({ item, projects, domains, onCategorize, onDismiss, defaultProjectId }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(null);
  const THRESHOLD = 72;
  const MAX = 90;

  const direction = offset > 0 ? "right" : offset < 0 ? "left" : null;
  const revealed  = Math.abs(offset) >= THRESHOLD;

  const onTouchStart = e => { startX.current = e.touches[0].clientX; };
  const onTouchMove  = e => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    setOffset(Math.max(-MAX, Math.min(MAX, dx)));
  };
  const onTouchEnd = () => {
    if (offset > THRESHOLD)  { onCategorize(item.id, defaultProjectId, true); return; }
    if (offset < -THRESHOLD) { onDismiss(item.id); return; }
    setOffset(0);
    startX.current = null;
  };

  const [selectedProject, setSelectedProject] = useState(defaultProjectId || "");

  return (
    <div className="inbox-swipe-wrap">
      {/* Left bg: complete */}
      <div className="inbox-action-left" onClick={() => onCategorize(item.id, selectedProject || defaultProjectId, true)}>
        <span className="inbox-action-ico">✓</span>
        <span className="inbox-action-lbl">Done</span>
      </div>
      {/* Right bg: delete */}
      <div className="inbox-action-right" onClick={() => onDismiss(item.id)}>
        <span className="inbox-action-ico">✕</span>
        <span className="inbox-action-lbl">Delete</span>
      </div>
      {/* Swipeable card */}
      <div
        className="inbox-item"
        style={{ transform: `translateX(${offset}px)`,
          transition: startX.current === null ? "transform .2s ease, box-shadow .15s" : "box-shadow .1s",
          boxShadow: offset > 20 ? `0 0 0 1.5px ${offset > THRESHOLD ? "var(--green)" : "rgba(69,193,122,.3)"}` :
                     offset < -20 ? `0 0 0 1.5px ${offset < -THRESHOLD ? "var(--red)" : "rgba(224,85,85,.3)"}` : "none"
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {offset > 20  && <div style={{ fontSize:11, color:"var(--green)", fontWeight:700, letterSpacing:".05em", textTransform:"uppercase", marginBottom:6, opacity: Math.min(1, offset/THRESHOLD) }}>→ Mark as done</div>}
        {offset < -20 && <div style={{ fontSize:11, color:"var(--red)", fontWeight:700, letterSpacing:".05em", textTransform:"uppercase", marginBottom:6, opacity: Math.min(1, -offset/THRESHOLD) }}>← Delete</div>}
        <div className="ii-text">{item.text}</div>
        <div className="ii-label">Assign to project</div>
        <select className="ii-select" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
          <option value="">— choose a project —</option>
          {domains.map(d => (
            <optgroup key={d.id} label={d.name}>
              {projects.filter(p=>p.domainId===d.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          ))}
        </select>
        <div className="ii-actions">
          <button className="ii-save" disabled={!selectedProject} onClick={() => selectedProject && onCategorize(item.id, selectedProject, false)}>Add to Project</button>
          <button className="ii-dismiss" onClick={() => onDismiss(item.id)}>Dismiss</button>
        </div>
        <div style={{ fontSize:11, color:"var(--text3)", marginTop:8, textAlign:"center", opacity:.5 }}>
          Swipe → done · Swipe ← delete
        </div>
      </div>
    </div>
  );
}

function CategorizeSheet({ data, onClose, onCategorize, onDismiss }) {
  const swipe = useSwipeDown(onClose);
  const { inbox, projects, domains } = data;
  if (!inbox.length) return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Inbox</div>
        <div className="inbox-empty">✓ Nothing left to categorize</div>
      </div>
    </>
  );
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Categorize</div>
        <div className="sheet-sub">{inbox.length} item{inbox.length!==1?"s":""} waiting</div>
        <div className="sheet-scroll">
          {inbox.map(item => (
            <InboxSwipeRow
              key={item.id}
              item={item}
              projects={projects}
              domains={domains}
              defaultProjectId={projects.find(p=>p.status==="active")?.id || projects[0]?.id || ""}
              onCategorize={onCategorize}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:"today",    ico:"◉", lbl:"Today"    },
  { id:"projects", ico:"▦", lbl:"Projects" },
  { id:"plan",     ico:"⬚", lbl:"Week"     },
  { id:"season", ico:"◎", lbl:"Season" },
];

// ── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendLink = async () => {
    if (!email.trim()) return;
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  };

  const f = "'DM Sans',sans-serif";

  return (
    <div style={{ position:"fixed", inset:0, display:"flex", flexDirection:"column", background:"#101213", fontFamily:f }}>
      {/* Top section — branding */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 32px" }}>
        <div style={{ fontSize:36, fontWeight:700, color:"#fff", letterSpacing:"-.02em", marginBottom:10 }}>Clearwork</div>
        <div style={{ fontSize:14, color:"#555", textAlign:"center", lineHeight:1.6, maxWidth:240 }}>The Productivity App that makes you love getting things done</div>
      </div>

      {/* Bottom section — form */}
      <div style={{ padding:"28px 24px 52px", borderTop:"1px solid #1E2122" }}>
        <div style={{ maxWidth:340, margin:"0 auto" }}>
          {!sent ? (
            <>
              <div style={{ fontSize:12, color:"#666", marginBottom:8, textTransform:"uppercase", letterSpacing:".06em" }}>Sign in with your email</div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendLink()}
                placeholder="you@example.com"
                style={{ width:"100%", padding:"14px 16px", background:"#1E2122", border:"1px solid #2C3032", borderRadius:12, color:"#fff", fontSize:15, fontFamily:f, outline:"none", marginBottom:10, display:"block", boxSizing:"border-box" }}
                autoFocus
              />
              {error && <div style={{ fontSize:12, color:"#E05555", marginBottom:8 }}>{error}</div>}
              <button
                onClick={sendLink}
                disabled={loading}
                style={{ width:"100%", padding:"15px", background:"#E8A030", color:"#000", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:f, transition:"opacity .15s", opacity: loading ? .6 : 1 }}
              >
                {loading ? "Sending…" : "Send Link"}
              </button>
            </>
          ) : (
            <div style={{ textAlign:"center", padding:"8px 0" }}>
              <div style={{ fontSize:40, marginBottom:14 }}>📬</div>
              <div style={{ fontSize:17, fontWeight:700, color:"#fff", marginBottom:8 }}>Check Your Inbox</div>
              <div style={{ fontSize:13, color:"#888", lineHeight:1.6, marginBottom:24 }}>We sent a magic link to<br/><span style={{color:"#ccc", fontWeight:600}}>{email}</span></div>
              <button onClick={() => setSent(false)} style={{ width:"100%", padding:"15px", background:"#E8A030", color:"#000", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:f }}>Use a different email</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id || null;
  const [data, setData] = useData(userId);
  const [tab, setTab] = useState("today");
  const [sheet, setSheet] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [lightMode, setLightMode] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === "light"; } catch { return false; }
  });
  const toggleTheme = () => setLightMode(v => {
    const next = !v;
    try { localStorage.setItem(THEME_KEY, next ? "light" : "dark"); } catch {}
    return next;
  });

  // Show loading while Supabase checks session
  if (session === undefined) {
    return (
      <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background:"#101213" }}>
        <div style={{ width:32, height:32, border:"3px solid #333", borderTop:"3px solid #E8A030", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!session) return <LoginScreen />;

  const closeSheet = () => setSheet(null);

  const handleAddBlock = b => setData(d => ({ ...d, blocks: [...d.blocks, b] }));
  const handleAddRoutine = r => setData(d => ({ ...d, routineBlocks: [...(d.routineBlocks||[]), r] }));
  const handleQuickAdd = item => setData(d => ({ ...d, inbox: [...(d.inbox||[]), item] }));
  const handleCategorize = (itemId, projectId, markDone = false) => setData(d => {
    const item = d.inbox.find(i => i.id===itemId);
    if (!item || !projectId) return d;
    return { ...d, inbox: d.inbox.filter(i=>i.id!==itemId), projects: d.projects.map(p => p.id===projectId ? { ...p, tasks: [...p.tasks,{id:uid(),text:item.text,done:markDone}] } : p) };
  });
  const handleDismissInbox = itemId => setData(d => ({ ...d, inbox: d.inbox.filter(i=>i.id!==itemId) }));

  return (
    <>
      <style>{css}</style>
      <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background: lightMode ? "#E8E4DE" : "#101213" }}>
        <div className={`phone ${lightMode ? "light" : ""}`}>
          {tab==="today"    && <TodayScreen    data={data} setData={setData} openShutdown={()=>setSheet("shutdown")} openAddBlock={()=>setSheet("addblock")} focusMode={focusMode} setFocusMode={setFocusMode} onSignOut={() => supabase.auth.signOut()} />}
          {tab==="projects" && <ProjectsScreen data={data} setData={setData} openCategorize={()=>setSheet("categorize")} />}
          {tab==="plan"     && <PlanScreen     data={data} setData={setData} openAddBlock={()=>setSheet("addblock")} onGoToSeason={()=>setTab("season")} lightMode={lightMode} toggleTheme={toggleTheme} />}
          {tab==="season"  && <SeasonScreen   data={data} setData={setData} />}

          {sheet==="shutdown"  && <ShutdownSheet    onClose={closeSheet} onComplete={()=>setData(d=>({...d,shutdownDone:true}))} alreadyDone={data.shutdownDone} data={data} onAddBlock={b=>setData(d=>({...d,blocks:[...d.blocks,b]}))} />}
          {sheet==="addblock"  && <AddBlockSheet    data={data} onClose={closeSheet} onAdd={handleAddBlock} onAddRoutine={handleAddRoutine} />}

          {sheet==="categorize"&& <CategorizeSheet  data={data} onClose={closeSheet} onCategorize={handleCategorize} onDismiss={handleDismissInbox} />}

          {!focusMode && captureOpen && (
            <QuickReminders
              onClose={() => setCaptureOpen(false)}
              onAddAll={handleQuickAdd}
            />
          )}

          <div className="nav" style={{ display: focusMode ? "none" : undefined }}>
            {/* Today + Projects */}
            {NAV_ITEMS.slice(0,2).map(n => (
              <div key={n.id} className={`nav-btn ${tab===n.id?"on":""}`} onClick={()=>setTab(n.id)}>
                {n.id === "projects" && data.inbox.length > 0 && <span className="nav-dot" />}
                <span className="nav-ico">{n.ico}</span>
                <span className="nav-lbl">{n.lbl}</span>
              </div>
            ))}

            {/* Center FAB */}
            <button
              className={`fab${captureOpen ? " open" : ""}`}
              onClick={() => setCaptureOpen(v => !v)}
            >
              {captureOpen
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              }
            </button>

            {/* Week + Season */}
            {NAV_ITEMS.slice(2).map(n => (
              <div key={n.id} className={`nav-btn ${tab===n.id?"on":""}`} onClick={()=>setTab(n.id)}>
                <span className="nav-ico">{n.ico}</span>
                <span className="nav-lbl">{n.lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
