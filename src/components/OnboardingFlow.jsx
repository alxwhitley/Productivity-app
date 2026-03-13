import { useState, useRef } from "react";
import OnboardingIllustration from "./OnboardingIllustration.jsx";
import StatusBar from "./StatusBar.jsx";

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

export default function OnboardingFlow({ onDone }) {
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
