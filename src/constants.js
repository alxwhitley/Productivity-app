// 5 colors mapped to Huberman's psychology of motivation:
// Blue=deep focus, Amber=drive/dopamine, Green=completion/recovery, Purple=identity/seasons, Slate=neutral/admin
export const DOMAIN_COLORS = ["#5B8AF0","#E8A030","#45C17A","#9B72CF","#8A9BB0"];

export const INITIAL_DATA = {
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

export const SCHEMA_VERSION = 4;
export const STORAGE_KEY    = "nave_data_v1";       // new key — clean break from momentum_v2
export const THEME_KEY      = "nave_theme";

// ── Supabase config (fill in when ready) ────────────────────────────────────
export const USE_SUPABASE    = true;
export const SUPABASE_URL    = "https://fezgmuhrgbtzlworbsep.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlemdtdWhyZ2J0emx3b3Jic2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjgyNTEsImV4cCI6MjA4ODc0NDI1MX0.YxHafnW1m287XRDiiRWTIPF2rKA1xEsQ4ArCeJO0ul8";

// ── Field defaults — merged over any saved data so new fields always exist ──
export const FIELD_DEFAULTS = {
  schemaVersion:  SCHEMA_VERSION,
  domains:        INITIAL_DATA.domains,
  projects:       INITIAL_DATA.projects,
  blocks:         INITIAL_DATA.blocks,
  looseTasks:     [],
  fabQueue:       [], // [{ id, text, createdAt, quickWin: false }]
  shallowWork:    {}, // { [dateISO]: [{ id, text, domainId, sourceType, sourceId, done, doneAt, addedAt }] }
  deepWorkHours:  {}, // { [dateISO]: number } — minutes of deep work logged per day
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
};

// ── Deep work slot defaults ──────────────────────────────────────────────────
export const DEFAULT_DEEP_SLOTS = [
  { slotIndex: 0, startHour: 9,  startMin: 0,  durationMin: 90, blockType: "analytical",
    hint: "Block 1", hintDetail: "Peak neurochemical window — best for hard analysis, complex decisions, and deep problem-solving." },
  { slotIndex: 1, startHour: 12, startMin: 0,  durationMin: 90, blockType: "creative",
    hint: "Block 2",   hintDetail: "Post-peak window — excellent for generative work, writing, and ideation." },
  { slotIndex: 2, startHour: 15, startMin: 0,  durationMin: 90, blockType: "generative",
    hint: "Block 3", hintDetail: "Third block — strong for execution-focused work: building, shipping, tasks you know well." },
];

// Resolve the live slot definitions: user's saved deepBlockDefaults override the built-in defaults
export function getDeepSlots(data) {
  const saved = data.deepBlockDefaults;
  if (!saved || !saved.length) return DEFAULT_DEEP_SLOTS;
  return saved.map((s, i) => ({ ...(DEFAULT_DEEP_SLOTS[i] || DEFAULT_DEEP_SLOTS[0]), ...s, slotIndex: i }));
}

// ── Migrations — run in order when schema version is behind ─────────────────
// Each entry: { version: N, up: (data) => newData }
// Add a new entry here whenever SCHEMA_VERSION bumps.
export const MIGRATIONS = [
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
  // v4: move inbox → fabQueue, add shallowWork + deepWorkHours, remove captured
  {
    version: 4,
    up: (data) => {
      const inbox = data.inbox || [];
      const captured = data.captured || [];
      const fabQueue = [
        ...inbox.map(i => ({ id: i.id, text: i.text, createdAt: i.createdAt || Date.now() })),
        ...captured.map(c => ({ id: c.id, text: c.text, createdAt: c.createdAt || Date.now() })),
      ];
      const next = { ...data, fabQueue, shallowWork: data.shallowWork || {}, deepWorkHours: data.deepWorkHours || {}, schemaVersion: 4 };
      delete next.inbox;
      delete next.captured;
      return next;
    }
  },
];
