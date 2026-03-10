

## Plan: iOS Push Notification Entegrasyonu (Revize v3)

### Analiz Sonuçları

Mevcut sistemde 3 bildirim tipi var:

| Tip | Edge Function | channel_id | Ses | deep_link | Tetik |
|-----|--------------|------------|-----|-----------|-------|
| Ödev | `notifications-push` | `homework` | homework.wav | `/notifications` | DB webhook |
| Ders hatırlatma | `lesson-reminder-cron` | `lesson` | lesson.wav | yok | Cron |
| Son ders uyarısı | `admin-notifications-push` | `last_lesson` | last_lesson.wav | `/admin` | DB webhook |

---

### Token Akışı — Kritik Analiz

**Sorun:** Capacitor plugin'i iOS'ta Firebase SDK olmadan sadece APNs device token döner. FCM HTTP v1 API bu token'ı kabul etmez.

**Çözüm:** Firebase SDK entegre edilecek. AppDelegate'te APNs token Firebase'e bridge edildikten sonra, `Messaging.messaging().token(...)` ile gerçek FCM registration token alınacak ve Capacitor'ın `registration` event'ine **bu FCM token** verilecek.

**Token akışı (adım adım):**
1. `PushNotifications.register()` → iOS APNs'e kayıt ister
2. `didRegisterForRemoteNotificationsWithDeviceToken` → APNs device token gelir
3. `Messaging.messaging().apnsToken = deviceToken` → APNs token Firebase'e bridge edilir
4. `Messaging.messaging().token { token, error in ... }` → Firebase SDK, FCM sunucusundan gerçek FCM registration token alır
5. `NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)` → **FCM token** Capacitor plugin'e verilir (APNs token değil)
6. Capacitor `registration` event'inde `token.value` = gerçek FCM token
7. Bu FCM token Supabase `push_tokens` tablosuna kaydedilir
8. `send-push` edge function bu token'ı FCM HTTP v1 API'ye gönderir → çalışır

**Garanti:** iOS tarafında backend'e kaydedilen token APNs token değil, FCM registration token'dır.

---

### 1. Firebase iOS SDK Entegrasyonu (Manuel — Xcode)

Kullanıcının yapacağı adımlar:
1. Xcode'da: **File → Add Package Dependencies**
2. Repo URL: `https://github.com/firebase/firebase-ios-sdk`
3. Version: en güncel stable sürüm
4. Sadece **FirebaseMessaging** modülünü seç
5. Xcode SPM dependency'yi resolve edecek

`Package.swift` dosyası elle düzenlenmeyecek.

---

### 2. `ios/App/App/AppDelegate.swift` — APNs Callback'leri + Firebase Bridge

```swift
import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // APNs token'ı Firebase'e bridge et
        Messaging.messaging().apnsToken = deviceToken
        // Firebase'den gerçek FCM registration token'ı al
        Messaging.messaging().token { token, error in
            if let error = error {
                NotificationCenter.default.post(
                    name: .capacitorDidFailToRegisterForRemoteNotifications,
                    object: error
                )
            } else if let token = token {
                // Capacitor'a FCM token gönder (APNs token değil)
                NotificationCenter.default.post(
                    name: .capacitorDidRegisterForRemoteNotifications,
                    object: token
                )
            }
        }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
```

---

### 3. `capacitor.config.ts` — iOS Foreground PresentationOptions

```ts
plugins: {
  PushNotifications: {
    presentationOptions: ["badge", "sound", "alert"]
  }
}
```

LocalNotifications ile duplicate oluşturmaya gerek yok.

---

### 4. `supabase/functions/send-push/index.ts` — APNs Payload Ekleme

Android bloğu aynen korunacak. `apns` bloğu eklenecek:

```ts
const soundFile = recipient.channel_id
  ? `${recipient.channel_id}.wav`
  : "default";

apns: {
  payload: {
    aps: {
      sound: soundFile
    }
  }
}
```

`mutable-content` opsiyoneldir, bu projede kullanılmayacak.

Ses eşlemesi: `homework` → `homework.wav`, `lesson` → `lesson.wav`, `last_lesson` → `last_lesson.wav`

---

### 5. Homework Bildirimi → Ödevler Ekranına Yönlendirme

**5a. `notifications-push/index.ts`** — deep_link güncelleme:
```ts
deep_link: "/dashboard?action=homework&student_id=X&teacher_id=Y"
```

**5b. `src/lib/pushNotifications.ts`** — action listener'ında:
```ts
const deepLink = data.deep_link ?? '/dashboard';
if (deepLink.startsWith('/')) {
  window.history.pushState({}, '', deepLink);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
```

**5c. `StudentDashboard.tsx` ve `TeacherDashboard.tsx`** — query param kontrolü:
```ts
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'homework') {
    setListDialogOpen(true);
    window.history.replaceState({}, '', '/dashboard');
  }
}, []);
```

**Senaryolar:** Cold start, background tap, foreground tap — üçünde de `pushNotificationActionPerformed` → URL push → useEffect → homework dialog açılır.

---

### Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `ios/App/App/AppDelegate.swift` | APNs callback + `Messaging.messaging().token(...)` ile FCM token bridge |
| `capacitor.config.ts` | PushNotifications presentationOptions |
| `supabase/functions/send-push/index.ts` | APNs payload bloğu |
| `supabase/functions/notifications-push/index.ts` | deep_link homework route |
| `src/lib/pushNotifications.ts` | Deep link action handling |
| `src/components/StudentDashboard.tsx` | Query param ile homework dialog |
| `src/components/TeacherDashboard.tsx` | Query param ile homework dialog |

### Dokunulmayacaklar
- Android bildirim kanalları ve ses mantığı
- Edge function tetikleme akışları
- Token kayıt/upsert mantığı
- Ders hatırlatma ve admin notification deep link'leri

### Kullanıcının Manuel Yapması Gerekenler
1. Xcode: **File → Add Package Dependencies** → `https://github.com/firebase/firebase-ios-sdk` → **FirebaseMessaging**
2. `npx cap sync ios`
3. App'i yeniden build et

### Özet

1. **iOS'ta hangi token kaydediliyor?** → `Messaging.messaging().token(...)` ile alınan FCM registration token. APNs token değil.
2. **Bu token neden doğru?** → `send-push` FCM HTTP v1 API kullanıyor, FCM token bekliyor. Firebase SDK APNs→FCM dönüşümünü garanti ediyor.
3. **Homework tıklanınca?** → `/dashboard?action=homework` → useEffect → HomeworkListDialog açılır.
4. **Cold/background/foreground:** Üçünde de tutarlı çalışır.

