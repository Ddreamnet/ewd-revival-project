import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';

const EDGE_THRESHOLD = 35;
const SWIPE_THRESHOLD = 80;
const MAX_ANGLE = 35;
const VELOCITY_THRESHOLD = 0.4;
const COMPLETE_DURATION = 300;
const CANCEL_DURATION = 200;
const MAX_SCRIM_OPACITY = 0.35;

type GesturePhase = 'idle' | 'tracking' | 'settling';

export function useBackSwipe<T extends HTMLElement>(): {
  ref: RefObject<T>;
  contentRef: RefObject<HTMLDivElement>;
  scrimRef: RefObject<HTMLDivElement>;
} {
  const ref = useRef<T>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const phase = useRef<GesturePhase>('idle');
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const currentDx = useRef(0);
  const angleLocked = useRef(false);

  const applyTransform = useCallback((dx: number) => {
    const content = contentRef.current;
    const scrim = scrimRef.current;
    if (!content) return;

    const progress = Math.min(dx / window.innerWidth, 1);
    content.style.transform = `translateX(${dx}px)`;
    content.style.boxShadow = dx > 0
      ? `-8px 0 24px rgba(0,0,0,${0.12 * (1 - progress)})`
      : 'none';

    if (scrim) {
      scrim.style.opacity = String(MAX_SCRIM_OPACITY * (1 - progress));
      scrim.style.display = dx > 0 ? 'block' : 'none';
    }
  }, []);

  const clearStyles = useCallback(() => {
    const content = contentRef.current;
    const scrim = scrimRef.current;
    if (content) {
      content.style.transform = '';
      content.style.transition = '';
      content.style.boxShadow = '';
      content.style.willChange = '';
    }
    if (scrim) {
      scrim.style.transition = '';
      scrim.style.opacity = '0';
      scrim.style.display = 'none';
    }
  }, []);

  const settle = useCallback((action: 'cancel' | 'complete') => {
    if (phase.current === 'settling') return;
    phase.current = 'settling';

    const content = contentRef.current;
    const scrim = scrimRef.current;
    const duration = action === 'complete' ? COMPLETE_DURATION : CANCEL_DURATION;
    const easing = 'cubic-bezier(0.32, 0.72, 0, 1)';

    if (!content) {
      phase.current = 'idle';
      if (action === 'complete') navigate(-1);
      return;
    }

    content.style.transition = `transform ${duration}ms ${easing}, box-shadow ${duration}ms ease-out`;
    content.style.transform = action === 'complete' ? 'translateX(100vw)' : 'translateX(0)';
    content.style.boxShadow = 'none';

    if (scrim) {
      scrim.style.transition = `opacity ${duration}ms ease-out`;
      scrim.style.opacity = '0';
    }

    // Single cleanup — whichever fires first wins
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearStyles();
      phase.current = 'idle';
      if (action === 'complete') {
        navigate(-1);
      }
    };

    content.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, duration + 60);
  }, [navigate, clearStyles]);

  useEffect(() => {
    const isMobile = 'ontouchstart' in window && window.innerWidth < 1024;
    if (!isMobile) return;

    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (phase.current !== 'idle') return;

      const touch = e.touches[0];
      if (touch.clientX > EDGE_THRESHOLD) return;

      // Check if we can actually go back — history.state.idx > 0 means there's a previous entry
      // For browsers that don't expose idx, fall back to allowing the gesture
      const historyState = window.history.state;
      const idx = historyState?.idx;
      if (typeof idx === 'number' && idx <= 0) return;

      phase.current = 'tracking';
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      startTime.current = Date.now();
      currentDx.current = 0;
      angleLocked.current = false;

      if (contentRef.current) {
        contentRef.current.style.willChange = 'transform';
        contentRef.current.style.transition = '';
      }
      if (scrimRef.current) {
        scrimRef.current.style.transition = '';
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (phase.current !== 'tracking') return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = Math.abs(touch.clientY - startY.current);

      // Direction lock: if vertical movement dominates, cancel gesture
      if (!angleLocked.current && (dy > 10 || Math.abs(dx) > 10)) {
        const angle = Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI);
        if (angle > MAX_ANGLE) {
          phase.current = 'idle';
          clearStyles();
          return;
        }
        angleLocked.current = true;
      }

      if (dx > 0) {
        currentDx.current = dx;
        applyTransform(dx);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (phase.current !== 'tracking') return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX.current;
      const elapsed = Date.now() - startTime.current;
      const velocity = elapsed > 0 ? dx / elapsed : 0;

      const shouldComplete = dx >= SWIPE_THRESHOLD || velocity >= VELOCITY_THRESHOLD;

      if (shouldComplete && dx > 20) {
        settle('complete');
      } else {
        settle('cancel');
      }
    };

    const onTouchCancel = () => {
      if (phase.current === 'tracking') {
        settle('cancel');
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [applyTransform, settle, clearStyles]);

  return { ref, contentRef, scrimRef };
}
