export default function WaveIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}>
      <path d="M2 12c1.5-4 3-6 4.5-6S9 9 10.5 12s3 6 4.5 6 3-3 4.5-6 3-6 4.5-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
