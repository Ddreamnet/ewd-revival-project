

# iOS-style Back Swipe Gesture

## Approach

Create a `useBackSwipe` hook that detects left-edge swipe gestures and triggers `history.back()`. Apply it to the three target pages via a wrapper component.

## New file: `src/hooks/useBackSwipe.ts`

Custom hook that:
- Listens for `touchstart` / `touchmove` / `touchend`
- Only activates when touch starts within 30px of left edge
- Requires horizontal movement > 80px with angle < 30° from horizontal
- Only runs on Capacitor native or mobile viewport (skip desktop)
- Calls `window.history.back()` on successful swipe
- Optional: shows a visual indicator during swipe (subtle opacity edge shadow)

## New file: `src/components/BackSwipeWrapper.tsx`

A thin wrapper component that:
- Calls `useBackSwipe` on a ref
- Renders children inside a div with the ref attached
- Optionally renders a left-edge visual indicator (iOS-style shadow) during active swipe

## Changes to existing pages

Each page's content component gets wrapped with `<BackSwipeWrapper>`:
- `src/pages/WorkWithUsPage.tsx` — wrap `WorkWithUsContent` return
- `src/pages/PrivacyPolicyPage.tsx` — wrap `PrivacyPolicyContent` return  
- `src/pages/BlogPage.tsx` — wrap `BlogContent` return

## Edge cases handled

- Gesture only fires from left 30px edge strip — won't interfere with horizontal scrolling or carousels
- Angle check prevents vertical scroll from triggering back
- Desktop/non-touch devices: hook is a no-op
- Android: Android already has native back gesture; hook checks `Capacitor.getPlatform() === 'ios'` and only activates on iOS + web mobile
- React Router compatibility: `window.history.back()` works with React Router's BrowserRouter

## Files

| File | Action |
|---|---|
| `src/hooks/useBackSwipe.ts` | New — gesture detection hook |
| `src/components/BackSwipeWrapper.tsx` | New — wrapper with visual indicator |
| `src/pages/WorkWithUsPage.tsx` | Wrap content |
| `src/pages/PrivacyPolicyPage.tsx` | Wrap content |
| `src/pages/BlogPage.tsx` | Wrap content |

