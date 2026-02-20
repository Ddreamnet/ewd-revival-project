

# Android Custom Notification Sounds — Duzeltilmis Plan

## Ozet

3 katman degistirilecek: ses dosyalari repo'ya commit edilecek, kanal olusturma TypeScript'ten yapilacak (native koda dokunulmayacak), ve FCM payload'ina `channel_id` eklenecek.

---

## ADIM 1 — Ses Dosyalarini Repo'ya Ekleme

Kullanicinin yukledigim zip'ten cikarilan 3 `.wav` dosyasi asagidaki konumlara yazilacak:

```
android/app/src/main/res/raw/lesson.wav
android/app/src/main/res/raw/homework.wav
android/app/src/main/res/raw/last_lesson.wav
```

Bu dosyalar repo'da kalacak. Kullanici `git pull` yaptiginda native projede hazir olacak.

---

## ADIM 2 — Notification Channel Olusturma (TypeScript, native kod degil)

`@capacitor/local-notifications` paketinin `createChannel()` API'si kullanilarak kanallar TypeScript tarafinda olusturulacak. Boylece `MainActivity.java` veya `.kt` dosyasina dokunmaya gerek kalmaz.

**Yeni bagimlilik:** `@capacitor/local-notifications`

**Degisiklik:** `src/lib/pushNotifications.ts` icinde `initPushNotifications` fonksiyonunun basinda, sadece Android platformunda 3 kanal olusturulacak:

```typescript
import { LocalNotifications } from '@capacitor/local-notifications';

async function createAndroidChannels() {
  if (Capacitor.getPlatform() !== 'android') return;
  
  const channels = [
    { id: 'lesson', name: 'Ders Hatirlatma', description: 'Derse 10 dk kala bildirim', importance: 5, sound: 'lesson.wav' },
    { id: 'homework', name: 'Odev Bildirimi', description: 'Odev yuklendiginde bildirim', importance: 5, sound: 'homework.wav' },
    { id: 'last_lesson', name: 'Son Ders Uyarisi', description: 'Admin son ders uyarisi', importance: 5, sound: 'last_lesson.wav' },
  ];

  for (const ch of channels) {
    await LocalNotifications.createChannel(ch);
  }
}
```

`importance: 5` = HIGH (Android NotificationManager.IMPORTANCE_HIGH).

`sound` alani `res/raw/` altindaki dosya adini referans eder (uzanti dahil).

Mevcut `lesson_reminders` kanali artik kullanilmayacak — yeni 3 kanal onun yerini alacak. Kullanicinin uygulamayi uninstall/reinstall etmesi gerekebilir (Android kanal sesi ilk olusturulmada sabitlenir).

---

## ADIM 3 — `send-push/index.ts`: channel_id Destegi

`Recipient` interface'ine `channel_id?: string` eklenir.

FCM payload'inda:

```typescript
android: {
  priority: "HIGH",
  notification: {
    channel_id: recipient.channel_id || undefined,
    // channel_id varsa default_sound kaldirilir (kanal sesi kullanilacak)
    ...(recipient.channel_id ? {} : { default_sound: true }),
    default_vibrate_timings: true,
  },
},
```

---

## ADIM 4 — Caller Fonksiyonlari Guncelleme

| Fonksiyon | channel_id degeri |
|---|---|
| `lesson-reminder-cron/index.ts` | `"lesson"` — her recipient'a `channel_id: "lesson"` eklenir (data objesi degil, recipients dizisindeki her elemana) |
| `notifications-push/index.ts` | `"homework"` — pushPayload'a `channel_id: "homework"` eklenir |
| `admin-notifications-push/index.ts` | `"last_lesson"` — pushPayload'a `channel_id: "last_lesson"` eklenir |

`send-push` tek recipient modunda da `channel_id`'yi kabul ettiginden, hem batch (lesson-reminder-cron) hem tekli (notifications-push, admin-notifications-push) cagrilar desteklenir.

---

## Degistirilecek / Olusturulacak Dosyalar

| Dosya | Islem |
|---|---|
| `android/app/src/main/res/raw/lesson.wav` | YENI (zip'ten) |
| `android/app/src/main/res/raw/homework.wav` | YENI (zip'ten) |
| `android/app/src/main/res/raw/last_lesson.wav` | YENI (zip'ten) |
| `package.json` | `@capacitor/local-notifications` ekleme |
| `src/lib/pushNotifications.ts` | Channel olusturma + import |
| `supabase/functions/send-push/index.ts` | `channel_id` destegi |
| `supabase/functions/lesson-reminder-cron/index.ts` | `channel_id: "lesson"` |
| `supabase/functions/notifications-push/index.ts` | `channel_id: "homework"` |
| `supabase/functions/admin-notifications-push/index.ts` | `channel_id: "last_lesson"` |

## Onemli Not

Android'de notification channel sesi ilk olusturulmada belirlenir ve sonradan degistirilemez. Bu yuzden ilk kurulumda dogru olmasini sagliyoruz. Mevcut `lesson_reminders` kanali zaten kurulu kullanicilarda eski ses calacaktir — temiz kurulum (uninstall/reinstall) gerekir.

