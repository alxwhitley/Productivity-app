export default function OnboardingIllustration({ type, accent }) {
  if (type === "welcome") return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="48" stroke={accent} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.3"/>
      <circle cx="60" cy="60" r="32" stroke={accent} strokeWidth="1.5" opacity="0.5"/>
      <circle cx="60" cy="60" r="14" fill={accent} opacity="0.9"/>
      <path d="M60 12V24M60 96V108M12 60H24M96 60H108" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
    </svg>
  );
  if (type === "deepwork") return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {/* Timeline blocks */}
      <rect x="16" y="30" width="88" height="14" rx="4" fill={accent} opacity="0.15" stroke={accent} strokeWidth="1.5"/>
      <rect x="16" y="53" width="56" height="28" rx="6" fill={accent} opacity="0.9"/>
      <rect x="16" y="53" width="4" height="28" rx="2" fill="#fff" opacity="0.5"/>
      <text x="26" y="63" fill="#000" fontSize="8" fontWeight="700" opacity="0.8">DEEP WORK</text>
      <text x="26" y="74" fill="#000" fontSize="7" opacity="0.7">90 min · no interruptions</text>
      <rect x="16" y="90" width="36" height="10" rx="3" fill={accent} opacity="0.2" stroke={accent} strokeWidth="1"/>
      <rect x="58" y="90" width="46" height="10" rx="3" fill={accent} opacity="0.1" stroke={accent} strokeWidth="1" strokeDasharray="3 2"/>
    </svg>
  );
  if (type === "tasks") return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {/* Long overwhelming list (faded) */}
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x="16" y={18 + i*10} width={60 - i*4} height="6" rx="3" fill="#666" opacity={0.12 + i*0.02}/>
      ))}
      {/* Arrow */}
      <path d="M88 60L76 54V58H64V62H76V66L88 60Z" fill={accent} opacity="0.7"/>
      {/* Clean structured view */}
      <rect x="92" y="30" width="12" height="12" rx="3" fill="#5B8AF0" opacity="0.8"/>
      <rect x="92" y="47" width="12" height="12" rx="3" fill="#9B72CF" opacity="0.8"/>
      <rect x="92" y="64" width="12" height="12" rx="3" fill={accent} opacity="0.8"/>
      <rect x="106" y="33" width="8" height="2.5" rx="1.5" fill="#fff" opacity="0.4"/>
      <rect x="106" y="37" width="5" height="2" rx="1" fill="#fff" opacity="0.25"/>
      <rect x="106" y="50" width="8" height="2.5" rx="1.5" fill="#fff" opacity="0.4"/>
      <rect x="106" y="54" width="6" height="2" rx="1" fill="#fff" opacity="0.25"/>
      <rect x="106" y="67" width="8" height="2.5" rx="1.5" fill="#fff" opacity="0.4"/>
    </svg>
  );
  if (type === "season") return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {/* Quarter arc */}
      <path d="M60 20 A40 40 0 0 1 100 60" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.3"/>
      <path d="M60 20 A40 40 0 0 1 100 60" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeDasharray="0 100" opacity="0"/>
      <circle cx="60" cy="20" r="4" fill={accent} opacity="0.5"/>
      <circle cx="100" cy="60" r="4" fill={accent} opacity="0.5"/>
      {/* Goal rows */}
      {[0,1,2,3].map(i => (
        <g key={i}>
          <circle cx="28" cy={52 + i*14} r="4" stroke={accent} strokeWidth="1.5" fill={i < 2 ? accent : "none"} opacity="0.8"/>
          <rect x="38" y={49 + i*14} width={i===0?52:i===1?40:44} height="6" rx="3" fill={accent} opacity={i < 2 ? 0.4 : 0.15}/>
        </g>
      ))}
    </svg>
  );
  if (type === "shutdown") return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {/* Power symbol */}
      <path d="M60 28V52" stroke={accent} strokeWidth="3" strokeLinecap="round"/>
      <path d="M44 38 A26 26 0 1 0 76 38" stroke={accent} strokeWidth="3" strokeLinecap="round" fill="none"/>
      {/* Check marks below */}
      <rect x="24" y="80" width="72" height="22" rx="6" fill={accent} opacity="0.12" stroke={accent} strokeWidth="1" strokeDasharray="3 2"/>
      <path d="M34 91l5 5 9-9" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="52" y="88" width="36" height="3" rx="1.5" fill={accent} opacity="0.35"/>
      <rect x="52" y="93" width="24" height="3" rx="1.5" fill={accent} opacity="0.2"/>
    </svg>
  );
  return null;
}
