import { type ReactNode } from 'react';
import { useBackSwipe } from '@/hooks/useBackSwipe';

export function BackSwipeWrapper({ children }: { children: ReactNode }) {
  const { ref, contentRef, scrimRef } = useBackSwipe<HTMLDivElement>();

  return (
    <div ref={ref} className="relative">
      {/* Scrim overlay — themed background behind sliding page */}
      <div
        ref={scrimRef}
        className="fixed inset-0 pointer-events-none z-[40]"
        style={{
          backgroundColor: 'hsl(var(--background))',
          opacity: 0,
          display: 'none',
        }}
      />
      {/* Current page content — slides right during gesture */}
      <div ref={contentRef} className="relative z-[9999] bg-background">
        {children}
      </div>
    </div>
  );
}
