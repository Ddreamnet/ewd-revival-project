

# iOS Form Zoom & Scroll Fix

## 1. Root Cause Analysis

### Problem 1: Phone input zoom on WorkWithUsPage
**Cause**: Line 137 — phone input uses `text-sm` only (no `text-base` mobile-first). On mobile, `text-sm` = 14px → iOS auto-zooms on focus when font-size < 16px.
**Why other fields don't zoom**: Name/age inputs use `text-base md:text-sm` (16px on mobile) — correct pattern.

### Problem 2: ContactSection form — zoom on ALL fields
**Cause**: Lines 194-196, 249-251, 266-268 — all inputs/textarea use `text-sm sm:text-base` (wrong order). On mobile (< 640px), computed font = 14px → iOS zoom. Should be `text-base sm:text-sm` or `text-base md:text-sm`.

The SelectTrigger (line 212) also uses `text-sm sm:text-base` — same problem.

### Problem 3: ContactSection scroll jump on focus
**Cause**: `scroll-behavior: smooth` on `html` (index.css line 227) combined with iOS WKWebView keyboard resize causes the viewport to smooth-scroll to a wrong position. When keyboard opens, the viewport shrinks, and `scroll-behavior: smooth` creates an animated jump effect that overshoots.

### Problem 4: Orientation change zoom persistence
**Cause**: iOS Safari/WKWebView doesn't reset scale after orientation change if a focused input previously triggered auto-zoom. The zoom state "sticks."

### Why Android is fine
Android Chrome doesn't auto-zoom on inputs regardless of font-size. This is purely an iOS Safari/WKWebView behavior.

## 2. Fixes

### Fix A: WorkWithUsPage phone input font-size
**File**: `src/pages/WorkWithUsPage.tsx`, line 137
**Change**: `text-sm` → `text-base md:text-sm`

### Fix B: ContactSection — all form fields font-size
**File**: `src/components/landing/ContactSection.tsx`
- Line 195: `text-sm sm:text-base` → `text-base md:text-sm` (fullName input)
- Line 212: `text-sm sm:text-base` → `text-base md:text-sm` (SelectTrigger)
- Line 250: `text-sm sm:text-base` → `text-base md:text-sm` (phone input)
- Line 267: `text-sm sm:text-base` → `text-base md:text-sm` (textarea)

### Fix C: SelectTrigger base component
**File**: `src/components/ui/select.tsx`, line 20
**Change**: `text-sm` → `text-base md:text-sm`
This ensures ALL Select components across the app are iOS-safe by default.

### Fix D: Scroll-behavior smooth → remove from html
**File**: `src/index.css`, line 227
**Change**: Remove `scroll-behavior: smooth` from `html`. The smooth scrolling is already handled by JS via `scrollIntoView({ behavior: 'smooth' })` where needed. Having it globally on `html` causes iOS keyboard open/close to trigger smooth scroll animations to wrong positions.

## 3. Files to change

| File | Change | Risk |
|---|---|---|
| `src/pages/WorkWithUsPage.tsx` | Phone input: `text-sm` → `text-base md:text-sm` | None |
| `src/components/landing/ContactSection.tsx` | 4 fields: `text-sm sm:text-base` → `text-base md:text-sm` | None |
| `src/components/ui/select.tsx` | SelectTrigger base: `text-sm` → `text-base md:text-sm` | Low — slightly larger select text on mobile across app, but consistent with Input/Textarea |
| `src/index.css` | Remove `scroll-behavior: smooth` from `html` | Low — all smooth scrolls are already JS-based |

## 4. Why this fixes everything

- **No zoom**: All form fields will have computed font-size ≥ 16px on mobile → iOS won't auto-zoom
- **No scroll jump**: Removing global `scroll-behavior: smooth` prevents iOS WKWebView from animating viewport adjustments when keyboard opens
- **Orientation stable**: Without auto-zoom triggering, orientation changes won't have stuck zoom state
- **Android unaffected**: These are CSS-only changes; Android already works fine
- **No viewport hack needed**: No `user-scalable=no` or `maximum-scale=1` — accessibility preserved

## 5. Test checklist
- iPhone portrait: tap each form field → no zoom
- iPhone landscape: same test
- iPad portrait/landscape: same test
- Landing page contact form: all 4 fields
- Bizimle Çalışın: phone field specifically
- Keyboard open/close: page shouldn't jump
- Orientation change mid-form: no zoom persistence
- Android: verify no regression

