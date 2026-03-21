

# Back-Swipe Gesture — Double Navigate Fix + Snapshot Background

## Root Causes

**BUG 1 — Double navigate(-1):** In `completeTransition` (line 110-119), `transitionend` fires first and calls `navigate(-1)`. Then `setTimeout` fires and calls `navigate(-1)` again. `{ once: true }` removes the event listener, so `removeEventListener` on line 114 is a no-op. Result: history goes back 2 steps (e.g., Privacy → Dashboard → Login instead of Privacy → Dashboard).

**BUG 2 — Empty background:** React Router renders only one route. During swipe, the current page slides right but there's nothing behind it — just a black scrim over void.

**BUG 3 — Re-mount feel:** `navigate(-1)` triggers fresh mount of previous route component after animation completes.

## Solution

### 1. Double-navigate guard (Critical fix)

In `completeTransition`, add a `navigated` boolean flag. Both `transitionend` and `setTimeout` check it — only the first caller executes `navigate(-1)`.

### 2. Snapshot-based previous page background

**New module `src/lib/pageSnapshot.ts`:**
- `captureSnapshot()` — clones `#root` innerHTML + stores `window.scrollY`
- Strips known portal containers (Toaster, Sonner, Radix portals) and removes all `id` attributes to prevent DOM conflicts
- Stores only the last snapshot (single-slot, no memory growth)
- `getSnapshot()` → returns `{ html: string, scrollY: number } | null`
- `clearSnapshot()` — nulls the stored data

**`src/App.tsx` — ScrollToTop enhancement:**
- Before `window.scrollTo(0, 0)`, call `captureSnapshot()` to save outgoing page's visual state
- Runs on every route change, so the snapshot always reflects the most recent previous page

**`src/components/BackSwipeWrapper.tsx` — 3-layer stack:**

```text
Layer 1 (z-9997): Snapshot layer
  - div with dangerouslySetInnerHTML of captured snapshot
  - position: fixed, inset: 0, overflow: hidden
  - transform: translateY(-scrollY) to match original scroll position
  - pointer-events: none
  - hidden by default, shown only during active swipe

Layer 2 (z-9998): Scrim overlay (existing)
  - opacity fades as page slides right

Layer 3 (z-9999): Current page content (existing)
  - slides right during gesture
```

The hook exports `onSwipeStart` / `onSwipeEnd` callbacks. BackSwipeWrapper uses these to show/hide the snapshot layer.

**Why this is safe:**
- Snapshot shares app's global stylesheets (Tailwind, index.css) → renders identically
- Non-interactive (`pointer-events: none`), visible for ~300ms max
- Portals stripped → no duplicate toasts/modals
- IDs stripped → no DOM conflicts
- Single-slot storage → no memory accumulation
- If snapshot is null (first page load), falls back to themed solid background

### 3. Improved easing

Change completion easing from `cubic-bezier(0.2, 0, 0, 1)` to `cubic-bezier(0.32, 0.72, 0, 1)` — matches iOS native back gesture curve.

### 4. Same cleanup pattern fix in `resetTransform`

The `resetTransform` function has the same `transitionend` + `setTimeout` double-fire pattern (lines 67-73, 80-85). Add guards there too to prevent double cleanup (less critical but keeps code consistent).

## Files to Change

| File | Change |
|------|--------|
| `src/lib/pageSnapshot.ts` | NEW — capture/get/clear snapshot module |
| `src/App.tsx` | Add `captureSnapshot()` in ScrollToTop before scrollTo |
| `src/hooks/useBackSwipe.ts` | Double-navigate guard, export swipe callbacks, iOS easing |
| `src/components/BackSwipeWrapper.tsx` | Add snapshot layer, wire swipe callbacks |

## Validation Points (from user's concerns)

1. **Correct page, correct timing:** `captureSnapshot()` runs in `ScrollToTop`'s `useEffect` which fires on `pathname` change — captures the DOM BEFORE scroll reset, so it reflects the outgoing page at its current scroll position.

2. **Performance:** Snapshot is a string assignment (`innerHTML` read + store), no canvas rendering. Injection into DOM happens once on swipe start. Lightweight for any page size.

3. **Portals/toasts/modals:** Explicitly stripped from snapshot by removing known container selectors (`[data-sonner-toaster]`, `[data-radix-portal]`, `.toaster-container`, etc.).

4. **iOS + Android:** Same code path. Snapshot is pure HTML/CSS, no platform-specific APIs.

5. **No residual bugs:** `navigated` flag guarantees single `navigate(-1)`. Snapshot cleared on swipe end.

## Test Checklist

- Privacy Policy → back swipe → Landing page visible behind during swipe → returns to Landing (not Login)
- Blog → back swipe → Landing visible behind → correct return
- Blog Post → back swipe → Blog list visible behind
- Work With Us → back swipe → correct previous page
- Cancel (partial swipe) → snaps back, no navigation
- Fast flick → completes correctly
- No portal/toast duplication in snapshot background
- Smooth 60fps animation on iOS and Android
- Desktop: no gesture triggered

