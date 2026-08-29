# AUDIT_REPORT.md — English with Dilara (Capacitor + Supabase)

**Audit date:** 2026-08-28 · **Mode:** Read-only, full-repo scan (23,105 LOC app code, 50+ migrations, RLS policies, native shells)
**Stack:** Vite 5 + React 18 + TypeScript + shadcn/ui + Supabase (Postgres/RLS/Edge Functions/Realtime/Storage) + Capacitor 8 (iOS + Android), live on Web / App Store / Play Store.

> ⚠️ Scope note: the 8 deployed Edge Functions (`create-student`, `create-teacher`, `send-push`, `notifications-push`, `admin-notifications-push`, `lesson-reminder-cron`, `cleanup-lesson-overrides`, `cleanup-trial-lessons`) have **no source code in this repository** (`supabase/functions/` contains only `.gitkeep`). They could not be audited and are themselves a finding (see §2.7, §3.1).

---

## 1. Executive Summary

| Pillar | Score | Verdict |
|---|---|---|
| Database security (RLS + RPC) | **2.5 / 10** | Critical: privileged RPCs callable by anyone with the anon key |
| Client auth & credential handling | **3.5 / 10** | Critical: plaintext password persistence on device & web |
| Data integrity of admin operations | **4 / 10** | Non-atomic multi-row mutations; teacher transfer misses tables |
| Code hygiene & typing | **5 / 10** | `strict: false`, 92 `: any`, dead code, 41 prod `console.log` |
| Performance | **6.5 / 10** | Good route-level code splitting; 480 KB editor chunk leaks into all dashboards; query waterfalls |
| Architecture | **6 / 10** | Sensible layering (`lessonService` single write path) undermined by client-side orchestration of transactional work |
| **Overall project health** | **4.5 / 10** | Functionally solid product; **security posture is not production-grade** |

**What is genuinely good** (keep doing this): route-level lazy loading with prefetch (`src/App.tsx:12-36`), the Capacitor Preferences storage adapter for Supabase auth (`src/lib/capacitorStorage.ts:11-35`), `startAutoRefresh`/`stopAutoRefresh` on app state change (`src/contexts/AuthContext.tsx:228-240`), the batched admin fetch (`src/components/AdminDashboard.tsx:183-229`), the stale-while-revalidate week cache (`src/hooks/useScheduleGrid.ts:52-78`), the `balance_events` audit table, and the duplicate-instance guard trigger (`supabase/migrations/20260504185355`).

**The three fires to put out first:**

1. **Every `rpc_*` database function is SECURITY DEFINER with zero caller authorization.** `rpc_delete_student` permanently wipes a student's entire data footprint, `rpc_manual_balance_adjust` edits any teacher's payable minutes — both accept caller-supplied IDs and never check `auth.uid()`. Supabase grants `EXECUTE` on public-schema functions to `anon` and `authenticated` by default, so these are callable by **anyone on the internet holding the app's public anon key** (which ships inside the app binary). → §2.1
2. **User passwords are stored in plaintext** in `localStorage` (web) and unencrypted `Preferences` (Android/iOS) for login prefill, with Android `allowBackup="true"` making them backup-extractable. → §2.2
3. **Privilege / relationship escalation chain**: `handle_new_user` trusts the client-supplied `role` metadata, and `create_student_relationship` never checks who is calling — an attacker who signs up via the (still enabled) auth API as "teacher" can attach themselves to any student and read that student's name, e-mail, homework, and progress through the teacher RLS policies. → §2.3

---

## 2. Critical Vulnerabilities & Edge Cases (live risk)

### 2.1 🔴 CRITICAL — Unauthorized execution of all business RPCs

**Files:**
- `supabase/migrations/20260318133304_f2b430c5….sql:3-49` — `rpc_delete_student` (deletes topics, resources, homework, lessons, notifications, the `students` row **and the `profiles` row**)
- `supabase/migrations/20260318130502_505a656b….sql:40-64` — `rpc_manual_balance_adjust` (adds/subtracts payable minutes for **any** `p_teacher_id`)
- Same file `:4-35` — `rpc_archive_student`; `:68-118` — `rpc_complete_trial_lesson`
- `supabase/migrations/20260318195400_94881245….sql:4-140` — `rpc_complete_lesson`, `rpc_undo_complete_lesson` (final versions)
- `supabase/migrations/20260324212642…`, `20260325221841…`, `20260326214924…`, `20260323224112…`, `20260324144815…` — `rpc_reset_package`, `rpc_restore_student`, `rpc_undo_trial_lesson`, `rpc_sync_student_schedule`

**Root cause:** every function is `SECURITY DEFINER` (bypasses RLS) and takes `p_teacher_id` / `p_student_id` as **parameters supplied by the caller**. A `grep -rn "auth.uid()"` across all RPC migrations returns **zero hits**. No `REVOKE EXECUTE` exists in any migration, so PostgREST's default grants (`anon`, `authenticated`) apply. `verify_jwt` protects Edge Functions, not RPCs.

**Attack:** `POST https://<project>.supabase.co/rest/v1/rpc/rpc_delete_student` with the shipped anon key and guessed/leaked UUIDs (UUIDs appear in `tmp/restore_*.json`, which is committed — see §2.6). No login needed.

**Fix (one migration, ~30 min):**

