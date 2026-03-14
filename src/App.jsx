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
import ProfileScreen from "./screens/ProfileScreen.jsx";

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
    shallowWork: data.shallowWork || {},
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
  };

  return (
    <>
      <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background: lightMode ? "#E8E4DE" : "#101213" }}>
        <div className={`phone ${lightMode ? "light" : ""}`}>
          {!safeData.onboardingDone && (
            <OnboardingFlow onDone={() => setData(d => ({ ...d, onboardingDone: true }))} />
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

          {profileOpen && (
            <ProfileScreen
              data={safeData}
              setData={setData}
              onClose={() => setProfileOpen(false)}
            />
          )}

          {/* Profile icon — top-right, all tabs */}
          <button className="profile-btn" onClick={() => setProfileOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Back button — Work tab only */}
          {tab === "work" && (
            <button className="work-back-btn" onClick={() => setTab("tasks")}>← Tasks</button>
          )}

          {/* Floating pill nav — hidden when Work tab is active */}
          {tab !== "work" && (
            <div className="pill-nav">
              {[
                { id: "work", lbl: "Work" },
                { id: "tasks", lbl: "Tasks" },
                { id: "projects", lbl: "Projects" },
              ].map(n => (
                <button
                  key={n.id}
                  className={`pill-nav-btn ${tab === n.id ? "active" : ""}`}
                  onClick={() => setTab(n.id)}
                >
                  {n.lbl}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
