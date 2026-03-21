

# Push Notification End-to-End Verification & Fixes

## Architecture Summary

```text
Flow 1 — Admin "son 1 dersi kaldı":
  lesson_instances UPDATE → notify_admin_last_lesson() trigger
  → INSERT admin_notifications → Webhook → admin-notifications-push edge fn
  → send-push edge fn → FCM → device

Flow 2 — Lesson reminder (teacher + student):
  pg_cron every minute → lesson-reminder-cron edge fn
  → queries lesson_instances for today at TR_now+10min
  → send-push edge fn (batch) → FCM → device

Flow 3 — Homework:
  homework_submissions INSERT → notify_on_homework_upload() trigger
  → INSERT notifications → Webhook → notifications-push edge fn
  → send-push edge fn → FCM → device
```

## Per-Flow Analysis

### Flow 1: Admin "son 1 dersi kaldı" — 2 BUGS FOUND

**Trigger chain:** Correct. DB trigger `notify_admin_last_lesson` fires on `lesson_instances` UPDATE when `completed_count = total_lessons - 1`. Inserts into `admin_notifications`. Webhook calls `admin-notifications-push`. Edge function finds all admin user_ids from `user_roles`, calls `send-push` for each.

**Token registration:** Fixed (previous change added `initPushNotifications` to AdminDashboard).

**BUG 1 — Wrong deep_link:** `admin-notifications-push/index.ts` line 117 sends `deep_link: "/admin"`. The app has NO `/admin` route — admin dashboard is at `/dashboard`. Tapping the notification navigates to `/admin` → 404 page.

**BUG 2 — No tap handling in AdminDashboard:** Even if deep_link were `/dashboard`, there's no code in `AdminDashboard.tsx` to read query params and auto-open the student settings dialog. TeacherDashboard and StudentDashboard both have deep_link handlers for homework — AdminDashboard has none.

**BUG 3 — No student context in deep_link:** The payload has `admin_notification_id` but not `student_id` or `teacher_id`, so even with a handler, the admin can't be routed to the specific student.

### Flow 2: Lesson Reminder — 1 MINOR ISSUE

**Trigger chain:** Correct. Cron runs every minute, timezone calculation is correct (Europe/Istanbul via Intl), queries `lesson_instances` by exact date + time. Dedup via `lesson_reminder_log` unique constraint. Sends batch to `send-push`.

**No `data` field in payload:** The `PushRecipient` interface in lesson-reminder-cron (line 132-137) doesn't include `data`. `send-push` receives `data: undefined` → sends `data: {}` to FCM. On tap, `pushNotificationActionPerformed` reads `data.deep_link` → undefined → defaults to `/dashboard`. This is acceptable behavior but means no structured routing.

### Flow 3: Homework — WORKING CORRECTLY

**Trigger chain:** Correct. DB trigger → notifications INSERT → webhook → notifications-push → send-push.

**Deep link:** `/dashboard?action=homework&student_id=X&teacher_id=Y` — well-structured.

**Tap handling:** TeacherDashboard (line 53-69) reads `action=homework` + `student_id`, finds student, opens `HomeworkListDialog`. StudentDashboard (line 78-83) reads `action=homework`, opens `listDialogOpen`. Both clean URL after handling. Working correctly.

### Tap Handling (All Flows)

**Current mechanism (pushNotifications.ts line 128-137):** `pushNotificationActionPerformed` listener reads `data.deep_link`, does `window.history.pushState()` + `dispatchEvent(popstate)`. React Router's BrowserRouter detects this and renders the route.

**Cold start:** Capacitor queues the `pushNotificationActionPerformed` event. On cold start: app opens → session restored → dashboard mounts → `initPushNotifications` runs → listener registered → queued event fires → navigation happens. This works because Capacitor holds the event until the listener is added.

**Listener duplication risk:** `registerAndSaveToken` adds 4 listeners without removing previous ones. Protected by `useRef(false)` per mount. Risk is low but adding `removeAllListeners()` before re-registering would be safer.

## Changes Required

### 1. `supabase/functions/admin-notifications-push/index.ts`
- Fix deep_link from `/admin` to `/dashboard?action=student_settings&student_id=${record.student_id}&teacher_id=${record.teacher_id}`
- Add `student_id` and `teacher_id` to data payload
- Redeploy edge function

### 2. `src/components/AdminDashboard.tsx`
- Add `useEffect` to handle `action=student_settings` query param from notification tap
- On detect: find matching student in loaded teachers data, set `editingStudent` + `setShowEditStudent(true)`
- Clean URL after handling (same pattern as TeacherDashboard)

### 3. `supabase/functions/lesson-reminder-cron/index.ts`
- Add `data: { deep_link: '/dashboard', type: 'lesson_reminder' }` to push recipients
- This enables future routing improvements without breaking current behavior

### 4. `src/lib/pushNotifications.ts`
- Add `await PushNotifications.removeAllListeners()` before adding new listeners in `registerAndSaveToken` to prevent listener accumulation on re-mounts

## What's Already Working (No Changes Needed)

- Token registration for all 3 roles (teacher, student, admin)
- Stale token cleanup on login
- Invalid token cleanup on FCM UNREGISTERED error
- Homework notification end-to-end with deep linking
- Lesson reminder cron with correct timezone handling
- Dedup via lesson_reminder_log
- Idempotent push via push_processing_at / push_sent_at columns
- Android custom sound channels (lesson, homework, last_lesson)
- iOS custom sounds via apns payload
- Foreground/background/cold-start notification receipt
- Permission flow with dismiss tracking

## Files to Change

| File | Change | Risk |
|------|--------|------|
| `supabase/functions/admin-notifications-push/index.ts` | Fix deep_link + add student context to data | Low |
| `src/components/AdminDashboard.tsx` | Add notification tap handler for student_settings | Low |
| `supabase/functions/lesson-reminder-cron/index.ts` | Add data field with type + deep_link | Low |
| `src/lib/pushNotifications.ts` | Add removeAllListeners before re-registering | Low |

## Test Checklist

- Admin login on native → permission prompt appears
- Admin token in `push_tokens` table
- Trigger "son 1 ders kaldı" → admin push arrives
- Tap admin notification → navigates to `/dashboard`, auto-opens EditStudentDialog for correct student
- Teacher lesson reminder → push arrives 10min before
- Student lesson reminder → push arrives 10min before
- Tap lesson reminder → navigates to `/dashboard`
- Homework upload by teacher → student gets push
- Homework upload by student → teacher gets push
- Tap homework notification → opens HomeworkListDialog for correct student
- All above in foreground, background, cold start
- No duplicate navigations on tap

