
# notifications-push Edge Function — Güvenli Uygulama Planı

## Özet

Kullanıcının belirttiği 5 düzeltme gereksinimi karşılanarak `notifications-push` Edge Function oluşturulacak, DB migration ile iki idempotency kolonu eklenecek, `NOTIFICATIONS_WEBHOOK_SECRET` sırrı kaydedilecek ve `pushNotifications.ts` deep link navigasyonu güncellenecek.

---

## Yapılacak İşlemler (Sırayla)

### ADIM 1 — DB Migration: İki Yeni Kolon

`public.notifications` tablosuna iki kolon eklenir:

```sql
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_processing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_push_unprocessed
  ON public.notifications (id)
  WHERE push_sent_at IS NULL AND push_processing_at IS NULL;
```

**Neden iki kolon?**
- `push_processing_at`: Fonksiyon bu satırı "aldım, işliyorum" diye işaretler. Webhook yeniden denerse bu satırı atlar.
- `push_sent_at`: Push başarıyla gönderildikten sonra set edilir.
- Hata olursa `push_processing_at` sıfırlanır, retry mümkün olur.

---

### ADIM 2 — Supabase Secret: `NOTIFICATIONS_WEBHOOK_SECRET`

Mevcut secretlar arasında `NOTIFICATIONS_WEBHOOK_SECRET` yok. Yeni bir rastgele değer ile eklenecek. Bu secret, Supabase Webhook'undan fonksiyona gelen isteğin doğruluğunu kanıtlar.

---

### ADIM 3 — Yeni Edge Function: `supabase/functions/notifications-push/index.ts`

**Güvenlik katmanı:**
- `verify_jwt = false` (Supabase webhook JWT'siz POST atar)
- Fonksiyon, `x-ewd-webhook-secret` header'ını `NOTIFICATIONS_WEBHOOK_SECRET` ile karşılaştırır.
- Uyuşmazlık → 401 döner.

**İdempotency akışı (2 kolonlu):**

```
1. CLAIM:
   UPDATE notifications
   SET push_processing_at = now()
   WHERE id = record.id
     AND push_sent_at IS NULL
     AND push_processing_at IS NULL
   RETURNING id;
   
   → Satır dönmezse: zaten işleniyor veya gönderildi. 200 ile çık.

2. SEND PUSH:
   fetch /functions/v1/send-push
   header: x-cron-secret: <CRON_SECRET>   ← send-push bunu zaten kabul ediyor
   body: { user_id, title, body, data: {...} }

3a. BAŞARI:
   UPDATE notifications
   SET push_sent_at = now(), push_processing_at = NULL
   WHERE id = record.id;

3b. HATA:
   UPDATE notifications
   SET push_processing_at = NULL
   WHERE id = record.id;
   → 500 döner, webhook retry edebilir.
```

**send-push çağrısının güvenliği:**
`send-push/index.ts` zaten `x-cron-secret` header'ını kabul ediyor (memory'den ve kaynak koddan doğrulandı). `notifications-push` bu header'ı `CRON_SECRET` değeriyle gönderecek. Hiçbir anonim erişime izin verilmeyecek.

**Profil isimleri ve mesaj kişiselleştirme:**
Service role client ile `profiles` tablosundan `teacher_id` ve `student_id` için `full_name` çekilir:

```
recipient_id === teacher_id:
  title = "Yeni Ödev Teslimi 📝"
  body  = "{student_name} yeni ödev yükledi."

recipient_id === student_id:
  title = "Yeni Ödev 📝"
  body  = "Öğretmeniniz {teacher_name} yeni ödev paylaştı."

diğer:
  title = "Yeni Bildirim"
  body  = "Bildirimlerinizi kontrol edin."
```

**Data payload (tüm değerler string):**
```json
{
  "notification_id": "<uuid>",
  "homework_id": "<uuid>",
  "deep_link": "/notifications"
}
```

---

### ADIM 4 — `supabase/config.toml` Güncelleme

```toml
[functions.notifications-push]
verify_jwt = false
```

---

### ADIM 5 — `src/lib/pushNotifications.ts` Deep Link Güncelleme

`pushNotificationActionPerformed` listener'ı `window.location.hash` kullanmak yerine React Router ile uyumlu çalışacak şekilde güncellenir:

```typescript
await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
  const data = action.notification.data ?? {};
  const deepLink: string = data.deep_link ?? '/notifications';
  // Safely navigate — use history API so React Router picks it up
  if (deepLink && deepLink.startsWith('/')) {
    window.history.pushState({}, '', deepLink);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
});
```

Bu yaklaşım: `BrowserRouter` `popstate` olayını dinlediğinden, `window.history.pushState` + `PopStateEvent` dispatch etmek React Router'ı tetikler.

---

## Değiştirilecek / Oluşturulacak Dosyalar

| Dosya | İşlem |
|---|---|
| DB Migration | `push_processing_at` + `push_sent_at` kolonları |
| Supabase Secret | `NOTIFICATIONS_WEBHOOK_SECRET` ekleme |
| `supabase/functions/notifications-push/index.ts` | YENİ |
| `supabase/config.toml` | `[functions.notifications-push]` |
| `src/lib/pushNotifications.ts` | Deep link navigasyon güncelleme |

`send-push/index.ts` — **değiştirilmeyecek**, zaten `x-cron-secret` doğrulaması var.

---

## Webhook Kurulumu (Manuel Adım — Kullanıcı Yapacak)

Edge Function dağıtıldıktan sonra kullanıcıya adımlar gösterilecek:

1. Supabase Dashboard → **Database → Webhooks → Create a new webhook**
2. Name: `notifications_push`
3. Table: `public.notifications` / Event: `INSERT`
4. Type: Supabase Edge Functions → `notifications-push`
5. HTTP Header ekle:
   - Key: `x-ewd-webhook-secret`
   - Value: `<NOTIFICATIONS_WEBHOOK_SECRET değeri>`
6. Kaydet

---

## Güvenlik Özeti

| Katman | Yöntem |
|---|---|
| Webhook → notifications-push | `x-ewd-webhook-secret` header (dedicated secret) |
| notifications-push → send-push | `x-cron-secret: <CRON_SECRET>` header |
| send-push → FCM | Google OAuth2 service account JWT |
| Anon erişim | Her iki fonksiyon da 401 döner |

