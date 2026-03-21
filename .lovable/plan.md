

# iOS Contact Form Scroll Jump Fix

## Root Cause

`html` element has `overflow-x: hidden` in `index.css` (line 228). On iOS WKWebView, setting `overflow` on `<html>` changes the scroll container identity. When an input receives focus and the keyboard opens, iOS tries to scroll the focused element into view but the altered scroll container causes the page to jump to the top instead.

This is a well-documented iOS WKWebView bug: `overflow` on `<html>` or `<body>` breaks native scroll-into-view behavior during keyboard activation.

## Why It's Safe to Remove

`#root` already has `overflow-x: hidden` (line 232), and `.landing-body` has Tailwind's `overflow-x-hidden` class. These inner containers already prevent horizontal overflow. The `html` level rule is redundant.

## Fix

**`src/index.css` (line 228):** Remove `overflow-x: hidden` from `html`. The `#root` wrapper already handles it.

```css
html {
  min-height: 100%;
  margin: 0;
  /* scroll-behavior: smooth removed — causes iOS WKWebView scroll jumps on keyboard open */
  /* overflow-x: hidden removed — causes iOS WKWebView scroll-to-top on input focus.
     #root already has overflow-x: hidden which is sufficient. */
}
```

Single line change. No layout or UI impact — all visible overflow clipping is handled by `#root` and page-level wrappers.

