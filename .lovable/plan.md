

# Login Page iOS Safe Area Fix

## Problem
Login page logo (line 87) uses `fixed left-2 top-1 sm:top-2 md:top-3` positioning but has no iOS safe area offset. On notch/Dynamic Island devices, the logo is hidden behind the status bar area.

## Solution
Add a marker class (like `landing-header-logo` used on the landing page) to the login logo element, then add a corresponding `.ios-native` CSS rule in `index.css`.

### Changes

**1. `src/components/AuthForm.tsx` (line 87)**
Add a marker class `login-logo` to the Link element wrapping the logo.

**2. `src/index.css`**
Add iOS native safe area rule:
```css
.ios-native .login-logo {
  top: calc(var(--safe-area-top) + 0.25rem);
}
@media (min-width: 640px) {
  .ios-native .login-logo {
    top: calc(var(--safe-area-top) + 0.5rem);
  }
}
@media (min-width: 768px) {
  .ios-native .login-logo {
    top: calc(var(--safe-area-top) + 0.75rem);
  }
}
```

This mirrors the exact pattern used for `.landing-header-logo` — same safe area offset values, same responsive breakpoints. Desktop and Android are unaffected since the `.ios-native` class is only added on iOS Capacitor.