```sql
-- 1) Kill default exposure for every privileged function
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
-- (re-grant SELECT-style helper fns to anon individually if any are needed pre-login)

-- 2) Add a caller check inside EVERY rpc_* function, e.g. rpc_manual_balance_adjust:
CREATE OR REPLACE FUNCTION public.rpc_manual_balance_adjust(
  p_teacher_id uuid, p_amount_minutes integer, p_notes text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'forbidden');
  END IF;
  -- …existing body…
END; $$;

-- 3) For teacher-facing RPCs (complete/undo lesson, trials), bind identity instead of trusting a param:
IF NOT (auth.uid() = p_teacher_id OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
  RETURN json_build_object('success', false, 'error', 'forbidden');
END IF;
-- Destructive RPCs (rpc_delete_student, rpc_archive_student, rpc_reset_package,
-- rpc_restore_student, rpc_sync_student_schedule) should be admin-only.
```

No client change is required (`src/lib/lessonService.ts` already passes the caller's own id in legitimate flows).

### 2.2 🔴 CRITICAL — Plaintext password persistence

**Files:** `src/lib/capacitorStorage.ts:44-65` (`saveCredentials` / `loadCredentials`), written on every sign-in at `src/contexts/AuthContext.tsx:261`, read into form state at `src/components/AuthForm.tsx:26-32`. Amplified by `android/app/src/main/AndroidManifest.xml:4` (`android:allowBackup="true"` → SharedPreferences included in device backups) and by web `localStorage` (any XSS steals the actual password, not just a revocable token).

**Root cause:** login-prefill convenience implemented as raw credential storage. Supabase already persists the session; the password adds nothing except risk.

**Fix:** delete `saveCredentials`/`loadCredentials` and the call sites; prefill **e-mail only**:

```ts
// capacitorStorage.ts — keep only:
export async function saveLastEmail(email: string) { /* Preferences/localStorage, email only */ }
```
If "remember password" is a hard product requirement, use `capacitor-secure-storage-plugin` (Keychain / EncryptedSharedPreferences) — never `Preferences`/`localStorage` — and set `android:allowBackup="false"`.

### 2.3 🔴 CRITICAL — Role & relationship escalation chain

**Files:**
- `docs/clone/01-clean-schema.sql:396-402` — `handle_new_user` sets `profiles.role` from client-controlled `raw_user_meta_data->>'role'`
- `docs/clone/01-clean-schema.sql:538-567` — `create_student_relationship(student_user_id, teacher_user_id)` is SECURITY DEFINER, checks only that the **target** is a teacher (`profiles.role`), never that the **caller** is that teacher or an admin
- `src/contexts/AuthContext.tsx:268-289` — client `signUp` forwards `role` metadata; the signup form still exists (`src/components/AuthForm.tsx:151-224`) though it is unreachable in the UI (see §3.6) — the **auth API endpoint remains open** unless disabled in the dashboard

**Attack:** `supabase.auth.signUp({ …, options: { data: { role: 'teacher' } } })` → `profiles.role = 'teacher'` → `rpc create_student_relationship(victim_id, attacker_id)` → a `students` row now exists → RLS policies `teachers_view_assigned_students` (profiles), `teacher_view_student_homework`, `teacher_manage_student_completion`, storage policy "Teachers can view student homework" all light up → attacker reads the victim's **name, e-mail, homework files, topics and progress**.

**Fix:**
1. Stop trusting metadata: `handle_new_user` should always insert `role = 'student'` (admins grant roles via `user_roles`).
2. Add a caller check to `create_student_relationship` (admin-only), or drop it — the admin UI creates relationships through the `create-student` Edge Function anyway.
3. In Supabase Dashboard → Auth: **disable public signups** (this is an invite-only school app; accounts are created by admin).

### 2.4 🔴 HIGH — Teachers can edit their own payable balance via RLS

**File:** `docs/clone/02-rls-policies.sql:356-363` (`teacher_update_own_balance`, `teacher_insert_own_balance`).
A teacher can run `supabase.from('teacher_balance').update({ total_minutes: 99999 }).eq('teacher_id', me)` — this is the number the admin pays out from (`AdminBalanceManager`). Since the RPC refactor, all legitimate balance writes go through `rpc_complete_lesson` / `rpc_manual_balance_adjust` (SECURITY DEFINER), so the direct-write policies are pure attack surface.

**Fix:** `DROP POLICY "teacher_update_own_balance" …; DROP POLICY "teacher_insert_own_balance" …;` (keep `teacher_view_own_balance`).

### 2.5 🟠 HIGH — Over-broad and spoofable teacher RLS policies

**File:** `docs/clone/02-rls-policies.sql`
- `:59-61` `teacher_view_own_students`: `teacher_id = auth.uid() OR has_role(auth.uid(),'teacher')` — the `OR` clause lets **every** teacher read **every** teacher's roster. Same pattern `:98-100` (all tracking rows), `:137-139` (global topics — probably intended).
- `:80-83`, `:102-105` — `teacher_manage_student_lessons` / `teacher_manage_student_tracking` `WITH CHECK (teacher_id = auth.uid())` only: any teacher can insert schedule/tracking rows for **any student**, including other teachers' students.
- `:293-302` — homework INSERT allows `teacher_id = auth.uid() OR EXISTS(owns student)`: a teacher can insert homework attributed to a **different** teacher for their own student; a student INSERT (`:278-280`) never validates `teacher_id`, so students can spam any teacher's notifications (the trigger at `01-clean-schema.sql:412-433` notifies whoever is named).

**Fix pattern:** replace the `OR has_role(…, 'teacher')` reads with ownership-only checks, and add `teacher_owns_student(auth.uid(), student_id)` to every teacher `WITH CHECK`:

```sql
CREATE POLICY "teacher_manage_student_lessons" ON public.student_lessons
FOR ALL TO authenticated
USING  (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid()
            AND public.teacher_owns_student(auth.uid(), student_id));
```

### 2.6 🟠 HIGH — Secrets & production data committed to git

`git ls-files` confirms these are tracked:
- `.env` (anon key + project URL; `.gitignore:1-24` never excludes it)
- `tmp/raw.zip`, `tmp/restore_student_lessons.json`, `tmp/restore_student_lesson_tracking.json`, `tmp/restore_teacher_balance.json` — **real production data dumps** (verified: live teacher UUIDs, balances, timestamps from 2025-11 → 2026-03)
- `android/app/google-services.json`, `ios/App/App/GoogleService-Info.plist`
- `docs/archive/data-recovery-index.ts`, `docs/archive/recovery.html` — an old recovery Edge Function with `Access-Control-Allow-Origin: *`

The anon key is public by design (RLS is the boundary — currently a weak one, see above), but production data dumps in a repo are a data-protection problem regardless.

**Fix:** add `.env`, `tmp/`, `*.zip` to `.gitignore`; `git rm --cached` them; purge history (`git filter-repo`) if this repo is ever shared; rotate the anon key after §2.1–2.5 land.

### 2.7 🟠 HIGH — Unversioned Edge Functions, most with `verify_jwt = false`

**File:** `supabase/config.toml:3-27`. Six of eight functions skip JWT verification (`send-push`, `notifications-push`, `admin-notifications-push`, `lesson-reminder-cron`, `cleanup-lesson-overrides`, `cleanup-trial-lessons`). If any of them acts on request-body parameters without an internal shared secret, anyone can trigger pushes or cleanups. **Their source is not in the repo, so this cannot be verified** — that alone is a production risk (no review, no rollback, no disaster recovery).

**Fix:** `supabase functions download <name>` for all eight → commit under `supabase/functions/`; add a `WEBHOOK_SECRET` header check to every `verify_jwt = false` function; call them from `pg_cron`/webhooks with that secret.

### 2.8 🟡 MEDIUM — Stored-XSS surface on the public blog

**File:** `src/pages/BlogPostPage.tsx:71` — `dangerouslySetInnerHTML={{ __html: post.content }}` renders TipTap HTML from `blog_posts` with no sanitizer (no DOMPurify in `package.json`). Only admins can write posts (RLS `20260217094759`), so exploitation requires an admin-account compromise — but it then executes in every visitor's browser and inside both mobile apps' WebViews.

**Fix:** `npm i dompurify` → `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}` (same for any other rich-text render, e.g. `StudentAboutDialog` display path).

### 2.9 Edge cases that strand real users

| # | Edge case | Where | Effect |
|---|---|---|---|
| E1 | Authenticated user with **no profile row** (e.g. after `rpc_delete_student` deletes `profiles` but the auth user survives, or `handle_new_user` swallowed an error — `01-clean-schema.sql:404-408`) | `src/App.tsx:70-74` falls through to an **infinite spinner** with no sign-out escape | User permanently stuck on all 3 platforms |
| E2 | Deleted teacher can still log in | `src/components/EditTeacherDialog.tsx:205-267` deletes the `profiles` row but not the auth user, `user_roles`, or `push_tokens` | Zombie account → E1 spinner + keeps receiving pushes |
| E3 | Logout doesn't disable push tokens | `disablePushTokens` (`src/lib/pushNotifications.ts:208-219`) is **never called** | A signed-out shared/family device keeps receiving that user's homework notifications |
| E4 | Student linked to two teachers | `src/components/StudentDashboard.tsx:86-98` uses `.single()` → throws, `teacherId` stays `""` → homework upload inserts fail silently later | No `UNIQUE(teacher_id, student_id)` on `students` makes this reachable |
| E5 | UI offers 7 lessons/week, DB trigger hard-caps 6 | `src/components/CreateStudentDialog.tsx:193` vs `01-clean-schema.sql:477-489` | Admin gets an opaque DB error on a legitimate-looking form |
| E6 | Timezone drift on date parsing | `new Date("YYYY-MM-DD")` (UTC) at `src/components/AdminWeeklySchedule.tsx:182,189,193`, `src/lib/instanceGeneration.ts:173`, `src/lib/lessonDateCalculation.ts:68` vs local-safe `new Date(d + "T00:00:00")` at `src/hooks/useEditStudentDialog.ts:291` | For any user west of UTC (teacher travels, expat students) day-of-week computations shift by one day. Standardize on a `parseLocalDate()` helper |
| E7 | Auth init timeout comment says 5s, code says 3s | `src/contexts/AuthContext.tsx:164-171` | Slow native storage on old Androids can force `initializing=false` before `getSession()` resolves → brief flash to login while actually signed in |
| E8 | Native debug logging always on | `src/contexts/AuthContext.tsx:185-193` prints Preferences keys; `[PUSH-DIAG]` logs partial FCM tokens & session IDs (`src/lib/pushNotifications.ts` throughout) | Info leak in device logs; gate all with `if (DEV)` |
| E9 | `signOut()` clears local storage **before** `supabase.auth.signOut()` and relies on hardcoded key `sb-hwwpbtcgppzuscbvjkde-auth-token` (`src/lib/capacitorStorage.ts:70`) | `src/contexts/AuthContext.tsx:302-323` | Works today, silently breaks on project migration; also global-scope signOut logs the user out of every device — use `signOut({ scope: 'local' })` |

---

## 3. Architecture & File Hygiene

### 3.1 Structure

```
src/
  components/        # 60+ files, flat — admin/teacher/student/shared all mixed
  components/landing # ✔ good separation
  components/ui      # 49 shadcn primitives (≈⅓ unused)
  contexts/ hooks/ lib/ pages/ integrations/
supabase/functions/  # ❌ EMPTY (.gitkeep) while 8 functions run in prod
docs/clone/          # schema snapshot — already drifted from migrations
tmp/                 # ❌ production data dumps, tracked
```

- **Flat `components/` is the main structural debt.** Recommended target: `features/admin/`, `features/teacher/`, `features/student/`, `features/scheduling/`, `features/homework/`, `shared/`. Mechanical move + import updates.
- **Two parallel scheduling models still live**: legacy `student_lessons`/`student_lesson_tracking`/`lesson_overrides` and new `lesson_instances`. Migration `20260318195400` ("Phase 6 Final Cleanup") removed legacy sync from RPCs, yet the UI still reads/writes legacy tables (`useScheduleGrid.ts` templates, `TeacherDashboard.tsx:90-107`, `LessonOverrideDialog`). Finish the migration or document the contract; today a template edit and an instance edit can disagree.
- **Capacitor layout is correct** (webDir `dist`, per-platform folders, icons/resources generated). One flag: `capacitor.config.ts` has no `server.hostname`/scheme pinning and `SplashScreen.launchAutoHide:false` is correctly paired with `SplashHider` (`src/App.tsx:89-99`) — good.
- Repo noise: the whole tree (294 files) shows as modified due to CRLF churn (`core.autocrlf` unset). Add a `.gitattributes` (`* text=auto eol=lf`) and renormalize once — until then every real diff is buried.

### 3.2 God-modules that need splitting

| File | Lines | Problem |
|---|---|---|
| `src/hooks/useEditStudentDialog.ts` | 939 | Profile rename + template sync + date-chain editing + shift forward/backward + realign + package reset + archive + delete in one hook returning 30 members |
| `src/components/LessonOverrideDialog.tsx` | 614 | Override + postpone + revert + conflict UI |
| `src/components/GlobalTopicsManager.tsx` | 568 | CRUD + DnD ordering + role branching (`isAdmin` prop) |
| `src/hooks/useScheduleGrid.ts` | 590 | Cache + instance generation (writes!) + grid math + dedup |

Split `useEditStudentDialog` into `useStudentProfileForm`, `useLessonChain` (shift/realign/dates), `usePackageLifecycle` (reset/archive/delete). Pure grid math in `useScheduleGrid.ts:83-590` should move to `lib/scheduleMath.ts` (it isn't a hook at all — nothing in it uses React).

### 3.3 The systemic bug-class: client-orchestrated multi-row transactions

Every one of these mutates N rows with parallel independent `.update()` calls — a network drop or app kill mid-flight leaves live data half-migrated (this is exactly the incident the `tmp/restore_*.json` recovery dumps and the `20260504` duplicate-guard trigger tell the story of):

- `src/hooks/useEditStudentDialog.ts:321-336` (`batchUpdateInstances`), `:405-416` (tail regeneration), `:673-681` / `:719-727` / `:801-809` (realign/shift), `:634-638` (`resequenceLessonNumbers` — parallel `lesson_number` swaps can also trip `UNIQUE(student_id, teacher_id, lesson_number)` from `20260227205013` intermittently)
- `src/lib/instanceGeneration.ts:197-213` (`shiftLessonsForward`)
- `src/components/EditTeacherDialog.tsx:143-183` (student transfer — see §6.1)
- `src/components/AdminBalanceManager.tsx:154-209` (balance reset — see §6.3)

**Fix pattern:** one SQL RPC per operation (`rpc_shift_chain`, `rpc_realign_chain`, `rpc_update_lesson_dates`, `rpc_transfer_student`, `rpc_reset_balance`), each wrapping the whole change in a transaction with `FOR UPDATE` locks and the conflict check **inside** the same transaction (the current check-then-write is also TOCTOU-racy: `useEditStudentDialog.ts:309-318` checks conflicts, then writes seconds later).

### 3.4 Duplicated logic

- `AdminDashboard.fetchStudentTopics` (`src/components/AdminDashboard.tsx:118-172`) is a ~55-line copy of `useStudentTopics` (`src/hooks/useStudentTopics.ts`) — the hook's own header comment claims it replaced this exact function.
- `initializeDialog` vs `fetchInstances` (`src/hooks/useEditStudentDialog.ts:69-115` vs `:117-151`) — identical bodies modulo the first query.
- The `file_url.split('/homework-files/')` path-recovery trick appears 3× in `src/components/HomeworkListDialog.tsx:167,211,263`. Root cause: `UploadHomeworkDialog.tsx:138-140` stores `getPublicUrl()` output **for a private bucket** (the URL itself 403s). Store the storage *path* in `file_url` and build signed URLs at read time.
- Global-topic ↔ student-topic matching **by title** in 3 places + 1 DB trigger (`useStudentTopics.ts:102-105`, `AdminDashboard.tsx:143-145`, `complete_global_topic_resources` in `01-clean-schema.sql:516-535`). Renaming a global topic silently orphans completion state; two topics with the same title cross-link. Model it with a real `global_topic_id uuid` FK on `topics`. Note also `01-clean-schema.sql:666-673`: **both** completion triggers fire on `topics` updates (`on_topic_completion` + `on_global_topic_completion`) — double work per completion.

### 3.5 Typing & lint configuration

- `tsconfig.app.json:16,25` — `noImplicitAny: false`, `strict: false`; `eslint.config.js:23` — `@typescript-eslint/no-unused-vars: "off"`. This is why 92 explicit `: any` (worst: `useEditStudentDialog.ts` ×12, `GlobalTopicsManager.tsx` ×9, `AdminDashboard.tsx` ×9) and dead imports accumulate unseen. Turn on `strict` incrementally: start with `"noImplicitAny": true` + `"strictNullChecks": true` and fix ~1 file/day; re-enable `no-unused-vars` with `argsIgnorePattern: "^_"`.
- `src/integrations/supabase/types.ts` is generated and used by the client — good — but query results are then widened to `any` in most components instead of using `Database['public']['Tables'][…]['Row']`.

### 3.6 Dead code & dead weight (safe deletions)

| Item | Evidence |
|---|---|
| Sign-up form is unreachable (`isSignUp` can never become `true` — no toggle exists in the sign-in branch) | `src/components/AuthForm.tsx:15,117-149` |
| `disablePushTokens`, `resetPushDismissed` never called | `src/lib/pushNotifications.ts:208-226` (wire the first into `signOut` instead of deleting — see E3) |
| `ScrollToTop` tracks `prevPathname` and never uses it | `src/App.tsx:77-87` |
| `completeLesson`/`undoCompleteLesson` accept an unused `studentId` param | `src/lib/lessonService.ts:26-30,50-54` |
| `public/uploads/pinkgingham.png` — **1.3 MB** referenced only from a commented-out CSS line | `src/index.css:308` (live rule at `:245` uses the 84 KB `.webp`) — ships in web deploy **and both store binaries** |
| Unused npm deps (only referenced by their unused shadcn wrapper, or nothing): `recharts`, `vaul`, `cmdk`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `embla-carousel-react`, `zod`, `react-hook-form`, `@hookform/resolvers` | dependency-usage scan (app-code references: 0) |
| ~16 of 49 `components/ui/*` primitives unreferenced (`chart`, `carousel`, `drawer`, `command`, `input-otp`, `calendar`* …) | *`calendar.tsx` is used by `LessonOverrideDialog`; verify per-file before deleting |
| `docs/clone/*` drifted from `supabase/migrations` (policies shown there no longer match e.g. `push_tokens`, `blog_posts`, `lesson_instances`) | mark as historical or regenerate |
| Two toast systems mounted simultaneously (`Toaster` + `Sonner`, `src/App.tsx:107-108`); `sonner` used only in `AdminBalanceManager.tsx:18`, `CreateTeacherDialog.tsx:13`, `StudentAboutDialog` | pick one |
| i18n split-brain: `LanguageContext` + 308-line `translations.ts` serve only the landing pages; all dashboard strings are hardcoded Turkish | intentional? then document it — otherwise it looks abandoned |
| 41 `console.log` in production paths (auth, push, notifications) | gate with `import.meta.env.DEV` |

---

## 4. Performance Optimization Plan

### 4.1 Bundle (measured from `dist/`)

| Chunk | Size | Cause | Fix |
|---|---|---|---|
| `index-*.js` | 684 KB | React + Router + Radix + Supabase + landing (eager by design) | acceptable; optional `build.rollupOptions.output.manualChunks` to split vendor for better caching |
| `StudentAboutDialog-*.js` | **480 KB** | TipTap imported eagerly (`src/components/StudentAboutDialog.tsx:13-17`) and the dialog is imported statically by `TeacherDashboard.tsx:16` and `AdminDashboard.tsx:23` → **every teacher/student/admin downloads a rich-text editor on dashboard load** | `const StudentAboutDialog = lazy(() => import('./StudentAboutDialog'))` + render inside `<Suspense>` only when opened. Same for `BlogPostEditor` via `AdminBlogManager` (`AdminDashboard.tsx:24`) and `GlobalTopicsManager` |
| `AdminDashboard-*.js` | 156 KB | fine once the above is split | — |

```tsx
// AdminDashboard.tsx / TeacherDashboard.tsx — quick win
const StudentAboutDialog = lazy(() =>
  import("./StudentAboutDialog").then(m => ({ default: m.StudentAboutDialog })));
…
{showStudentAbout && (
  <Suspense fallback={null}>
    <StudentAboutDialog … />
  </Suspense>
)}
```

### 4.2 Images (public landing = first impression + LCP)

- `public/uploads/dilarateacher.png` 343 KB — hero image (`HeroSection.tsx:14`, also `ContactSection.tsx:296`) → convert to WebP/AVIF ≤ 60 KB, add explicit `width/height` (CLS) and `fetchpriority="high"`.
- `public/uploads/instagramLogo.png` 212 KB rendered at **24×24 px** (`ContactSection.tsx:124`) → 2 KB SVG.
- `src/assets/values-*.jpg` ≈ 800 KB combined (`ValuesSection`) + `ataturk-signature.png` 179 KB → WebP + `loading="lazy"` (currently **zero** `loading="lazy"` anywhere).
- Delete the dead 1.3 MB `pinkgingham.png` (§3.6).

### 4.3 Query patterns

- **Week view cascade:** rendering one admin/teacher week runs ~9 queries sequentially-ish (`ensureInstancesForWeek` 5 + core fetch 4, `src/hooks/useScheduleGrid.ts:151-456`) — on 4G that's 1.5–3 s per week flip past the cache. Collapse into a single `rpc_get_week_schedule(teacher_id, week_start)` returning instances+ghosts+names in one round trip; move instance generation server-side (§7).
- **Conflict checks are N×3 queries:** `checkTeacherConflicts` (`src/lib/conflictDetection.ts:41-130`) is called per-date in `Promise.all` loops (`useEditStudentDialog.ts:309-313,393-397`; `instanceGeneration.ts:184-188`) → a 24-lesson chain = ~72 queries. One `rpc_check_conflicts(teacher_id, jsonb_slots)` = 1.
- **`getRemainingRights`** (`src/lib/lessonService.ts:298-339`) is a 3-query waterfall → parallelize or fold into the RPC above.
- **React Query is installed and wrapped around the app (`App.tsx:38,102`) but used only by `useBlogPosts`.** Every dashboard fetch is hand-rolled `useState`+`useEffect` with no caching/dedup — e.g. `TeacherDashboard` refetches students on every `profile` object identity change (`TeacherDashboard.tsx:41-50`). Adopt `useQuery` with `staleTime: 60_000` for teachers/students/schedule/balance and replace the manual `weekCache` in `useScheduleGrid`.
- `AdminWeeklySchedule.tsx:85-102` — two effects both fire on mount → double `fetchActualSchedule()` on every teacher select.

### 4.4 Leaks / timers / listeners

- `src/components/AdminDashboard.tsx:102-108` — deep-link retry `setInterval(300ms)` is only cleared by a 5 s `setTimeout` that itself isn't cleared on unmount; the whole effect re-subscribes `popstate` on **every** `teachers` refetch (`:74-116`). Convert to a `useEffect` keyed on `pendingDeepLink` state with proper cleanup.
- `src/hooks/useScheduleGrid.ts:53,57` — module-level `weekCache`/`ensuredWeeks` grow unbounded across a long admin session (small entries; cap or LRU when convenient).
- Landing (`useBackSwipe`, `AdminNotificationBell` visibility/app-state listeners) are correctly cleaned up — verified balanced add/remove.
- `index.html:5` — `maximum-scale=1.0` blocks pinch-zoom on the **web** too (accessibility / Lighthouse penalty); keep it only for native via runtime injection, or drop it.

---

## 5. Auth & Supabase Lifecycle Audit

**What's solid:** listener-before-`getSession()` ordering with `INITIAL_SESSION` deferral (`AuthContext.tsx:108-223`), profile-fetch dedupe on `TOKEN_REFRESHED` so the dashboard doesn't flash a spinner (`:143-154`), abort-controller + signing-out guards, `startAutoRefresh`/`stopAutoRefresh` on native app state (`:228-240`), async storage adapter (`capacitorStorage.ts`), `detectSessionInUrl: false` for the SPA.

**Gaps, ordered by severity:**

1. **Plaintext credential storage** — §2.2 (the only truly critical client-side auth issue).
2. **Sign-out semantics** (`AuthContext.tsx:291-331`): storage is wiped before `supabase.auth.signOut()`; default scope is `global` (kills the user's session on every device — surprising for a family sharing an account across phone+tablet); push tokens stay enabled (E3). Suggested shape:

```ts
const signOut = async () => {
  isSigningOutRef.current = true; setSigningOut(true);
  try { await disablePushTokens(user?.id); } catch {}
  try { await supabase.auth.signOut({ scope: "local" }); } // revokes token server-side first
  catch (e) { console.warn(e); }
  await clearSupabaseStorage();   // then belt-and-braces local wipe
  // …state resets…
};
```
3. **Hardcoded storage key** `sb-hwwpbtcgppzuscbvjkde-auth-token` (`capacitorStorage.ts:70`) — derive from `VITE_SUPABASE_PROJECT_ID`.
4. **`/dashboard` fallthrough spinner** for the profile-less user (E1). Minimal fix:

```tsx
// App.tsx — replace lines 70-74
return (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4">
    <p>Hesabınız yapılandırılamadı. Lütfen yöneticinizle iletişime geçin.</p>
    <Button onClick={signOut}>Çıkış Yap</Button>
  </div>
);
```
5. **Role model is split-brain:** authorization uses `user_roles` (`has_role`) but the app and several DB functions still key off legacy `profiles.role` (`AdminDashboard.tsx:187`, `EditTeacherDialog.tsx:74`, `create_student_relationship`). Until §2.3 lands, `profiles.role` is client-influenced — migrate every check to `user_roles` and demote `profiles.role` to display-only.
6. **`.env` is decorative:** `src/integrations/supabase/client.ts:6-8` hardcodes URL+key (Lovable-generated). Fine for an anon key, but the `.env` file then serves no purpose except leaking into git (§2.6). Read from `import.meta.env` and drop the file from tracking.
7. **Network-dropout resume path:** on app resume, `TOKEN_REFRESHED` fires and profile is *not* refetched if already cached (good), but if the refresh fails while offline Supabase emits `SIGNED_OUT` in v2 only after retry exhaustion — the UI then bounces to `AuthForm` even though credentials would recover. Consider handling the `TOKEN_REFRESH_FAILED`-style flow by showing a "reconnecting…" state instead of the login form when `navigator.onLine === false`.
8. Session security hygiene to schedule: enable leaked-password protection & MFA options in the dashboard, and set JWT expiry ≤ 1 h (defaults are fine but verify — dashboard config isn't in the repo).

---

## 6. Admin Dashboard Deep Dive

### 6.1 🔴 Student transfer silently corrupts data
`src/components/EditTeacherDialog.tsx:124-203` updates `students`, then `topics`, `student_lessons`, `student_lesson_tracking`, `homework_submissions`, `notifications` — **sequentially, ignoring every error after the first**, and **never touches `lesson_instances`, `lesson_overrides`, or `student_resource_completion`**. Result of a transfer today: the new teacher sees the student and templates, but all planned/completed instances still belong to the old teacher → schedule shows nothing, balance history splits across two teachers.
**Fix:** one `rpc_transfer_student(p_student_id, p_from, p_to)` (admin-gated per §2.1) updating all 8 tables in a transaction.

### 6.2 🔴 Teacher deletion leaves a zombie
`EditTeacherDialog.tsx:205-267` deletes data + `profiles` but cannot delete the auth user from the client, and skips `user_roles`/`push_tokens`; every step ignores errors. The teacher can still sign in → infinite spinner (E1).
**Fix:** do it in the existing admin Edge-Function layer (service role): `supabase.auth.admin.deleteUser(id)` after a transactional data cleanup; the `ON DELETE CASCADE` FKs on `profiles`/`user_roles`/`push_tokens` then do the rest.

### 6.3 🟠 Balance reset is racy and drifts
`src/components/AdminBalanceManager.tsx:154-209`: read balance → insert `payment_history` → zero the row. A teacher completing a lesson between read and write gets those minutes silently erased **without being recorded in the payment**; a failure between the two steps double-counts on retry. Also never resets `manual_adjustment_minutes` (added `20260318130328`), so that component drifts from `total_minutes` forever, and no `balance_events` row of type `balance_reset` is written (the enum exists!).
**Fix:** `rpc_reset_balance(p_teacher_id)` — `SELECT … FOR UPDATE`, insert history, zero all five columns + `manual_adjustment_minutes`, insert `balance_events('balance_reset')`, return the receipt.

### 6.4 🟠 Chain shift/realign skips conflict detection
`useEditStudentDialog.handleShiftForward/Backward/RealignChain` (`:642-825`) move whole chains with **no `checkTeacherConflicts` call** (unlike `confirmDateUpdate`, which checks). The `20260504` trigger only blocks same-student duplicates → one tap can silently double-book the teacher with another student. Also, when a write **throws** (network error, not a Supabase error result), the optimistic `setInstances` is never rolled back (`catch` blocks at `:693,738,820` only toast).

### 6.5 Workflow friction (daily-use costs)

| Friction | Where | Suggestion |
|---|---|---|
| Payment record delete is a single tap, no confirm, no undo | `AdminBalanceManager.tsx:382-389` | AlertDialog + soft-delete (`deleted_at`) |
| `window.confirm` for the most destructive action (teacher delete) vs styled AlertDialogs everywhere else | `EditTeacherDialog.tsx:386` | AlertDialog with typed-name confirmation ("type the teacher's name") |
| Temp password shown in a toast and generated with `Math.random()` | `CreateStudentDialog.tsx:101,122-129` | `crypto.getRandomValues`, copy-to-clipboard button, force password change on first login |
| Sequential-only completion blocks legitimate out-of-order fixes; admin must undo N lessons to fix one | `rpc_complete_lesson` "Not the next completable lesson" | admin-only `p_force` flag on the RPC |
| Editing a student = giant single dialog (name+schedule+dates+package+danger zone) | `EditStudentDialog` + 939-line hook | tabbed dialog: Profile / Schedule / Package / Danger |
| Every mutation triggers full `fetchTeachers()` refetch (all teachers+students+lessons) | `AdminDashboard.tsx:392-425` callbacks | React Query invalidation per-entity |
| Deep-link from push: Admin polls for data (`AdminDashboard.tsx:98-109`), Teacher silently drops the link if students haven't loaded (`TeacherDashboard.tsx:53-70`) | unify: stash the pending link in state, resolve it in an effect once data arrives |
| Generic "Hata: yüklenemedi" toasts hide root causes everywhere (e.g. `AdminDashboard.tsx:170,225`) | append `error.message`, log `error` once |
| No pagination on `payment_history` (unbounded) and homework list | fine at current scale; add `.range()` when >100 rows |

---

## 7. Admin Automation & Workload Reduction (Pillar 6)

High-impact, in order of leverage:

1. **Server-side weekly instance generation (removes a whole bug class + admin ritual).** Today instances materialize only when someone *opens* the schedule (`ensureInstancesForWeek` — a client read that writes, race-prone, error-ignored at `useScheduleGrid.ts:293-294`). Move it to a `pg_cron` job (`SELECT cron.schedule('generate-week', '0 2 * * 1', $$ SELECT generate_instances_for_all_teachers(); $$)`) and delete the client path. Bonus: packages auto-advance cycles when exhausted instead of waiting for a manual "Paketi Sıfırla".
2. **Admin daily digest push** (extend the existing `admin-notifications-push` function + `lesson_reminder_log` dedup pattern): today's lesson count, trials scheduled, students on their last 2 lessons (the trigger exists — `notify_admin_last_lesson`), unpaid balances over a threshold, new homework since yesterday. One notification at 08:00 replaces the morning click-through of every teacher tab.
3. **Holiday / bulk-shift mode.** Recurring real task: "teacher is away next week". Provide `rpc_shift_teacher_range(teacher_id, from_date, to_date)` shifting all planned instances of all students at once with conflict checks in-transaction — replaces per-student, per-lesson dialog work.
4. **Payment receipt automation.** On `rpc_reset_balance`, auto-send the teacher a push + insert a `payment_history` row with a generated note; add "export payments CSV" (client-side `Blob` from the existing query) for the accountant.
5. **Data-health "Doctor" panel** (the `tmp/` recovery dumps prove incidents happen): one admin card running read-only checks — duplicate active instances (the pre-trigger legacy ones are explicitly still in the DB per `20260504` comments), students without tracking rows, instances whose `teacher_id` mismatches the `students` relationship (catches §6.1 damage), `teacher_balance.total_minutes ≠ SUM(balance_events)`. Each check = one SQL view + a red/green row.
6. **Onboarding autopilot:** `create-student` already exists — extend it to also create the tracking row, generate cycle-1 instances, and (optional) e-mail the invite with the temp password, removing the copy-paste-into-WhatsApp step.

---

## 8. Actionable Roadmap — Impact × Effort

### 🔴 P0 — This week (live security)
| # | Action | Effort |
|---|---|---|
| 1 | Migration: `auth.uid()`/admin checks in **all** `rpc_*` + `REVOKE EXECUTE … FROM anon` (§2.1) | 0.5 d |
| 2 | Drop `teacher_update_own_balance` / `teacher_insert_own_balance` (§2.4) | 10 min |
| 3 | `handle_new_user` → always `'student'`; gate/drop `create_student_relationship`; disable public signup in dashboard (§2.3) | 1 h |
| 4 | Remove plaintext password save/load; email-only prefill; `allowBackup="false"` (§2.2) — ship app update | 2 h + release |
| 5 | Untrack `.env`, `tmp/`, recovery files; add `.gitignore` entries (§2.6) | 30 min |
| 6 | Sanitize blog HTML with DOMPurify (§2.8) | 30 min |

### 🟠 P1 — Next 2–3 weeks (data integrity + admin trust)
| # | Action | Effort |
|---|---|---|
| 7 | `rpc_transfer_student` transactional; fix missing tables (§6.1) | 0.5 d |
| 8 | Teacher deletion via service-role Edge Function incl. `auth.admin.deleteUser` (§6.2) | 0.5 d |
| 9 | `rpc_reset_balance` atomic + `manual_adjustment_minutes` + `balance_events` (§6.3) | 0.5 d |
| 10 | Move chain shift/realign/date-update into transactional RPCs with in-transaction conflict checks (§3.3, §6.4) | 2–3 d |
| 11 | Profile-less user escape hatch on `/dashboard` (E1) + `signOut` ordering/scope + `disablePushTokens` on logout (E3, §5.2) | 0.5 d |
| 12 | Download & commit all Edge Functions; add shared-secret checks to `verify_jwt=false` ones (§2.7) | 0.5 d |
| 13 | Tighten teacher RLS ownership checks (§2.5); add `UNIQUE(teacher_id, student_id)` to `students` (E4) | 0.5 d |

### 🟡 P2 — This quarter (performance + hygiene)
| # | Action | Effort |
|---|---|---|
| 14 | Lazy-load `StudentAboutDialog` / `AdminBlogManager` / `GlobalTopicsManager` (−480 KB from dashboards, §4.1) | 2 h |
| 15 | Image pass: delete dead 1.3 MB PNG, WebP hero/values, SVG icons, `loading="lazy"` (§4.2) | 0.5 d |
| 16 | `rpc_get_week_schedule` + server-side weekly generation via pg_cron (§4.3, §7.1) | 2 d |
| 17 | Adopt React Query for dashboard data; delete manual caches (§4.3) | 2–3 d |
| 18 | `strict: true` incrementally + re-enable unused-vars lint; kill the 92 `any`s (§3.5) | ongoing |
| 19 | Split the god-hook/components; move features into `features/` folders (§3.1–3.2) | 3–4 d |
| 20 | `.gitattributes` + renormalize line endings; dead-dependency prune (§3.6) | 2 h |
| 21 | `parseLocalDate()` helper; fix UTC `new Date(str)` call sites (E6); 5s/3s timeout constant (E7); DEV-gate all logging (E8) | 0.5 d |

### 🟢 P3 — Opportunistic
| # | Action |
|---|---|
| 22 | Admin daily digest push (§7.2) · Holiday bulk-shift (§7.3) · Doctor panel (§7.5) · Payment CSV (§7.4) |
| 23 | Unify toast system; unify confirm dialogs; tabbed student editor (§6.5) |
| 24 | i18n decision: extend `LanguageContext` to dashboards or delete `translations.ts` scope creep (§3.6) |
| 25 | Add an error boundary around dashboard routes (none exists today — one render error white-screens the native app) |

---

*Report generated by read-only audit. No code, database state, or git history was modified. Line numbers reference the working tree as of 2026-08-28.*
