import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const EDGE_THRESHOLD = 30;
const SWIPE_THRESHOLD = 100;
const MAX_ANGLE = 30;
const VELOCITY_THRESHOLD = 0.5;
const COMPLETE_DURATION = 300;
const CANCEL_DURATION = 250;
const MAX_SCRIM_OPACITY = 0.4;

/**
 * Track navigation depth so we know if there's a real previous page.
 * Only count forward pushes; replaces don't add depth.
 * On back navigation, depth decreases.
 */
let navDepth = 0;

// Routes where swipe-back should NOT trigger (auth, dashboard)
const DISABLED_ROUTES = ['/login', '/dashboard'];

export function useBackSwipe<T extends HTMLElement>(): {
  ref: RefObject<T>;
  contentRef: RefObject<HTMLDivElement>;
  scrimRef: RefObject<HTMLDivElement>;
} {
  const ref = useRef<T>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Track navigation depth via history length changes
  const lastHistoryLength = useRef(window.history.length);
  const lastPathname = useRef(location.pathname);

  useEffect(() => {
    const currentLength = window.history.length;
    const pathname = location.pathname;

    if (pathname !== lastPathname.current) {
      if (currentLength > lastHistoryLength.current) {
        // Forward navigation (push)
        navDepth++;
      } else if (currentLength < lastHistoryLength.current) {
        // Back navigation
        navDepth = Math.max(0, navDepth - 1);
      }
      // If length is same, it's a replace — depth stays the same
    }

    lastHistoryLength.current = currentLength;
    lastPathname.current = pathname;
  }, [location.pathname]);

  const state = useRef({
    tracking: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    lastX: 0,
    lastTime: 0,
    dx: 0,
    angleLocked: false,
    animating: false, // prevents interactions during completion/cancel animation
  });

  const applyTransform = useCallback((dx: number) => {
    const content = contentRef.current;
    const scrim = scrimRef.current;
    if (!content) return;

    const progress = Math.min(dx / window.innerWidth, 1);

    content.style.transform = `translateX(${dx}px)`;
    content.style.boxShadow = dx > 0
      ? `-8px 0 30px rgba(0, 0, 0, ${0.15 * (1 - progress)})`
      : 'none';

    if (scrim) {
      // Show themed background behind with decreasing opacity
      scrim.style.opacity = String(MAX_SCRIM_OPACITY * (1 - progress));
      scrim.style.display = dx > 0 ? 'block' : 'none';
    }
  }, []);

  const resetTransform = useCallback((animated: boolean) => {
    const content = contentRef.current;
    const scrim = scrimRef.current;
    const s = state.current;

    if (content) {
      if (animated) {
        s.animating = true;
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
          s.animating = false;
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

    // History safety: don't navigate if there's no real previous page
    if (navDepth <= 0) {
      resetTransform(true);
      return;
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      if (content) { content.style.transform = ''; content.style.boxShadow = ''; content.style.willChange = ''; }
      if (scrim) { scrim.style.display = 'none'; scrim.style.opacity = '0'; }
      navDepth = Math.max(0, navDepth - 1);
      navigate(-1);
      return;
    }

    s.animating = true;

    if (content) {
      content.style.transition = `transform ${COMPLETE_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow ${COMPLETE_DURATION}ms ease-out`;
      content.style.transform = 'translateX(100vw)';
      content.style.boxShadow = 'none';

      // CRITICAL: single-fire guard prevents double navigate(-1)
      let navigated = false;
      const onEnd = () => {
        if (navigated) return;
        navigated = true;
        content.style.transition = '';
        content.style.transform = '';
        content.style.willChange = '';
        s.animating = false;
        navDepth = Math.max(0, navDepth - 1);
        navigate(-1);
      };
      content.addEventListener('transitionend', onEnd, { once: true });
      setTimeout(onEnd, COMPLETE_DURATION + 50);
    } else {
      navDepth = Math.max(0, navDepth - 1);
      navigate(-1);
    }

    if (scrim) {
      scrim.style.transition = `opacity ${COMPLETE_DURATION}ms ease-out`;
      scrim.style.opacity = '0';
    }
  }, [navigate, resetTransform]);

  useEffect(() => {
    const isMobile = 'ontouchstart' in window && window.innerWidth < 1024;
    if (!isMobile) return;

    const el = ref.current;
    if (!el) return;

    const s = state.current;

    const onTouchStart = (e: TouchEvent) => {
      // Don't start gesture if animation is running or on disabled routes
      if (s.animating) return;
      if (DISABLED_ROUTES.some(r => location.pathname.startsWith(r))) return;

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

      if (!s.angleLocked && dy > 10) {
        const angle = Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI);
        if (angle > MAX_ANGLE) {
          s.tracking = false;
          resetTransform(true);
          return;
        }
        if (Math.abs(dx) > 10) s.angleLocked = true;
      }

      if (dx > 0) {
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

      if ((dx >= SWIPE_THRESHOLD || velocity >= VELOCITY_THRESHOLD) && navDepth > 0) {
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
  }, [applyTransform, resetTransform, completeTransition, location.pathname]);

  return { ref, contentRef, scrimRef };
}
