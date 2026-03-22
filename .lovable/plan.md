

# Fix Plan: 3 Issues

## Issue 1: Sub-page backgrounds killed + hamburger menu broken

**Root cause:** `BackSwipeWrapper.tsx` still has `z-[9999]` on the content div and `bg-background`. The previous fix was planned but never applied to this file.

- `z-[9999]` creates a stacking context above `MobileNavPanel`'s Popover (portaled at `z-[70]`), making hamburger menu unclickable
- `bg-background` paints an opaque solid color over child page gradients/backgrounds

**Fix in `src/components/BackSwipeWrapper.tsx`:**
- Remove `bg-background` from content div
- Change scrim z-index from `z-[9998]` to `z-[40]`
- Change content z-index from `z-[9999]` to `z-[41]`

## Issue 2: Homework preview close button position

**Fix in `src/components/HomeworkListDialog.tsx`:**
- Move close button from `top-4` to `top-10` for more clearance on notch devices

## Issue 3: Screen rotation zoom-in not resetting

**Root cause:** The viewport meta tag in `index.html` has no `maximum-scale=1` constraint. When the device rotates, mobile browsers (especially iOS Safari) zoom in to fit content and don't zoom back out.

**Fix in `index.html`:**
- Add `maximum-scale=1` to the viewport meta tag:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content" />
```

This prevents the browser from zooming on rotation. Combined with the existing `text-base` (16px) font-size on form inputs, iOS won't trigger auto-zoom on focus either.

## Files to change

| File | Change |
|------|--------|
| `src/components/BackSwipeWrapper.tsx` | Remove `bg-background`, lower z-indexes to 40/41 |
| `src/components/HomeworkListDialog.tsx` | Close button `top-4` → `top-10` |
| `index.html` | Add `maximum-scale=1.0` to viewport meta |

