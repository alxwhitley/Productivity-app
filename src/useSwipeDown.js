import { useState, useRef } from "react";

export default function useSwipeDown(onClose) {
  const startY = useRef(null);
  const [dy, setDy] = useState(0);

  const onTouchStart = e => { startY.current = e.touches[0].clientY; };
  const onTouchMove  = e => {
    if (startY.current === null) return;
    const d = e.touches[0].clientY - startY.current;
    if (d > 0) { e.preventDefault(); setDy(d); }
  };
  const onTouchEnd = () => {
    if (dy > 80) onClose();
    setDy(0);
    startY.current = null;
  };

  const style = {
    transform: `translateY(${dy}px)`,
    transition: dy === 0 ? "transform .25s ease" : "none",
  };

  return { onTouchStart, onTouchMove, onTouchEnd, style };
}
