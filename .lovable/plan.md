

# Push Notification Fixes — Admin Init + Weekend Verification

## Confirmed Root Causes (Data-Backed)

### 1. Admin notification failure
**Kesin neden:** Admin user (`9f017d05-2118-4ec8-9d36-d1b592115841`) has ZERO entries in `push_tokens` table. `AdminDashboard.tsx` never calls `initPushNotifications()`. The function's type signature only accepts `'teacher' | 'student'` — no `'admin'`.

Result: No permission prompt, no token registration, no push delivery possible.

### 2. Weekend notifications
**Kesin neden: Kod bug'ı YOK. Cron hafta sonu DA çalıştı ve bildirim gönderdi.**

`lesson_reminder_log` proves it — 6 entries for March 21 (Saturday):
- 07:50 UTC → student `556dcff9` + teacher `4e24dbea` (11:00 lesson)
- 08:30 UTC → student `24b96bfc` + teacher `4e24dbea` (11:40 lesson)
- 09:10 UTC → student `4b93a7e6` + teacher `4e24dbea` (12:20 lesson)

All 3 Saturday students (`556dcff9`, `24b96bfc`, `4b93a7e6`) have **zero push tokens** in the DB — they never registered for push on a native device. So `send-push` found no tokens for them and silently skipped.

Teacher `4e24dbea` (Fatih Teacher) HAS tokens and should have received the reminder. If the user (admin) expected to see weekend notifications personally — that's Problem 1 (no admin token).

### 3. Stale token accumulation (secondary issue)
Users like "Fatih Teacher" have 3 iOS tokens (from reinstalls) and "Deneme123" has 3 iOS tokens — all `enabled: true`. The `upsert` on `onConflict: 'token'` creates new rows without cleaning old ones. Old tokens self-heal via FCM `UNREGISTERED` error in `send-push`, but this wastes API calls.

## Changes

### File 1: `src/lib/pushNotifications.ts`
- Line 38: Change `role: 'teacher' | 'student'` → `role: 'teacher' | 'student' | 'admin'`
- In `registerAndSaveToken`: Before upserting the new token, delete all other tokens for the same `user_id` that have a different token value. This prevents stale token accumulation from reinstalls.

### File 2: `src/components/AdminDashboard.tsx`
- Add `import { initPushNotifications } from '@/lib/pushNotifications'`
- Add a `useRef` + `useEffect` that calls `initPushNotifications(user.id, 'admin')` once after mount (same pattern as TeacherDashboard/StudentDashboard)

### No edge function changes needed
- Cron works correctly on weekends (proven by data)
- Timezone/date calculations are correct
- `send-push` stale token cleanup works (self-healing)

## Summary Answers

**1. Admin sorununun kesin nedeni:** `AdminDashboard` hiçbir zaman `initPushNotifications()` çağırmıyor. Admin kullanıcısının `push_tokens` tablosunda hiç kaydı yok. İzin ekranı da gösterilmiyor, token da kaydedilmiyor.

**2. Weekend bildirim gelmemesinin kesin nedeni:** Kod bug'ı değil. Cron Cumartesi sabahı 3 ders için 6 hatırlatma kaydı oluşturmuş (`lesson_reminder_log`'da kanıtı var). Ancak 3 öğrencinin hiçbirinin `push_tokens` tablosunda kaydı yok — native uygulamada bildirim izni vermemişler veya uygulamayı hiç açmamışlar. Öğretmenin token'ı var ve bildirimi almış olmalı. Admin olarak sen bildirimleri almadıysan, nedeni Problem 1 (admin token yok).

## Implementation Order
1. Update `pushNotifications.ts` — add admin role + stale token cleanup
2. Update `AdminDashboard.tsx` — add init call
3. No DB migration needed

## Test Checklist
- Admin login on native → permission prompt appears
- Admin token appears in `push_tokens` with role='admin'
- "Son 1 ders kaldı" trigger → admin push arrives
- Teacher/student push still works (no regression)
- Reinstall app → only 1 token per user (stale cleaned)

