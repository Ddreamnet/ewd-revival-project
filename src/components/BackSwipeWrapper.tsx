import { type ReactNode } from 'react';
import { useBackSwipe } from '@/hooks/useBackSwipe';

export function BackSwipeWrapper({ children }: { children: ReactNode }) {
  const { ref, swipeProgress } = useBackSwipe<HTMLDivElement>();

  return (
    <div ref={ref} className="relative">
      {/* iOS-style left edge shadow indicator */}
      {swipeProgress > 0 && (
        <div
          className="fixed inset-y-0 left-0 w-3 pointer-events-none z-50"
          style={{
            background: `linear-gradient(to right, rgba(0,0,0,${0.15 * swipeProgress}), transparent)`,
          }}
        />
      )}
      {children}
    </div>
  );
}
