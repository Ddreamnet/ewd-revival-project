import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';

const EDGE_THRESHOLD = 30;      // px from left edge to start
const SWIPE_THRESHOLD = 100;    // px horizontal distance to trigger
const MAX_ANGLE = 30;           // degrees from horizontal
const VELOCITY_THRESHOLD = 0.5; // px/ms — fast flick triggers regardless of distance
const COMPLETE_DURATION = 300;  // ms for completion animation
const CANCEL_DURATION = 250;    // ms for cancel animation
const MAX_SCRIM_OPACITY = 0.3;

export interface SwipeCallbacks {
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

export function useBackSwipe<T extends HTMLElement>(callbacks?: SwipeCallbacks): {
  ref: RefObject<T>;
  contentRef: RefObject<HTMLDivElement>;
  scrimRef: RefObject<HTMLDivElement>;
} {
  const ref = useRef<T>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Mutable tracking state (no React re-renders during gesture)
  const state = useRef({
    tracking: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    lastX: 0,
    lastTime: 0,
    dx: 0,
    angleLocked: false,
    swipeActive: false, // true once we've committed to the gesture (called onSwipeStart)
  });

  const applyTransform = useCallback((dx: number) => {
    const content = contentRef.current;
    const scrim = scrimRef.current;
    if (!content) return;

    const progress = Math.min(dx / window.innerWidth, 1);

    // Current page slides right with left-edge shadow
    content.style.transform = `translateX(${dx}px)`;
    content.style.boxShadow = dx > 0
      ? `-8px 0 30px rgba(0, 0, 0, ${0.15 * (1 - progress)})`
      : 'none';

    // Scrim fades out as page slides away
    if (scrim) {
      scrim.style.opacity = String(MAX_SCRIM_OPACITY * (1 - progress));
      scrim.style.display = dx > 0 ? 'block' : 'none';
    }
  }, []);

  const resetTransform = useCallback((animated: boolean) => {
    const content = contentRef.current;
    const scrim = scrimRef.current;
    const s = state.current;

    // Notify swipe ended
    if (s.swipeActive) {
      s.swipeActive = false;
      callbacksRef.current?.onSwipeEnd?.();
    }

    if (content) {
      if (animated) {
        content.style.transition = `transform ${CANCEL_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow ${CANCEL_DURATION}ms ease-out`;
      }
      content.style.transform = 'translateX(0)';
      content.style.boxShadow = 'none';
      content.style.willChange = '';

      if (animated) {
        let cleaned = false;
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          content.style.transition = '';
        };
        content.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, CANCEL_DURATION + 50);
      }
    }

    if (scrim) {
      if (animated) {
        scrim.style.transition = `opacity ${CANCEL_DURATION}ms ease-out`;
        let cleaned = false;
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          scrim.style.transition = '';
        };
        scrim.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, CANCEL_DURATION + 50);
      }
      scrim.style.opacity = '0';
      setTimeout(() => { scrim.style.display = 'none'; }, animated ? CANCEL_DURATION : 0);
    }
  }, []);

  const completeTransition = useCallback(() => {
    const content = contentRef.current;
    const scrim = scrimRef.current;
    const s = state.current;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      // Instant navigation
      if (content) { content.style.transform = ''; content.style.boxShadow = ''; content.style.willChange = ''; }
      if (scrim) { scrim.style.display = 'none'; scrim.style.opacity = '0'; }
      if (s.swipeActive) { s.swipeActive = false; callbacksRef.current?.onSwipeEnd?.(); }
      navigate(-1);
      return;
    }

    if (content) {
      content.style.transition = `transform ${COMPLETE_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow ${COMPLETE_DURATION}ms ease-out`;
      content.style.transform = 'translateX(100vw)';
      content.style.boxShadow = 'none';

      // *** CRITICAL FIX: Guard against double navigate(-1) ***
      let navigated = false;
      const onEnd = () => {
        if (navigated) return;
        navigated = true;
        content.style.transition = '';
        content.style.transform = '';
        content.style.willChange = '';
        if (s.swipeActive) { s.swipeActive = false; callbacksRef.current?.onSwipeEnd?.(); }
        navigate(-1);
      };
      content.addEventListener('transitionend', onEnd, { once: true });
      // Fallback in case transitionend doesn't fire
      setTimeout(onEnd, COMPLETE_DURATION + 50);
    } else {
      if (s.swipeActive) { s.swipeActive = false; callbacksRef.current?.onSwipeEnd?.(); }
      navigate(-1);
    }

    if (scrim) {
      scrim.style.transition = `opacity ${COMPLETE_DURATION}ms ease-out`;
      scrim.style.opacity = '0';
    }
  }, [navigate]);

  useEffect(() => {
    // Enable on mobile only (both iOS and Android)
    const isMobile = 'ontouchstart' in window && window.innerWidth < 1024;
    if (!isMobile) return;

    const el = ref.current;
    if (!el) return;

    const s = state.current;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch.clientX <= EDGE_THRESHOLD) {
        s.tracking = true;
        s.startX = touch.clientX;
        s.startY = touch.clientY;
        s.startTime = Date.now();
        s.lastX = touch.clientX;
        s.lastTime = s.startTime;
        s.dx = 0;
        s.angleLocked = false;

        if (contentRef.current) {
          contentRef.current.style.willChange = 'transform';
          contentRef.current.style.transition = '';
        }
        if (scrimRef.current) {
          scrimRef.current.style.transition = '';
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!s.tracking) return;
      const touch = e.touches[0];
      const dx = touch.clientX - s.startX;
      const dy = Math.abs(touch.clientY - s.startY);

      // Angle check — if too vertical, cancel tracking
      if (!s.angleLocked && dy > 10) {
        const angle = Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI);
        if (angle > MAX_ANGLE) {
          s.tracking = false;
          resetTransform(true);
          return;
        }
        if (Math.abs(dx) > 10) s.angleLocked = true;
      }

      // Only allow rightward movement
      if (dx > 0) {
        // Notify swipe started (first meaningful move)
        if (!s.swipeActive) {
          s.swipeActive = true;
          callbacksRef.current?.onSwipeStart?.();
        }
        s.dx = dx;
        s.lastX = touch.clientX;
        s.lastTime = Date.now();
        applyTransform(dx);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!s.tracking) return;
      s.tracking = false;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - s.startX;
      const elapsed = Date.now() - s.startTime;
      const velocity = elapsed > 0 ? dx / elapsed : 0;

      // Decide: complete or cancel
      if (dx >= SWIPE_THRESHOLD || velocity >= VELOCITY_THRESHOLD) {
        completeTransition();
      } else {
        resetTransform(true);
      }
    };

    const onTouchCancel = () => {
      if (s.tracking) {
        s.tracking = false;
        resetTransform(true);
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
  }, [applyTransform, resetTransform, completeTransition]);

  return { ref, contentRef, scrimRef };
}
