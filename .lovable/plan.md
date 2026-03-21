# Interactive Back Swipe Gesture — Premium Stacked Page Transition

## 1. Current System Analysis

**How it works now:**

- `useBackSwipe` hook listens for left-edge touch gestures (within 30px)
- Tracks horizontal movement, validates angle (< 30°)
- On release, if dx ≥ 80px → calls `navigate(-1)` — instant navigation, no visual transition
- Only visual feedback: a thin 3px shadow strip on the left edge
- **Active on**: iOS native + mobile web only (Android skipped)
- **Applied to**: BlogPage, WorkWithUsPage, PrivacyPolicyPage via `<BackSwipeWrapper>`

**What's missing:**

- No interactive page movement during gesture
- No stacked/layered visual effect
- No smooth completion/cancellation animation
- Android excluded entirely

## 2. Recommended Approach

**CSS transform-based interactive gesture** at the component level (not router level).

Why not router-level: React Router unmounts the previous route — we can't keep the real previous page rendered. Router-level transitions (like `ViewTransition` API) are either experimental or require major architectural changes (keeping two routes mounted).

**Visual illusion approach:**

- During swipe: translate the current page to the right via `transform: translateX()`
- Behind it: a semi-transparent dark scrim that fades out (simulates depth/previous page shadow)
- Optional subtle scale on the "background layer" (e.g., scale from 0.95 to 1.0) for parallax feel
- On release: spring animation to complete or cancel
- No actual previous page rendering needed — the scrim + shadow + movement creates the iOS-native feel

This is exactly how iOS itself works visually — the "previous page" appearance is actually just the edge shadow and the current page sliding away.

1. Scrim + shadow + current-page translate yaklaşımı, benim istediğim “stacked / altta önceki sayfa beliriyor” hissini gerçekten yeterince veriyor mu? Yetersizse en yakın daha güçlü görsel alternatifi uygula.

2. iOS Capacitor/WKWebView native edge-back davranışıyla gesture conflict olup olmadığını test et.

Mevcut çalışan geri swipe davranışını bozma, performansı yüksek tut, yanlışlıkla tetiklenmeyi önle ve hem iOS hem Android’de doğal hissettirecek şekilde uygula.

## 3. Technical Plan

### File: `src/hooks/useBackSwipe.ts` — Major rewrite

Changes:

- Remove `useState` for progress → use `useRef` + direct DOM manipulation (no React re-renders during gesture = 60fps)
- Track `translateX` value in real-time via `requestAnimationFrame`
- On touch move: apply `transform: translateX(${dx}px)` directly to the wrapper element
- On touch end:
  - If threshold met → animate to `translateX(100%)` with CSS transition, then call `navigate(-1)`
  - If not → animate back to `translateX(0)` with CSS transition
- Enable on **both iOS and Android** (user requirement)
- Add `will-change: transform` during active gesture for GPU acceleration
- Add velocity detection: fast flick (even if < 80px) should trigger back navigation

New constants:

```
EDGE_THRESHOLD = 30px (unchanged)
SWIPE_THRESHOLD = 100px (slightly increased for interactive feel)
VELOCITY_THRESHOLD = 0.5 (px/ms — fast flick triggers regardless of distance)
```

### File: `src/components/BackSwipeWrapper.tsx` — Visual upgrade

Changes:

- Add a background scrim layer (`position: fixed, inset: 0, bg black, opacity tied to progress`)
- Add left-edge shadow on the current page during swipe (box-shadow or gradient)
- Structure:

```
<div ref={ref} style="position: relative">
  {/* Scrim — dark overlay behind current page */}
  <div fixed inset-0 bg-black opacity={0.3 * (1 - progress)} pointer-events-none />
  
  {/* Current page — moves right during swipe */}
  <div style="transform: translateX(${dx}px); box-shadow: ...">
    {children}
  </div>
</div>
```

- All visual updates via direct DOM style manipulation (no React state = no re-renders)
- CSS transition added on touch end for smooth completion/cancellation
- `prefers-reduced-motion` check: skip transform animation, just do instant navigate

### File: `src/hooks/useBackSwipe.ts` — Detailed behavior

```
Touch flow:
1. touchstart: if clientX <= 30px → start tracking, add will-change
2. touchmove: 
   - validate angle (< 30°)
   - set transform directly on DOM element
   - update scrim opacity directly
   - track velocity (timestamp + position history)
3. touchend:
   - calculate velocity from last 2-3 touch points
   - if dx >= 100px OR velocity >= 0.5px/ms → trigger back
   - trigger: add CSS transition (300ms ease-out), set translateX(100vw)
     → on transitionend → navigate(-1), reset transform
   - cancel: add CSS transition (250ms ease-out), set translateX(0)
     → on transitionend → remove will-change
```

## 4. Edge Cases Handled

- **Scrollable pages**: Only activates from left 30px edge — won't conflict with content scrolling
- **Form inputs**: Gesture starts from edge strip where inputs never sit
- **Modals/drawers**: BackSwipeWrapper is per-page, modals render in portals (outside wrapper) — no conflict
- **Horizontal carousels**: Edge threshold prevents conflict
- **Orientation change**: Transform is reset on touch cancel
- `**prefers-reduced-motion**`: Skip transform animation, instant navigate(-1)
- **Desktop**: Hook is no-op (no touch events + viewport > 768px)

## 5. Platform Behavior

- **iOS + Android**: Both active (user requirement)
- Same gesture mechanics on both platforms
- iOS native back gesture: on iOS Capacitor, the WKWebView edge swipe may conflict — we keep `EDGE_THRESHOLD = 30px` which coexists (iOS native gesture uses ~20px edge, our gesture catches what native misses in webview)

## 6. Files to Change


| File                                  | Change                                                         | Risk                 |
| ------------------------------------- | -------------------------------------------------------------- | -------------------- |
| `src/hooks/useBackSwipe.ts`           | Major rewrite — DOM-direct animation, velocity, both platforms | Low — self-contained |
| `src/components/BackSwipeWrapper.tsx` | Add scrim + shadow + transform structure                       | Low — wrapper only   |


**No other files change.** The three pages already use `<BackSwipeWrapper>` — they get the upgrade automatically.

## 7. Implementation Order

1. Rewrite `useBackSwipe.ts` with DOM-direct manipulation + velocity
2. Update `BackSwipeWrapper.tsx` with scrim + shadow layers
3. Test on mobile viewport

## 8. Test Checklist

- Swipe from left edge → page slides right with shadow + scrim
- Release past threshold → smooth completion animation → navigates back
- Release before threshold → smooth snap-back animation
- Fast flick (short distance) → triggers back
- Vertical scroll → no gesture activation
- Form input focus → no interference
- Desktop → no effect
- `prefers-reduced-motion` → instant navigation, no animation