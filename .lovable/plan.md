

# send-push Single Mode channel_id Bug Fix

## Tespit

`send-push` edge function'da iki mod var:

1. **Batch mode** (`body.recipients` array) — channel_id DOGRU geciliyor
2. **Single mode** (body'den tek recipient) — channel_id KAYBOLUYOR

```text
notifications-push --> { user_id, title, body, channel_id: "homework", data }
                                                    |
                               send-push single mode'da bunu ALIYOR:
                               { user_id, title, body, data }
                                    channel_id YOK!
                                         |
                               recipient.channel_id = undefined
                                         |
                               { default_sound: true }  --> Default kanal
```

Hangi fonksiyon hangi modu kullaniyor:

| Kaynak | Mod | channel_id |
|---|---|---|
| lesson-reminder-cron | batch (recipients array) | DOGRU geciyor |
| notifications-push | single | KAYIP — homework |
| admin-notifications-push | single | KAYIP — last_lesson |

## Cozum

`send-push/index.ts` satir 57'de `channel_id`'yi de dahil et:

```typescript
// ONCE (BUG):
recipients = [{ user_id: body.user_id, title: body.title, body: body.body, data: body.data }];

// SONRA (FIX):
recipients = [{ 
  user_id: body.user_id, 
  title: body.title, 
  body: body.body, 
  data: body.data, 
  channel_id: body.channel_id 
}];
```

## Degistirilecek Dosya

| Dosya | Degisiklik |
|---|---|
| `supabase/functions/send-push/index.ts` | Satir 57: single mode'da `channel_id: body.channel_id` ekle |

Tek satirlik degisiklik. Baska dosyada degisiklik gerekmiyor — `notifications-push` ve `admin-notifications-push` zaten `channel_id`'yi dogru gonderiyor, sadece `send-push` onu okumuyor.

## Test

Fix sonrasi `send-push` loglarinda su gorulmeli:

- Odev bildirimi: `channel_id=homework`
- Son ders uyarisi: `channel_id=last_lesson`
- Ders hatirlatma: `channel_id=lesson` (zaten calisiyor)

