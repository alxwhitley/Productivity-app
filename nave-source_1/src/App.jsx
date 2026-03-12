import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

// 5 colors mapped to Huberman's psychology of motivation:
// Blue=deep focus, Amber=drive/dopamine, Green=completion/recovery, Purple=identity/seasons, Slate=neutral/admin
const DOMAIN_COLORS = ["#5B8AF0","#E8A030","#45C17A","#9B72CF","#8A9BB0"];

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
  blocks: [],
  inbox: [],
  looseTasks: [], // [{id, domainId, text, done, doneAt}]
  weekIntention: "Ship Podcast episode. At least one Freelance deliverable. Get Church Social Media unblocked.",
  shutdownDone: false,
  shutdownDate: null,
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

// Returns "YYYY-MM-DD" for a given Date (or today if omitted)
function toISODate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
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

const SCHEMA_VERSION = 3;
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
  todayPrefs:     { name:"", showShutdown:true, defaultBlock:"9", hideTimes:false },
  blockCompletions: [], // [{ blockId, date, durationMin }] — "I did this" / Done logs
  deepWorkTargets: { dailyHours: 4, weeklyHours: 20, maxDeepBlocks: 3 }, // user-configurable
  deepWorkSlots: {}, // { [dateStr]: [{ projectId, startHour, startMin, durationMin, todayTasks }] }
  todayLoosePicks: {}, // { [dateStr]: [looseTaskId, ...] } — tasks picked for today's loose block
  onboardingDone: false,
  sessionLog: [], // [{ id, projectId, date, durationMin, note }]
  captured: [], // [{ id, text, createdAt }] — raw unprocessed brain-dump items
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
  // v2: clear todayTasks from all DW slots (force re-pick; old code set all tasks)
  {
    version: 2,
    up: (data) => {
      const deepWorkSlots = data.deepWorkSlots || {};
      const cleared = {};
      for (const [date, slots] of Object.entries(deepWorkSlots)) {
        cleared[date] = slots.map(s => s ? { ...s, todayTasks: null } : s);
      }
      return { ...data, deepWorkSlots: cleared, schemaVersion: 2 };
    }
  },
  // v3: add mode field to all existing projects, initialize sessionLog
  {
    version: 3,
    up: (data) => ({
      ...data,
      projects: (data.projects || []).map(p => ({ mode: "tasks", ...p })),
      sessionLog: data.sessionLog || [],
      schemaVersion: 3,
    })
  },
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
  /* Prevent iOS Safari zoom on input focus — font-size must be >= 16px */
  input,textarea,select{font-size:16px !important;}
  /* Visual compensation: scale text down visually where needed without triggering zoom */
  input.small-input,textarea.small-input,select.small-input{transform-origin:left center;}
  :root{
    --bg:#161514;--bg2:#1E1C1A;--bg3:#252220;--bg4:#2C2926;
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
  .light .now-block,.light .card,.light .week-card,.light .cov-card,.light .dw-card,.light .stat-box,.light .intention-card,.light .season-hero,.light .sg-card,.light .season-pull-card,.light .loose-zone{background:var(--bg2);} .light .loose-section{background:var(--bg2);}
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
  .sh{padding:16px 20px 6px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
  .sh-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);padding-left:8px;border-left:2px solid var(--border2);}
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
  .t-check.bouncing{animation:check-bounce .35s cubic-bezier(.22,.68,0,1.4) forwards;}
  .st-wrap.flash{animation:task-flash .4s ease forwards;}
  .t-text{font-size:14px;color:var(--text);line-height:1.4;}
  .t-text.done{color:var(--text3);text-decoration:line-through;}
  /* TIMELINE */
  .tl-wrap{margin:0;padding:0 16px 0 0;display:flex;flex-direction:column;gap:0;}
  .tl-item{display:flex;gap:10px;position:relative;padding-right:16px;align-items:flex-start;}
  .tl-left{display:flex;flex-direction:column;align-items:center;width:56px;flex-shrink:0;padding-left:12px;}
  .tl-connector-top{width:1px;height:18px;background:var(--border2);flex-shrink:0;}
  .tl-pill{font-size:9px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;padding:3px 6px;cursor:pointer;background:var(--pill-bg,var(--bg3));color:var(--pill-color,var(--text3));border:none;border-radius:20px;font-family:'DM Sans',sans-serif;text-align:center;transition:all .15s;-webkit-tap-highlight-color:transparent;letter-spacing:.02em;flex-shrink:0;}
  .tl-pill.static{cursor:default;}
  .tl-connector{width:1px;flex:1;min-height:8px;background:var(--border2);}

  .tl-swipe-action-btn.swap{background:var(--accent);color:#000;}
  .tl-swipe-action-btn.tomorrow{background:var(--bg4);color:var(--text);}
  .tl-swipe-action-lbl{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;}
  .tl-swipe-action-ico{font-size:16px;line-height:1;}
  .tl-swipe-card{position:relative;z-index:1;transition:transform .3s cubic-bezier(.25,.46,.45,.94);will-change:transform;background:var(--bg2);border-radius:14px;width:100%;}
  .tl-swipe-card.swiping{transition:none;}
  /* Deep Work Slots */
  .dw-empty{width:100%;background:transparent;border:1.5px dashed rgba(255,255,255,.14);border-radius:14px;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:border-color .2s,background .2s,color .2s;font-family:"DM Sans",sans-serif;min-height:44px;}
  .dw-empty:active{background:rgba(255,255,255,.03);}
  .dw-empty.is-open{background:rgba(232,160,48,.08);border-color:rgba(232,160,48,.5);border-style:solid;}
  .dw-empty.is-open .dw-empty-label{color:var(--accent);}
  .dw-empty.is-open .dw-empty-sub{color:rgba(232,160,48,.5);}
  .dw-empty.is-open .dw-plus{color:var(--accent);}
  .dw-plus{width:22px;height:22px;border-radius:50%;border:1.5px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.35);font-size:14px;font-weight:300;flex-shrink:0;}
  .dw-empty-label{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:1px;}
  .dw-empty-sub{font-size:12px;color:rgba(255,255,255,.18);}
  .dw-empty-dur{font-size:11px;color:rgba(255,255,255,.18);margin-left:auto;flex-shrink:0;}
  .dw-picker-wrap{background:var(--bg3);border:1.5px dashed rgba(255,255,255,.14);border-top:none;border-radius:0 0 14px 14px;overflow:hidden;}
  .dw-picker-sect{padding:10px 10px 6px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);}
  .dw-proj-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px 6px 8px;max-height:240px;overflow-y:auto;overscroll-behavior:contain;}
  .dw-proj-row{display:flex;align-items:center;gap:8px;padding:9px 10px;cursor:pointer;border-radius:10px;background:var(--bg4);}
  .dw-proj-row:active{background:var(--border);}
  .dw-proj-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .dw-proj-name{font-size:13px;color:var(--text);flex:1;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .dw-proj-domain{font-size:10px;color:var(--text3);}
  .dw-confirm-wrap{padding:12px;}
  .dw-time-row{display:flex;gap:8px;margin-bottom:12px;}
  .dw-time-sel{flex:1;background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:9px 10px;color:var(--text);font-family:"DM Sans",sans-serif;font-size:16px;outline:none;appearance:none;}
  .dw-confirm-btn{width:100%;background:var(--accent);color:#000;border:none;border-radius:10px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:"DM Sans",sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;}
  .dw-back{background:none;border:none;color:var(--text3);font-size:12px;cursor:pointer;font-family:"DM Sans",sans-serif;padding:8px 0 0;display:block;width:100%;text-align:center;}
  .tl-swap-panel{background:var(--bg3);border-radius:0 0 14px 14px;padding:8px;display:flex;flex-direction:column;gap:1px;border-top:1px solid var(--border);}
  .tl-drag-handle{width:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:grab;opacity:.35;flex-shrink:0;padding:14px 0;}
  .tl-drag-handle:active{cursor:grabbing;opacity:.7;}
  .tl-drag-handle span{display:block;width:14px;height:2px;background:var(--text3);border-radius:2px;}
  .tl-item.dragging{opacity:.4;border:1px dashed var(--border);}
  .tl-item.drag-over{border-top:2px solid var(--accent);}
  /* No-times mode */
  .tl-wrap.no-times{padding:0 16px;}
  .today-plan-mode{background:rgba(232,160,48,.045);transition:background .6s ease;}
  .today-work-mode{background:#12151F;transition:background .6s ease;}
  .today-plan-mode .screen,.today-plan-mode{--bg:#181A1B;}
  .today-work-mode .ph-eye{color:var(--blue)!important;}
  .plan-block-row{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg2);border-radius:14px;margin:0 16px 8px;border:1px solid var(--border);cursor:pointer;transition:border-color .15s,background .15s;}
  .plan-block-row:active{background:var(--bg3);}
  .plan-block-row.assigned{border-color:var(--domain-color,var(--border));}
  .begin-btn{display:block;width:calc(100% - 32px);margin:16px 16px 8px;padding:16px;background:var(--accent);color:#000;border:none;border-radius:16px;font-size:16px;font-weight:800;font-family:"DM Sans",sans-serif;letter-spacing:.01em;cursor:pointer;transition:transform .1s,opacity .1s;}
  .begin-btn:active{transform:scale(.98);opacity:.9;}
  .work-hero{margin:0 16px 12px;background:var(--bg2);border-radius:20px;overflow:hidden;border:1px solid var(--border);}
  .work-hero.has-domain{border-color:var(--domain-color,var(--border));}
  .work-next-strip{margin:0 16px 8px;display:flex;flex-direction:column;gap:6px;}
  .work-next-card{background:var(--bg2);border-radius:12px;padding:11px 14px;border:1px solid var(--border);display:flex;align-items:center;gap:10;}
  .earlier-link{text-align:center;padding:8px 0 4px;font-size:12px;color:var(--text3);font-weight:600;cursor:pointer;font-family:"DM Sans",sans-serif;letter-spacing:.02em;}
  .replan-btn{background:none;border:none;font-size:11px;color:var(--text3);font-weight:600;cursor:pointer;font-family:"DM Sans",sans-serif;padding:0;letter-spacing:.03em;}
  .tl-wrap.no-times .tl-item{padding-right:0;gap:0;}
  .tl-wrap.no-times .tl-left{display:none;}
  .tl-wrap.no-times .tl-item+.tl-item{margin-top:8px;}

  .tl-card{width:100%;background:var(--bg2);border-radius:14px;overflow:hidden;transition:opacity .2s,border-color .2s,box-shadow .2s,transform .25s;}
  .tl-card.done-card{opacity:.32;filter:saturate(0.1);}
  .tl-card.missed-card{border:1px solid var(--domain-color,rgba(255,255,255,.1));box-shadow:0 0 14px var(--domain-color,transparent);}
  .tl-card.now-card{border:2px solid var(--domain-color,rgba(232,160,48,.7));box-shadow:0 0 0 4px var(--domain-color,rgba(232,160,48,.08)),0 0 40px var(--domain-color,rgba(232,160,48,.2));transform:scale(1.018);transform-origin:center top;background:var(--bg2);animation:now-pulse 3s ease-in-out infinite;}
  @keyframes now-pulse{0%,100%{box-shadow:0 0 0 4px var(--domain-color,rgba(232,160,48,.08)),0 0 40px var(--domain-color,rgba(232,160,48,.2));}50%{box-shadow:0 0 0 6px var(--domain-color,rgba(232,160,48,.14)),0 0 55px var(--domain-color,rgba(232,160,48,.28));}}
  .tl-card.active-card{border:1px solid rgba(232,160,48,.25);box-shadow:0 0 24px rgba(232,160,48,.09);}
  .tl-card.upcoming-card{border:1px solid var(--domain-color,rgba(255,255,255,.08));box-shadow:0 0 14px var(--domain-color,transparent);}
  /* Routine pill card */
  .tl-card.routine-pill{background:var(--bg3);border-radius:22px;border:1px solid var(--border2);}
  .tl-card.routine-pill.now-card{border:1.5px solid rgba(232,160,48,.4);box-shadow:0 0 12px rgba(232,160,48,.1);transform:none;}
  .tl-card.routine-pill.done-card{opacity:.32;filter:saturate(0.1);}
  .tl-check-icon.missed{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .tl-card-head{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;}
  .tl-stripe{width:3px;border-radius:2px;align-self:stretch;min-height:28px;flex-shrink:0;}
  .tl-info{flex:1;min-width:0;}
  .tl-name{font-size:15px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .tl-meta{font-size:11px;color:var(--text3);margin-top:2px;}
  .tl-dur{font-size:11px;font-weight:500;background:var(--bg3);color:var(--text3);padding:3px 8px;border-radius:6px;white-space:nowrap;flex-shrink:0;}
  .tl-prime-pill{font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:20px;background:rgba(232,160,48,.12);color:var(--accent);border:1px solid rgba(232,160,48,.25);flex-shrink:0;white-space:nowrap;}
  .tl-now-pill{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:rgba(232,160,48,.15);color:var(--accent);border:1px solid rgba(232,160,48,.3);padding:2px 7px;border-radius:20px;flex-shrink:0;}
  .tl-tasks{border-top:1px solid var(--border2);padding:10px 14px 14px 14px;}
  .tl-task-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-radius:8px;transition:background .2s;}
  .tl-task-row.next-action{background:rgba(232,160,48,.07);border-left:2px solid var(--accent);padding-left:8px;margin-left:-2px;}
  .tl-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
  .tl-check.done{background:var(--green);border-color:var(--green);}
  .tl-check.bouncing{animation:check-bounce .35s cubic-bezier(.22,.68,0,1.4) forwards;}
  @keyframes check-bounce{0%{transform:scale(0);opacity:0;}60%{transform:scale(1.4);}100%{transform:scale(1);opacity:1;}}
  .tl-task-row.flash{animation:task-flash .4s ease forwards;}
  @keyframes task-flash{0%{background:rgba(69,193,122,.18);}100%{background:transparent;}}
  .tl-task-txt{font-size:13px;color:var(--text);flex:1;}
  .tl-task-txt.done{text-decoration:line-through;opacity:.45;}
  .tl-add-task{display:flex;gap:8px;margin-top:6px;padding-top:8px;border-top:1px solid var(--border2);}
  .tl-add-input{flex:1;background:var(--bg3);border:none;border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
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
  .tl-time-btn{font-size:9px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;padding:3px 6px;cursor:pointer;background:var(--pill-bg,var(--bg3));color:var(--pill-color,var(--text3));border:none;border-radius:20px;font-family:'DM Sans',sans-serif;text-align:center;transition:all .15s;-webkit-tap-highlight-color:transparent;letter-spacing:.02em;}
  .tl-time-btn:hover,.tl-time-btn.open{filter:brightness(1.3);}
  .tl-time{font-size:9px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;padding:3px 6px;background:var(--bg3);color:var(--text3);border-radius:20px;text-align:center;letter-spacing:.02em;}
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
  .picker-input{flex:1;background:var(--bg3);border:none;border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
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
  .today-clock{font-size:26px;font-weight:700;color:var(--text);letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1;}
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
  .loose-zone{margin:0 16px 10px;min-height:72px;border-radius:14px;display:flex;flex-direction:column;position:relative;background:var(--bg2);border:1px solid var(--border2);}
  .loose-empty{flex:1;min-height:72px;display:flex;align-items:center;justify-content:center;color:var(--text3);opacity:.35;}
  .loose-split-bar{display:flex;min-height:56px;border-radius:14px;overflow:hidden;}
  .loose-split-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;color:var(--text3);font-size:13px;font-weight:500;opacity:.45;transition:opacity .15s,background .15s;border:none;background:none;font-family:'DM Sans',sans-serif;}
  .loose-split-btn:active{opacity:.9;background:var(--bg3);}
  .loose-split-divider{width:1px;background:var(--border2);align-self:stretch;margin:10px 0;flex-shrink:0;}
  .loose-tasks-list{display:flex;flex-direction:column;}
  .loose-add-inline{padding:10px 14px 4px;}
  .loose-inline-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);padding:6px 2px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
  .loose-inline-input::placeholder{color:var(--text3);}
  .loose-add-more{display:flex;align-items:center;gap:6px;padding:8px 14px 12px;color:var(--text3);font-size:12px;cursor:pointer;opacity:.5;}
  .loose-add-more:active{opacity:1;}
  .loose-section{margin:0 16px 10px;background:var(--bg2);border-radius:14px;overflow:hidden;border:1px solid var(--border2);}
  .loose-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;}
  .loose-title{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);padding-left:8px;border-left:2px solid var(--border2);}
  .loose-count{font-size:11px;color:var(--text3);background:var(--bg3);border-radius:20px;padding:2px 8px;}
  .loose-task-row{display:flex;align-items:center;gap:10px;padding:11px 16px;border-top:1px solid var(--border2);cursor:pointer;position:relative;}
  .loose-task-row:hover{background:var(--bg3);}
  .loose-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:transparent;transition:all .15s;}
  .loose-check.done{background:var(--green);border-color:var(--green);color:#fff;}
  .loose-task-text{flex:1;font-size:13px;color:var(--text);line-height:1.4;}
  .loose-task-text.done{color:var(--text3);text-decoration:line-through;}
  .loose-assign-btn{font-size:11px;color:var(--text3);background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:3px 9px;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;flex-shrink:0;}
  .loose-add-row{display:flex;align-items:center;gap:8px;padding:8px 16px 12px;border-top:1px solid var(--border2);}
  .loose-add-input{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
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
  .proj-bar-wrap{height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin-bottom:6px;}
  .proj-bar-fill{height:100%;border-radius:2px;transition:width .5s cubic-bezier(.4,0,.2,1);}
  .proj-card-meta{display:flex;justify-content:space-between;}
  /* Session mode */
  .proj-session-bar-wrap{height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin-bottom:6px;}
  .proj-session-bar-fill{height:100%;border-radius:2px;opacity:0.7;transition:width .5s cubic-bezier(.4,0,.2,1);}
  .proj-session-log{padding:8px 0 2px;}
  .proj-session-log-item{display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid var(--border2);}
  .proj-session-log-item:last-child{border-bottom:none;}
  .proj-session-log-note{font-size:12px;color:var(--text2);flex:1;line-height:1.4;}
  .proj-session-log-meta{font-size:10px;color:var(--text3);white-space:nowrap;padding-top:1px;}
  .session-focus-input{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--text);font-family:'DM Sans',sans-serif;outline:none;resize:none;box-sizing:border-box;line-height:1.4;}
  .session-focus-input:focus{border-color:var(--accent);}
  .session-focus-note{font-size:12px;color:var(--text3);font-style:italic;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
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
  .proj-edit-input{flex:1;background:var(--bg3);border:1.5px solid var(--accent);border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;font-weight:600;outline:none;}
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
  .set-input{background:var(--bg3);border:1.5px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;width:100%;margin-top:6px;}
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
  .st-edit-input{flex:1;background:var(--bg3);border:1.5px solid var(--accent);border-radius:8px;padding:4px 8px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;line-height:1.4;}

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
  .gear-btn-inline{background:none;border:none;cursor:pointer;padding:4px 6px;color:var(--text3);line-height:1;border-radius:8px;flex-shrink:0;transition:color .15s,transform .25s ease;}
  .gear-btn-inline:hover{color:var(--text2);}
  .gear-btn-inline.open{color:var(--text2);transform:rotate(45deg);}
  .blk-mgmt-panel{overflow:hidden;max-height:0;transition:max-height .3s cubic-bezier(.4,0,.2,1),opacity .22s ease;opacity:0;}
  .blk-mgmt-panel.open{max-height:420px;opacity:1;}
  .blk-mgmt-inner{border-top:1px solid var(--border2);padding:3px 0;}
  .blk-mgmt-proj-list{max-height:220px;overflow-y:auto;overscroll-behavior:contain;}
  .blk-mgmt-row{display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:none;border:none;width:100%;font-family:'DM Sans',sans-serif;transition:background .12s;}
  .blk-mgmt-row:hover{background:rgba(255,255,255,.04);}
  .blk-mgmt-row-ico{width:18px;display:flex;align-items:center;justify-content:center;color:var(--text3);flex-shrink:0;}
  .blk-mgmt-row-txt{font-size:14px;color:var(--text2);font-weight:500;}
  .blk-mgmt-row.danger .blk-mgmt-row-ico{color:var(--red);}
  .blk-mgmt-row.danger .blk-mgmt-row-txt{color:var(--red);}
  .blk-mgmt-row.sub-item{padding-left:24px;}
  .blk-mgmt-divider{height:1px;background:var(--border2);margin:2px 14px;}
  .add-domain-btn{width:100%;background:var(--bg3);border:1.5px dashed var(--border);border-radius:12px;padding:12px;color:var(--text3);font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:8px;}

  /* ── PLAN ── */
  .intention-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;padding:16px 18px;}
  .ic-text{font-size:14px;color:var(--text2);line-height:1.65;}
  .ic-edit{font-size:12px;color:var(--accent);font-weight:500;margin-top:10px;cursor:pointer;background:none;border:none;display:block;}
  .intent-textarea{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;line-height:1.6;resize:none;margin-top:10px;outline:none;}
  .intent-save{margin-top:8px;background:var(--accent);color:#000;border:none;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}


  /* WEEK PLAN CARDS */
  .week-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;overflow:hidden;border:1px solid var(--border2);transition:opacity .2s;}
  .week-card.past-day{opacity:0.55;}
  .week-card.today-card{border-color:rgba(232,160,48,0.3);}
  .wc-head{padding:13px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border2);}
  .today-card .wc-head{background:rgba(232,160,48,0.05);}
  .wc-day{font-size:14px;font-weight:600;color:var(--text);}
  .wc-day.today{color:var(--accent);}
  .wc-date{font-size:12px;color:var(--text3);}

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
  .ww-slot-select{background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;appearance:none;}
  .plan-gear{background:none;border:none;color:var(--text3);cursor:pointer;padding:6px;line-height:0;opacity:.7;border-radius:8px;transition:opacity .15s,background .15s;}

  /* ASSIGN BLOCK SHEET coach card */
  .coach-card{background:rgba(232,160,48,0.07);border:1px solid rgba(232,160,48,0.2);border-radius:12px;padding:12px 14px;margin-bottom:14px;}
  .coach-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:4px;}
  .coach-body{font-size:13px;color:var(--text2);line-height:1.55;}

  /* BLOCK INLINE EDIT */
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
  .add-goal-input{flex:1;min-width:0;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
  .add-goal-domain{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;appearance:none;}
  .add-goal-btn{background:var(--accent);color:#000;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .season-divider{margin:8px 16px 4px;display:flex;align-items:center;gap:10px;}
  .sdiv-line{flex:1;height:1px;background:var(--border2);}
  .sdiv-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);}
  /* ── NAV ── */
  .nav{flex-shrink:0;height:78px;background:var(--bg);border-top:1px solid var(--border2);display:flex;align-items:flex-end;padding-bottom:10px;position:relative;z-index:25;overflow:visible;}
  .nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;padding-top:10px;}
  .nav-ico{width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:var(--text3);transition:color .15s;}
  .nav-ico svg{width:24px;height:24px;display:block;color:inherit;}
  .nav-lbl{font-size:10px;font-weight:500;letter-spacing:.04em;color:var(--text3);text-transform:uppercase;transition:color .15s;}
  .nav-btn.on .nav-ico,.nav-btn.on .nav-lbl{color:var(--accent);}
  .nav-dot{position:absolute;top:8px;right:calc(50% - 14px);width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px rgba(232,160,48,.6);}
  .nav-dot.urgent{background:var(--red);box-shadow:0 0 8px rgba(224,85,85,.7);animation:dot-pulse 1.5s ease-in-out infinite;}
  @keyframes dot-pulse{0%,100%{box-shadow:0 0 8px rgba(224,85,85,.7);}50%{box-shadow:0 0 14px rgba(224,85,85,.9);}}
  @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.65)}}
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
  .form-select,.form-input{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;appearance:none;}
  .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .form-btn{width:100%;background:var(--accent);color:#000;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:6px;}

  /* ADD TASK */
  .add-task-tap{min-height:36px;cursor:pointer;}
  .add-task-tap:active{background:var(--bg3);}
  .add-task-inline{display:flex;align-items:center;border-top:1px solid var(--border2);padding:0 14px;}
  .add-task-inline-input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;padding:10px 0;}
  .add-task-inline-input::placeholder{color:var(--text3);}
  /* keep old classes for TodayScreen usage */
  .add-task-row{display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--border2);}
  .add-task-input{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:9px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
  .add-task-input::placeholder{color:var(--text3);}
  .add-task-btn{background:var(--accent);color:#000;border:none;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}

  /* INBOX */
  .inbox-banner{margin:0 16px 10px;background:var(--accent);border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;}
  .ib-icon{font-size:18px;flex-shrink:0;}
  .ib-info{flex:1;}
  .ib-title{font-size:14px;font-weight:700;color:#000;line-height:1.2;}
  .ib-sub{font-size:12px;color:rgba(0,0,0,.6);margin-top:2px;}
  .ib-arrow{font-size:18px;color:rgba(0,0,0,.5);}
  .reminder-card{margin:0 16px 8px;background:rgba(232,160,48,.12);border:1px solid rgba(232,160,48,.35);border-radius:14px;padding:13px 16px;display:flex;align-items:flex-start;gap:10px;}
  .reminder-card-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:5px;}
  .reminder-card-text{flex:1;font-size:14px;color:var(--text);font-weight:500;line-height:1.4;}
  .reminder-card-assign{background:var(--accent);color:#000;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;flex-shrink:0;}
  .reminder-section-label{margin:0 16px 6px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);opacity:.8;}
  .inbox-swipe-wrap{position:relative;overflow:hidden;border-radius:12px;margin-bottom:8px;}
  .inbox-action-left{position:absolute;left:0;top:0;bottom:0;width:90px;background:var(--green);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;border-radius:12px;}
  .inbox-action-right{position:absolute;right:0;top:0;bottom:0;width:90px;background:var(--red);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;border-radius:12px;}
  .inbox-action-lbl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;}
  .inbox-action-ico{font-size:18px;line-height:1;}
  .inbox-item{background:var(--bg3);border-radius:12px;padding:14px 16px;position:relative;z-index:1;}
  .ii-text{font-size:14px;color:var(--text);font-weight:500;margin-bottom:10px;}
  .ii-label{font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;}
  .ii-select{width:100%;background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;appearance:none;margin-bottom:8px;}
  .ii-actions{display:flex;gap:8px;}
  .ii-save{flex:1;background:var(--accent);color:#000;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .ii-save:disabled{opacity:.4;cursor:not-allowed;}
  .ii-dismiss{background:var(--bg4);color:var(--text3);border:none;border-radius:8px;padding:9px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .inbox-empty{text-align:center;padding:30px 0;color:var(--text3);font-size:14px;}

  /* ── Block completion celebration ── */
  .block-celebrate{position:relative;padding:18px 0 14px;display:flex;flex-direction:column;align-items:center;gap:6px;overflow:hidden;}
  .block-celebrate-burst{position:relative;height:40px;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;}
  .celebrate-particle{font-size:16px;display:inline-block;animation:celebrate-pop .7s cubic-bezier(.22,.68,0,1.2) calc(var(--i) * 60ms) both;}
  @keyframes celebrate-pop{0%{transform:scale(0) translateY(8px);opacity:0;}60%{transform:scale(1.3) translateY(-4px);opacity:1;}100%{transform:scale(1) translateY(0);opacity:1;}}
  .block-celebrate-label{font-size:13px;font-weight:700;letter-spacing:.04em;color:var(--green);animation:fade-up .4s ease .3s both;}
  @keyframes fade-up{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}

  /* ── Inbox aging badges ── */
  .reminder-card-age{font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:10px;flex-shrink:0;margin-top:3px;}
  .reminder-card-age.age-fresh{background:rgba(69,193,122,.15);color:var(--green);}
  .reminder-card-age.age-warn{background:rgba(232,160,48,.15);color:var(--accent);}
  .reminder-card-age.age-old{background:rgba(224,85,85,.15);color:var(--red);}


  /* QUICK REMINDERS MODAL */
  /* ── Capture panel ── */
  .cap-backdrop{position:absolute;inset:0;z-index:24;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);}
  .cap-panel{position:absolute;left:0;right:0;bottom:0;background:var(--bg2);border-radius:24px 24px 0 0;z-index:25;display:flex;flex-direction:column;height:75vh;animation:sheet-up .22s cubic-bezier(.4,0,.2,1);box-shadow:0 -4px 40px rgba(0,0,0,.5);}
  .cap-handle-row{display:flex;justify-content:center;padding-top:10px;flex-shrink:0;}
  .cap-handle{width:36px;height:4px;border-radius:2px;background:var(--border);}
  .cap-header{display:flex;align-items:center;justify-content:space-between;padding:10px 20px 12px;flex-shrink:0;border-bottom:1px solid var(--border2);}
  .cap-title{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
  .cap-close{background:none;border:none;cursor:pointer;padding:4px;color:var(--text3);display:flex;align-items:center;justify-content:center;}
  .cap-items{max-height:40%;overflow-y:auto;padding:6px 18px 4px;flex-shrink:0;}
  .cap-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border2);}
  .cap-item-dot{width:5px;height:5px;border-radius:50%;background:var(--text3);flex-shrink:0;margin-top:7px;}
  .cap-item-text{flex:1;font-size:15px;color:var(--text);line-height:1.4;}
  .cap-textarea-row{padding:10px 18px 6px;flex:1;display:flex;flex-direction:column;}
  .cap-textarea{width:100%;background:transparent;border:none;outline:none;resize:none;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;line-height:1.55;box-sizing:border-box;min-height:52px;flex:1;}
  .cap-textarea::placeholder{color:var(--text3);}
  .cap-footer{padding:8px 18px 28px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .cap-count{font-size:12px;color:var(--text3);}
  .cap-done-btn{background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:7px 18px;font-size:13px;font-weight:700;color:var(--text2);cursor:pointer;font-family:'DM Sans',sans-serif;}
  /* legacy qr classes kept for safety */
  .qr-backdrop{position:absolute;inset:0;z-index:24;background:rgba(0,0,0,.6);backdrop-filter:blur(2px);}
  .qr-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(100% - 40px);max-width:340px;background:var(--bg2);border-radius:20px;box-shadow:0 16px 48px rgba(0,0,0,.6);z-index:25;overflow:hidden;animation:qr-in .2s cubic-bezier(.34,1.3,.64,1);}
  @keyframes qr-in{from{opacity:0;transform:translate(-50%,-46%) scale(.94);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}
  .qr-header{padding:16px 18px 10px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
  .qr-items{max-height:260px;overflow-y:auto;}
  .qr-item{display:flex;align-items:center;gap:6px;padding:9px 12px 9px 18px;border-bottom:1px solid var(--border2);}
  .qr-item-text{flex:1;font-size:14px;color:var(--text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .qr-item-input{flex:1;background:transparent;border:none;outline:none;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text);min-width:0;padding:0;}
  .qr-pill{flex-shrink:0;padding:4px 9px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.03em;cursor:pointer;border:1.5px solid transparent;transition:all .12s;font-family:'DM Sans',sans-serif;line-height:1.4;}
  .qr-pill-today{border-color:rgba(232,160,48,.3);color:rgba(232,160,48,.45);background:transparent;}
  .qr-pill-today.active{background:var(--accent-s);border-color:var(--accent);color:var(--accent);}
  .qr-pill-later{border-color:rgba(255,255,255,.1);color:rgba(255,255,255,.25);background:transparent;}
  .qr-pill-later.active{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.3);color:var(--text2);}
  .qr-input-row{display:flex;align-items:center;padding:10px 18px 14px;}
  .qr-input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;}
  .qr-input::placeholder{color:var(--text3);}


  /* FAB */
  .fab{width:50px;height:50px;border-radius:50%;background:var(--accent);border:none;color:#000;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;bottom:28px;z-index:26;flex-shrink:0;transition:transform .15s,background .15s;font-family:'DM Sans',sans-serif;box-shadow:0 2px 16px rgba(0,0,0,.3);}
  .fab.open{background:var(--accent);filter:brightness(1.1);transform:scale(1.05);}
  .fab:active{transform:scale(.93);}
  .capture-input{width:100%;background:var(--bg3);border:1.5px solid var(--accent);border-radius:12px;padding:14px 16px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;margin-bottom:14px;}
  .capture-input::placeholder{color:var(--text3);}
  .capture-btn{width:100%;background:var(--accent);color:#000;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .capture-hint{font-size:12px;color:var(--text3);text-align:center;margin-top:10px;}

  .spacer{height:16px;}
`;

// ─── STATUS BAR (no time) ─────────────────────────────────────────────────────
// ─── ONBOARDING FLOW ──────────────────────────────────────────────────────────
const ONBOARDING_CARDS = [
  {
    eyebrow: "Welcome to Clearwork",
    headline: "Built on two\nbig ideas.",
    body: "Clearwork isn't a to-do app. It's a system built around how your brain actually works — drawing on the research of Cal Newport and Andrew Huberman.",
    accent: "#E8A030",
    illustration: "welcome",
  },
  {
    eyebrow: "Cal Newport · Deep Work",
    headline: "Your best thinking needs\nprotected time.",
    body: "Shallow tasks — email, admin, quick replies — expand to fill whatever time you give them. Deep Work blocks carve out uninterrupted 60–90 minute windows for the work that actually moves things forward.",
    accent: "#5B8AF0",
    illustration: "deepwork",
  },
  {
    eyebrow: "Task Fatigue",
    headline: "A long list is\ndemotivating by design.",
    body: "Seeing 40 tasks creates decision paralysis before you've started. Clearwork keeps tasks inside projects, projects inside domains — and Today only shows what's actually scheduled. The rest is out of sight until you need it.",
    accent: "#45C17A",
    illustration: "tasks",
  },
  {
    eyebrow: "Cal Newport · Seasons",
    headline: "Big goals need\na longer horizon.",
    body: "Weeks are too short for meaningful progress. Clearwork uses a quarterly Season — up to 4 goals that define what this chapter is actually about. Everything else is in service of those.",
    accent: "#9B72CF",
    illustration: "season",
  },
  {
    eyebrow: "Newport + Huberman · Shutdown",
    headline: "Ending work deliberately\nprotects your recovery.",
    body: "Without a clear stop signal, your brain keeps processing work problems into the evening. The Shutdown Ritual is a deliberate cognitive closure — a signal that the workday is done and recovery can begin.",
    accent: "#4BAABB",
    illustration: "shutdown",
  },
];

function OnboardingIllustration({ type, accent }) {
  if (type === "welcome") return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="48" stroke={accent} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.3"/>
      <circle cx="60" cy="60" r="32" stroke={accent} strokeWidth="1.5" opacity="0.5"/>
      <circle cx="60" cy="60" r="14" fill={accent} opacity="0.9"/>
      <path d="M60 12V24M60 96V108M12 60H24M96 60H108" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
    </svg>
  );
  if (type === "deepwork") return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {/* Timeline blocks */}
      <rect x="16" y="30" width="88" height="14" rx="4" fill={accent} opacity="0.15" stroke={accent} strokeWidth="1.5"/>
      <rect x="16" y="53" width="56" height="28" rx="6" fill={accent} opacity="0.9"/>
      <rect x="16" y="53" width="4" height="28" rx="2" fill="#fff" opacity="0.5"/>
      <text x="26" y="63" fill="#000" fontSize="8" fontWeight="700" opacity="0.8">DEEP WORK</text>
      <text x="26" y="74" fill="#000" fontSize="7" opacity="0.7">90 min · no interruptions</text>
      <rect x="16" y="90" width="36" height="10" rx="3" fill={accent} opacity="0.2" stroke={accent} strokeWidth="1"/>
      <rect x="58" y="90" width="46" height="10" rx="3" fill={accent} opacity="0.1" stroke={accent} strokeWidth="1" strokeDasharray="3 2"/>
    </svg>
  );
  if (type === "tasks") return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {/* Long overwhelming list (faded) */}
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x="16" y={18 + i*10} width={60 - i*4} height="6" rx="3" fill="#666" opacity={0.12 + i*0.02}/>
      ))}
      {/* Arrow */}
      <path d="M88 60L76 54V58H64V62H76V66L88 60Z" fill={accent} opacity="0.7"/>
      {/* Clean structured view */}
      <rect x="92" y="30" width="12" height="12" rx="3" fill="#5B8AF0" opacity="0.8"/>
      <rect x="92" y="47" width="12" height="12" rx="3" fill="#9B72CF" opacity="0.8"/>
      <rect x="92" y="64" width="12" height="12" rx="3" fill={accent} opacity="0.8"/>
      <rect x="106" y="33" width="8" height="2.5" rx="1.5" fill="#fff" opacity="0.4"/>
      <rect x="106" y="37" width="5" height="2" rx="1" fill="#fff" opacity="0.25"/>
      <rect x="106" y="50" width="8" height="2.5" rx="1.5" fill="#fff" opacity="0.4"/>
      <rect x="106" y="54" width="6" height="2" rx="1" fill="#fff" opacity="0.25"/>
      <rect x="106" y="67" width="8" height="2.5" rx="1.5" fill="#fff" opacity="0.4"/>
    </svg>
  );
  if (type === "season") return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {/* Quarter arc */}
      <path d="M60 20 A40 40 0 0 1 100 60" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.3"/>
      <path d="M60 20 A40 40 0 0 1 100 60" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeDasharray="0 100" opacity="0"/>
      <circle cx="60" cy="20" r="4" fill={accent} opacity="0.5"/>
      <circle cx="100" cy="60" r="4" fill={accent} opacity="0.5"/>
      {/* Goal rows */}
      {[0,1,2,3].map(i => (
        <g key={i}>
          <circle cx="28" cy={52 + i*14} r="4" stroke={accent} strokeWidth="1.5" fill={i < 2 ? accent : "none"} opacity="0.8"/>
          <rect x="38" y={49 + i*14} width={i===0?52:i===1?40:44} height="6" rx="3" fill={accent} opacity={i < 2 ? 0.4 : 0.15}/>
        </g>
      ))}
    </svg>
  );
  if (type === "shutdown") return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {/* Power symbol */}
      <path d="M60 28V52" stroke={accent} strokeWidth="3" strokeLinecap="round"/>
      <path d="M44 38 A26 26 0 1 0 76 38" stroke={accent} strokeWidth="3" strokeLinecap="round" fill="none"/>
      {/* Check marks below */}
      <rect x="24" y="80" width="72" height="22" rx="6" fill={accent} opacity="0.12" stroke={accent} strokeWidth="1" strokeDasharray="3 2"/>
      <path d="M34 91l5 5 9-9" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="52" y="88" width="36" height="3" rx="1.5" fill={accent} opacity="0.35"/>
      <rect x="52" y="93" width="24" height="3" rx="1.5" fill={accent} opacity="0.2"/>
    </svg>
  );
  return null;
}

function OnboardingFlow({ onDone }) {
  const [card, setCard] = useState(0);
  const [animDir, setAnimDir] = useState(null); // "in" | null
  const touchStartX = useRef(null);
  const total = ONBOARDING_CARDS.length;
  const current = ONBOARDING_CARDS[card];

  const advance = (dir = 1) => {
    const next = card + dir;
    if (next < 0) return;
    if (next >= total) { onDone(); return; }
    setAnimDir("out");
    setTimeout(() => {
      setCard(next);
      setAnimDir("in");
      setTimeout(() => setAnimDir(null), 280);
    }, 180);
  };

  const onTouchStart = e => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = e => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx < -44) advance(1);
    else if (dx > 44) advance(-1);
  };

  const slideStyle = {
    transform: animDir === "out" ? "translateX(-32px)" : animDir === "in" ? "translateX(16px)" : "translateX(0)",
    opacity: animDir === "out" ? 0 : animDir === "in" ? 0 : 1,
    transition: animDir === "out" ? "transform .18s ease-in, opacity .18s ease-in" : animDir === "in" ? "none" : "transform .28s cubic-bezier(.2,.8,.4,1), opacity .28s ease-out",
  };

  return (
    <div
      style={{ position:"absolute", inset:0, zIndex:200, background:"var(--bg)", display:"flex", flexDirection:"column", borderRadius:"inherit", overflow:"hidden" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <StatusBar />

      {/* Skip */}
      <div style={{ display:"flex", justifyContent:"flex-end", padding:"8px 20px 0" }}>
        <button onClick={onDone} style={{ background:"none", border:"none", color:"var(--text3)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"4px 0" }}>
          Skip
        </button>
      </div>

      {/* Card content */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 32px 16px", ...slideStyle }}>

        {/* Illustration */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:32 }}>
          <OnboardingIllustration type={current.illustration} accent={current.accent} />
        </div>

        {/* Eyebrow */}
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:current.accent, marginBottom:10 }}>
          {current.eyebrow}
        </div>

        {/* Headline */}
        <div style={{ fontSize:28, fontWeight:800, color:"var(--text)", lineHeight:1.15, letterSpacing:"-.02em", marginBottom:16, whiteSpace:"pre-line" }}>
          {current.headline}
        </div>

        {/* Body */}
        <div style={{ fontSize:15, color:"var(--text2)", lineHeight:1.6, fontWeight:400 }}>
          {current.body}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ padding:"0 28px 36px", display:"flex", flexDirection:"column", gap:20 }}>

        {/* Progress dots */}
        <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
          {ONBOARDING_CARDS.map((_, i) => (
            <div key={i} style={{
              width: i === card ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === card ? current.accent : "var(--border)",
              transition: "width .25s cubic-bezier(.4,0,.2,1), background .25s",
            }} />
          ))}
        </div>

        {/* Next / Let's go button */}
        <button
          onClick={() => advance(1)}
          style={{
            width:"100%",
            padding:"15px",
            background: current.accent,
            color: "#000",
            border:"none",
            borderRadius:14,
            fontSize:16,
            fontWeight:800,
            cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",
            letterSpacing:"-.01em",
          }}
        >
          {card === total - 1 ? "Let's go →" : "Next →"}
        </button>
      </div>
    </div>
  );
}

// ─── SHARED ICONS ─────────────────────────────────────────────────────────────

function NavIcon({ id, active }) {
  // Bold, simple shapes — readable at 22px. All use currentColor.
  if (id === "today") return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Clock — thick stroke, large hands */}
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 8v4.5l3 1.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (id === "projects") return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 2×2 grid — large rounded squares with clear gaps */}
      <rect x="3" y="3" width="8" height="8" rx="2.5" stroke="currentColor" strokeWidth="2"/>
      <rect x="13" y="3" width="8" height="8" rx="2.5" stroke="currentColor" strokeWidth="2"/>
      <rect x="3" y="13" width="8" height="8" rx="2.5" stroke="currentColor" strokeWidth="2"/>
      <rect x="13" y="13" width="8" height="8" rx="2.5" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
  if (id === "plan") return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Calendar — clean, no internal dots (too small to read) */}
      <rect x="3" y="6" width="18" height="15" rx="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 11h18" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 3v5M16 3v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
  if (id === "season") return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sun — larger core, only 4 rays (diagonal look cleaner at small size) */}
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M5.6 5.6L7.4 7.4M16.6 16.6L18.4 18.4M18.4 5.6L16.6 7.4M7.4 16.6L5.6 18.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  return null;
}

function WaveIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}>
      <path d="M2 12c1.5-4 3-6 4.5-6S9 9 10.5 12s3 6 4.5 6 3-3 4.5-6 3-6 4.5-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function GearIcon({ size = 17, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.36.07-.72.07-1.08s-.03-.73-.07-1.08l2.32-1.82c.21-.16.27-.46.13-.7l-2.2-3.81a.55.55 0 0 0-.67-.24l-2.74 1.1c-.57-.44-1.18-.81-1.86-1.08l-.42-2.9A.55.55 0 0 0 14 2h-4a.55.55 0 0 0-.54.46l-.42 2.9c-.68.27-1.3.64-1.86 1.08L4.44 5.35a.54.54 0 0 0-.67.24L1.57 9.4c-.14.24-.08.54.13.7l2.32 1.82C3.98 12.27 3.95 12.63 3.95 13s.03.73.07 1.08L1.7 15.9c-.21.16-.27.46-.13.7l2.2 3.81c.13.24.43.32.67.24l2.74-1.1c.57.44 1.18.81 1.86 1.08l.42 2.9c.08.28.29.47.54.47h4c.25 0 .46-.19.54-.46l.42-2.9c.68-.27 1.3-.64 1.86-1.08l2.74 1.1c.24.09.54 0 .67-.24l2.2-3.81c.14-.24.08-.54-.13-.7l-2.32-1.82Z" fill={color}/>
    </svg>
  );
}

function StatusBar() {
  return (
    <div className="status">
      
    </div>
  );
}


// ─── TODAY SCREEN ─────────────────────────────────────────────────────────────
function TodayScreen({ data, setData, openShutdown, onSignOut, jumpToBlock, onClearJump }) {
  const [showTodaySettings, setShowTodaySettings] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [celebratingId, setCelebratingId] = useState(null);
  const [recentlyChecked, setRecentlyChecked] = useState(new Set()); // taskIds with bounce animation
  const [blockMenuOpen, setBlockMenuOpen] = useState(null); // blockId with gear menu open
  const [blockMenuMode, setBlockMenuMode] = useState(null); // null | "project"
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const swipeState = useRef({});
  const [revealedBlockId, setRevealedBlockId] = useState(null); // unused visually but guards close-on-drag
  const [dwPickerOpen, setDwPickerOpen] = useState(null); // slotId of open picker
  const [dwPickerStep, setDwPickerStep] = useState({}); // { [slotId]: "project" | "confirm" }
  const [dwPickerProj, setDwPickerProj] = useState({}); // { [slotId]: projectId }
  const [dwPickerTime, setDwPickerTime] = useState({}); // { [slotId]: { startHour, startMin, durationMin } }
  const [workMode, setWorkMode] = useState(false); // false=Plan, true=Work
  const [earlierOpen, setEarlierOpen] = useState(false); // "Earlier today" disclosure


  const rescheduleToTomorrow = (blockId) => {
    setData(d => ({ ...d, blocks: d.blocks.map(b => b.id === blockId ? { ...b, dayOffset: (b.dayOffset || 0) + 1 } : b) }));
    setRevealedBlockId(null);
  };

  // ── DW slot mutation helper — all slot saves go through this ──────────────
  const mutateDWSlot = (dateStr, slotIndex, patch) => {
    setData(prev => {
      const existing = [...((prev.deepWorkSlots || {})[dateStr] || [])];
      while (existing.length <= slotIndex) existing.push({});
      existing[slotIndex] = patch === null ? {} : { ...existing[slotIndex], ...patch };
      return { ...prev, deepWorkSlots: { ...(prev.deepWorkSlots || {}), [dateStr]: existing } };
    });
  };

  const saveDWSlot = (slotId, slotIndex, projectId, startHour, startMin, durationMin, todayTasks) =>
    mutateDWSlot(viewDateKeyISO, slotIndex, { projectId, startHour, startMin, durationMin, todayTasks: todayTasks || null });

  const clearDWSlot = (slotIndex) =>
    mutateDWSlot(viewDateKeyISO, slotIndex, null);

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
      const newBlocks = blocks.map(b => {
        if (b.id === dragId) return { ...b, startHour: toBlk.startHour, startMin: toBlk.startMin };
        if (b.id === targetId) return { ...b, startHour: fromBlk.startHour, startMin: fromBlk.startMin };
        return b;
      });
      return { ...d, blocks: newBlocks };
    });
    setDragId(null); setDragOverId(null);
  };

  const [newTaskText, setNewTaskText] = useState({});
  const [tick, setTick] = useState(0);
  const [viewingTomorrow, setViewingTomorrow] = useState(false);
  // lateStarted: { [slotId]: { startedAt: ms, accumulatedMs: number, paused: bool, pausedAt: ms|null } }
  const [lateStarted, setLateStarted] = useState({});

  // Get elapsed ms for a slot (handles running + paused states)
  const getElapsedMs = (info) => {
    if (!info) return 0;
    const accumulated = info.accumulatedMs || 0;
    if (info.paused) return accumulated;
    return accumulated + (Date.now() - (info.startedAt || Date.now()));
  };

  // Start or resume timer
  const startTimerSlot = (slotId) => {
    setLateStarted(prev => {
      const existing = prev[slotId];
      return { ...prev, [slotId]: {
        startedAt: Date.now(),
        accumulatedMs: existing?.accumulatedMs || 0,
        paused: false,
        pausedAt: null,
      }};
    });
  };

  // Pause timer — freeze elapsed, keep accumulated
  const pauseTimerSlot = (slotId) => {
    setLateStarted(prev => {
      const info = prev[slotId];
      if (!info || info.paused) return prev;
      const accumulated = (info.accumulatedMs || 0) + (Date.now() - info.startedAt);
      return { ...prev, [slotId]: { ...info, paused: true, pausedAt: Date.now(), accumulatedMs: accumulated } };
    });
  };

  // Done: log elapsed time (even if running — snapshot now), mark complete, clear timer
  const doneTimer = (slot, proj) => {
    const info = lateStarted[slot.id];
    const elapsedMs = getElapsedMs(info);
    const elapsedMin = Math.round(elapsedMs / 60000);
    if (elapsedMin > 0) logSession(proj.id, elapsedMin, null);
    markManualDone(slot.id, proj.id, slot.todayTasks);
    setLateStarted(prev => { const n = { ...prev }; delete n[slot.id]; return n; });
  };

  // Reset: clear timer entirely without saving
  const resetTimer = (slotId) => {
    setLateStarted(prev => { const n = { ...prev }; delete n[slotId]; return n; });
  };


  const [conflictWarning, setConflictWarning] = useState(null); // blockId with conflict

  // pickerState: { blockId, projectId, selected: Set<taskId>, newText }
  const [pickerState, setPickerState] = useState(null);
  const [dwAddingTask, setDwAddingTask] = useState(null); // slotId currently adding task
  const [dwNewTaskText, setDwNewTaskText] = useState("");
  const [editingDwTaskId, setEditingDwTaskId] = useState(null); // taskId being edited inline
  const [editingDwTaskText, setEditingDwTaskText] = useState("");
  const [dwOverflowOpen, setDwOverflowOpen] = useState(null); // slotId with overflow menu open
  const [editingTaskId, setEditingTaskId] = useState(null); // { taskId, projectId, text }
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
  // looseQuickAdd: inline quick-add input state
  const [looseQuickDraft, setLooseQuickDraft] = useState("");
  const [looseEditId, setLooseEditId] = useState(null);
  const [looseEditText, setLooseEditText] = useState("");
  const { domains, projects, blocks, shutdownDone } = data;



  // Live tick every second (powers clock + countdowns)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Reset shutdownDone each new day
  useEffect(() => {
    const todayISO = toISODate();
    if (data.shutdownDone && data.shutdownDate !== todayISO) {
      setData(d => ({ ...d, shutdownDone: false, shutdownDate: todayISO }));
    }
  }, [data.shutdownDone, data.shutdownDate]);

  const now   = new Date();
  const today = new Date();
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const isAfter4 = now.getHours() >= 16;

  const getProject = id => projects.find(p => p.id === id);
  const getDomain  = id => domains.find(d => d.id === id);

  const toggleTask = (projectId, taskId) => {
    setData(d => ({
      ...d, projects: d.projects.map(p =>
        p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t) } : p
      )
    }));
    // Trigger bounce + flash on check (not uncheck)
    setRecentlyChecked(prev => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    setTimeout(() => setRecentlyChecked(prev => {
      const next = new Set(prev); next.delete(taskId); return next;
    }), 450);
  };

  const updateTaskText = (projectId, taskId, newText) => {
    if (!newText.trim()) return;
    setData(d => ({
      ...d, projects: d.projects.map(p =>
        p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, text: newText.trim() } : t) } : p
      )
    }));
    setEditingTaskId(null);
  };

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

  const rescheduleDWSlot = (slotIndex, newHour, newMin) => {
    mutateDWSlot(viewDateKeyISO, slotIndex, { startHour: newHour, startMin: newMin });
    setEditingTime(null);
  };

  const saveDWTodayTasks = (slotIndex, taskIds) =>
    mutateDWSlot(viewDateKeyISO, slotIndex, { todayTasks: taskIds.length > 0 ? taskIds : null });

  const saveDWSessionNote = (slotIndex, note) =>
    mutateDWSlot(viewDateKeyISO, slotIndex, { sessionNote: note || null });

  const logSession = (projectId, durationMin, note) => {
    setData(d => ({
      ...d,
      sessionLog: [...(d.sessionLog || []), {
        id: uid(),
        projectId,
        date: toISODate(),
        durationMin,
        note: note || "",
      }],
    }));
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
    // Show celebration burst, then collapse
    setCelebratingId(blockId);
    setTimeout(() => {
      setCelebratingId(null);
      setExpandedId(null);
    }, 1600);
  };

  // Add a brand-new task to project AND return its id so caller can also select it
  const addTaskToProject = (projectId, text) => {
    const newId = uid();
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { id: newId, text, done: false }] } : p) }));
    return newId;
  };

  const startBlock = (slotId) => {
    startTimerSlot(slotId);
    setExpandedId(slotId);
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

  const addLooseQuickTask = (text) => {
    const t = text.trim();
    if (!t) return;
    const newTask = { id: uid(), text: t, done: false, domainId: null, doneAt: null, createdAt: Date.now() };
    setData(d => ({
      ...d,
      looseTasks: [...(d.looseTasks||[]), newTask],
      todayLoosePicks: { ...(d.todayLoosePicks||{}), [todayDateStr]: [...((d.todayLoosePicks||{})[todayDateStr]||[]), newTask.id] },
    }));
    setLooseQuickDraft("");
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
  const dateKeyISO = toISODate(today);

  // Tomorrow date keys
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tomorrowDateKey = tomorrow.toDateString();
  const tomorrowDateKeyISO = toISODate(tomorrow);

  // Active view date (today or tomorrow)
  const viewDate = viewingTomorrow ? tomorrow : today;
  const viewDateKey = viewingTomorrow ? tomorrowDateKey : dateKey;
  const viewDateKeyISO = viewingTomorrow ? tomorrowDateKeyISO : dateKeyISO;

  // Build deep work slots for active view (today or tomorrow)
  const deepDefaults = getDeepSlots(data);
  const savedDWSlots = (data.deepWorkSlots || {})[viewDateKeyISO] || [];
  const maxDeepBlocks = data.deepWorkTargets?.maxDeepBlocks ?? 3;
  // For tomorrow: show all slots (don't hide past since nowMins doesn't apply)
  const viewBlocks = viewingTomorrow ? blocks.filter(b => b.dayOffset === 1) : todayBlocks;
  const viewRoutines = viewingTomorrow ? getRoutinesForDate(data.routineBlocks || [], tomorrow) : todayRoutines;

  // Always show exactly maxDeepBlocks slots — never filter past or empty cards
  // Rule of 3: always 3 cards visible regardless of time of day or completion status
  const todayDWSlots = Array.from({ length: maxDeepBlocks }, (_, i) => {
    const def = deepDefaults[i] || deepDefaults[deepDefaults.length - 1];
    const saved = savedDWSlots[i] || {};
    return ({
    id: `dw-${viewDateKeyISO}-${i}`,
    slotIndex: i,
    startHour: saved.startHour ?? def.startHour,
    startMin:  saved.startMin  ?? def.startMin,
    durationMin: saved.durationMin ?? def.durationMin,
    projectId:   saved.projectId || null,
    todayTasks:  saved.todayTasks || null,
  });
  });

  const timeline = [
    ...viewRoutines.map(r => ({ type: "routine", id: r.id, mins: r.startHour * 60 + r.startMin, data: r })),
    ...todayDWSlots.map(s => ({ type: "deepwork", id: s.id, mins: s.startHour * 60 + s.startMin, data: s })),
  ].sort((a, b) => a.mins - b.mins);

  // Find the "current" block — started and not yet ended
  const currentItem = timeline.find(item => {
    const endMins = item.mins + (item.data.durationMin || 60);
    return item.mins <= nowMins && nowMins < endMins;
  });

  // Auto-expand the current block so the user always sees what to do right now
  const lastAutoExpanded = useRef(null);
  useEffect(() => {
    if (currentItem && currentItem.id !== lastAutoExpanded.current) {
      setExpandedId(currentItem.id);
      lastAutoExpanded.current = currentItem.id;
    }
  }, [currentItem?.id]);

  // Jump to a specific block when navigating from Projects "Work Now"
  const scrollRef = useRef(null);
  const [tomorrowActive, setTomorrowActive] = useState(false);

  // Scroll DW slot button to near top of screen when picker opens
  useEffect(() => {
    if (!dwPickerOpen) return;
    setTimeout(() => {
      const btn = document.querySelector(`[data-dwslot="${dwPickerOpen}"]`);
      if (btn && scrollRef.current) {
        const scrollEl = scrollRef.current;
        const btnTop = btn.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
        scrollEl.scrollTo({ top: Math.max(0, btnTop - 80), behavior: "smooth" });
      }
    }, 30);
  }, [dwPickerOpen]);
  const tomorrowTimerRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (nearBottom) {
        if (!tomorrowTimerRef.current) {
          tomorrowTimerRef.current = setTimeout(() => setTomorrowActive(true), 600);
        }
      } else {
        clearTimeout(tomorrowTimerRef.current);
        tomorrowTimerRef.current = null;
        setTomorrowActive(false);
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => { el.removeEventListener("scroll", handleScroll); clearTimeout(tomorrowTimerRef.current); };
  }, []);
  useEffect(() => {
    if (!jumpToBlock) return;
    setExpandedId(jumpToBlock);
    // Scroll to the block after a short delay for render
    setTimeout(() => {
      const el = document.querySelector(`[data-blockid="${jumpToBlock}"]`);
      if (el && scrollRef.current) {
        const top = el.getBoundingClientRect().top - scrollRef.current.getBoundingClientRect().top + scrollRef.current.scrollTop - 20;
        scrollRef.current.scrollTo({ top, behavior: "smooth" });
      }
      onClearJump?.();
    }, 120);
  }, [jumpToBlock]);
  // Next upcoming
  const nextItem = timeline.find(item => item.mins > nowMins);

  // Clock display
  const clockH = now.getHours() > 12 ? now.getHours() - 12 : now.getHours() === 0 ? 12 : now.getHours();
  const clockM = now.getMinutes().toString().padStart(2, "0");
  const clockAmpm = now.getHours() >= 12 ? "PM" : "AM";

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const name = data.todayPrefs?.name;

  return (
    <div className="screen active" style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <StatusBar />

      {/* ── HEADER ── */}
      <div className="ph" style={{ paddingBottom:10, paddingTop:10, flexShrink:0 }}>
        {viewingTomorrow && (
          <button onClick={() => setViewingTomorrow(false)} style={{ background:"none", border:"none", cursor:"pointer", padding:"0 0 8px", display:"flex", alignItems:"center", gap:4, color:"var(--text3)", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Today
          </button>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
              {!viewingTomorrow
                ? <><span className="today-clock">{clockH}:{clockM}</span><span className="today-clock-ampm">{clockAmpm}</span></>
                : <span className="today-clock" style={{ fontSize:28 }}>Tomorrow</span>
              }
            </div>
            <div style={{ fontSize:13, color:"var(--text2)", marginTop:2, fontWeight:500 }}>
              {days[viewDate.getDay()]}, {months[viewDate.getMonth()]} {viewDate.getDate()}
            </div>
          </div>
          <button className="tab-gear" onClick={() => setShowTodaySettings(true)} onContextMenu={e => { e.preventDefault(); if(onSignOut) onSignOut(); }}><GearIcon size={20} /></button>
        </div>
        <div style={{ fontSize:12, color:"var(--text3)", marginTop:6 }}>
          {viewingTomorrow
            ? `${timeline.length} block${timeline.length !== 1 ? "s" : ""} planned`
            : `${greeting}${name ? `, ${name}` : ""}.`
          }
        </div>
      </div>

      {/* ── CARD STACK — fills remaining screen height ── */}
      {(() => {
        const dwItems = timeline.filter(i => i.type === "deepwork");
        const rtItems = timeline.filter(i => i.type === "routine");
        const allCards = [...timeline]; // routines + dw slots sorted by time

        if (allCards.length === 0) {
          return (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <div style={{ fontSize:13, color:"var(--text3)", textAlign:"center" }}>No blocks today.<br/>Add some in the Week tab.</div>
            </div>
          );
        }

        // Determine flex values: current gets 2.2, others get 1
        return (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
            {/* Tomorrow link — top-right of card stack */}
            <div style={{ display:"flex", justifyContent:"flex-end", padding:"0 14px 6px", flexShrink:0 }}>
              {!viewingTomorrow ? (
                <button onClick={() => setViewingTomorrow(true)}
                  style={{ background:"none", border:"none", fontSize:12, color:"var(--text3)", fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"2px 0", letterSpacing:".02em" }}>
                  Tomorrow →
                </button>
              ) : (
                <button onClick={() => setViewingTomorrow(false)}
                  style={{ background:"none", border:"none", fontSize:12, color:"var(--accent)", fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"2px 0", letterSpacing:".02em" }}>
                  ← Today
                </button>
              )}
            </div>
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8, padding:"0 12px 8px", overflow:"hidden", minHeight:0 }}>
            {allCards.map((item) => {
              const isPast = !viewingTomorrow && (item.mins + (item.data.durationMin || 60)) <= nowMins;
              const isNow  = !viewingTomorrow && currentItem?.id === item.id;
              const isExp  = expandedId === item.id;
              const flexVal = currentItem ? (isNow ? 2.2 : 0.8) : 1;

              // ── ROUTINE CARD ──
              if (item.type === "routine") {
                const rb = item.data;
                const comp = (rb.completions || {})[dateKey] || {};
                const doneCt = rb.tasks.filter(t => comp[t.id]).length;
                const allDone = rb.tasks.length > 0 && doneCt === rb.tasks.length;
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
                  <div key={rb.id} style={{ flex: isExp ? 3 : 0.85, minHeight:0, borderRadius:18, background: isExp ? "var(--bg2)" : "var(--bg2)", border: isExp ? "1.5px solid rgba(75,170,187,.5)" : isNow ? "1.5px solid rgba(75,170,187,.3)" : allDone ? "1px solid rgba(69,193,122,.2)" : "1px solid var(--border)", boxShadow: isExp ? "0 0 24px rgba(75,170,187,.15)" : "none", overflow:"hidden", display:"flex", flexDirection:"column", opacity: isPast && !allDone && !isExp ? 0.45 : 1, transition:"flex .35s cubic-bezier(.4,0,.2,1), opacity .2s, border-color .2s, box-shadow .2s", cursor:"pointer" }}
                    onClick={() => setExpandedId(isExp ? null : rb.id)}
                  >
                    {/* Collapsed header */}
                    <div style={{ padding: isExp ? "14px 16px 10px" : "14px 16px 12px", flex: isExp ? "none" : 1, display:"flex", alignItems:"flex-start", gap:12, minHeight:0 }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:"var(--teal)", flexShrink:0, opacity: allDone ? 0.4 : 1, marginTop:3 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize: isNow ? 17 : 14, fontWeight:700, color: allDone ? "var(--text3)" : "var(--text)", letterSpacing:"-.01em", lineHeight:1.2 }}>{rb.title}</div>
                        {!isExp && <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>{data.todayPrefs?.hideTimes ? "" : `${fmtTime(rb.startHour, rb.startMin)} · `}{rb.durationMin} min · {doneCt}/{rb.tasks.length} done</div>}
                      </div>
                      {allDone && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, color:"var(--text3)", opacity:.4, transform: isExp ? "rotate(90deg)" : "none", transition:"transform .2s" }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    {isExp && (
                      <div style={{ flex:1, overflowY:"auto", padding:"0 16px 14px" }}>
                        {rb.tasks.map((t, i) => (
                          <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 0", borderBottom: i < rb.tasks.length-1 ? "1px solid var(--border2)" : "none", cursor:"pointer" }}
                            onClick={e => { e.stopPropagation(); toggleRtTask(t.id); }}>
                            <div className={`tl-check ${comp[t.id] ? "done" : ""}`} style={{ width:20, height:20, flexShrink:0 }}>
                              {comp[t.id] && <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>}
                            </div>
                            <span className={`tl-task-txt ${comp[t.id] ? "done" : ""}`} style={{ fontSize:14 }}>{t.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // ── DEEP WORK CARD ──
              if (item.type === "deepwork") {
                const slot = item.data;
                const proj = slot.projectId ? getProject(slot.projectId) : null;
                const domain = proj ? getDomain(proj.domainId) : null;
                const domainColor = domain?.color || null;
                const isFilled = !!proj;
                const isPickerOpen = dwPickerOpen === slot.id;
                const pickerTime = dwPickerTime[slot.id] || { startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin };

                // Completion state
                const isSessionMode = proj?.mode === "sessions";
                const todayTaskIds = slot.todayTasks;
                const hasTodayTasks = Array.isArray(todayTaskIds) && todayTaskIds.length > 0;
                const relevantTasks = hasTodayTasks ? todayTaskIds.map(id => proj?.tasks.find(t => t.id === id)).filter(Boolean) : [];
                const relevantDone = relevantTasks.filter(t => t.done).length;
                const allTasksDone = isSessionMode ? manualCompleted.has(slot.id) : (relevantTasks.length > 0 && relevantDone === relevantTasks.length);
                const isCompleted = allTasksDone || manualCompleted.has(slot.id);

                const lateInfo = lateStarted[slot.id];
                const timerActive = !!lateInfo; // has been started at least once
                const isRunning = timerActive && !lateInfo.paused;
                const isPaused = timerActive && !!lateInfo.paused;
                const elapsedMs = getElapsedMs(lateInfo);
                const elapsedSec = Math.floor(elapsedMs / 1000);
                const elapsedM = Math.floor(elapsedSec / 60), elapsedS = elapsedSec % 60;
                const elapsedStr = `${String(elapsedM).padStart(2,"0")}:${String(elapsedS).padStart(2,"0")}`;
                const cdDone = false; // no auto-complete — user hits Done

                const isPicking = pickerState?.blockId === slot.id;

                const cardBg = "var(--bg2)";
                const cardBorder = isCompleted
                  ? "1px solid rgba(69,193,122,.25)"
                  : isNow && domainColor
                    ? `2px solid ${domainColor}90`
                    : domainColor
                      ? `1px solid ${domainColor}50`
                      : "1px solid var(--border)";
                const cardShadow = isNow && domainColor ? `0 0 32px ${domainColor}20` : "none";

                if (!isFilled) {
                  // ── UNASSIGNED CARD ──
                  const ptKey = slot.id;
                  const selProjId = dwPickerProj[ptKey] || null;
                  const selProj = selProjId ? data.projects.find(p => p.id === selProjId) : null;
                  const curTime = dwPickerTime[ptKey] || { startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin };
                  const curSelTasks = curTime._tasks !== undefined ? curTime._tasks : [];
                  const togglePT = (tid) => setDwPickerTime(s => {
                    const base = s[ptKey] || { startHour:slot.startHour, startMin:slot.startMin, durationMin:slot.durationMin };
                    const ex = base._tasks||[];
                    return { ...s, [ptKey]: { ...base, _tasks: ex.includes(tid) ? ex.filter(x=>x!==tid) : [...ex, tid] } };
                  });

                  return (
                    <div key={slot.id} data-blockid={slot.id} style={{ flex: isExp ? 3 : 0.6, minHeight:0, borderRadius:18, background: isExp ? "var(--bg2)" : "var(--bg2)", border: isExp ? "1.5px solid rgba(255,255,255,.18)" : "1.5px dashed rgba(255,255,255,.1)", overflow:"hidden", display:"flex", flexDirection:"column", opacity: 1, transition:"flex .35s cubic-bezier(.4,0,.2,1), border-color .2s", cursor:"pointer" }}
                      onClick={() => setExpandedId(isExp ? null : slot.id)}
                    >
                      {!isExp ? (
                        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:7, padding:"10px 14px" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="rgba(255,255,255,.18)" strokeWidth="2" strokeLinecap="round"/></svg>
                          <span style={{ fontSize:10, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"rgba(255,255,255,.15)", textAlign:"center" }}>Deep Work Block</span>
                        </div>
                      ) : (
                        <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }} onClick={e => e.stopPropagation()}>
                          {!selProjId ? (
                            /* ── STEP 1: 2-col project grid ── */
                            <>
                              <div style={{ fontSize:11, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--text3)", marginBottom:10 }}>Assign project</div>
                              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
                                {data.projects.filter(p => p.status === "active").map(p => {
                                  const d2 = data.domains?.find(d => d.id === p.domainId);
                                  const incomp = (p.tasks||[]).filter(t=>!t.done);
                                  return (
                                    <div key={p.id}
                                      onClick={() => { setDwPickerProj(s => ({ ...s, [ptKey]: p.id })); setDwPickerTime(s => ({ ...s, [ptKey]: { startHour:slot.startHour, startMin:slot.startMin, durationMin:slot.durationMin, _tasks:[] } })); }}
                                      style={{ borderRadius:11, background:"var(--bg3)", border:"1.5px solid var(--border2)", padding:"10px 12px", cursor:"pointer", display:"flex", flexDirection:"column", gap:4, transition:"border-color .15s, background .15s" }}>
                                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                                        <div style={{ width:8, height:8, borderRadius:"50%", background: d2?.color||"var(--text3)", flexShrink:0 }} />
                                        <span style={{ fontSize:13, fontWeight:700, color:"var(--text)", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
                                      </div>
                                      <div style={{ fontSize:11, color:"var(--text3)", paddingLeft:15 }}>{d2?.name}{incomp.length > 0 ? ` · ${incomp.length}t` : ""}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            /* ── STEP 2: task list for selected project ── */
                            (() => {
                              const sp = data.projects.find(p => p.id === selProjId);
                              const sd = data.domains?.find(d => d.id === sp?.domainId);
                              const incomp = (sp?.tasks||[]).filter(t=>!t.done);
                              const confirmAssign = () => {
                                const t = dwPickerTime[ptKey] || { startHour:slot.startHour, startMin:slot.startMin, durationMin:slot.durationMin };
                                const tasks = (t._tasks && t._tasks.length > 0) ? t._tasks : null;
                                saveDWSlot(slot.id, slot.slotIndex, selProjId, t.startHour, t.startMin, t.durationMin, tasks);
                                setExpandedId(null);
                                setDwPickerProj(s => { const n={...s}; delete n[ptKey]; return n; });
                                setDwPickerTime(s => { const n={...s}; delete n[ptKey]; return n; });
                              };
                              return (
                                <>
                                  {/* Back + project name header */}
                                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                                    <button onClick={() => setDwPickerProj(s => { const n={...s}; delete n[ptKey]; return n; })}
                                      style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer", padding:0, fontFamily:"'DM Sans',sans-serif", fontSize:12, display:"flex", alignItems:"center", gap:4, fontWeight:600 }}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                      Back
                                    </button>
                                    <div style={{ width:8, height:8, borderRadius:"50%", background: sd?.color||"var(--text3)", flexShrink:0 }} />
                                    <span style={{ fontSize:13, fontWeight:700, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sp?.name}</span>
                                  </div>
                                  {/* Task list */}
                                  {incomp.length > 0 ? (
                                    <>
                                      <div style={{ fontSize:11, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Pick focus tasks</div>
                                      {incomp.map(t => {
                                        const tSel = curSelTasks.includes(t.id);
                                        return (
                                          <div key={t.id} onClick={() => togglePT(t.id)}
                                            style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 4px", borderBottom:"1px solid var(--border2)", cursor:"pointer" }}>
                                            <div style={{ width:18, height:18, borderRadius:5, border: tSel ? "none" : "1.5px solid var(--border)", background: tSel ? (sd?.color||"var(--accent)") : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .12s" }}>
                                              {tSel && <span style={{ fontSize:9, color:"#000", fontWeight:800 }}>✓</span>}
                                            </div>
                                            <span style={{ fontSize:13, color: tSel ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                                          </div>
                                        );
                                      })}
                                    </>
                                  ) : (
                                    <div style={{ fontSize:13, color:"var(--text3)", padding:"8px 0 12px" }}>No open tasks — assigning project only.</div>
                                  )}
                                  {/* Quick add task inline */}
                                  {dwAddingTask === slot.id && (
                                    <div style={{ marginTop:10, display:"flex", gap:6 }}>
                                      <input autoFocus
                                        style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"8px 10px", color:"var(--text)", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none", boxSizing:"border-box" }}
                                        placeholder="Task name…"
                                        value={dwNewTaskText}
                                        onChange={e => setDwNewTaskText(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === "Enter") {
                                            const txt = dwNewTaskText.trim();
                                            if (txt) { const newId = addTaskToProject(selProjId, txt); togglePT(newId); }
                                            setDwNewTaskText(""); setDwAddingTask(null);
                                          }
                                          if (e.key === "Escape") { setDwAddingTask(null); setDwNewTaskText(""); }
                                        }} />
                                      <button onClick={() => {
                                          const txt = dwNewTaskText.trim();
                                          if (txt) { const newId = addTaskToProject(selProjId, txt); togglePT(newId); }
                                          setDwNewTaskText(""); setDwAddingTask(null);
                                        }}
                                        style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"8px 12px", color:"var(--text2)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}>
                                        Add
                                      </button>
                                      <button onClick={() => { setDwAddingTask(null); setDwNewTaskText(""); }}
                                        style={{ background:"none", border:"none", color:"var(--text3)", fontSize:18, cursor:"pointer", padding:"0 6px", lineHeight:1 }}>×</button>
                                    </div>
                                  )}
                                  <div style={{ marginTop:12, display:"flex", gap:8 }}>
                                    <button style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 12px", fontSize:13, fontWeight:600, color: dwAddingTask === slot.id ? "var(--accent)" : "var(--text2)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"color .15s" }}
                                      onClick={() => { setDwAddingTask(dwAddingTask === slot.id ? null : slot.id); setDwNewTaskText(""); }}>
                                      + Add Task
                                    </button>
                                    <button className="dw-confirm-btn" style={{ flex:1, padding:"10px 12px" }} onClick={confirmAssign}>
                                      ✓ Assign{curSelTasks.length > 0 ? ` · ${curSelTasks.length} task${curSelTasks.length!==1?"s":""}` : ""}
                                    </button>
                                  </div>
                                </>
                              );
                            })()
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // ── ASSIGNED CARD ──
                const incompleteTasks = (proj?.tasks||[]).filter(t=>!t.done);

                const expandedBg = domainColor ? `color-mix(in srgb, ${domainColor} 8%, var(--bg2))` : "var(--bg2)";
                const expandedBorder = isCompleted ? "1px solid rgba(69,193,122,.4)" : domainColor ? `2px solid ${domainColor}` : "1.5px solid rgba(255,255,255,.25)";
                const expandedShadow = domainColor ? `0 0 40px ${domainColor}30, 0 0 0 1px ${domainColor}20` : "0 0 20px rgba(255,255,255,.06)";
                return (
                  <div key={slot.id} data-blockid={slot.id}
                    style={{ flex: isExp ? 3 : (currentItem && !isExp ? 0.8 : 1), minHeight:0, borderRadius:18, background: isExp ? expandedBg : cardBg, border: isExp ? expandedBorder : cardBorder, boxShadow: isExp ? expandedShadow : cardShadow, overflow:"hidden", display:"flex", flexDirection:"column", opacity: 1, transition:"flex .35s cubic-bezier(.4,0,.2,1), opacity .2s, border-color .2s, background .2s, box-shadow .2s", "--domain-color": domainColor || "transparent", position:"relative" }}
                    onClick={() => setExpandedId(isExp ? null : slot.id)}
                  >
                    {/* Colour stripe */}
                    {domainColor && <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background: isCompleted ? "var(--border)" : domainColor, borderRadius:"18px 0 0 18px", transition:"background .3s" }} />}

                    {/* ── Overflow overlay — fills card, X to close ── */}
                    {dwOverflowOpen === slot.id && (
                      <div style={{ position:"absolute", inset:0, background:"var(--bg2)", borderRadius:18, zIndex:10, display:"flex", flexDirection:"column", padding:"16px 16px 14px" }} onClick={e => e.stopPropagation()}>
                        {/* Header row */}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:"var(--text2)" }}>{proj?.name}</span>
                          <button onClick={() => setDwOverflowOpen(null)}
                            style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"50%", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text3)", flexShrink:0 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                        {/* Options */}
                        <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1 }}>
                          <button
                            onClick={() => { mutateDWSlot(viewDateKeyISO, slot.slotIndex, null); setExpandedId(null); setDwOverflowOpen(null); }}
                            style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:14, padding:"0 16px", fontSize:14, fontWeight:600, color:"var(--text2)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:12 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
                            Unassign
                          </button>
                          {!viewingTomorrow && (
                            <button
                              onClick={() => {
                                const tomorrowISO = toISODate(new Date(Date.now() + 86400000));
                                mutateDWSlot(toISODate(), slot.slotIndex, null);
                                mutateDWSlot(tomorrowISO, slot.slotIndex, { projectId: slot.projectId, startHour: slot.startHour, startMin: slot.startMin, durationMin: slot.durationMin, todayTasks: slot.todayTasks });
                                setExpandedId(null); setDwOverflowOpen(null);
                              }}
                              style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:14, padding:"0 16px", fontSize:14, fontWeight:600, color:"var(--text2)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:12 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              Move to Tomorrow
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Collapsed header — visible always, bigger when now */}
                    <div style={{ padding: isExp ? "14px 16px 10px 20px" : "14px 16px 12px 20px", flex: isExp ? "none" : 1, display:"flex", alignItems:"flex-start", gap:12, minHeight:0 }}>
                      {/* Mode icon */}
                      <div style={{ width:34, height:34, borderRadius:10, background: isCompleted ? "var(--bg3)" : isExp ? (domainColor ? `${domainColor}25` : "var(--bg3)") : (domainColor ? `${domainColor}18` : "var(--bg3)"), border: isCompleted ? "1px solid var(--border)" : isExp ? `1.5px solid ${domainColor ? domainColor+"60" : "var(--border)"}` : `1px solid ${domainColor ? domainColor+"35" : "var(--border)"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity: isCompleted ? 0.5 : 1, transition:"background .2s, border-color .2s", flexShrink:0 }}>
                        {isSessionMode
                          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2-5.3" stroke={isCompleted ? "var(--text3)" : (domainColor||"var(--text2)")} strokeWidth="2.2" strokeLinecap="round"/><path d="M20 7v5h-5" stroke={isCompleted ? "var(--text3)" : (domainColor||"var(--text2)")} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke={isCompleted ? "var(--text3)" : (domainColor||"var(--text2)")} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke={isCompleted ? "var(--text3)" : (domainColor||"var(--text2)")} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        }
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        {/* Eyebrow */}
                        <div style={{ fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color: isNow ? (domainColor||"var(--accent)") : "var(--text3)", marginBottom: isNow || isExp ? 4 : 2, opacity: isCompleted ? 0.5 : 1 }}>
                          {isSessionMode ? "Deep Work · Session" : "Deep Work · Tasks"}{isRunning ? ` · ${elapsedStr}` : isPaused ? ` · ${elapsedStr} ⏸` : ""}
                        </div>
                        <div style={{ fontSize: isNow && !isExp ? 20 : 15, fontWeight:800, color: isCompleted ? "var(--text3)" : "var(--text)", letterSpacing:"-.02em", lineHeight:1.15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace: isExp ? "normal" : "nowrap" }}>{proj.name}</div>
                        {!isExp && (
                          <>
                            <div style={{ fontSize:11, color:"var(--text3)", marginTop:3 }}>
                              {domain?.name}{data.todayPrefs?.hideTimes ? "" : ` · ${fmtTime(slot.startHour, slot.startMin)}`} · {slot.durationMin} min
                              {!isSessionMode && hasTodayTasks ? ` · ${relevantDone}/${relevantTasks.length}` : ""}
                            </div>
                            {!isSessionMode && (() => {
                              if (!hasTodayTasks) return isCompleted ? null : (
                                <div style={{ marginTop:8, fontSize:12, color:"var(--text3)", opacity:.5, fontStyle:"italic" }}>Assign tasks</div>
                              );
                              const preview = relevantTasks.slice(0, 3);
                              const hidden = relevantTasks.length - 3;
                              return (
                                <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:5, opacity: isCompleted ? 0.35 : 1, transition:"opacity .3s" }}>
                                  {preview.map(t => (
                                    <div key={t.id} onClick={e => { e.stopPropagation(); if (!isCompleted) toggleTask(proj.id, t.id); }}
                                      style={{ display:"flex", alignItems:"center", gap:7, cursor: isCompleted ? "default" : "pointer" }}>
                                      <div style={{ width:13, height:13, borderRadius:3, border: t.done ? "none" : `1.5px solid ${domainColor ? domainColor+"60" : "var(--border)"}`, background: t.done ? "var(--green)" : "transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                        {t.done && <span style={{ fontSize:7, color:"#000", fontWeight:900 }}>✓</span>}
                                      </div>
                                      <span style={{ fontSize:12, color:"var(--text3)", textDecoration: t.done ? "line-through" : "none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.text}</span>
                                    </div>
                                  ))}
                                  {hidden > 0 && (
                                    <div style={{ fontSize:11, color:"var(--text3)", opacity:.6, paddingLeft:20 }}>+{hidden} more</div>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                      {isCompleted && !isExp && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      {!isCompleted && !isExp && (
                        timerActive ? (
                          <div style={{ display:"flex", alignItems:"center", gap:5, background:"var(--bg3)", border:`1px solid ${isRunning ? "rgba(232,160,48,.4)" : "rgba(232,160,48,.2)"}`, borderRadius:20, padding:"4px 8px 4px 6px", flexShrink:0 }}>
                            <div style={{ width:5, height:5, borderRadius:"50%", background: isRunning ? "var(--accent)" : "var(--text3)", flexShrink:0, opacity: isRunning ? 1 : 0.5 }} />
                            <span style={{ fontSize:11, fontWeight:700, color: isRunning ? "var(--accent)" : "var(--text3)", fontVariantNumeric:"tabular-nums", letterSpacing:".02em" }}>{elapsedStr}</span>
                          </div>
                        ) : hasTodayTasks ? (
                          <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--bg3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:"1px solid var(--border2)" }}>
                            <span style={{ fontSize:11, fontWeight:800, color: relevantDone === relevantTasks.length ? "var(--green)" : "var(--text2)" }}>{relevantDone}/{relevantTasks.length}</span>
                          </div>
                        ) : null
                      )}
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                        {isExp && (
                          <button style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", color:"var(--text3)", display:"flex", alignItems:"center" }}
                            onClick={e => { e.stopPropagation(); setDwOverflowOpen(dwOverflowOpen === slot.id ? null : slot.id); }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                              <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                            </svg>
                          </button>
                        )}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color:"var(--text3)", opacity:.4, transform: isExp ? "rotate(90deg)" : "none", transition:"transform .2s", cursor:"pointer" }} onClick={e => { e.stopPropagation(); setExpandedId(isExp ? null : slot.id); if (!isExp) setDwOverflowOpen(null); }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>

                    {/* Expanded body */}
                    {isExp && (() => {
                      // Total logged hours for this project (session log)
                      const totalLoggedMin = (data.sessionLog || [])
                        .filter(s => s.projectId === proj.id)
                        .reduce((sum, s) => sum + (s.durationMin || 0), 0);
                      const totalLoggedHrs = totalLoggedMin / 60;
                      const loggedDisplay = totalLoggedMin === 0 ? null
                        : totalLoggedMin < 60 ? `${totalLoggedMin}m logged`
                        : `${totalLoggedHrs % 1 === 0 ? totalLoggedHrs : totalLoggedHrs.toFixed(1)}h logged`;

                      // Compact timer bar — single row with elapsed + controls + done
                      const TimerBlock = ({ onDone }) => {
                        const iconBtn = (onClick, children, active, danger) => (
                          <button onClick={e => { e.stopPropagation(); onClick(); }}
                            style={{ width:32, height:32, borderRadius:"50%", border:"none", background: danger ? "var(--bg4)" : active ? "var(--bg4)" : "var(--bg3)", color: danger ? "var(--red)" : active ? "var(--text)" : "var(--text3)", display:"flex", alignItems:"center", justifyContent:"center", cursor: onClick ? "pointer" : "default", flexShrink:0, transition:"background .12s, color .12s", opacity: (!active && !danger) ? 0.45 : 1 }}>
                            {children}
                          </button>
                        );
                        return (
                          <div onClick={e => e.stopPropagation()} style={{ marginTop:12, display:"flex", flexDirection:"column", gap:8 }}>
                            {/* Single row: elapsed · reset · start/pause/resume */}
                            <div style={{ display:"flex", alignItems:"center", gap:8, background:"var(--bg3)", borderRadius:12, padding:"8px 12px", border:"1px solid var(--border2)" }}>
                              {/* Elapsed display */}
                              <span style={{ fontSize:16, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:".02em", color: isRunning ? "var(--text)" : isPaused ? "var(--accent)" : "var(--text3)", minWidth:40, fontFamily:"'DM Sans',sans-serif", lineHeight:1 }}>
                                {elapsedStr}
                              </span>
                              {/* Running dot */}
                              {isRunning && <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent)", flexShrink:0, animation:"pulse-dot 1.2s ease-in-out infinite" }} />}
                              <div style={{ flex:1 }} />
                              {/* Reset — only interactive when paused */}
                              {isPaused ? (
                                iconBtn(() => resetTimer(slot.id),
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 15a9 9 0 1 0 .49-4.95" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                                  true, false)
                              ) : (
                                <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--bg3)", display:"flex", alignItems:"center", justifyContent:"center", opacity:0.25, color:"var(--text3)" }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 15a9 9 0 1 0 .49-4.95" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                              )}
                              {/* Start / Pause / Resume */}
                              {isRunning ? (
                                <button onClick={e => { e.stopPropagation(); pauseTimerSlot(slot.id); }}
                                  style={{ width:32, height:32, borderRadius:"50%", border:"none", background:"var(--red)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>
                                </button>
                              ) : (
                                <button onClick={e => { e.stopPropagation(); startTimerSlot(slot.id); }}
                                  style={{ width:32, height:32, borderRadius:"50%", border:"none", background:"var(--green)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
                                  <svg width="11" height="12" viewBox="0 0 16 18" fill="none"><path d="M1 1l14 8-14 8V1z" fill="currentColor"/></svg>
                                </button>
                              )}
                            </div>
                            {/* Done bar */}
                            <button onClick={e => { e.stopPropagation(); onDone(); }}
                              style={{ width:"100%", background: timerActive ? "rgba(69,193,122,.1)" : "var(--bg3)", border: timerActive ? "1px solid rgba(69,193,122,.3)" : "1px solid var(--border2)", borderRadius:10, padding:"8px 0", fontSize:12, fontWeight:700, color: timerActive ? "var(--green)" : "var(--text3)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"all .2s", boxSizing:"border-box" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              Done{timerActive ? ` · ${elapsedStr}` : ""}
                            </button>
                          </div>
                        );
                      };

                      // Kept for task mode bottom area (just the timer block, no separate TimerRow)
                      const TimerRow = () => null;

                      return (
                        <div style={{ flex:1, overflowY:"auto", padding:"0 16px 14px 20px" }} onClick={() => setExpandedId(null)}>
                          <div style={{ fontSize:12, color:"var(--text3)", marginBottom:10 }}>{domain?.name}{data.todayPrefs?.hideTimes ? "" : ` · ${fmtTime(slot.startHour, slot.startMin)}`} · {slot.durationMin} min{loggedDisplay ? ` · ${loggedDisplay}` : ""}</div>

                          {isCompleted ? (
                            <div onClick={e => e.stopPropagation()}>
                              {!isSessionMode && hasTodayTasks && (
                                <div style={{ display:"flex", flexDirection:"column", gap:2, opacity:0.35, marginBottom:14 }}>
                                  {relevantTasks.map((t, i) => (
                                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom: i < relevantTasks.length-1 ? "1px solid var(--border2)" : "none" }}>
                                      <div className="tl-check done" style={{ width:20, height:20, flexShrink:0 }}>
                                        <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>
                                      </div>
                                      <span style={{ fontSize:14, color:"var(--text3)", textDecoration:"line-through" }}>{t.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                <div style={{ width:22, height:22, borderRadius:"50%", background:"rgba(69,193,122,.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                                <span style={{ fontSize:13, color:"var(--green)", fontWeight:700, flex:1 }}>Session complete</span>
                                <button onClick={() => unmarkManualDone(slot.id, proj.id, slot.todayTasks)}
                                  style={{ background:"none", border:"1px solid var(--border)", borderRadius:8, fontSize:12, color:"var(--text3)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"4px 10px" }}>
                                  ← Undo
                                </button>
                              </div>
                            </div>

                          ) : isSessionMode ? (
                            <div onClick={e => e.stopPropagation()}>
                              {totalLoggedMin > 0 && (
                                <div style={{ background:"var(--bg3)", borderRadius:10, padding:"8px 14px", marginBottom:4, display:"flex", alignItems:"center", gap:10 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color:"var(--blue)", flexShrink:0 }}>
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                  </svg>
                                  <span style={{ fontSize:12, color:"var(--text3)" }}>
                                    <span style={{ fontWeight:700, color:"var(--text)" }}>{totalLoggedHrs % 1 === 0 ? totalLoggedHrs : totalLoggedHrs.toFixed(1)}h</span>
                                    {" "}logged across all sessions
                                  </span>
                                </div>
                              )}
                              <TimerBlock onDone={() => doneTimer(slot, proj)} />
                            </div>

                          ) : isPicking ? (
                            (() => {
                              const ps = pickerState;
                              const confirmPick = () => {
                                let finalIds = [...ps.selected];
                                if (ps.newText.trim()) { const newId = addTaskToProject(proj.id, ps.newText.trim()); finalIds.push(newId); }
                                saveDWTodayTasks(slot.slotIndex, finalIds);
                                setPickerState(null);
                              };
                              return (
                                <div>
                                  <div style={{ fontSize:12, fontWeight:700, color:"var(--text3)", letterSpacing:".05em", textTransform:"uppercase", marginBottom:8 }}>Pick today's tasks</div>
                                  {proj.tasks.filter(t=>!t.done).map(t => {
                                    const checked = ps.selected.has(t.id);
                                    return (
                                      <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 2px", cursor:"pointer" }}
                                        onClick={() => setPickerState(prev => { const s = new Set(prev.selected); checked ? s.delete(t.id) : s.add(t.id); return { ...prev, selected: s }; })}>
                                        <div style={{ width:18, height:18, borderRadius:5, border: checked ? "none" : "1.5px solid var(--border)", background: checked ? "var(--accent)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                          {checked && <span style={{ fontSize:10, color:"#000", fontWeight:800 }}>✓</span>}
                                        </div>
                                        <span style={{ fontSize:14, color: checked ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                                      </div>
                                    );
                                  })}
                                  <input style={{ width:"100%", background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:8, padding:"8px 10px", color:"var(--text)", fontSize:13, fontFamily:"'DM Sans',sans-serif", marginTop:8, boxSizing:"border-box" }}
                                    placeholder="Add new task…" value={ps.newText}
                                    onChange={e => setPickerState(prev => ({ ...prev, newText: e.target.value }))}
                                    onKeyDown={e => e.key === "Enter" && confirmPick()} />
                                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                                    <button className="dw-confirm-btn" style={{ flex:1 }} onClick={confirmPick}>✓ Confirm</button>
                                    <button className="dw-back" onClick={() => setPickerState(null)}>✕</button>
                                  </div>
                                </div>
                              );
                            })()

                          ) : hasTodayTasks ? (
                            <>
                              {relevantTasks.map((t, i) => (
                                <div key={t.id} className="tl-task-row" style={{ padding:"8px 0", borderBottom: i < relevantTasks.length-1 ? "1px solid var(--border2)" : "none" }}>
                                  <div className={`tl-check ${t.done ? "done" : ""} ${recentlyChecked.has(t.id) ? "bounce" : ""}`}
                                    style={{ width:20, height:20, flexShrink:0 }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleTask(proj.id, t.id);
                                      const wasAlreadyDone = t.done;
                                      if (!wasAlreadyDone) {
                                        const remaining = relevantTasks.filter(rt => rt.id !== t.id && !rt.done);
                                        if (remaining.length === 0) {
                                          logSession(proj.id, slot.durationMin, null);
                                          markManualDone(slot.id, proj.id, slot.todayTasks);
                                        }
                                      }
                                    }}>
                                    {t.done && <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>}
                                  </div>
                                  {editingDwTaskId === t.id ? (
                                    <input autoFocus
                                      style={{ flex:1, background:"transparent", border:"none", borderBottom:"1.5px solid var(--accent)", outline:"none", color:"var(--text)", fontSize:14, fontFamily:"'DM Sans',sans-serif", padding:"1px 0" }}
                                      value={editingDwTaskText}
                                      onChange={e => setEditingDwTaskText(e.target.value)}
                                      onBlur={() => {
                                        const txt = editingDwTaskText.trim();
                                        if (txt && txt !== t.text) setData(d => ({ ...d, projects: d.projects.map(p => p.id !== proj.id ? p : { ...p, tasks: p.tasks.map(tk => tk.id !== t.id ? tk : { ...tk, text: txt }) }) }));
                                        setEditingDwTaskId(null);
                                      }}
                                      onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }}
                                      onClick={e => e.stopPropagation()} />
                                  ) : (
                                    <span className={`tl-task-txt ${t.done ? "done" : ""}`} style={{ fontSize:14, cursor:"text" }}
                                      onClick={e => { e.stopPropagation(); if (!t.done) { setEditingDwTaskId(t.id); setEditingDwTaskText(t.text); } }}>
                                      {t.text}
                                    </span>
                                  )}
                                </div>
                              ))}
                              <TimerBlock onDone={() => doneTimer(slot, proj)} />
                            </>

                          ) : (
                            <div onClick={e => e.stopPropagation()}>
                              <div style={{ fontSize:13, color:"var(--text3)", marginBottom:10 }}>No tasks picked yet.</div>
                              <button className="tl-start-btn"
                                onClick={e => { e.stopPropagation(); setPickerState({ blockId: slot.id, projectId: proj.id, selected: new Set(), newText: "" }); }}>
                                Pick tasks
                              </button>
                              <TimerBlock onDone={() => doneTimer(slot, proj)} />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              }

              return null;
            })}
            </div>
          </div>
        );
      })()}

      {/* ── LOOSE TASKS BANNER ── */}
      {(() => {
        const looseCt = (data.looseTasks||[]).filter(t=>!t.done).length;
        const capCt = (data.captured||[]).length;
        const totalCt = looseCt + capCt;
        return (
          <div onClick={() => setLooseBlockExp(true)}
            style={{ flexShrink:0, margin:"0 12px 8px", background:"var(--bg2)", borderRadius:14, border:"1px solid var(--border)", padding:"11px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"/></svg>
            <span style={{ flex:1, fontSize:13, fontWeight:600, color:"var(--text2)" }}>Loose Tasks</span>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              {capCt > 0 && (
                <span style={{ fontSize:11, fontWeight:700, color:"var(--blue)", background:"rgba(91,138,240,.12)", borderRadius:20, padding:"2px 8px" }}>
                  {capCt} captured
                </span>
              )}
              {looseCt > 0
                ? <span style={{ fontSize:12, fontWeight:700, color:"var(--accent)", background:"rgba(232,160,48,.12)", borderRadius:20, padding:"2px 10px" }}>{looseCt} left</span>
                : totalCt === 0 && <span style={{ fontSize:12, color:"var(--text3)" }}>None</span>
              }
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color:"var(--text3)", opacity:.5 }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        );
      })()}

      {/* ── SHUTDOWN BAR — full width, always visible ── */}
      {(() => {
        const isRelevant = !shutdownDone && (data.todayPrefs?.showShutdown !== false);
        return (
          <div onClick={isRelevant ? openShutdown : undefined}
            style={{ flexShrink:0, margin:"0 12px 10px", borderRadius:14, border: shutdownDone ? "1px solid rgba(69,193,122,.2)" : isRelevant ? "1px solid var(--border)" : "1px solid var(--border2)", background: shutdownDone ? "rgba(69,193,122,.06)" : isRelevant ? "var(--bg2)" : "var(--bg2)", padding:"13px 18px", display:"flex", alignItems:"center", gap:12, cursor: isRelevant ? "pointer" : "default", opacity: !isRelevant && !shutdownDone ? 0.4 : 1, transition:"opacity .2s, border-color .2s, background .2s" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: shutdownDone ? "var(--green)" : isRelevant ? "var(--text2)" : "var(--text3)", flexShrink:0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ flex:1, fontSize:13, fontWeight:700, color: shutdownDone ? "var(--green)" : isRelevant ? "var(--text)" : "var(--text3)", letterSpacing:"-.01em" }}>
              {shutdownDone ? "Shutdown complete" : "Shutdown Ritual"}
            </span>
            {shutdownDone
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : isRelevant
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color:"var(--text3)", opacity:.5 }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : null
            }
          </div>
        );
      })()}

      {/* ── LOOSE TASKS BOTTOM SHEET ── */}
      {looseBlockExp && (
        <div style={{ position:"absolute", inset:0, zIndex:120 }} onClick={() => { setLooseBlockExp(false); setLooseEditId(null); }}>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"var(--bg2)", borderRadius:"20px 20px 0 0", border:"none", borderTop:"3px solid var(--border)", maxHeight:"70vh", display:"flex", flexDirection:"column", animation:"sheet-up .25s cubic-bezier(.4,0,.2,1)", boxShadow:"0 -2px 0 var(--bg4), 0 -20px 60px rgba(0,0,0,.5)" }}
            onClick={e => e.stopPropagation()}>
            {/* Drag handle */}
            <div style={{ flexShrink:0, display:"flex", justifyContent:"center", paddingTop:10 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:"var(--border)" }} />
            </div>
            {/* Header */}
            <div style={{ flexShrink:0, padding:"10px 20px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"2px solid var(--border)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:15, fontWeight:800, color:"var(--text)", letterSpacing:"-.01em" }}>Loose Tasks</div>
                {(data.captured||[]).length > 0 && (
                  <div style={{ background:"rgba(91,138,240,.15)", border:"1px solid rgba(91,138,240,.3)", borderRadius:12, padding:"2px 8px", fontSize:11, fontWeight:700, color:"var(--blue)" }}>
                    {(data.captured||[]).length} captured
                  </div>
                )}
              </div>
              <button onClick={() => { setLooseBlockExp(false); setLooseEditId(null); }} style={{ background:"none", border:"none", cursor:"pointer", padding:4, color:"var(--text3)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"6px 16px 24px" }}>
              {/* ── Captured section ── */}
              {(data.captured||[]).length > 0 && (() => {
                const moveToInbox = (s) => setData(d => ({
                  ...d,
                  captured: (d.captured||[]).filter(sc => sc.id !== s.id),
                  inbox: [...(d.inbox||[]), { id: uid(), text: s.text, createdAt: s.createdAt || Date.now() }]
                }));
                const dismiss = (s) => setData(d => ({ ...d, captured: (d.captured||[]).filter(sc => sc.id !== s.id) }));
                return (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--blue)", marginBottom:6, paddingLeft:2, opacity:.8 }}>Captured</div>
                    {(data.captured||[]).map(s => (
                      <div key={s.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 0", borderBottom:"1px solid var(--border2)" }}>
                        <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--text3)", flexShrink:0, marginTop:7 }} />
                        <span style={{ flex:1, fontSize:14, color:"var(--text2)", lineHeight:1.4 }}>{s.text}</span>
                        <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                          <button onClick={() => moveToInbox(s)}
                            style={{ background:"rgba(91,138,240,.12)", border:"1px solid rgba(91,138,240,.3)", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, color:"var(--blue)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>
                            → Inbox
                          </button>
                          <button onClick={() => dismiss(s)}
                            style={{ background:"none", border:"1px solid var(--border)", borderRadius:8, padding:"4px 8px", fontSize:12, color:"var(--text3)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    {(data.captured||[]).length > 1 && (
                      <button onClick={() => setData(d => ({
                        ...d,
                        captured: [],
                        inbox: [...(d.inbox||[]), ...(d.captured||[]).map(s => ({ id: uid(), text: s.text, createdAt: s.createdAt || Date.now() }))]
                      }))}
                        style={{ marginTop:10, width:"100%", background:"rgba(91,138,240,.08)", border:"1px solid rgba(91,138,240,.2)", borderRadius:10, padding:"9px 12px", fontSize:13, fontWeight:700, color:"var(--blue)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                        Move all {(data.captured||[]).length} to Inbox
                      </button>
                    )}
                    <div style={{ height:1, background:"var(--border)", margin:"14px 0 6px" }} />
                  </div>
                );
              })()}
              {(() => {
                const loose = (data.looseTasks||[]).filter(t=>!t.done);
                const saveEdit = (id) => {
                  if (looseEditText.trim()) {
                    setData(d => ({ ...d, looseTasks: (d.looseTasks||[]).map(lt => lt.id===id ? { ...lt, text: looseEditText.trim() } : lt) }));
                  }
                  setLooseEditId(null);
                  setLooseEditText("");
                };
                return loose.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"24px 0", fontSize:13, color:"var(--text3)" }}>No loose tasks</div>
                ) : (
                  loose.map(t => {
                    const dom = data.domains?.find(d => d.id === t.domainId);
                    const isEditing = looseEditId === t.id;
                    const isPickedToday = ((data.todayLoosePicks||{})[toISODate()]||[]).includes(t.id);
                    const addToToday = () => {
                      if (isPickedToday) return;
                      setData(d => {
                        const cur = (d.todayLoosePicks||{})[toISODate()] || [];
                        return { ...d, todayLoosePicks: { ...(d.todayLoosePicks||{}), [toISODate()]: [...cur, t.id] } };
                      });
                    };
                    return (
                      <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid var(--border2)" }}>
                        {/* Circle — tap to check */}
                        <div onClick={() => setData(d => ({ ...d, looseTasks: (d.looseTasks||[]).map(lt => lt.id===t.id ? { ...lt, done:true, doneAt:new Date().toISOString() } : lt) }))}
                          style={{ width:22, height:22, borderRadius:"50%", border:"1.5px solid var(--border)", background:"transparent", flexShrink:0, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"border-color .15s, background .15s" }} />
                        {/* Text — tap to edit */}
                        <div style={{ flex:1, minWidth:0 }}>
                          {isEditing ? (
                            <input
                              autoFocus
                              style={{ width:"100%", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:7, padding:"5px 8px", color:"var(--text)", fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:"none", boxSizing:"border-box" }}
                              value={looseEditText}
                              onChange={e => setLooseEditText(e.target.value)}
                              onKeyDown={e => { if (e.key==="Enter") saveEdit(t.id); if (e.key==="Escape") { setLooseEditId(null); setLooseEditText(""); } }}
                              onBlur={() => saveEdit(t.id)} />
                          ) : (
                            <div onClick={() => { setLooseEditId(t.id); setLooseEditText(t.text); }}
                              style={{ fontSize:14, color:"var(--text)", cursor:"text", padding:"2px 0" }}>{t.text}</div>
                          )}
                          {dom && !isEditing && <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>{dom.name}</div>}
                        </div>
                        {/* ↓ Do Today button */}
                        <button onClick={addToToday} title="Do today"
                          style={{ flexShrink:0, width:28, height:28, borderRadius:8, border: isPickedToday ? "1.5px solid rgba(232,160,48,.4)" : "1px solid var(--border)", background: isPickedToday ? "rgba(232,160,48,.12)" : "none", display:"flex", alignItems:"center", justifyContent:"center", cursor: isPickedToday ? "default" : "pointer", transition:"all .15s" }}>
                          {isPickedToday
                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"/><path d="M19 16l-7 7-7-7" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          }
                        </button>
                      </div>
                    );
                  })
                );
              })()}
              {/* Quick add */}
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:10, padding:"8px 12px", marginTop:12 }}>
                <span style={{ fontSize:16, color:"var(--text3)", lineHeight:1 }}>+</span>
                <input style={{ flex:1, background:"none", border:"none", outline:"none", color:"var(--text)", fontSize:13, fontFamily:"'DM Sans',sans-serif", padding:0 }}
                  placeholder="Add a task…"
                  value={looseQuickDraft}
                  onChange={e => setLooseQuickDraft(e.target.value)}
                  onKeyDown={e => { if (e.key==="Enter") addLooseQuickTask(looseQuickDraft); if (e.key==="Escape") setLooseQuickDraft(""); }} />
                {looseQuickDraft.trim() && (
                  <button onClick={() => addLooseQuickTask(looseQuickDraft)}
                    style={{ background:"var(--accent)", color:"#000", border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Add</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Celebration overlay */}
      {celebratingId && (
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:200 }}>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div className="celebrate-burst" />
            <div style={{ fontSize:14, fontWeight:800, color:"var(--accent)", background:"var(--bg2)", borderRadius:20, padding:"8px 20px", border:"1px solid rgba(232,160,48,.3)" }}>Block complete ✓</div>
          </div>
        </div>
      )}

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
              {false && assigningId === t.id && (
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

// ─── PROJECT CARD ────────────────────────────────────────────────────────────
const PROJ_COLORS = DOMAIN_COLORS;

function ProjectCard({ proj, domain, isExp, newTaskText,
  onToggleExpand, onToggleStatus, onDelete, onEditSave,
  onToggleTask, onDeleteTask, onSaveTask, onNewTaskChange, onAddTask, autoFocus,
  sessionLog, onModeToggle }) {
  const isSessionMode = proj.mode === "sessions";
  const [addingTask, setAddingTask] = useState(false);
  const taskInputRef = useRef(null);
  const nameInputRef = useRef(null);

  const pct = getPct(proj.tasks);
  const [swipeX, setSwipeX] = useState(0);
  const [showEdit, setShowEdit] = useState(!!autoFocus);
  const [draftName, setDraftName] = useState(proj.name);
  const [draftColor, setDraftColor] = useState(domain?.color || PROJ_COLORS[0]);
  const startX = useRef(null);
  // Two-button reveal: Session toggle(blue) 80px + Delete(red) 80px = 160px
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
        {/* Action bg: Session toggle + Delete */}
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 80, background: "var(--blue)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }} onClick={e => { e.stopPropagation(); onModeToggle(); setSwipeX(0); }}>
            {isSessionMode
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2-5.3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><path d="M20 7v5h-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>{isSessionMode ? "Tasks" : "Session"}</span>
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
            {/* Mode icon replaces stripe */}
            <div style={{ width:32, height:32, borderRadius:"50%", background: `${domain?.color || "var(--text3)"}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity: proj.status === "active" ? 1 : 0.4 }}>
              {isSessionMode
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2-5.3" stroke={domain?.color || "var(--text3)"} strokeWidth="2" strokeLinecap="round"/><path d="M20 7v5h-5" stroke={domain?.color || "var(--text3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={domain?.color || "var(--text3)"} strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke={domain?.color || "var(--text3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </div>
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
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              <span className={`proj-card-badge ${proj.status === "active" ? "badge-active" : "badge-backlog"}`} onClick={e => { e.stopPropagation(); onToggleStatus(e); }}>
                {proj.status === "active" ? "Active" : "Backlog"}
              </span>
              {!showEdit && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color:"var(--text3)", opacity:.4, transform: isExp ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s", flexShrink:0 }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
          {isSessionMode ? (() => {
            const projSessions = (sessionLog || []).filter(s => s.projectId === proj.id);
            const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
            const weekSessions = projSessions.filter(s => new Date(s.date) >= weekStart);
            const weekMins = weekSessions.reduce((a,s) => a + (s.durationMin||0), 0);
            const weekHrs = (weekMins/60).toFixed(1);
            const weekTarget = 10; // soft weekly hours target for session projects
            const barPct = Math.min((weekMins/60) / weekTarget * 100, 100);
            return (
              <>
                <div className="proj-session-bar-wrap">
                  <div className="proj-session-bar-fill" style={{ width:`${barPct}%`, background: domain?.color || "var(--blue)" }} />
                </div>
                <div className="proj-card-meta">
                  <span className="proj-card-tasks">{projSessions.length} sessions total · {weekHrs}h this week</span>
                  <WaveIcon size={13} color={proj.status === "active" ? (domain?.color || "var(--blue)") : "var(--text3)"} />
                </div>
              </>
            );
          })() : (
            <>
              <div className="proj-bar-wrap">
                <div className="proj-bar-fill" style={{ width: `${pct}%`, background: domain?.color }} />
              </div>
              <div className="proj-card-meta">
                <span className="proj-card-tasks">{proj.tasks.filter(t => t.done).length} of {proj.tasks.length} tasks</span>
                <span className="proj-card-pct" style={{ color: proj.status === "active" ? domain?.color : "var(--text3)" }}>{pct}%</span>
              </div>
            </>
          )}
        </div>
      </div>



      {/* Tasks / Session Log */}
      {isExp && (
        <div className="proj-tasks-expand">
          {isSessionMode ? (() => {
            const projSessions = (sessionLog || []).filter(s => s.projectId === proj.id).slice().reverse();
            const recent = projSessions.slice(0, 5);
            return (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 0 10px", borderBottom:"1px solid var(--border2)", marginBottom:8 }}>
                  <WaveIcon size={12} color="var(--blue)" />
                  <span style={{ fontSize:11, color:"var(--text3)", fontWeight:600, letterSpacing:".05em", textTransform:"uppercase" }}>Session Mode</span>
                </div>
                {recent.length === 0 ? (
                  <div style={{ fontSize:12, color:"var(--text3)", padding:"8px 0", textAlign:"center" }}>No sessions logged yet.</div>
                ) : (
                  <div className="proj-session-log">
                    {recent.map(s => (
                      <div key={s.id} className="proj-session-log-item">
                        <div style={{ width:6, height:6, borderRadius:"50%", background: domain?.color || "var(--blue)", flexShrink:0, marginTop:5 }} />
                        <span className="proj-session-log-note">{s.note || <span style={{fontStyle:"italic",opacity:.5}}>No note</span>}</span>
                        <span className="proj-session-log-meta">{s.date} · {s.durationMin}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })() : (
          <>
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
              />
              <button
                onMouseDown={e => { e.preventDefault(); if (newTaskText.trim()) { onAddTask(); setTimeout(() => taskInputRef.current?.focus(), 30); } else { setAddingTask(false); } }}
                style={{ background: "none", border: "none", padding: "0 4px 0 8px", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <circle cx="13" cy="13" r="12" fill="rgba(232,160,48,0.15)" stroke="rgba(232,160,48,0.5)" strokeWidth="1.5"/>
                  <path d="M13 8v10M8 13h10" stroke="#E8A030" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <div
              className="add-task-tap"
              onClick={() => { setAddingTask(true); setTimeout(() => taskInputRef.current?.focus(), 30); }}
            />
          )}

          {/* Work Now button removed — blocks are deep work slots only */}

        </>
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
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, color:"var(--text3)", opacity:.4, marginLeft:4, transform: open ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s" }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
  const [pendingModeProj, setPendingModeProj] = useState(null); // { id, name, domainId } — awaiting mode pick

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
    // Stage project — wait for mode picker before creating
    setPendingModeProj({ id: uid(), domainId: activeDomain, name: "", status: "backlog", tasks: [] });
  };

  const confirmNewProject = (mode) => {
    if (!pendingModeProj) return;
    const newProj = { ...pendingModeProj, mode };
    setData(d => ({ ...d, projects: [...d.projects, newProj] }));
    setNewProjId(newProj.id);
    setPendingModeProj(null);
  };

  const cancelNewProject = () => setPendingModeProj(null);

  return (
    <div className="screen active">
      <StatusBar />
      <div className="ph">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="ph-eye">Your Work</div>
            <div className="ph-title">Projects</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:2 }}>
            {/* Captured inbox icon */}
            <button onClick={openCategorize}
              style={{ position:"relative", background:"none", border:"none", cursor:"pointer", padding:4, color:"var(--text3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22 12h-6l-2 3H10l-2-3H2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {((data.inbox||[]).length > 0 || (data.captured||[]).length > 0) && (() => {
                const total = (data.inbox||[]).length + (data.captured||[]).length;
                const isUrgent = (data.inbox||[]).some(i => i.createdAt && Date.now() - i.createdAt > 2*24*60*60*1000);
                return (
                  <span style={{
                    position:"absolute", top:0, right:0,
                    minWidth:16, height:16, borderRadius:8,
                    background: isUrgent ? "var(--red)" : "var(--accent)",
                    color:"#000", fontSize:10, fontWeight:800,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    padding:"0 4px", lineHeight:1,
                    border:"2px solid var(--bg)"
                  }}>
                    {total}
                  </span>
                );
              })()}
            </button>
            <button className="tab-gear" onClick={() => setShowManage(true)}><GearIcon size={20} /></button>
          </div>
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




        {/* Mode picker — appears inline when adding a new project */}
        {pendingModeProj && (
          <div style={{ margin:"0 16px 8px", borderRadius:14, background:"var(--bg2)", border:"1px solid var(--border)", padding:"16px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--text3)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:12, textAlign:"center" }}>How will you work on this?</div>
            <div style={{ display:"flex", gap:10 }}>
              {/* Tasks option */}
              <button
                onClick={() => confirmNewProject("tasks")}
                style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 10px", cursor:"pointer", textAlign:"left", fontFamily:"'DM Sans',sans-serif" }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:`${domain?.color || "var(--accent)"}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={domain?.color || "var(--accent)"} strokeWidth="2"/><path d="M9 12l2 2 4-4" stroke={domain?.color || "var(--accent)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>Tasks</span>
                </div>
                <div style={{ fontSize:11, color:"var(--text3)", lineHeight:1.4 }}>Discrete work with a clear finish line. Build a list, check things off, measure progress.</div>
              </button>
              {/* Sessions option */}
              <button
                onClick={() => confirmNewProject("sessions")}
                style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 10px", cursor:"pointer", textAlign:"left", fontFamily:"'DM Sans',sans-serif" }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:`${domain?.color || "var(--accent)"}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2-5.3" stroke={domain?.color || "var(--accent)"} strokeWidth="2.2" strokeLinecap="round"/><path d="M20 7v5h-5" stroke={domain?.color || "var(--accent)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>Sessions</span>
                </div>
                <div style={{ fontSize:11, color:"var(--text3)", lineHeight:1.4 }}>Craft work that compounds over time. Show up, push it forward, log the hours.</div>
              </button>
            </div>
            <button onClick={cancelNewProject} style={{ marginTop:10, width:"100%", background:"none", border:"none", fontSize:12, color:"var(--text3)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"4px 0" }}>Cancel</button>
          </div>
        )}

        {domainProjects.map(proj => (
          <ProjectCard
            key={proj.id}
            proj={proj}
            domain={domains.find(d => d.id === proj.domainId)}
            isExp={!collapsedProjs.has(proj.id)}
            newTaskText={newTaskText[proj.id] || ""}
            sessionLog={data.sessionLog || []}
            onModeToggle={() => setData(d => ({ ...d, projects: d.projects.map(p => p.id === proj.id ? { ...p, mode: p.mode === "sessions" ? "tasks" : "sessions" } : p) }))}
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
  const saved = data.deepBlockDefaults;
  if (!saved || !saved.length) return DEFAULT_DEEP_SLOTS;
  return saved.map((s, i) => ({ ...(DEFAULT_DEEP_SLOTS[i] || DEFAULT_DEEP_SLOTS[0]), ...s, slotIndex: i }));
}

function PlanScreen({ data, setData, onGoToSeason, lightMode, toggleTheme }) {
  const { domains, projects, blocks, weekIntention, workWeek = [2,3,4,5,6] } = data;
  const [editingIntention, setEditingIntention] = useState(false);
  const [intentionDraft, setIntentionDraft] = useState(weekIntention);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [showWorkWeek, setShowWorkWeek] = useState(false);

  const getProject = id => projects.find(p => p.id === id);
  const getDomain  = id => domains.find(d => d.id === id);
  const today      = new Date();
  const days       = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const [wkDwPickerOpen, setWkDwPickerOpen] = useState(null); // `${dateStr}-${slotIndex}`
  const [wkDwPickerStep, setWkDwPickerStep] = useState({}); // { [key]: "project"|"confirm" }
  const [wkDwPickerProj, setWkDwPickerProj] = useState({}); // { [key]: projectId }
  const [wkDwPickerTime, setWkDwPickerTime] = useState({}); // { [key]: { startHour, startMin, durationMin } }
  const [wkDwPickerTasks, setWkDwPickerTasks] = useState({}); // { [key]: [taskId, ...] }
  const wkScrollRef = useRef(null);
  const wkPickerRef = useRef(null);

  useEffect(() => {
    if (wkDwPickerOpen && wkPickerRef.current && wkScrollRef.current) {
      setTimeout(() => {
        const pickerEl = wkPickerRef.current;
        const scrollEl = wkScrollRef.current;
        if (!pickerEl || !scrollEl) return;
        // Scroll the button (parent of picker) to near top of screen
        const btnEl = pickerEl.previousElementSibling;
        const targetEl = btnEl || pickerEl;
        const elTop = targetEl.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
        scrollEl.scrollTo({ top: Math.max(0, elTop - 80), behavior: "smooth" });
      }, 50);
    }
  }, [wkDwPickerOpen]);

  const saveIntention = () => { setData(d => ({ ...d, weekIntention: intentionDraft })); setEditingIntention(false); };
  const deleteBlock   = id => setData(d => ({ ...d, blocks: d.blocks.filter(b => b.id !== id) }));
  const updateBlock   = (id, changes) => { setData(d => ({ ...d, blocks: d.blocks.map(b => b.id===id?{...b,...changes}:b) })); setEditingBlockId(null); };

  // DW slot mutation for week view — uses same pattern as TodayScreen's mutateDWSlot
  const mutateDWSlotForDate = (dateStr, slotIndex, patch) => {
    setData(prev => {
      const existing = [...((prev.deepWorkSlots || {})[dateStr] || [])];
      while (existing.length <= slotIndex) existing.push({});
      existing[slotIndex] = patch === null ? {} : { ...existing[slotIndex], ...patch };
      return { ...prev, deepWorkSlots: { ...(prev.deepWorkSlots || {}), [dateStr]: existing } };
    });
  };

  const saveDWSlotForDate = (dateStr, slotIndex, projectId, startHour, startMin, durationMin, todayTasks) =>
    mutateDWSlotForDate(dateStr, slotIndex, { projectId, startHour, startMin, durationMin, todayTasks: todayTasks || null });

  const clearDWSlotForDate = (dateStr, slotIndex) =>
    mutateDWSlotForDate(dateStr, slotIndex, null);

  // Live slot definitions for this user
  const deepSlots = getDeepSlots(data);

  // For a given dayOffset, build the merged sorted list of real blocks + DW slots (filled + empty)
  const getMergedRows = (offset) => {
    const dayDate = new Date(today); dayDate.setDate(today.getDate() + offset);
    const dow = dayDate.getDay();
    const isWorkDay = workWeek.includes(dow);
    const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth()+1).padStart(2,"0")}-${String(dayDate.getDate()).padStart(2,"0")}`;
    if (!isWorkDay) return [];

    // Filled DW slots for this day
    const savedDW = (data.deepWorkSlots || {})[dateStr] || [];
    const filledDWSlots = deepSlots.map((def, i) => {
      const saved = savedDW[i] || {};
      if (!saved.projectId) return null;
      return {
        type: "deepwork-filled",
        dateStr,
        slotIndex: i,
        startHour: saved.startHour ?? def.startHour,
        startMin: saved.startMin ?? def.startMin,
        durationMin: saved.durationMin ?? def.durationMin,
        projectId: saved.projectId,
      };
    }).filter(Boolean);

    // How many filled DW slots exist? Empty = maxDeepBlocks - filled (min 0)
    const maxDW = data.deepWorkTargets?.maxDeepBlocks ?? 3;
    const filledCount = filledDWSlots.length;
    const emptyCount = Math.max(0, maxDW - filledCount);

    // Empty DW slots: use the deepSlots that are NOT filled, up to emptyCount
    const emptyDWSlots = deepSlots
      .filter((def, i) => !(savedDW[i] || {}).projectId)
      .slice(0, emptyCount)
      .map((def, arrIdx) => ({
        type: "ghost",
        dateStr,
        slot: def,
        origSlot: def,
        dayOffset: offset,
      }));

    const allItems = [
      ...filledDWSlots,
      ...emptyDWSlots,
    ];

    allItems.sort((a, b) => {
      const getMin = x => {
        if (x.type === "deepwork-filled") return x.startHour*60+x.startMin;
        return x.slot.startHour*60+x.slot.startMin;
      };
      return getMin(a) - getMin(b);
    });

    return allItems;
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
          <button className="plan-gear" onClick={() => setShowWorkWeek(true)}><GearIcon size={20} /></button>
        </div>
      </div>
      <div className="scroll" ref={wkScrollRef}>

        {[0,1,2,3,4,5,6].map(offset => {
          const dayDate = new Date(today); dayDate.setDate(today.getDate() + offset);
          const dow = dayDate.getDay();
          const isWorkDay = workWeek.includes(dow);
          const isToday = offset === 0;
          const isPastDay = !isToday && dayDate < today;
          const mergedRows = getMergedRows(offset);
          const dayDateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth()+1).padStart(2,"0")}-${String(dayDate.getDate()).padStart(2,"0")}`;
          const dayDateKey = dayDate.toDateString();
          const completedBlockIds = new Set(
            (data.blockCompletions || []).filter(c => c.date === dayDateKey).map(c => c.blockId)
          );
          const dayHasPickerOpen = wkDwPickerOpen && wkDwPickerOpen.startsWith(dayDateStr);

          return (
            <div key={offset} className={["week-card", isToday ? "today-card" : "", isPastDay ? "past-day" : ""].filter(Boolean).join(" ")} style={dayHasPickerOpen ? { overflow:"visible" } : undefined}>
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
                // Filled deep work slot
                if (row.type === "deepwork-filled") {
                  const proj2 = getProject(row.projectId);
                  const domain2 = proj2 ? getDomain(proj2.domainId) : null;
                  const domainColor2 = domain2?.color || null;
                  const cardKey = `dwfilled_${row.dateStr}_${row.slotIndex}`;
                  const isExpFilled = wkDwPickerOpen === cardKey + "_exp";
                  const savedDW2 = (data.deepWorkSlots || {})[row.dateStr] || [];
                  const savedSlot2 = savedDW2[row.slotIndex] || {};
                  const assignedTaskIds = savedSlot2.todayTasks || null;
                  const projTasks3 = (proj2?.tasks || []).filter(t => !t.done);
                  const selectedTasks3 = wkDwPickerTasks[cardKey] !== undefined
                    ? wkDwPickerTasks[cardKey]
                    : (assignedTaskIds || []);

                  const toggleTask3 = (taskId) => {
                    setWkDwPickerTasks(st => {
                      const cur = st[cardKey] !== undefined ? st[cardKey] : (assignedTaskIds || []);
                      const next = cur.includes(taskId) ? cur.filter(id => id !== taskId) : [...cur, taskId];
                      return { ...st, [cardKey]: next };
                    });
                  };

                  const saveTasksForFilled = () => {
                    const tasks = selectedTasks3.length > 0 ? selectedTasks3 : null;
                    saveDWSlotForDate(row.dateStr, row.slotIndex, row.projectId, row.startHour, row.startMin, row.durationMin, tasks);
                    setWkDwPickerOpen(null);
                    setWkDwPickerTasks(st => { const n={...st}; delete n[cardKey]; return n; });
                  };

                  const isDoneFilled = completedBlockIds.has(cardKey) ||
                    (isPastDay && assignedTaskIds?.length > 0 && assignedTaskIds.every(id => proj2?.tasks?.find(t => t.id === id)?.done));
                  const isMissedFilled = isPastDay && !isDoneFilled;
                  return (
                    <div key={cardKey} style={{ padding: "6px 12px 2px", opacity: isDoneFilled ? 0.38 : isMissedFilled ? 0.55 : 1, filter: isDoneFilled ? "saturate(0.15)" : "none", transition: "opacity .2s" }}>
                      <div
                        style={{
                          background: "var(--bg3)",
                          border: isMissedFilled ? "1px solid rgba(224,85,85,0.25)" : domainColor2 ? `1px solid ${domainColor2}60` : "1px solid var(--border)",
                          boxShadow: isDoneFilled || isMissedFilled ? "none" : domainColor2 ? `0 0 14px ${domainColor2}1a` : "none",
                          borderRadius: 12,
                          overflow: "hidden",
                          cursor: isPastDay ? "default" : "pointer",
                        }}
                        onClick={() => { if (!isPastDay) setWkDwPickerOpen(isExpFilled ? null : cardKey + "_exp"); }}
                      >
                        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px" }}>
                          <div style={{ width:3, borderRadius:2, alignSelf:"stretch", minHeight:36, background: domainColor2 || "var(--bg4)", flexShrink:0 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", textDecoration: isMissedFilled ? "line-through" : "none" }}>{proj2?.name || "—"}</div>
                            <div style={{ fontSize:11, color:"var(--text3)", marginTop:3 }}>
                              {domain2?.name} · {row.durationMin} min · {fmtTime(row.startHour, row.startMin)}
                              {assignedTaskIds?.length > 0 ? ` · ${assignedTaskIds.length} task${assignedTaskIds.length > 1 ? "s" : ""}` : ""}
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {isDoneFilled
                              ? <div style={{ width:20, height:20, borderRadius:"50%", background:"rgba(69,193,122,0.2)", border:"1.5px solid rgba(69,193,122,0.5)", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:10, color:"#45C17A", fontWeight:800 }}>✓</span></div>
                              : isMissedFilled
                                ? <div style={{ fontSize:10, fontWeight:700, letterSpacing:".05em", textTransform:"uppercase", color:"var(--red)", opacity:.7 }}>missed</div>
                                : <><div style={{ fontSize:10, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color: domainColor2 || "var(--accent)", opacity:.8 }}>DW</div>
                                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color:"var(--text3)", opacity:.45, transform: isExpFilled ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s" }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></>
                            }
                          </div>
                        </div>
                        {isExpFilled && !isPastDay && (
                          <div style={{ borderTop:"1px solid var(--border2)" }} onClick={e => e.stopPropagation()}>
                            {projTasks3.length > 0 && proj2?.mode !== "sessions" && (
                              <div style={{ padding:"10px 14px 4px" }}>
                                <div style={{ fontSize:11, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"var(--text3)", marginBottom:6 }}>
                                  Focus tasks <span style={{ color:"var(--text3)", fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optional)</span>
                                </div>
                                {projTasks3.map(t => {
                                  const isSel = selectedTasks3.includes(t.id);
                                  return (
                                    <div key={t.id} onClick={() => toggleTask3(t.id)}
                                      style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 4px", cursor:"pointer", borderRadius:8 }}>
                                      <div style={{
                                        width:18, height:18, borderRadius:5,
                                        border: isSel ? "none" : "1.5px solid var(--border)",
                                        background: isSel ? "var(--accent)" : "transparent",
                                        display:"flex", alignItems:"center", justifyContent:"center",
                                        flexShrink:0, transition:"all .15s"
                                      }}>
                                        {isSel && <span style={{ fontSize:10, color:"#000", fontWeight:800 }}>✓</span>}
                                      </div>
                                      <span style={{ fontSize:13, color: isSel ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div style={{ display:"flex", gap:8, padding:"10px 14px 14px" }}>
                              {projTasks3.length > 0 && (
                                <button onClick={saveTasksForFilled}
                                  style={{ flex:1, background:"var(--accent)", color:"#000", border:"none", borderRadius:8, padding:"9px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                                  Save
                                </button>
                              )}
                              <button onClick={e => { e.stopPropagation(); clearDWSlotForDate(row.dateStr, row.slotIndex); setWkDwPickerOpen(null); setWkDwPickerTasks(st => { const n={...st}; delete n[cardKey]; return n; }); }}
                                style={{ flex:1, background:"rgba(224,85,85,.1)", color:"var(--red)", border:"none", borderRadius:8, padding:"9px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                                Clear slot
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Empty deep work slot — inline picker (matches Today tab design)
                const s = row.slot;
                const pickerKey = `${row.dateStr}-${s.slotIndex}`;
                const isPickerOpen2 = wkDwPickerOpen === pickerKey;
                const pickerStep2 = wkDwPickerStep[pickerKey] || "project";
                const pickerProj2 = wkDwPickerProj[pickerKey] ? getProject(wkDwPickerProj[pickerKey]) : null;
                const pickerTime2 = wkDwPickerTime[pickerKey] || { startHour: s.startHour, startMin: s.startMin, durationMin: s.durationMin };
                const timeOptions2 = [];
                for (let h = 5; h <= 21; h++) for (let m of [0, 15, 30, 45]) timeOptions2.push({ h, m });
                const fmt2 = (h, m) => { const hh = h > 12 ? h-12 : h===0?12:h; const mm = m===0?"":`:${String(m).padStart(2,"0")}`; return `${hh}${mm}${h>=12?"pm":"am"}`; };
                return (
                  <div key={`ghost_${row.dateStr}_${s.slotIndex}`} style={{ padding: "6px 12px 2px" }}>
                    <button className={`dw-empty${isPickerOpen2 ? " is-open" : ""}`} style={{ borderRadius: isPickerOpen2 ? "14px 14px 0 0" : 14 }}
                      onClick={() => {
                        setWkDwPickerOpen(isPickerOpen2 ? null : pickerKey);
                        setWkDwPickerStep(st => ({ ...st, [pickerKey]: "project" }));
                      }}
                    >
                      <div className="dw-plus">+</div>
                      <div style={{ flex:1, textAlign:"left" }}>
                        <div className="dw-empty-label">Deep Work Block</div>
                        <div className="dw-empty-sub">{s.durationMin} min · {fmt2(s.startHour, s.startMin)} · tap to assign</div>
                      </div>
                      <div className="dw-empty-dur">{s.durationMin}m</div>
                    </button>
                    {isPickerOpen2 && (
                      <div className="dw-picker-wrap" ref={wkPickerRef}>
                        {/* UNIFIED picker: project list with inline tasks */}
                        {(() => {
                          const selProjId = wkDwPickerProj[pickerKey] || null;
                          const selProj = selProjId ? data.projects.find(p => p.id === selProjId) : null;
                          const curTime = wkDwPickerTime[pickerKey] || { startHour: s.startHour, startMin: s.startMin, durationMin: s.durationMin };
                          const curSelTasks = (wkDwPickerTasks[pickerKey] !== undefined) ? wkDwPickerTasks[pickerKey] : [];
                          const toggleTask2 = (tid) => {
                            setWkDwPickerTasks(st => {
                              const existing = st[pickerKey] !== undefined ? st[pickerKey] : [];
                              const next = existing.includes(tid) ? existing.filter(id=>id!==tid) : [...existing, tid];
                              return { ...st, [pickerKey]: next };
                            });
                          };
                          return (
                            <>
                              <div className="dw-picker-sect">Choose a project</div>
                              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                                {data.projects.filter(p => p.status === "active").map(p => {
                                  const d2 = data.domains?.find(d => d.id === p.domainId);
                                  const isSel = selProjId === p.id;
                                  const incompleteTasks = (p.tasks||[]).filter(t=>!t.done);
                                  const tasksSel = isSel ? curSelTasks : [];
                                  return (
                                    <div key={p.id} style={{ borderRadius:10, overflow:"hidden", border: isSel ? `1.5px solid ${d2?.color||"var(--accent)"}` : "1.5px solid var(--border2)", background: isSel ? `${d2?.color||"var(--accent)"}11` : "var(--bg3)", transition:"all .15s" }}>
                                      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", cursor:"pointer" }}
                                        onClick={() => {
                                          if (isSel) {
                                            setWkDwPickerProj(st => { const n={...st}; delete n[pickerKey]; return n; });
                                            setWkDwPickerTasks(st => { const n={...st}; delete n[pickerKey]; return n; });
                                          } else {
                                            setWkDwPickerProj(st => ({ ...st, [pickerKey]: p.id }));
                                            setWkDwPickerTasks(st => ({ ...st, [pickerKey]: [] }));
                                            setWkDwPickerTime(st => ({ ...st, [pickerKey]: { startHour:s.startHour, startMin:s.startMin, durationMin:s.durationMin } }));
                                          }
                                        }}
                                      >
                                        <div style={{ width:9, height:9, borderRadius:"50%", background: d2?.color||"var(--text3)", flexShrink:0 }} />
                                        <div style={{ flex:1, minWidth:0 }}>
                                          <div style={{ fontSize:13, fontWeight:600, color: isSel ? "var(--text)" : "var(--text2)" }}>{p.name}</div>
                                          <div style={{ fontSize:11, color:"var(--text3)" }}>{d2?.name}{incompleteTasks.length > 0 ? ` · ${incompleteTasks.length} task${incompleteTasks.length!==1?"s":""}` : ""}</div>
                                        </div>
                                        <div style={{ width:18, height:18, borderRadius:"50%", border: isSel ? "none" : "1.5px solid var(--border)", background: isSel ? (d2?.color||"var(--accent)") : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s" }}>
                                          {isSel && <span style={{ fontSize:9, color:"#000", fontWeight:800 }}>✓</span>}
                                        </div>
                                      </div>
                                      {isSel && incompleteTasks.length > 0 && (
                                        <div style={{ borderTop:"1px solid var(--border2)", padding:"6px 12px 10px" }}>
                                          <div style={{ fontSize:10, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--text3)", marginBottom:6 }}>Focus tasks</div>
                                          {incompleteTasks.map(t => {
                                            const tSel = tasksSel.includes(t.id);
                                            return (
                                              <div key={t.id} onClick={() => toggleTask2(t.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 2px", cursor:"pointer" }}>
                                                <div style={{ width:16, height:16, borderRadius:4, border: tSel ? "none" : "1.5px solid var(--border)", background: tSel ? "var(--accent)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .12s" }}>
                                                  {tSel && <span style={{ fontSize:8, color:"#000", fontWeight:800 }}>✓</span>}
                                                </div>
                                                <span style={{ fontSize:13, color: tSel ? "var(--text)" : "var(--text2)" }}>{t.text}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {data.todayPrefs?.hideTimes ? (
                                <div onClick={() => setData(d => ({ ...d, todayPrefs: { ...(d.todayPrefs||{}), hideTimes: false } }))}
                                  style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:10, background:"var(--bg3)", border:"1.5px dashed var(--border)", cursor:"pointer", marginBottom:10, opacity:0.6 }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"/></svg>
                                  <span style={{ fontSize:13, color:"var(--text2)" }}>Times hidden — tap to enable</span>
                                </div>
                              ) : (
                                <div className="dw-time-row" style={{ marginBottom:10 }}>
                                  <div style={{ flex:1 }}>
                                    <div className="dw-picker-sect" style={{ padding:"0 0 4px" }}>Start time</div>
                                    <select className="dw-time-sel" value={`${curTime.startHour}:${curTime.startMin}`}
                                      onChange={e => { const [h,m] = e.target.value.split(":").map(Number); setWkDwPickerTime(st => ({ ...st, [pickerKey]: { ...st[pickerKey], startHour:h, startMin:m } })); }}>
                                      {timeOptions2.map(({h,m}) => <option key={`${h}${m}`} value={`${h}:${m}`}>{fmt2(h,m)}</option>)}
                                    </select>
                                  </div>
                                  <div style={{ flex:1 }}>
                                    <div className="dw-picker-sect" style={{ padding:"0 0 4px" }}>Duration</div>
                                    <select className="dw-time-sel" value={curTime.durationMin}
                                      onChange={e => setWkDwPickerTime(st => ({ ...st, [pickerKey]: { ...st[pickerKey], durationMin: Number(e.target.value) } }))}>
                                      {[30,45,60,75,90,105,120].map(d => <option key={d} value={d}>{d} min</option>)}
                                    </select>
                                  </div>
                                </div>
                              )}
                              <button className="dw-confirm-btn"
                                disabled={!selProjId}
                                style={{ opacity: selProjId ? 1 : 0.4 }}
                                onClick={() => {
                                  if (!selProjId) return;
                                  const tasks = curSelTasks.length > 0 ? curSelTasks : null;
                                  saveDWSlotForDate(row.dateStr, s.slotIndex, selProjId, curTime.startHour, curTime.startMin, curTime.durationMin, tasks);
                                  setWkDwPickerOpen(null);
                                  setWkDwPickerStep(st => { const n={...st}; delete n[pickerKey]; return n; });
                                  setWkDwPickerProj(st => { const n={...st}; delete n[pickerKey]; return n; });
                                  setWkDwPickerTasks(st => { const n={...st}; delete n[pickerKey]; return n; });
                                }}
                              >✓ Confirm</button>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })})()}

            </div>
          );
        })}
        <div className="spacer" />
      </div>

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

          <div className="sh" style={{ paddingLeft:0, paddingTop:8 }}>
            <span className="sh-label">Default Deep Work Times</span>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:"auto" }}>
              <button onClick={() => setDefs(d => d.length > 1 ? d.slice(0,-1) : d)} style={{ width:26, height:26, borderRadius:8, background:"var(--bg4)", border:"1px solid var(--border)", color:"var(--text)", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"DM Sans,sans-serif" }}>−</button>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text)", minWidth:8, textAlign:"center" }}>{defs.length}</span>
              <button onClick={() => setDefs(d => d.length < 6 ? [...d, { startHour:16, startMin:0, durationMin:90 }] : d)} style={{ width:26, height:26, borderRadius:8, background:"var(--bg4)", border:"1px solid var(--border)", color:"var(--text)", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"DM Sans,sans-serif" }}>+</button>
            </div>
          </div>

          <div className="ww-times">
            {defs.map((slot, i) => (
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
        <div className="spc-empty">All season goals complete!</div>
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
          <div className="sh-title">
            {doneCount === seasonGoals.length && seasonGoals.length > 0
              ? "Season complete"
              : `${seasonGoals.length - doneCount} goal${seasonGoals.length - doneCount !== 1 ? "s" : ""} in motion`}
          </div>
          <div className="sh-sub">
            {seasonGoals.length === 0
              ? "Set up to 4 big goals for this quarter."
              : doneCount === seasonGoals.length
                ? `All ${seasonGoals.length} goals complete this quarter.`
                : `${doneCount} of ${seasonGoals.length} complete · ${getQuarterLabel()}`}
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

        {/* Session projects — season summary */}
        {(() => {
          const sessionProjects = (data.projects || []).filter(p => p.mode === "sessions");
          if (sessionProjects.length === 0) return null;
          const sessionLog = data.sessionLog || [];
          const quarterStart = new Date(); quarterStart.setMonth(Math.floor(quarterStart.getMonth()/3)*3, 1); quarterStart.setHours(0,0,0,0);
          return (
            <>
              <div className="sh"><span className="sh-label">Session Work</span></div>
              <div style={{ margin:"0 16px 16px", background:"var(--bg2)", borderRadius:14, border:"1px solid var(--border2)", overflow:"hidden" }}>
                {sessionProjects.map((p, i) => {
                  const domain = (data.domains||[]).find(d => d.id === p.domainId);
                  const projSessions = sessionLog.filter(s => s.projectId === p.id && new Date(s.date) >= quarterStart);
                  const totalMins = projSessions.reduce((a,s) => a + (s.durationMin||0), 0);
                  const totalHrs = (totalMins/60).toFixed(1);
                  return (
                    <div key={p.id} style={{ padding:"12px 16px", borderBottom: i < sessionProjects.length-1 ? "1px solid var(--border2)" : "none" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background: domain?.color || "var(--blue)", flexShrink:0 }} />
                          <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{p.name}</span>
                          <WaveIcon size={12} color={domain?.color || "var(--blue)"} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color: domain?.color || "var(--blue)" }}>{totalHrs}h</span>
                      </div>
                      <div style={{ fontSize:11, color:"var(--text3)" }}>{projSessions.length} session{projSessions.length !== 1 ? "s" : ""} this season · {domain?.name}</div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

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

function ShutdownSheet({ onClose, onComplete, alreadyDone, data, onCategorizeLoose }) {
  const swipe = useSwipeDown(onClose);
  const [checked, setChecked] = useState(alreadyDone ? [0,1,2,3] : []);
  const { projects, domains } = data;

  // Today's date
  const todayStr = new Date().toDateString();
  const todayISO = new Date().toISOString().slice(0,10);

  // Loose tasks picked for today that are still undone
  const todayPickIds = (data.todayLoosePicks || {})[todayISO] || [];
  const undoneToday = todayPickIds
    .map(id => (data.looseTasks||[]).find(t => t.id === id))
    .filter(t => t && !t.done);

  // Uncategorized loose tasks (no domain) added today but NOT in today picks
  const uncategorized = (data.looseTasks || []).filter(t =>
    !t.done && t.domainId === null && t.createdAt && new Date(t.createdAt).toDateString() === todayStr
    && !todayPickIds.includes(t.id)
  );

  // All tasks needing attention in shutdown = undone today picks + uncategorized
  const needsAttention = [...undoneToday, ...uncategorized.filter(t => !undoneToday.find(u => u.id === t.id))];

  const [localDomains, setLocalDomains] = useState(() => {
    const m = {};
    needsAttention.forEach(t => { m[t.id] = t.domainId || null; });
    return m;
  });
  const allCategorized = needsAttention.every(t => localDomains[t.id] !== null && localDomains[t.id] !== undefined);
  const assignDomain = (taskId, domainId) => {
    setLocalDomains(m => ({ ...m, [taskId]: domainId }));
    onCategorizeLoose(taskId, domainId);
  };

  const allDone = checked.length === SD_ITEMS.length && (needsAttention.length === 0 || allCategorized);

  const toggle = i => setChecked(p => p.includes(i) ? p.filter(x=>x!==i) : [...p, i]);

  const getProject = id => projects.find(p => p.id === id);
  const getDomain  = id => domains.find(d => d.id === id);

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


                    {/* UNFINISHED TODAY PICKS + UNCATEGORIZED LOOSE TASKS */}
          {needsAttention.length > 0 && (
            <div style={{ margin:"4px 0 14px" }}>
              <div style={{ height:1, background:"var(--border2)", marginBottom:14 }} />
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{
                  width:20, height:20, borderRadius:6, flexShrink:0,
                  background: allCategorized ? "var(--green)" : "rgba(232,160,48,0.15)",
                  border: allCategorized ? "none" : "1.5px solid rgba(232,160,48,0.5)",
                  display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s",
                }}>
                  {allCategorized
                    ? <span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>
                    : <span style={{fontSize:10,color:"var(--accent)",fontWeight:700}}>{needsAttention.filter(t => !localDomains[t.id]).length}</span>
                  }
                </div>
                <span style={{ fontSize:14, color:"var(--text)", fontWeight:500 }}>
                  Assign unfinished tasks to a domain
                </span>
              </div>
              <div style={{ marginLeft:28, display:"flex", flexDirection:"column", gap:8 }}>
                {needsAttention.map(task => {
                  const assigned = localDomains[task.id];
                  const isFromToday = todayPickIds.includes(task.id);
                  return (
                    <div key={task.id} style={{ background:"var(--bg3)", borderRadius:12, padding:"12px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                        {isFromToday && (
                          <span style={{ fontSize:10, fontWeight:700, color:"var(--accent)", background:"rgba(232,160,48,.1)", border:"1px solid rgba(232,160,48,.25)", borderRadius:6, padding:"2px 6px", flexShrink:0 }}>Today</span>
                        )}
                        <div style={{ fontSize:13, color:"var(--text)", fontWeight:500 }}>{task.text}</div>
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {domains.map(d => (
                          <button key={d.id} onClick={() => assignDomain(task.id, d.id)}
                            style={{
                              display:"flex", alignItems:"center", gap:5,
                              padding:"5px 11px", borderRadius:20,
                              border: assigned === d.id ? `1.5px solid ${d.color}` : "1.5px solid var(--border)",
                              background: assigned === d.id ? `${d.color}22` : "var(--bg4)",
                              color: assigned === d.id ? d.color : "var(--text2)",
                              fontSize:12, fontWeight:600, cursor:"pointer",
                              fontFamily:"'DM Sans',sans-serif", transition:"all .12s",
                            }}
                          >
                            <span style={{ width:6, height:6, borderRadius:"50%", background:d.color, flexShrink:0, display:"inline-block" }} />
                            {d.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* COMPLETED SINCE LAST SHUTDOWN */}
          {(() => {
            // Show tasks completed since the last shutdown (or beginning of today if never shut down)
            const lastShutdown = data.shutdownDate ? new Date(data.shutdownDate + "T00:00:00") : null;
            const isAfterShutdown = (dateVal) => {
              if (!dateVal) return false;
              const d = new Date(dateVal);
              if (lastShutdown) return d > lastShutdown;
              // No prior shutdown — show anything completed today
              return d.toDateString() === new Date().toDateString();
            };
            const completed = [];
            projects.forEach(proj => {
              const dom = domains.find(d => d.id === proj.domainId);
              proj.tasks.forEach(t => {
                if (t.done && isAfterShutdown(t.doneAt)) {
                  completed.push({ text: t.text, projName: proj.name, color: dom?.color });
                }
              });
            });
            (data.looseTasks || []).filter(t => t.done && isAfterShutdown(t.doneAt)).forEach(t => {
              const dom = domains.find(d => d.id === t.domainId);
              completed.push({ text: t.text, projName: dom?.name || "Loose tasks", color: dom?.color });
            });

            if (!completed.length) return null;
            return (
              <div style={{ margin:"16px 0 8px" }}>
                <div style={{ height:1, background:"var(--border2)", marginBottom:16 }} />
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:".09em", textTransform:"uppercase", color:"var(--text3)", marginBottom:4 }}>
                  Completed This Session
                </div>
                <div style={{ fontSize:22, fontWeight:700, color:"var(--text)", marginBottom:12 }}>
                  {completed.length} task{completed.length !== 1 ? "s" : ""} done
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {completed.map((t, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--bg3)", borderRadius:10 }}>
                      <div style={{ width:3, alignSelf:"stretch", borderRadius:2, background: t.color || "var(--border)", flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:"var(--text)", textDecoration:"line-through", opacity:.7 }}>{t.text}</div>
                        <div style={{ fontSize:11, color:"var(--text3)", marginTop:1 }}>{t.projName}</div>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
            {allDone ? "Shutdown Complete ✓" : `${checked.length} of ${SD_ITEMS.length} complete`}
          </button>

        </div>
      </div>
    </>
  );
}

// ─── ADD BLOCK SHEET ──────────────────────────────────────────────────────────
function AddBlockSheet({ data, onClose, onAddRoutine }) {
  const swipe = useSwipeDown(onClose);
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

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

  const submitRoutine = () => {
    if (!rtTitle.trim()) return;
    const today = new Date();
    let targetDate = null;
    if (!rtRecurring) {
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

  // ── Routine block form ────────────────────────────────────────
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Add Routine Block</div>
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

// ─── SCRIBBLES ────────────────────────────────────────────────────────────────
// Fast brain-dump: type, Enter = new item, close = saved. Zero decisions.
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

// ─── TODAY SETTINGS SHEET ────────────────────────────────────────────────────
function TodaySettingsSheet({ data, setData, onClose }) {
  const swipe = useSwipeDown(onClose);
  const prefs = data.todayPrefs || {};
  const [name, setName]           = useState(prefs.name || "");
  const [showShutdown, setShowSD] = useState(prefs.showShutdown !== false);
  const [hideTimes, setHideTimes] = useState(prefs.hideTimes === true);
  const [defaultBlock, setDefault] = useState(prefs.defaultBlock || "9");
  const targets = data.deepWorkTargets || { dailyHours: 4, weeklyHours: 20, maxDeepBlocks: 3 };
  const dwCount = (data.deepBlockDefaults || []).length;
  const [dailyHours, setDailyHours]     = useState(String(targets.dailyHours));
  const [weeklyHours, setWeeklyHours]   = useState(String(targets.weeklyHours));
  const [maxDeepBlocks, setMaxDeepBlocks] = useState(String(targets.maxDeepBlocks ?? 3));

  const save = () => {
    setData(d => ({
      ...d,
      todayPrefs: { name: name.trim(), showShutdown, defaultBlock, hideTimes },
      deepWorkTargets: { dailyHours: parseFloat(dailyHours)||4, weeklyHours: parseFloat(weeklyHours)||20, maxDeepBlocks: parseInt(maxDeepBlocks)||3 },
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
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Max deep work blocks per day</div>
            <div style={{ display:"flex", gap:8 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setMaxDeepBlocks(String(n))}
                  style={{ flex:1, padding:"9px 0", borderRadius:10, border:`1.5px solid ${String(n) === maxDeepBlocks ? "var(--accent)" : "var(--border)"}`, background: String(n) === maxDeepBlocks ? "var(--accent-s)" : "var(--bg3)", color: String(n) === maxDeepBlocks ? "var(--accent)" : "var(--text2)", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .15s" }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, color:"var(--text3)", marginTop:6 }}>Huberman recommends 1–3 blocks of 90 min each</div>
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

          <div className="set-section">Layout</div>
          <div className="set-row">
            <div>
              <div className="set-row-label">Hide Time Column</div>
              <div className="set-row-sub">Cards fill the full width — no fixed schedule</div>
            </div>
            <div className={`toggle-pill ${hideTimes ? "on" : ""}`} onClick={() => setHideTimes(v => !v)}>
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
  const COLORS = DOMAIN_COLORS;

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
                <select style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:7, padding:"5px 8px", color:"var(--text)", fontFamily:"'DM Sans',sans-serif", fontSize:16, outline:"none" }}
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
function CategorizeSheet({ data, onClose, onCategorize, onDismiss, onDoToday }) {
  const swipe = useSwipeDown(onClose);
  const { inbox, projects, domains } = data;

  // assignments: { [itemId]: projectId | "today" | "dismiss" }
  const [assignments, setAssignments] = useState({});

  const activeProjects = projects.filter(p => p.status === "active");
  const assignedCount = Object.keys(assignments).length;

  const assign = (itemId, value) => setAssignments(prev => {
    // Toggle off if tapping same value again
    if (prev[itemId] === value) { const n = {...prev}; delete n[itemId]; return n; }
    return { ...prev, [itemId]: value };
  });

  const commitAll = () => {
    Object.entries(assignments).forEach(([itemId, value]) => {
      if (value === "today") onDoToday(itemId);
      else if (value === "dismiss") onDismiss(itemId);
      else onCategorize(itemId, value, false);
    });
    if (assignedCount === inbox.length) onClose();
  };

  if (!inbox.length) return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Captured</div>
        <div className="inbox-empty">✓ Nothing left to categorize</div>
      </div>
    </>
  );

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div style={{ padding:"14px 20px 10px", display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
          <div className="sheet-title" style={{ margin:0 }}>Categorize</div>
          <div style={{ fontSize:12, color:"var(--text3)" }}>{inbox.length} item{inbox.length!==1?"s":""}</div>
        </div>
        <div className="sheet-scroll" style={{ paddingBottom:100 }}>
          {inbox.map(item => {
            const pickedId = assignments[item.id];
            return (
              <div key={item.id} style={{ marginBottom:14, background:"var(--bg2)", borderRadius:16, border: pickedId ? "1.5px solid var(--border)" : "1px solid var(--border)", overflow:"hidden" }}>
                {/* Item text */}
                <div style={{ padding:"12px 14px 8px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                  <span style={{ fontSize:15, fontWeight:600, color: pickedId ? "var(--text2)" : "var(--text)", lineHeight:1.4, flex:1 }}>{item.text}</span>
                  {pickedId && (
                    <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:5 }}>
                      {pickedId === "today" && <span style={{ fontSize:11, fontWeight:700, color:"var(--accent)" }}>Today</span>}
                      {pickedId === "dismiss" && <span style={{ fontSize:11, fontWeight:700, color:"var(--text3)" }}>Dismiss</span>}
                      {pickedId !== "today" && pickedId !== "dismiss" && (() => {
                        const p = projects.find(p => p.id === pickedId);
                        const dom = domains.find(d => d.id === p?.domainId);
                        return <span style={{ fontSize:11, fontWeight:700, color: dom?.color||"var(--text3)" }}>→ {p?.name}</span>;
                      })()}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </div>

                {/* Project grid — always visible, tiles show selected state */}
                <div style={{ padding:"0 10px 10px" }}>
                  {/* Do Today pill */}
                  <div onClick={() => assign(item.id, "today")}
                    style={{ marginBottom:8, borderRadius:22, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer",
                      background: pickedId === "today" ? "var(--accent)" : "var(--accent-s)",
                      color: pickedId === "today" ? "#000" : "var(--accent)",
                      border: pickedId === "today" ? "none" : "1.5px solid rgba(232,160,48,.3)",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                    {pickedId === "today" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#000" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    Do Today
                  </div>

                  {/* 2-col project grid */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                    {activeProjects.map(p => {
                      const dom = domains.find(d => d.id === p.domainId);
                      const isSelected = pickedId === p.id;
                      return (
                        <div key={p.id} onClick={() => assign(item.id, p.id)}
                          style={{ borderRadius:11, padding:"9px 11px", cursor:"pointer", display:"flex", flexDirection:"column", gap:3,
                            background: isSelected ? (dom?.color ? dom.color+"22" : "var(--bg3)") : "var(--bg3)",
                            border: isSelected ? `1.5px solid ${dom?.color||"var(--accent)"}` : "1.5px solid var(--border2)",
                            transition:"border-color .12s, background .12s" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:7, height:7, borderRadius:"50%", background:dom?.color||"var(--text3)", flexShrink:0 }} />
                            <span style={{ fontSize:12, fontWeight:700, color: isSelected ? "var(--text)" : "var(--text)", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
                            {isSelected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ marginLeft:"auto", flexShrink:0 }}><path d="M20 6L9 17l-5-5" stroke={dom?.color||"var(--accent)"} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <div style={{ fontSize:10, color:"var(--text3)", paddingLeft:13 }}>{dom?.name}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dismiss link */}
                  <div onClick={() => assign(item.id, "dismiss")}
                    style={{ marginTop:8, textAlign:"center", fontSize:11, color: pickedId === "dismiss" ? "var(--red)" : "var(--text3)", cursor:"pointer", padding:"4px 0", fontWeight: pickedId === "dismiss" ? 700 : 400 }}>
                    Dismiss
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Single confirm bar — sticky at bottom */}
        {assignedCount > 0 && (
          <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"12px 16px 28px", background:"linear-gradient(to bottom, transparent, var(--bg2) 30%)", pointerEvents:"none" }}>
            <button onClick={commitAll}
              style={{ width:"100%", background:"var(--accent)", border:"none", borderRadius:22, padding:"13px", fontSize:15, fontWeight:800, color:"#000", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", pointerEvents:"all" }}>
              Confirm {assignedCount} {assignedCount === 1 ? "assignment" : "assignments"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:"today",    lbl:"Today"    },
  { id:"projects", lbl:"Projects" },
  { id:"plan",     lbl:"Week"     },
  { id:"season",   lbl:"Season"   },
];

// ── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const f = "'DM Sans',sans-serif";
  const inputStyle = { width:"100%", padding:"14px 16px", background:"#1E2122", border:"1px solid #2C3032", borderRadius:12, color:"#fff", fontSize:16, fontFamily:f, outline:"none", marginBottom:10, display:"block", boxSizing:"border-box" };
  const btnStyle = (disabled) => ({ width:"100%", padding:"15px", background:"#E8A030", color:"#000", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:f, transition:"opacity .15s", opacity: disabled ? .6 : 1, marginTop:4 });

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message);
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password) return;
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess("Account created! Check your email to confirm, then sign in.");
    setMode("signin");
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError("Enter your email first"); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess("Password reset email sent! Check your inbox.");
    setMode("signin");
  };

  return (
    <div style={{ position:"fixed", inset:0, display:"flex", flexDirection:"column", background:"#101213", fontFamily:f }}>
      {/* Branding */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 32px" }}>
        <div style={{ fontSize:36, fontWeight:700, color:"#fff", letterSpacing:"-.02em", marginBottom:10 }}>Clearwork</div>
        <div style={{ fontSize:14, color:"#555", textAlign:"center", lineHeight:1.6, maxWidth:240 }}>The Productivity App that makes you love getting things done</div>
      </div>

      {/* Form */}
      <div style={{ padding:"28px 24px 52px", borderTop:"1px solid #1E2122" }}>
        <div style={{ maxWidth:340, margin:"0 auto" }}>

          {/* Tab switcher */}
          <div style={{ display:"flex", gap:0, marginBottom:20, background:"#1E2122", borderRadius:12, padding:4 }}>
            {[["signin","Sign In"],["signup","Sign Up"]].map(([m, lbl]) => (
              <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                style={{ flex:1, padding:"9px", border:"none", borderRadius:9, fontFamily:f, fontSize:13, fontWeight:600, cursor:"pointer", transition:"all .15s",
                  background: mode === m ? "#2C3032" : "transparent",
                  color: mode === m ? "#fff" : "#666"
                }}>{lbl}</button>
            ))}
          </div>

          {success && <div style={{ fontSize:13, color:"#45C17A", marginBottom:12, padding:"10px 12px", background:"rgba(69,193,122,.08)", borderRadius:8 }}>{success}</div>}
          {error && <div style={{ fontSize:13, color:"#E05555", marginBottom:10 }}>{error}</div>}

          {mode === "forgot" ? (
            <>
              <div style={{ fontSize:13, color:"#888", marginBottom:14 }}>Enter your email and we'll send a reset link.</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} autoFocus />
              <button onClick={handleForgot} disabled={loading} style={btnStyle(loading)}>{loading ? "Sending…" : "Send Reset Link"}</button>
              <button onClick={() => { setMode("signin"); setError(""); }} style={{ width:"100%", padding:"12px", background:"none", border:"none", color:"#666", fontSize:13, cursor:"pointer", fontFamily:f, marginTop:8 }}>← Back to sign in</button>
            </>
          ) : (
            <>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && (mode==="signin" ? handleSignIn() : handleSignUp())} placeholder="you@example.com" style={inputStyle} autoFocus />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && (mode==="signin" ? handleSignIn() : handleSignUp())} placeholder="Password" style={inputStyle} />
              <button onClick={mode === "signin" ? handleSignIn : handleSignUp} disabled={loading} style={btnStyle(loading)}>
                {loading ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
              </button>
              {mode === "signin" && (
                <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={{ width:"100%", padding:"12px", background:"none", border:"none", color:"#666", fontSize:13, cursor:"pointer", fontFamily:f, marginTop:4 }}>Forgot password?</button>
              )}
            </>
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

  const [captureOpen, setCaptureOpen] = useState(false);
  const [jumpToBlock, setJumpToBlock] = useState(null); // blockId to auto-expand when switching to Today
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

  const handleAddRoutine = r => setData(d => ({ ...d, routineBlocks: [...(d.routineBlocks||[]), r] }));
  const handleQuickAdd = item => {
    setData(d => ({
      ...d,
      inbox: [...(d.inbox || []), { id: item.id, text: item.text, createdAt: item.createdAt || Date.now() }]
    }));
  };
  const handleCategorize = (itemId, projectId, markDone = false) => setData(d => {
    const item = d.inbox.find(i => i.id===itemId);
    if (!item || !projectId) return d;
    return { ...d, inbox: d.inbox.filter(i=>i.id!==itemId), projects: d.projects.map(p => p.id===projectId ? { ...p, tasks: [...p.tasks,{id:uid(),text:item.text,done:markDone}] } : p) };
  });
  const handleDismissInbox = itemId => setData(d => ({ ...d, inbox: d.inbox.filter(i=>i.id!==itemId) }));
  const handleDoToday = itemId => setData(d => {
    const item = d.inbox.find(i => i.id === itemId);
    if (!item) return d;
    return {
      ...d,
      inbox: d.inbox.filter(i => i.id !== itemId),
      looseTasks: [...(d.looseTasks || []), { id: uid(), domainId: null, text: item.text, done: false, doneAt: null }],
    };
  });

  return (
    <>
      <style>{css}</style>
      <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background: lightMode ? "#E8E4DE" : "#101213" }}>
        <div className={`phone ${lightMode ? "light" : ""}`}>
          {!data.onboardingDone && (
            <OnboardingFlow onDone={() => setData(d => ({ ...d, onboardingDone: true }))} />
          )}
          {tab==="today"    && <TodayScreen    data={data} setData={setData} openShutdown={()=>setSheet("shutdown")} onSignOut={() => supabase.auth.signOut()} jumpToBlock={jumpToBlock} onClearJump={() => setJumpToBlock(null)} />}
          {tab==="projects" && <ProjectsScreen data={data} setData={setData} openCategorize={()=>setSheet("categorize")} />}
          {tab==="plan"     && <PlanScreen     data={data} setData={setData} onGoToSeason={()=>setTab("season")} lightMode={lightMode} toggleTheme={toggleTheme} />}
          {tab==="season"  && <SeasonScreen   data={data} setData={setData} />}

          {sheet==="shutdown"  && <ShutdownSheet    onClose={closeSheet} onComplete={()=>setData(d=>({...d,shutdownDone:true,shutdownDate:toISODate()}))} alreadyDone={data.shutdownDone} data={data} onCategorizeLoose={(taskId, domainId) => setData(d => {
              const todayISO = new Date().toISOString().slice(0,10);
              // Assign domain + remove from todayLoosePicks (it's now categorized)
              const picks = (d.todayLoosePicks||{})[todayISO] || [];
              const newPicks = picks.filter(id => id !== taskId);
              return {
                ...d,
                looseTasks: (d.looseTasks||[]).map(t => t.id === taskId ? { ...t, domainId } : t),
                todayLoosePicks: { ...(d.todayLoosePicks||{}), [todayISO]: newPicks }
              };
            })} />}
          {sheet==="addblock"  && <AddBlockSheet    data={data} onClose={closeSheet} onAddRoutine={handleAddRoutine} />}

          {sheet==="categorize"&& <CategorizeSheet  data={data} onClose={closeSheet} onCategorize={handleCategorize} onDismiss={handleDismissInbox} onDoToday={handleDoToday} />}

          {captureOpen && (
            <QuickReminders
              onClose={() => setCaptureOpen(false)}
              onAddCaptured={item => setData(d => ({ ...d, captured: [...(d.captured||[]), item] }))}
              existingCaptured={data.captured||[]}
            />
          )}

          <div className="nav">
            {/* Today + Projects */}
            {NAV_ITEMS.slice(0,2).map(n => (
              <div key={n.id} className={`nav-btn ${tab===n.id?"on":""}`} onClick={()=>setTab(n.id)}>
                {n.id === "projects" && ((data.inbox||[]).length > 0 || (data.captured||[]).length > 0) && (
                  <span className={`nav-dot${(data.inbox||[]).some(i => i.createdAt && Date.now() - i.createdAt > 2 * 24 * 60 * 60 * 1000) ? " urgent" : ""}`} />
                )}
                <span className="nav-ico"><NavIcon id={n.id} active={tab===n.id} /></span>
                <span className="nav-lbl">{n.lbl}</span>
              </div>
            ))}

            {/* Center FAB */}
            <button
              className={`fab${captureOpen ? " open" : ""}`}
              onClick={() => setCaptureOpen(v => !v)}
            >
              {captureOpen
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              }
            </button>

            {/* Week + Season */}
            {NAV_ITEMS.slice(2).map(n => (
              <div key={n.id} className={`nav-btn ${tab===n.id?"on":""}`} onClick={()=>setTab(n.id)}>
                <span className="nav-ico"><NavIcon id={n.id} active={tab===n.id} /></span>
                <span className="nav-lbl">{n.lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
