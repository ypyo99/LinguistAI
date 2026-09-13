import { useState, useRef, useCallback } from 'react';

export default function LongPressButton({ onLongPress, onClick, delay = 600, children, ...props }) {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);

  const startPress = useCallback((e) => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress(e);
      setIsPressing(false);
    }, delay);
    setIsPressing(true);
  }, [onLongPress, delay]);

  const cancelPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressing(false);
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressing(false);
    
    // Only trigger onClick if it wasn't a long press
    if (!isLongPressRef.current) {
      if (onClick) onClick(e);
    }
  }, [onClick]);

  return (
    <button
      onPointerDown={startPress}
      onPointerUp={handlePointerUp}
      onPointerLeave={cancelPress}
      onContextMenu={(e) => {
        // Prevent default context menu on mobile devices during long press
        e.preventDefault();
      }}
      {...props}
      style={{
        ...props.style,
        opacity: isPressing ? 0.6 : (props.style?.opacity || 1),
        transform: isPressing ? 'scale(0.9)' : 'scale(1)',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}
