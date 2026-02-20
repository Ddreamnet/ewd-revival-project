

# Admin Bildirimleri icin Push Ekleme Plani

## Mevcut Durum

- `admin_notifications` tablosu: `id, notification_type, teacher_id, student_id, message, is_read, created_at`
- Tabloda `recipient_id` yok — bildirimler tum admin kullanicilara gider
- Simdi sadece uygulama icinde Realtime ile gosteriliyor
- Push altyapisi (`notifications-push`, `send-push`, `push_tokens`) hazir

## Yapilacak Islemler

### ADIM 1 — DB Migration: admin_notifications icin idempotency kolonlari

```sql
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS push_processing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_push_unprocessed
  ON public.admin_notifications (id)
  WHERE push_sent_at IS NULL AND push_processing_at IS NULL;
```

### ADIM 2 — Yeni Edge Function: `admin-notifications-push`

**Dosya:** `supabase/functions/admin-notifications-push/index.ts`

Neden ayri fonksiyon: `admin_notifications` tablosunun yapisinin `notifications` tablosundan farkli olmasi (recipient_id yok, tum adminlere gitmesi gerekiyor).

**Akis:**

```text
1. x-ewd-webhook-secret header dogrula (ayni NOTIFICATIONS_WEBHOOK_SECRET)
2. payload.type === "INSERT" kontrolu
3. Idempotency: push_processing_at ile claim et
4. user_roles tablosundan role='admin' olan tum kullanicilari bul
5. Her admin icin send-push cagir:
   title: "Son Ders Uyarisi"
   body: record.message (zaten "X ogretmenin Y ogrencisinin son bir dersi kaldi!")
   data: { admin_notification_id: "<uuid>", deep_link: "/admin" }
6. Basari: push_sent_at = now()
7. Hata: push_processing_at = NULL (retry icin)
```

**Guvenlik:** Ayni `NOTIFICATIONS_WEBHOOK_SECRET` kullanilir. `send-push` cagrisi `x-cron-secret` ile yapilir.

### ADIM 3 — config.toml guncelleme

```toml
[functions.admin-notifications-push]
verify_jwt = false
```

### ADIM 4 — Webhook Kurulumu (Manuel)

Supabase Dashboard'ta ikinci bir webhook olusturulacak:
- Name: `admin_notifications_push`
- Table: `public.admin_notifications`
- Event: `INSERT`
- Edge Function: `admin-notifications-push`
- Header: `x-ewd-webhook-secret: <NOTIFICATIONS_WEBHOOK_SECRET>`

## Degistirilecek / Olusturulacak Dosyalar

| Dosya | Islem |
|---|---|
| DB Migration | `push_processing_at` + `push_sent_at` kolonlari (admin_notifications) |
| `supabase/functions/admin-notifications-push/index.ts` | YENI |
| `supabase/config.toml` | `[functions.admin-notifications-push]` ekleme |

## Teknik Notlar

- Admin kullanicilari `user_roles` tablosundan `role = 'admin'` ile bulunur
- Birden fazla admin varsa her birine ayri push gider
- Ayni `NOTIFICATIONS_WEBHOOK_SECRET` kullanildigi icin ek secret gerekmez
- `pushNotifications.ts` guncellenmesine gerek yok — deep link zaten calisiyor

