

# Final Revised Plan: Dark Mode Implementation

## Notes Incorporated

### Footer Semantic Swap — Light Mode Preservation Risk

After reviewing the actual values, a full semantic swap in Footer would **change the light mode appearance**:

| Footer Current | Hex/Value | Light Token Equivalent | Match? |
|---|---|---|---|
| `text-[#4A2040]` | Warm plum, hsl(330 55% 18%) | `text-foreground` = hsl(240 10% 20%) neutral gray | **No** — loses warm plum tone |
| `bg-[#FFF0F6]` | Strong pink tint | `bg-card` = hsl(320 100% 99%) barely tinted | **Close but lighter** |
| `border-[#D98BB5]` | Medium pink | `border-border` = hsl(320 30% 90%) very light | **No** — much lighter |
| `hover:bg-[#FFE0EE]` | Warm pink hover | `hover:bg-muted` = hsl(320 40% 95%) | **Close but different** |

**Decision:** Footer should keep its hardcoded light-mode hex values and add `dark:` overrides instead of a full semantic swap. This preserves the intentional brand colors in light mode while making dark mode work correctly.

```
text-[#4A2040] dark:text-foreground
text-[#4A2040]/70 dark:text-muted-foreground
bg-[#FFF0F6] dark:bg-card
border-[#D98BB5] dark:border-border
hover:bg-[#FFE0EE] dark:hover:bg-muted
hover:text-[#7C2D6B] dark:hover:text-primary
border-[#E9AFCB]/40 dark:border-border
text-[#4A2040]/60 dark:text-muted-foreground
```

Store badges (`bg-[#1a1a2e] text-white`) are already dark — no change needed.
"Coming soon" badges use `bg-landing-pink text-[#4A2040]` — add `dark:text-foreground`.

### LandingHeader / BlogSection / ValuesSection — Gradual Semantic Migration

These currently use `dark:` overrides (`dark:bg-card`, `dark:bg-popover`, etc.). This works correctly. A future pass can convert `bg-white/90` → `bg-card/90` etc. for full semantic consistency, but it's not blocking and carries the same light-mode appearance risk as Footer. **Keep `dark:` override approach for now; flag for future cleanup.**

### Manual Testing Requirements (Kept)

These remain mandatory post-implementation:
1. **Primary button contrast** — ~4.5:1 is borderline, must verify on real screens
2. **Android WebView** — `DayNight` theme force-darken interaction with new CSS dark mode
3. **Student color distinguishability** — 10 solid `-950` colors on navy background
4. **Navy gingham CSS pattern** — verify tiling and subtlety

---

## Final Implementation Order

### Step 1: ThemeProvider
**File: `src/App.tsx`**
- Wrap with `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>`

### Step 2: Global Tokens
**File: `src/index.css`**
- Replace `.dark` block with finalized navy palette (hue 222)
- Fix `--destructive-foreground: 0 0% 100%` in both `:root` and `.dark`
- Add new tokens: `--gingham-base`, `--gingham-stripe`, `--elevated`, `--soft-panel`

**File: `tailwind.config.ts`**
- Add color mappings for new tokens

### Step 3: Shared Form Primitives
- `ui/input.tsx`: `bg-background` → `bg-input`
- `ui/textarea.tsx`: `bg-background` → `bg-input`
- `ui/select.tsx` SelectTrigger: `bg-background` → `bg-input`

### Step 4: Gingham Swap
**File: `src/index.css`**
- Add `html.dark::before` with CSS `repeating-conic-gradient` navy gingham

### Step 5: Hero Book Dark Override
**File: `src/index.css`**
- Add `.dark .hero-book-wrap` CSS variable overrides

### Step 6: Component Fixes (priority order)

1. **ContactSection.tsx** — Semantic refactor (hardcoded → token classes)
2. **WorkWithUsPage.tsx** — Same semantic refactor
3. **Footer.tsx** — Keep hex for light mode + add `dark:` overrides (revised approach)
4. **LandingHeader.tsx** — `bg-white/95` add `dark:bg-popover`
5. **BlogSection.tsx** — Carousel buttons add `dark:bg-card`, `dark:hover:bg-muted`
6. **ValuesSection.tsx** — `bg-white/90` add `dark:bg-card/90`, gradient dark fix
7. **WeeklyScheduleDialog.tsx** — Student colors: solid `dark:-950/-800/-200`
8. **AdminWeeklySchedule.tsx** — Same student color treatment
9. **AdminNotificationBell.tsx** — `text-white` → `text-amber-950` (both modes)
10. **HomeworkListDialog.tsx** — Complete `dark:` text variants
11. **LessonTracker.tsx** — `dark:text-amber-400`
12. **TeacherBalanceDialog.tsx** — `dark:text-blue-400`, `dark:text-purple-400`
13. **Header.tsx** — `dark:bg-card/70`

### Step 7: Manual Testing
- Primary button contrast verification
- Android WebView force-darken check
- Student color palette distinguishability
- Navy gingham pattern visual check
- Footer light mode preservation confirmation

### Files Changed (total: 19)

| # | File | Change |
|---|---|---|
| 1 | `src/App.tsx` | ThemeProvider with disableTransitionOnChange |
| 2 | `src/index.css` | .dark tokens, new tokens, gingham swap, hero-book dark |
| 3 | `tailwind.config.ts` | New color mappings |
| 4 | `src/components/ui/input.tsx` | bg-background → bg-input |
| 5 | `src/components/ui/textarea.tsx` | bg-background → bg-input |
| 6 | `src/components/ui/select.tsx` | SelectTrigger bg-background → bg-input |
| 7 | `src/components/landing/ContactSection.tsx` | Semantic refactor |
| 8 | `src/pages/WorkWithUsPage.tsx` | Semantic refactor |
| 9 | `src/components/landing/Footer.tsx` | Keep hex + add dark: overrides |
| 10 | `src/components/landing/LandingHeader.tsx` | dark:bg-popover |
| 11 | `src/components/landing/BlogSection.tsx` | Carousel dark bg |
| 12 | `src/components/landing/ValuesSection.tsx` | Card/gradient dark |
| 13 | `src/components/WeeklyScheduleDialog.tsx` | Student dark palette |
| 14 | `src/components/AdminWeeklySchedule.tsx` | Student dark palette |
| 15 | `src/components/AdminNotificationBell.tsx` | Amber badge fix (both modes) |
| 16 | `src/components/HomeworkListDialog.tsx` | dark: text variants |
| 17 | `src/components/LessonTracker.tsx` | dark: amber text |
| 18 | `src/components/TeacherBalanceDialog.tsx` | dark: icon colors |
| 19 | `src/components/Header.tsx` | dark: card opacity |

