import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";
import { STORAGE_KEY, FIELD_DEFAULTS, MIGRATIONS } from "./constants.js";
import { applyDefaults, loadData } from "./utils.js";

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
export default function useData(userId) {
  const [data, setData] = useState(() => loadData());
  const userIdRef = useRef(userId);
  const lastLocalSave = useRef(0); // timestamp of last local setData
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Wrap setData to track when local changes happen
  const setDataTracked = (updater) => {
    lastLocalSave.current = Date.now();
    setData(updater);
  };

  // Load from Supabase on login
  useEffect(() => {
    if (!userId) return;
    const fetchStart = Date.now();
    supabase.from("user_data").select("data, updated_at").eq("user_id", userId).single()
      .then(({ data: row, error }) => {
        if (row?.data) {
          // Skip if user made local changes after we started fetching
          if (lastLocalSave.current > fetchStart) return;
          // Run all pending migrations on raw data first
          let migrated = { ...row.data };
          const savedVersion = migrated.schemaVersion || 0;
          for (const m of MIGRATIONS) {
            if (m.version > savedVersion || m.force) {
              migrated = m.up(migrated);
            }
          }
          // Then apply defaults for any missing keys
          migrated = applyDefaults(migrated, FIELD_DEFAULTS);
          setData(migrated);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch {}
        }
      });
  }, [userId]);

  // Debounced save on every data change
  const saveTimer = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveData(data, userIdRef.current);
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  // Flush pending save on page unload so refreshes don't lose data
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dataRef.current)); } catch {}
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  return [data, setDataTracked];
}
