

## Plan: LandingHeader Logo & Safe Area Fix

### Problem

1. **Logo absolute** (line 88) — ignores `pt-safe` on line 109, stays in notch zone
2. **Double offset** — `pt-safe` (line 109) + `mt-[16px]` (line 110) pushes buttons too far down

### Solution

Remove the absolute logo block (lines 88-107). Replace the invisible placeholder (line 112) with the actual logo in normal flex flow. Remove `mt-[16px]`. Nav uses `absolute left-1/2 -translate-x-1/2` which already centers independently of sibling widths, so the 3-zone layout works naturally.

### Changes in `src/components/landing/LandingHeader.tsx`

**Delete lines 87-107** (absolute logo block).

**Replace lines 109-112:**
```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative pt-safe">
  <div className="flex items-center justify-between h-20 md:h-24">
    {/* Logo - left zone, normal flow */}
    <div className="flex-shrink-0">
      <button
        onClick={() => {
          if (window.location.pathname === '/') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            navigate('/');
          }
        }}
        className="focus:outline-none"
        aria-label="Ana sayfaya git">
        <img
          src="/uploads/logo.webp"
          alt="English with Dilara"
          className="h-20 sm:h-28 md:h-32 lg:h-40 w-auto hover:scale-105 transition-transform duration-100 ease-out cursor-pointer"
          style={{ transform: `rotate(${logoRotation}deg)` }} />
      </button>
    </div>
```

Rest of the file (nav, right controls, closing tags) stays as-is.

### What changes
- `mt-[16px]` removed — `pt-safe` is the single safe area offset point
- Logo moved from absolute to flex flow — shares same vertical baseline with nav and buttons
- Invisible placeholder removed — logo itself occupies the left zone
- Nav's `absolute left-1/2 -translate-x-1/2` still centers it regardless of logo width

### What stays
- `pt-safe` on inner container (line 109) — single safe area offset
- `px-safe` on outer `<header>` — landscape protection
- Nav center positioning unchanged
- Right-side controls unchanged
- Logo scroll rotation unchanged

