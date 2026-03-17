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
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Load from Supabase on login
  useEffect(() => {
    if (!userId) return;
    supabase.from("user_data").select("data").eq("user_id", userId).single()
      .then(({ data: row, error }) => {
        if (row?.data) {
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
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveData(data, userIdRef.current);
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  return [data, setData];
}
