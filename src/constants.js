// Neutral domain palette — does not conflict with app-level semantic colors
// Slate, Rose, Sand, Sage, Dusk, Stone
export const DOMAIN_COLORS = ["#E8603C","#5BA8D4","#C46BAE","#7EC8A0"];

export const INITIAL_DATA = {
  domains: [
    { id: "domain-1", name: "Work", color: "#5BA8D4" },
  ],
  projects: [
    { id: "proj-1", domainId: "domain-1", name: "My First Project", status: "active", tasks: [
      { id: "task-1", text: "Break this project into smaller tasks", done: false },
      { id: "task-2", text: "Assign a Deep Work block to focus on it", done: false },
      { id: "task-3", text: "Check off tasks as you go", done: false },
    ]},
    { id: "proj-2", domainId: "domain-1", name: "Learn Clearwork", status: "active", tasks: [
      { id: "task-4", text: "Explore the Today tab", done: false },
      { id: "task-5", text: "Add a project in the Projects tab", done: false },
      { id: "task-6", text: "Set a season goal below", done: false },
    ]},
  ],
  blocks: [],
  inbox: [],
  looseTasks: [
    { id: "lt-1", text: "Swipe me left to queue for Shallow Work", done: false, domainId: null },
    { id: "lt-2", text: "Swipe me right to mark as a Quick Win", done: false, domainId: null },
  ],
  weekIntention: "",
  shutdownDone: false,
  shutdownDate: null,
  seasonGoals: [
    { id: "sg-1", text: "Complete one meaningful project this season", domainId: "domain-1", done: false },
    { id: "sg-2", text: "Build a daily Deep Work habit", domainId: "domain-1", done: false },
  ],
  workWeek: [2,3,4,5,6],
  emptyBlocks: [],
  reviewData: {
    domainBlocks: {},
    projectProgress: {},
    daysWorked: [],
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

export const SCHEMA_VERSION = 9;
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
  seasonGoals:    [], // [{ id, text, type, domainId, done }] — type: "essential"|"maintain"|"bonus"
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
  taskCompletions: {}, // { [dateISO]: [taskId, ...] } — tasks completed today, cleared on shutdown
  taskQueueOrder:  [], // [taskId, ...] — explicit ordering of queue, preserves position for unchecking
  deepWorkSlots: {}, // { [dateStr]: [{ projectId, startHour, startMin, durationMin, todayTasks }] }
  todayLoosePicks: {}, // { [dateStr]: [looseTaskId, ...] } — tasks picked for today's loose block
  onboardingDone: false,
  sessionLog: [], // [{ id, projectId, date, durationMin, note }]
  shutdownTriggerHour: 16, // 4 PM default
  leadDomino: "", // "most important thing tomorrow" from shutdown ritual
  onboardingHints: { swipeChevronSeen: false, dwSlotPulseSeen: false },
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
        ...inbox.map(i => ({ id: i.id, text: i.text, createdAt: i.createdAt || Date.now(), quickWin: false })),
        ...captured.map(c => ({ id: c.id, text: c.text, createdAt: c.createdAt || Date.now(), quickWin: false })),
      ];
      const next = { ...data, fabQueue, shallowWork: data.shallowWork || {}, deepWorkHours: data.deepWorkHours || {}, schemaVersion: 4 };
      delete next.inbox;
      delete next.captured;
      return next;
    }
  },
  // v5: add type field to projects (from mode, defaulting to "tasks")
  {
    version: 5,
    up: (data) => ({
      ...data,
      projects: (data.projects || []).map(p => ({ ...p, type: p.mode || p.type || "tasks" })),
      schemaVersion: 5,
    })
  },
  // v6: migrate domain colors from brand palette to neutral palette
  {
    version: 6,
    up: (data) => {
      const colorMap = {
        "#5B8AF0": "#5BA8D4", // Blue → Sky
        "#5b8af0": "#5BA8D4",
        "#E8A030": "#E8603C", // Amber → Flame
        "#e8a030": "#E8603C",
        "#45C17A": "#7EC8A0", // Green → Mint
        "#45c17a": "#7EC8A0",
        "#9B72CF": "#C46BAE", // Purple → Fuchsia
        "#9b72cf": "#C46BAE",
        "#8A9BB0": "#5BA8D4", // old Slate → Sky
        "#8a9bb0": "#5BA8D4",
      };
      const migrate = (color) => colorMap[color] || colorMap[color?.toLowerCase()] || "#5BA8D4";
      return {
        ...data,
        domains: (data.domains || []).map(d => ({ ...d, color: migrate(d.color) })),
        schemaVersion: 6,
      };
    }
  },
  // v7: add type field to seasonGoals (default "essential" for existing goals)
  {
    version: 7,
    up: (data) => ({
      ...data,
      seasonGoals: (data.seasonGoals || []).map(g => ({ type: "essential", ...g })),
      schemaVersion: 7,
    })
  },
  // v8: migrate shallowWork → looseTasks + todayLoosePicks, retire shallowWork
  {
    version: 8,
    up: (data) => {
      const sw = data.shallowWork || {};
      const looseTasks = [...(data.looseTasks || [])];
      const picks = { ...(data.todayLoosePicks || {}) };
      const existingIds = new Set(looseTasks.map(t => t.id));

      for (const [dateISO, tasks] of Object.entries(sw)) {
        const datePicks = [...(picks[dateISO] || [])];
        for (const t of (tasks || [])) {
          if (!existingIds.has(t.id)) {
            looseTasks.push({ id: t.id, text: t.text, done: t.done ?? false, doneAt: t.doneAt || null, domainId: t.domainId || null, quickWin: false });
            existingIds.add(t.id);
          }
          if (!datePicks.includes(t.id)) {
            datePicks.push(t.id);
          }
        }
        picks[dateISO] = datePicks;
      }

      const next = { ...data, looseTasks, todayLoosePicks: picks, schemaVersion: 8 };
      delete next.shallowWork;
      return next;
    }
  },
  // v9: migrate domain colors from old neutral palette to new vibrant palette
  {
    version: 9,
    up: (data) => {
      const colorMap = {
        "#6B7A8D": "#5BA8D4", // Slate → Sky
        "#6b7a8d": "#5BA8D4",
        "#C47A7A": "#E8603C", // Rose → Flame
        "#c47a7a": "#E8603C",
        "#B89B6A": "#E8603C", // Sand → Flame
        "#b89b6a": "#E8603C",
        "#7A9E7E": "#7EC8A0", // Sage → Mint
        "#7a9e7e": "#7EC8A0",
        "#8A7AAE": "#C46BAE", // Dusk → Fuchsia
        "#8a7aae": "#C46BAE",
        "#8A9099": "#5BA8D4", // Stone → Sky
        "#8a9099": "#5BA8D4",
      };
      const migrate = (color) => colorMap[color] || colorMap[color?.toLowerCase()] || "#5BA8D4";
      return {
        ...data,
        domains: (data.domains || []).map(d => ({ ...d, color: migrate(d.color) })),
        schemaVersion: 9,
      };
    }
  },
];
