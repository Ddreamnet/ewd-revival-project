

## Plan: iOS-Native Horizontal Safe Area for LandingHeader

### What's missing

The previous revision removed `px-safe` from `<header>` (line 86) to avoid affecting desktop/Android layouts. But with `viewport-fit=cover`, iPhone landscape mode can have left/right safe area insets that need protection.

### Solution

Add horizontal safe area protection scoped to iOS native only, matching the existing pattern.

**1. `src/components/landing/LandingHeader.tsx`**

- Remove the current unconditional `px-safe` from line 86's `<header>` (if still present after implementation).
- Add a marker class `landing-header` to the outer `<header>` element. No other DOM changes.

```tsx
<header className="fixed top-0 left-0 right-0 z-50 bg-transparent overflow-visible landing-header">
```

Everything else stays: absolute logo, placeholder, nav center, inner container with `px-4 sm:px-6 lg:px-8`.

**2. `src/index.css`** — Add iOS-scoped horizontal rule

Inside the `.ios-native` scoped block (alongside the other marker class rules from the approved plan):

```css
.ios-native .landing-header {
  padding-left: var(--safe-area-left);
  padding-right: var(--safe-area-right);
}
```

This applies left/right safe area padding to the outer `<header>` only on iOS native. The inner container's `px-4 / sm:px-6 / lg:px-8` sits on a different element, so values stack naturally without conflict. On desktop/Android, `ios-native` class is absent so nothing fires. In portrait mode, `--safe-area-left` and `--safe-area-right` resolve to `0px`.

**3. Dashboard Header (`src/components/Header.tsx`)**

Same approach: add `dashboard-header` marker class (already in the approved plan) and add horizontal safe area in the iOS-scoped CSS:

```css
.ios-native .dashboard-header {
  padding-top: var(--safe-area-top);
  padding-left: var(--safe-area-left);
  padding-right: var(--safe-area-right);
}
```

### What stays unchanged
- Logo absolute positioning, placeholder, nav center, right-side controls
- Inner container padding (`px-4 sm:px-6 lg:px-8`) untouched
- Desktop and Android rendering identical to current
- All other parts of the approved plan remain as-is

