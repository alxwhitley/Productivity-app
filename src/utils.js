import { STORAGE_KEY, MIGRATIONS, FIELD_DEFAULTS } from "./constants.js";

export function fmtTime(h, m) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hh}:${m.toString().padStart(2,"0")} ${ampm}`;
}

// Returns "YYYY-MM-DD" for a given Date (or today if omitted)
export function toISODate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export function fmtRange(h, m, dur) {
  const end = h * 60 + m + dur;
  return `${fmtTime(h, m)} – ${fmtTime(Math.floor(end/60), end%60)}`;
}

export function getPct(tasks) {
  if (!tasks.length) return 0;
  return Math.round(tasks.filter(t=>t.done).length / tasks.length * 100);
}

export function uid() { return `id${Date.now()}${Math.random().toString(36).slice(2,6)}`; }

export function getRoutinesForDate(routineBlocks, date) {
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

// ── Deep merge: add missing keys from defaults without touching existing ones ─
export function applyDefaults(saved, defaults) {
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
export function loadData() {
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
