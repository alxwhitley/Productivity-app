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

export function getBioPhase(wakeUpTime) {
  const wake = wakeUpTime || { hour: 7, min: 0 };
  const now = new Date();
  const wakeMinutes = wake.hour * 60 + wake.min;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let mins = nowMinutes - wakeMinutes;
  if (mins < 0) mins += 24 * 60;
  const hrs = mins / 60;
  if (hrs < 7)  return { phase: "DEEP",     label: "Mental Peak",  color: "var(--blue)",   bgColor: "rgba(91,138,240,.12)", advice: "Your neurons are sharpest now. Best for hard thinking, complex decisions, deep problem-solving." };
  if (hrs < 10) return { phase: "RECOVER",  label: "Second Wind",  color: "var(--green)",  bgColor: "rgba(69,193,122,.10)", advice: "A genuine second peak. Good for creative synthesis and complex planning." };
  if (hrs < 13) return { phase: "TROUGH",   label: "Shallow Work", color: "var(--text2)",  bgColor: "rgba(154,149,145,.08)", advice: "Energy is lower. Good for admin, follow-up, and tasks that don't need full focus." };
  return           { phase: "SHUTDOWN", label: "Wind Down",    color: "var(--accent)", bgColor: "rgba(232,160,48,.10)", advice: "Late in the day. Wrap-up only — avoid starting anything that needs deep concentration." };
}

export function getSlotBioPhase(startHour, startMin, wakeUpTime) {
  const wake = wakeUpTime || { hour: 7, min: 0 };
  const wakeMinutes = wake.hour * 60 + wake.min;
  const slotMinutes = startHour * 60 + startMin;
  let mins = slotMinutes - wakeMinutes;
  if (mins < 0) mins += 24 * 60;
  const hrs = mins / 60;
  if (hrs < 7)  return { label: "Mental Peak",  color: "var(--blue)",   bgColor: "rgba(91,138,240,.12)", advice: "Peak neurochemical window — best for hard analysis and deep problem-solving." };
  if (hrs < 10) return { label: "Second Wind",  color: "var(--green)",  bgColor: "rgba(69,193,122,.10)", advice: "A genuine second peak. Good for creative synthesis and complex planning." };
  if (hrs < 13) return { label: "Shallow Work", color: "var(--text2)",  bgColor: "rgba(154,149,145,.08)", advice: "Lower energy window. Good for admin and review." };
  return           { label: "Wind Down",   color: "var(--accent)", bgColor: "rgba(232,160,48,.10)", advice: "Late in the day. Wrap-up tasks only." };
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
