export default function NavIcon({ id, active }) {
  // Bold, simple shapes — readable at 22px. All use currentColor.
  if (id === "today") return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Clock — thick stroke, large hands */}
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 8v4.5l3 1.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (id === "projects") return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 2×2 grid — large rounded squares with clear gaps */}
      <rect x="3" y="3" width="8" height="8" rx="2.5" stroke="currentColor" strokeWidth="2"/>
      <rect x="13" y="3" width="8" height="8" rx="2.5" stroke="currentColor" strokeWidth="2"/>
      <rect x="3" y="13" width="8" height="8" rx="2.5" stroke="currentColor" strokeWidth="2"/>
      <rect x="13" y="13" width="8" height="8" rx="2.5" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
  if (id === "plan") return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Calendar — clean, no internal dots (too small to read) */}
      <rect x="3" y="6" width="18" height="15" rx="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 11h18" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 3v5M16 3v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
  if (id === "season") return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sun — larger core, only 4 rays (diagonal look cleaner at small size) */}
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M5.6 5.6L7.4 7.4M16.6 16.6L18.4 18.4M18.4 5.6L16.6 7.4M7.4 16.6L5.6 18.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  return null;
}
