import { type ReactNode, useRef, useCallback } from 'react';
import { useBackSwipe } from '@/hooks/useBackSwipe';
import { getSnapshot, clearSnapshot } from '@/lib/pageSnapshot';

export function BackSwipeWrapper({ children }: { children: ReactNode }) {
  const snapshotRef = useRef<HTMLDivElement>(null);

  const onSwipeStart = useCallback(() => {
    const snap = getSnapshot();
    const el = snapshotRef.current;
    if (!el) return;

    if (snap) {
      el.innerHTML = snap.html;
      el.style.transform = `translateY(-${snap.scrollY}px)`;
      el.style.display = 'block';
    } else {
      // Fallback: show themed solid background
      el.innerHTML = '';
      el.style.transform = '';
      el.style.display = 'block';
    }
  }, []);

  const onSwipeEnd = useCallback(() => {
    const el = snapshotRef.current;
    if (el) {
      el.style.display = 'none';
      el.innerHTML = '';
    }
    clearSnapshot();
  }, []);

  const { ref, contentRef, scrimRef } = useBackSwipe<HTMLDivElement>({
    onSwipeStart,
    onSwipeEnd,
  });

  return (
    <div ref={ref} className="relative">
      {/* Layer 1: Previous page snapshot — visible only during swipe */}
      <div
        ref={snapshotRef}
        className="fixed inset-0 overflow-hidden pointer-events-none z-[9997]"
        style={{
          display: 'none',
          backgroundColor: 'hsl(var(--background))',
        }}
        aria-hidden="true"
      />
      {/* Layer 2: Scrim overlay — simulates stacked page depth */}
      <div
        ref={scrimRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          opacity: 0,
          display: 'none',
        }}
      />
      {/* Layer 3: Current page content — slides right during swipe */}
      <div ref={contentRef} className="relative z-[9999]" style={{ backgroundColor: 'inherit' }}>
        {children}
      </div>
    </div>
  );
}
