// ARCHITECTURE RULE: All components must be defined at the top level as function declarations.
// Never define components inside other components, render functions, or IIFEs.

import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { THEME_KEY } from "./constants.js";
import { toISODate, uid } from "./utils.js";
import useData from "./useData.js";
import "./clearwork.css";
import NavIcon from "./components/NavIcon.jsx";
import OnboardingFlow from "./components/OnboardingFlow.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import ShutdownSheet from "./sheets/ShutdownSheet.jsx";
import AddBlockSheet from "./sheets/AddBlockSheet.jsx";
import QuickReminders from "./sheets/QuickReminders.jsx";
import CategorizeSheet from "./sheets/CategorizeSheet.jsx";
import TodayScreen from "./screens/TodayScreen.jsx";
import ProjectsScreen from "./screens/ProjectsScreen.jsx";
import PlanScreen from "./screens/PlanScreen.jsx";
import SeasonScreen from "./screens/SeasonScreen.jsx";


const NAV_ITEMS = [
  { id:"today",    lbl:"Today"    },
  { id:"projects", lbl:"Projects" },
  { id:"plan",     lbl:"Week"     },
  { id:"season",   lbl:"Season"   },
];

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

  const safeData = {
    ...data,
    domains: data.domains || [],
    projects: data.projects || [],
    blocks: data.blocks || [],
    inbox: data.inbox || [],
    looseTasks: data.looseTasks || [],
    deepWorkSlots: data.deepWorkSlots || {},
    deepWorkTargets: data.deepWorkTargets || { dailyHours: 4, weeklyHours: 20, maxDeepBlocks: 3 },
    todayPrefs: data.todayPrefs || { name: '', showShutdown: true },
    routineBlocks: data.routineBlocks || [],
    seasonGoals: data.seasonGoals || [],
    blockCompletions: data.blockCompletions || [],
    todayLoosePicks: data.todayLoosePicks || {},
    captured: data.captured || [],
    sessionLog: data.sessionLog || [],
    emptyBlocks: data.emptyBlocks || [],
    workWeek: data.workWeek || [2,3,4,5,6],
    reviewData: data.reviewData || { domainBlocks: {}, projectProgress: {}, daysWorked: [] },
  };

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
      <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background: lightMode ? "#E8E4DE" : "#101213" }}>
        <div className={`phone ${lightMode ? "light" : ""}`}>
          {!safeData.onboardingDone && (
            <OnboardingFlow onDone={() => setData(d => ({ ...d, onboardingDone: true }))} />
          )}
          {tab==="today"    && <TodayScreen    data={safeData} setData={setData} openShutdown={()=>setSheet("shutdown")} onSignOut={() => supabase.auth.signOut()} jumpToBlock={jumpToBlock} onClearJump={() => setJumpToBlock(null)} setTab={setTab} />}
          {tab==="projects" && <ProjectsScreen data={safeData} setData={setData} openCategorize={()=>setSheet("categorize")} />}
          {tab==="plan"     && <PlanScreen     data={safeData} setData={setData} onGoToSeason={()=>setTab("season")} lightMode={lightMode} toggleTheme={toggleTheme} />}
          {tab==="season"  && <SeasonScreen   data={safeData} setData={setData} />}

          {sheet==="shutdown"  && <ShutdownSheet    onClose={closeSheet} onComplete={()=>setData(d=>({...d,shutdownDone:true,shutdownDate:toISODate()}))} alreadyDone={safeData.shutdownDone} data={safeData} onCategorizeLoose={(taskId, domainId) => setData(d => {
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
          {sheet==="addblock"  && <AddBlockSheet    data={safeData} onClose={closeSheet} onAddRoutine={handleAddRoutine} />}

          {sheet==="categorize"&& <CategorizeSheet  data={safeData} onClose={closeSheet} onCategorize={handleCategorize} onDismiss={handleDismissInbox} onDoToday={handleDoToday} />}

          {captureOpen && (
            <QuickReminders
              onClose={() => setCaptureOpen(false)}
              onAddCaptured={item => setData(d => ({ ...d, captured: [...(d.captured||[]), item] }))}
              existingCaptured={safeData.captured}
            />
          )}

          <div className="nav">
            {/* Today + Projects */}
            {NAV_ITEMS.slice(0,2).map(n => (
              <div key={n.id} className={`nav-btn ${tab===n.id?"on":""}`} onClick={()=>setTab(n.id)}>
                {n.id === "projects" && (safeData.inbox.length > 0 || safeData.captured.length > 0) && (
                  <span className={`nav-dot${safeData.inbox.some(i => i.createdAt && Date.now() - i.createdAt > 2 * 24 * 60 * 60 * 1000) ? " urgent" : ""}`} />
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
