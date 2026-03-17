// ARCHITECTURE RULE: All components must be defined at the top level as function declarations.
// Never define components inside other components, render functions, or IIFEs.

import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { THEME_KEY } from "./constants.js";
import { toISODate } from "./utils.js";
import useData from "./useData.js";
import "./clearwork.css";
import OnboardingFlow from "./components/OnboardingFlow.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import WorkScreen from "./screens/WorkScreen.jsx";
import TasksScreen from "./screens/TasksScreen.jsx";
import ProjectsScreen from "./screens/ProjectsScreen.jsx";
import SeasonScreen from "./screens/SeasonScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import ShutdownRitualScreen from "./screens/ShutdownRitualScreen.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id || null;
  const [data, setData] = useData(userId);
  const [tab, setTab] = useState("tasks"); // default tab
  const [profileOpen, setProfileOpen] = useState(false);
  const [shutdownRitualOpen, setShutdownRitualOpen] = useState(false);

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

  const safeData = {
    ...data,
    domains: data.domains || [],
    projects: data.projects || [],
    blocks: data.blocks || [],
    looseTasks: data.looseTasks || [],
    fabQueue: data.fabQueue || [],
    deepWorkHours: data.deepWorkHours || {},
    deepWorkSlots: data.deepWorkSlots || {},
    deepWorkTargets: data.deepWorkTargets || { dailyHours: 4, weeklyHours: 20, maxDeepBlocks: 3 },
    todayPrefs: data.todayPrefs || { name: "", showShutdown: true },
    routineBlocks: data.routineBlocks || [],
    seasonGoals: data.seasonGoals || [],
    blockCompletions: data.blockCompletions || [],
    todayLoosePicks: data.todayLoosePicks || {},
    sessionLog: data.sessionLog || [],
    emptyBlocks: data.emptyBlocks || [],
    workWeek: data.workWeek || [2,3,4,5,6],
    reviewData: data.reviewData || { domainBlocks: {}, projectProgress: {}, daysWorked: [] },
    shutdownTriggerHour: data.shutdownTriggerHour ?? 16,
    leadDomino: data.leadDomino || "",
  };

  // ── Shutdown banner logic ──
  const now = new Date();
  const todayISO = toISODate(now);
  const currentHour = now.getHours();
  const shutdownDoneToday = safeData.shutdownDone && safeData.shutdownDate === todayISO;

  // Check if all DW blocks are complete or skipped
  const todayDateStr = new Date().toDateString();
  const allDWComplete = (() => {
    const completions = safeData.blockCompletions.filter(c => c.date === todayDateStr);
    const resolvedIds = new Set(completions.map(c => c.blockId));
    const maxBlocks = safeData.deepWorkTargets?.maxDeepBlocks ?? 3;
    if (maxBlocks === 0) return true;
    let allDone = true;
    for (let i = 0; i < maxBlocks; i++) {
      if (!resolvedIds.has(`dw-${todayISO}-${i}`)) { allDone = false; break; }
    }
    return allDone;
  })();

  const showBanner = currentHour >= safeData.shutdownTriggerHour || allDWComplete;

  return (
    <>
      <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background: lightMode ? "#E8E4DE" : "#101213" }}>
        <div className={`phone ${lightMode ? "light" : ""}`}>
          {!safeData.onboardingDone && (
            <OnboardingFlow onDone={() => setData(d => ({ ...d, onboardingDone: true }))} />
          )}

          {/* Shutdown pill — top of screen, in flow */}
          {showBanner && (
            <div
              onClick={() => !shutdownDoneToday && setShutdownRitualOpen(true)}
              style={{
                width: "52%", margin: "10px auto", height: 36,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                borderRadius: 20,
                background: shutdownDoneToday
                  ? "#0A0A0A"
                  : "#0A0A0A",
                border: shutdownDoneToday
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "1px solid rgba(255,255,255,0.12)",
                borderTop: shutdownDoneToday
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "1px solid rgba(255,255,255,0.18)",
                boxShadow: shutdownDoneToday
                  ? "none"
                  : "0 8px 32px rgba(0,0,0,0.6)",
                color: shutdownDoneToday ? "var(--text3)" : "#fff",
                fontSize: 13, fontWeight: 600,
                cursor: shutdownDoneToday ? "default" : "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <span style={{ display: "flex", alignItems: "center" }}>{shutdownDoneToday ? "✓" : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</span>
              <span>{shutdownDoneToday ? "Shutdown complete" : "Shutdown ritual →"}</span>
            </div>
          )}

          {tab === "work" && (
            <WorkScreen
              data={safeData}
              setData={setData}
              onGoToTasks={() => setTab("tasks")}
            />
          )}
          {tab === "tasks" && (
            <TasksScreen
              data={safeData}
              setData={setData}
            />
          )}
          {tab === "projects" && (
            <ProjectsScreen
              data={safeData}
              setData={setData}
            />
          )}
          {tab === "season" && (
            <SeasonScreen
              data={safeData}
              setData={setData}
              onOpenProfile={() => setProfileOpen(true)}
            />
          )}

          {profileOpen && (
            <ProfileScreen
              data={safeData}
              setData={setData}
              onClose={() => setProfileOpen(false)}
            />
          )}

          {shutdownRitualOpen && (
            <ShutdownRitualScreen
              data={safeData}
              setData={setData}
              onClose={() => setShutdownRitualOpen(false)}
            />
          )}

          {/* Floating pill nav — always visible */}
          <div className="pill-nav">
            {[
              { id: "work", lbl: "Work", icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )},
              { id: "tasks", lbl: "Tasks", icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )},
              { id: "projects", lbl: "Projects", icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )},
              { id: "season", lbl: "Season", icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10" stroke="currentColor" strokeWidth="2" />
                  <path d="M2 12h20" stroke="currentColor" strokeWidth="2" />
                </svg>
              )},
            ].map(n => (
              <button
                key={n.id}
                className={`pill-nav-btn ${tab === n.id ? "active" : ""}`}
                onClick={() => setTab(n.id)}
              >
                <span className="pill-nav-icon">{n.icon}</span>
                <span className="pill-nav-label">{n.lbl}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
