import { useEffect, useRef, useState, type RefObject } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';

const EDGE_THRESHOLD = 30;    // px from left edge to start
const SWIPE_MIN = 80;         // px horizontal distance to trigger
const MAX_ANGLE = 30;         // degrees from horizontal

export function useBackSwipe<T extends HTMLElement>(): {
  ref: RefObject<T>;
  swipeProgress: number; // 0-1 for visual indicator
} {
  const ref = useRef<T>(null);
  const navigate = useNavigate();
  const [swipeProgress, setSwipeProgress] = useState(0);

  useEffect(() => {
    // Only activate on iOS native or mobile web (skip Android — has native back gesture)
    const isIosNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
    const isMobileWeb = !Capacitor.isNativePlatform() && 'ontouchstart' in window && window.innerWidth < 768;

    if (!isIosNative && !isMobileWeb) return;

    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch.clientX <= EDGE_THRESHOLD) {
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
        setSwipeProgress(0);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);

      // Check angle — if too vertical, cancel
      if (dy > 0 && Math.atan2(dy, Math.abs(dx)) > (MAX_ANGLE * Math.PI) / 180) {
        tracking = false;
        setSwipeProgress(0);
        return;
      }

      if (dx > 0) {
        setSwipeProgress(Math.min(dx / SWIPE_MIN, 1));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      const angle = dy > 0 ? Math.atan2(dy, dx) * (180 / Math.PI) : 0;

      if (dx >= SWIPE_MIN && angle <= MAX_ANGLE) {
        navigate(-1);
      }

      tracking = false;
      setSwipeProgress(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [navigate]);

  return { ref, swipeProgress };
}
