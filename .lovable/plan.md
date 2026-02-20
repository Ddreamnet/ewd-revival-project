

# Android Custom Notification Sounds — Bug Fix

## Tespit Edilen Sorunlar

### Sorun 1: `sound` parametresi uzanti icermemeli

`LocalNotifications.createChannel()` cagrisinda `sound: 'lesson.wav'` kullaniliyor. Android `res/raw` kaynaklarina uzantisiz referans verir. Capacitor dokumantasyonuna gore `sound` alani dosya uzantisi OLMADAN verilmeli:

```
YANLIS:  sound: 'lesson.wav'
DOGRU:   sound: 'lesson'
```

Bu, kanalin varsayilan ses ile olusturulmasina neden oluyor. Android kanal sesi ilk olusturulma aninda sabitlendigindan, uygulama uninstall/reinstall yapilsa bile yanlis ses kaydedilmis oluyor.

### Sorun 2: FCM payload'inda `sound` alani eksik

FCM HTTP v1 payload'inda `android.notification.channel_id` gonderiliyor ama `android.notification.sound` alani yok. Bazi cihaz/OS kombinasyonlarinda channel_id tek basina yeterli olmuyor — `sound` alaninin da eklenmesi gerekiyor.

## Cozum

### Degisiklik 1: `src/lib/pushNotifications.ts`

Sound degerlerinden `.wav` uzantisini kaldir:

```typescript
const channels = [
  { id: 'lesson', name: 'Ders Hatırlatma', description: 'Derse 10 dk kala bildirim', importance: 5, sound: 'lesson' },
  { id: 'homework', name: 'Ödev Bildirimi', description: 'Ödev yüklendiğinde bildirim', importance: 5, sound: 'homework' },
  { id: 'last_lesson', name: 'Son Ders Uyarısı', description: 'Admin son ders uyarısı', importance: 5, sound: 'last_lesson' },
];
```

Debug loglar ekle:

```typescript
console.log('[PUSH] Creating Android notification channels...');
// ... her kanal icin:
console.log(`[PUSH] Channel created: ${ch.id}, sound: ${ch.sound}`);
```

### Degisiklik 2: `supabase/functions/send-push/index.ts`

FCM payload'ina `sound` alani ekle:

```typescript
android: {
  priority: "HIGH",
  notification: {
    ...(recipient.channel_id
      ? { channel_id: recipient.channel_id, sound: recipient.channel_id }
      : { default_sound: true }),
    default_vibrate_timings: true,
  },
},
```

Ayrica FCM payload loglamasi ekle:

```typescript
console.log(`[SEND-PUSH] FCM payload: title=${recipient.title}, channel_id=${recipient.channel_id || 'default'}`);
```

## Degistirilecek Dosyalar

| Dosya | Degisiklik |
|---|---|
| `src/lib/pushNotifications.ts` | `sound` degerlerinden `.wav` uzantisini kaldir + debug log ekle |
| `supabase/functions/send-push/index.ts` | FCM payload'ina `sound` alani ekle + loglama |

## Onemli Not

Android'de notification channel sesi ilk olusturulmada sabitlenir. Bu fix'ten sonra kullanicilarin **uygulamayi uninstall edip reinstall etmesi** gerekir — boylece kanallar dogru ses ile yeniden olusturulur.

## Checklist Cevaplari

| Madde | Durum |
|---|---|
| A) Ses dosyalari repo'da | TAMAM — `res/raw/` altinda 3 wav dosyasi mevcut |
| B) Channel olusturma | BUG — `sound: 'lesson.wav'` yerine `sound: 'lesson'` olmali |
| C) FCM channel_id | TAMAM — 3 fonksiyon dogru channel_id gonderiyor |
| D) notification vs data-only | TAMAM — notification payload kullaniliyor |
| E) Eski kanal ID | TAMAM — `lesson_reminders` artik hicbir yerde yok |
| F) Android 13+ permission | TAMAM — `POST_NOTIFICATIONS` izni isteniyor |
| G) FCM sound alani | EKSIK — payload'a `sound` alani eklenmeli |

