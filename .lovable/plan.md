

# Tablet Layout Fixes — Teacher Panel

## Problem 1: "Öğretmen Paneli" title wrapping
The h1 text wraps to two lines on tablet because there's no width constraint preventing it.

**Fix** (`src/components/TeacherDashboard.tsx` line 216):
Add `whitespace-nowrap` to the h1 element.

## Problem 2: Student detail section overflowing on tablet portrait
In `StudentTopics.tsx`, the header area uses `md:flex-row` (breakpoint 768px) to lay out the title, homework card, and LessonTracker side-by-side. On tablet portrait (~768–1024px), this causes content to overflow or get squished.

**Fix** (`src/components/StudentTopics.tsx`):
- Line 294: Change `md:flex-row md:justify-between md:items-center` to `lg:flex-row lg:justify-between lg:items-center` — keeps the three sections stacked in a single column until 1024px+.
- Line 302: Change `sm:flex-row` to `lg:flex-row` and `md:w-auto` to `lg:w-auto` — prevents the homework card and LessonTracker from going side-by-side too early.

## Files Changed

| File | Change |
|---|---|
| `src/components/TeacherDashboard.tsx` | Add `whitespace-nowrap` to "Öğretmen Paneli" h1 |
| `src/components/StudentTopics.tsx` | Change `md:` breakpoints to `lg:` for the student detail header layout |

