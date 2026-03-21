import { type ReactNode } from 'react';
import { useBackSwipe } from '@/hooks/useBackSwipe';

export function BackSwipeWrapper({ children }: { children: ReactNode }) {
  const { ref, contentRef, scrimRef } = useBackSwipe<HTMLDivElement>();

  return (
    <div ref={ref} className="relative">
      {/* Background scrim — simulates stacked page depth */}
      <div
        ref={scrimRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          opacity: 0,
          display: 'none',
        }}
      />
      {/* Current page content — slides right during swipe */}
      <div ref={contentRef} className="relative z-[9999]" style={{ backgroundColor: 'inherit' }}>
        {children}
      </div>
    </div>
  );
}
