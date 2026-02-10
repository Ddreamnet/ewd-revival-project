

# Android Play Store Readiness + Push Notifications + Kamera Plani (Revize v3)

## A) Bulgular (Repo Audit)

### 1. day_of_week Mapping -- DOGRULANMIS
DB'deki `day_of_week` degerleri **JavaScript `getDay()` standardini** kullanir:
- **0 = Pazar (Sunday), 1 = Pazartesi (Monday), ... 6 = Cumartesi (Saturday)**

Kanitlar:
- `AdminDashboard.tsx` ve `TeacherDashboard.tsx`: `getDayName()` fonksiyonu `["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"]` dizisi kullanir (index 0 = Pazar).
- `AdminWeeklySchedule.tsx` satir 227-228: `// day_of_week in DB: 1=Pazartesi, 0=Pazar` yorumu ve `dayIndex === 6 ? 0 : dayIndex + 1` donusumu.
- `useLessonOverrides.ts` satir 139: `// dayOfWeek: 1=Mon, 2=Tue, ..., 6=Sat, 0=Sun`
- DB'de day_of_week=0 icin dersler var (Pazar dersleri, saatleri: 10:00, 17:00, 17:40).

**Cron'daki gun hesabi:** Turkiye yerel saati ile `new Date().getDay()` sonucu kullanilacak. JavaScript'in `getDay()` ile DB tamamen uyumlu.

### 2. Zaman Dilimi
Tum ders saatleri (`start_time`) Turkiye yerel saati (Europe/Istanbul) olarak saklanir. DB'de `time without time zone` tipi kullanilir. Cron fonksiyonunda **Europe/Istanbul timezone ile** saat hesabi yapilacak; UTC+3 hardcode edilmeyecek.

### 3. Capacitor Durumu
- Capacitor paketleri package.json'da **YOK**.
- `capacitor.config.ts` dosyasi yok.
- Lokal `/android` klasoru repo disinda yonetiliyor.

### 4. Dosya Yukleme
- `UploadHomeworkDialog.tsx`: HTML `<input type="file">` ile odev yukleme. Android WebView'da kamera secenegi sunmuyor.
- `AddResourceDialog.tsx`: Ayni yapi, drag-drop destegi var.

### 5. Bildirim Sistemi
- Supabase Realtime ile sadece in-app bildirim (uygulama acikken).
- Push notification altyapisi yok.

### 6. Mevcut Edge Functions
- `cleanup-lesson-overrides`: Gunluk cron.
- `cleanup-trial-lessons`: Deneme dersi temizligi.
- `create-student`, `create-teacher`: JWT required.

### 7. Cron Endpoint Guvenlik Sorunu (YENI -- v3)
Mevcut `cleanup-lesson-overrides` ve `cleanup-trial-lessons` fonksiyonlari `verify_jwt=false` ile yapilandirilmis ve cron job'dan ANON_KEY ile cagrilmak uzere tasarlanmis. Bu, herhangi birinin bu endpoint'leri disaridan cagirabilecegi anlamina gelir. Yeni `lesson-reminder-cron` icin bu yaklasim kullanilmayacak; ozel secret header ile korunacak.

---

## B) Iki Plan: MVP vs Kamera Opsiyonlu

### Onerim: MVP ile basla, kamera ayri commit olarak ekle

MVP Play Store'a girmek icin yeterli. Kamera opsiyonu bagimsiz bir ek olarak sonra eklenebilir.

---

### PLAN A: MVP (Minimum Risk)

**Izinler:** INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, VIBRATE
**Kamera:** Yok. Dosya yukleme mevcut HTML input ile devam eder.
**Push:** FCM HTTP v1 + Supabase Edge Function + pg_cron.

**Kapsam:**
1. Capacitor paketlerini ve config'i Lovable repo'ya ekle
2. `push_tokens` tablosu olustur (parent destekli)
3. `lesson_reminder_log` dedup tablosu olustur
4. `src/lib/pushNotifications.ts` -- token kayit, dinleme, permission isteme
5. `supabase/functions/send-push/index.ts` -- FCM v1 ile push gonderim
6. `supabase/functions/lesson-reminder-cron/index.ts` -- dakikada 1 cron, 10dk sonraki dersleri bul ve push gonder, **X-CRON-SECRET header ile korunur**
7. Dashboard'lara push permission akisi ekle
8. AndroidManifest minimum izinler

### PLAN B: Kamera Opsiyonlu (MVP + Kamera)

MVP'nin **tamamini** icerir, ek olarak:
1. `@capacitor/camera` paketi eklenir
2. `src/lib/nativeCamera.ts` -- platform tespiti + Capacitor Camera / web fallback
3. `UploadHomeworkDialog.tsx`'e "Kamera ile Cek" butonu eklenir
4. `AddResourceDialog.tsx`'e "Kamera ile Cek" butonu eklenir
5. AndroidManifest'e `CAMERA` izni eklenir (runtime permission)
6. iOS icin `NSCameraUsageDescription` ve `NSPhotoLibraryUsageDescription` gerekir

**Kamera izin detaylari:**
- `CAMERA`: Runtime permission (Android 6+). Play Store'da neden gerektigi aciklanmali.
- `READ_MEDIA_IMAGES` **GEREKMEZ**: Capacitor Camera plugin'i kendi intent'ini kullanir.
- `<uses-feature android:name="android.hardware.camera" android:required="false" />` -- kamerasi olmayan cihazlarda da yuklensin.

---

## C) Detayli Teknik Tasarim

### C.1 -- push_tokens Tablosu

```sql
CREATE TABLE public.push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid,
  role text NOT NULL CHECK (role IN ('teacher', 'student', 'parent')),
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  token text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tokens"
  ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin full access push_tokens"
  ON public.push_tokens FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

**UNIQUE(token) aciklamasi:** Bir cihaz token'i tek bir kayida aittir. Kullanici degisirse (logout/login), upsert ile `user_id`, `student_id`, `role` guncellenir.

**Parent token kayit stratejisi:** Parent birden fazla ogrenciye bagliysa, her student_id icin ayri bir satir olusturulur. Bu durumda UNIQUE(token) yerine **UNIQUE(token, student_id)** kullanilir. Ancak su an parent rolu aktif degil, baslangicta **UNIQUE(token)** yeterli. Parent ozelligi eklendiginde migrate edilir.

### C.2 -- lesson_reminder_log Dedup Tablosu

```sql
CREATE TABLE public.lesson_reminder_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_user_id uuid NOT NULL,
  lesson_key text NOT NULL,
  lesson_date date NOT NULL,
  reminder_type text NOT NULL DEFAULT 'before_10min',
  sent_at timestamptz DEFAULT now(),
  UNIQUE(recipient_user_id, lesson_key, lesson_date, reminder_type)
);

ALTER TABLE public.lesson_reminder_log ENABLE ROW LEVEL SECURITY;
```

**lesson_key formati:**
- Normal ders: `"sl_{student_lesson_id}"`
- Override ile degismis ders: `"ov_{override_id}"`

**Temizlik:** 7 gunden eski kayitlar haftalik cron ile veya lesson-reminder-cron icinde her calistiginda silinir.

### C.3 -- Cron Endpoint Guvenligi (YENI -- v3)

**Yaklasim:** `verify_jwt = false` kalir (pg_net + pg_cron JWT gonderemez), ancak edge function icinde **X-CRON-SECRET** header kontrolu yapilir.

**Adimlar:**

1. Supabase Edge Function Secrets'a yeni bir secret ekle: `CRON_SECRET` (rastgele uzun string, ornegin `openssl rand -hex 32` ile uret).

2. lesson-reminder-cron edge function'in ilk satiri olarak:
```typescript
const cronSecret = Deno.env.get("CRON_SECRET");
const requestSecret = req.headers.get("x-cron-secret");

if (!requestSecret || requestSecret !== cronSecret) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
```

3. pg_cron job SQL'inde ANON_KEY yerine CRON_SECRET header kullanilir:
```sql
SELECT cron.schedule(
  'lesson-reminder-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://hwwpbtcgppzuscbvjkde.supabase.co/functions/v1/lesson-reminder-cron',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

**Alternatif (daha basit):** Secret'i dogrudan SQL string icine gomme (cron job definition'i zaten DB icinde guvenli saklanir, sadece DB admin erisebilir):
```sql
SELECT cron.schedule(
  'lesson-reminder-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://hwwpbtcgppzuscbvjkde.supabase.co/functions/v1/lesson-reminder-cron',
    headers:='{"Content-Type": "application/json", "x-cron-secret": "BURAYA_CRON_SECRET_DEGERI"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

Bu ikinci yaklasim daha pratik cunku `current_setting` Supabase'de ek konfigurason gerektirir. Cron job definition'i `cron.job` tablosunda saklanir ve sadece DB sahibi gorebilir, dolayisiyla secret'in burada olmasi guvenlidir.

**Mevcut cron endpoint'leri icin not:** `cleanup-lesson-overrides` ve `cleanup-trial-lessons` de ayni sekilde korunmali. Bu planin kapsaminda degil ama ilerde ayni pattern uygulanabilir.

### C.4 -- lesson-reminder-cron Edge Function Mantigi

```text
Her dakika calisir (pg_cron + pg_net ile tetiklenir):

0. Guvenlik kontrolu:
   x-cron-secret header'i kontrol et → eslesmezse 401 don

1. Turkiye yerel saatini hesapla:
   const now = new Date();
   const trFormatter = new Intl.DateTimeFormat('en-CA', {
     timeZone: 'Europe/Istanbul',
     year: 'numeric', month: '2-digit', day: '2-digit',
     hour: '2-digit', minute: '2-digit', hour12: false
   });
   // trFormatter ile Turkiye'deki tarih ve saati al

2. 10dk sonrasini hesapla:
   const target = new Date(trNow.getTime() + 10 * 60 * 1000);

3. target'in gun numarasini al:
   const targetDay = target.getDay();  // 0=Pazar (DB ile ayni)

4. target'in saatini HH:MM formatinda al:
   const targetTime = format(target, 'HH:mm');

5. student_lessons tablosundan eslesen dersleri bul:
   SELECT sl.id, sl.student_id, sl.teacher_id, sl.start_time
   FROM student_lessons sl
   WHERE sl.day_of_week = targetDay
   AND sl.start_time = targetTime

6. Her eslesen ders icin lesson_overrides kontrolu:
   - Iptal edilmis mi? → atla
   - Baska saate ertelenmis mi? → atla

7. Override ile BUGUN'e tasanmis dersleri de kontrol et:
   SELECT lo.id, lo.student_id, lo.teacher_id, lo.new_start_time
   FROM lesson_overrides lo
   WHERE lo.new_date = today
   AND lo.new_start_time = targetTime
   AND lo.is_cancelled = false

8. Dedup kontrolu:
   INSERT INTO lesson_reminder_log (recipient_user_id, lesson_key, lesson_date, reminder_type)
   VALUES ($1, $2, $3, 'before_10min')
   ON CONFLICT DO NOTHING
   RETURNING id;
   Satir donerse → push gonder; donmezse → zaten gonderilmis, atla

9. Push gonder:
   - Ogrenciye: "Dersiniz 10 dakika sonra basliyor!"
   - Ogretmene: "{ogrenci_adi} ile dersiniz 10 dakika sonra!"

10. Eski log temizligi:
    DELETE FROM lesson_reminder_log WHERE lesson_date < CURRENT_DATE - INTERVAL '7 days';
```

### C.5 -- Cron Yontemi: pg_cron + pg_net (Tek Yontem)

`pg_cron` extension'i ile dakikada 1 HTTP cagri. Bu proje zaten `cleanup-lesson-overrides` icin ayni yontemi kullaniyor.

Cron job SQL'i Supabase Dashboard > SQL Editor'de calistirilir (migration degil, proje-spesifik degerler icerdigi icin).

### C.6 -- send-push Edge Function (FCM HTTP v1)

```text
POST /send-push
Body: { user_id, title, body, data? }
veya toplu: { recipients: [{ user_id, title, body }] }

Adimlar:
1. FCM_SERVICE_ACCOUNT secret'inden Service Account JSON'u parse et
2. Google OAuth2 JWT olustur (scope: firebase.messaging)
3. push_tokens tablosundan user_id + enabled=true token'lari cek
4. FCM HTTP v1 API'ye gonder:
   URL: https://fcm.googleapis.com/v1/projects/{project_id}/messages:send

Payload:
{
  "message": {
    "token": "<device_token>",
    "notification": {
      "title": "Ders Hatirlatma",
      "body": "Dersiniz 10 dakika sonra basliyor!"
    },
    "android": {
      "priority": "HIGH",
      "notification": {
        "channel_id": "lesson_reminders",
        "default_sound": true,
        "default_vibrate_timings": true
      }
    },
    "data": {
      "type": "lesson_reminder",
      "click_action": "OPEN_APP"
    }
  }
}

5. Token temizleme:
   FCM yaniti 404 veya hata kodu UNREGISTERED → token'i sil
   FCM yaniti INVALID_ARGUMENT → token formatinda sorun, sil
   Diger hatalar → logla, retry yok (sonraki cron denemesinde bakilir)
```

### C.7 -- pushNotifications.ts (Frontend)

```text
initPushNotifications(userId, role):
  1. Platform kontrolu: Capacitor.isNativePlatform() ?
     - Web ise → sessizce cik

  2. Mevcut izin durumunu kontrol et:
     PushNotifications.checkPermissions()
     - 'granted' → dogrudan register
     - 'denied' → toast: "Bildirim izni reddedildi. Ayarlar > Uygulamalar >
       English with Dilara > Bildirimler'den izin verin."
     - 'prompt' → asagidaki UX akisina gec

  3. UX akisi (ilk kez):
     - Kendi dialog'umuzu goster (native dialog oncesi):
       "Ders Bildirimleri"
       "Dersinizden 10 dakika once hatirlatma almak ister misiniz?"
       [Evet, Bildir] [Simdilik Degil]
     - "Evet" → PushNotifications.requestPermissions() → native dialog
     - "Simdilik Degil" → sonraki login'de tekrar sorma (localStorage flag)

  4. Token kayit:
     PushNotifications.register()
     PushNotifications.addListener('registration', (token) => {
       supabase.from('push_tokens')
         .upsert({
           token: token.value,
           user_id: userId,
           role: role,
           platform: Capacitor.getPlatform(),
           enabled: true,
           updated_at: new Date().toISOString()
         }, { onConflict: 'token' })
     })

  5. Bildirim dinleyicileri:
     - pushNotificationReceived (foreground): Toast goster
     - pushNotificationActionPerformed (background tap): Ilgili sayfaya yonlendir

  6. Logout'ta:
     supabase.from('push_tokens')
       .update({ enabled: false })
       .eq('user_id', userId)
```

### C.8 -- Notification Channel Yaklasimi (GUNCELLENDI -- v3)

**Oncelik:** Ilk adimda native MainActivity degisikligi yapilmaz. FCM + Capacitor Push Notifications plugin'inin varsayilan kanal davranisi ile push'un uctan uca calismasini sagla.

**Varsayilan davranis:** Android 8+ cihazlarda, eger bildirimde belirtilen `channel_id` cihazda yoksa:
- FCM SDK otomatik olarak varsayilan bir kanal olusturur
- Bildirimler bu varsayilan kanaldan gosterilir

**Adimlar:**
1. Ilk olarak FCM payload'inda `channel_id` gondermeden test et -- varsayilan FCM kanali kullanilir
2. Push uctan uca calistigini dogrula (token kayit → cron tetikleme → bildirim gosterimi)
3. **Sonra, eger ozel kanal gerekiyorsa** (ozel ses, importance seviyesi vb.), o zaman native degisiklik yap:
   - Hangi activity lifecycle'da (`onCreate`)
   - Hangi dilde (Java veya Kotlin, projenin mevcut yapisina gore)
   - Channel ID: `lesson_reminders`, Name: "Ders ve Odev Bildirimleri", Importance: HIGH
4. Ozel kanal olusturulduktan sonra FCM payload'ina `"channel_id": "lesson_reminders"` ekle

**Neden bu sira?** Dogrudan MainActivity'ye kod eklemek "hangi package path, Java mi Kotlin mi, lifecycle hook hangisi" gibi repo-spesifik detaylarda gereksiz surtusmeler yaratabilir. Oncelik push'un calismasidir; kanal ozellestirmesi ikinci adim olarak yapilir.

### C.9 -- AndroidManifest.xml Minimum Izin Listesi

**MVP:**
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
```

**WAKE_LOCK ve RECEIVE_BOOT_COMPLETED:** FCM SDK bunlari kendi manifest'inde tanimlar, build sirasinda otomatik merge edilir. Manuel eklemeye gerek yok.

**Kamera opsiyonu (Plan B) secilirse ek:**
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

### C.10 -- Play Store Data Safety

| Veri Tipi | Toplaniyor | Paylasilir | Amac |
|-----------|-----------|-----------|------|
| E-posta adresi | Evet | Hayir | Hesap yonetimi |
| Ad | Evet | Hayir | Uygulama islevleri |
| Dosyalar (odev) | Evet | Hayir | Uygulama islevleri |
| Cihaz kimligi (push token) | Evet | Hayir | Push bildirimler |
| Kamera (sadece Plan B) | Evet | Hayir | Dosya yukleme |

**Privacy Policy:** `englishwithdilara.com/privacy` sayfasi olusturulmali. Play Store listesinde zorunlu.

### C.11 -- iOS Paritesi

| Android | iOS Karsiligi |
|---------|---------------|
| `POST_NOTIFICATIONS` (runtime) | `UNUserNotificationCenter.requestAuthorization()` |
| `google-services.json` | `GoogleService-Info.plist` |
| FCM token | APNs + FCM token mapping |
| `CAMERA` (Plan B, runtime) | `NSCameraUsageDescription` in Info.plist |
| -- | `NSPhotoLibraryUsageDescription` (Plan B) |
| Notification Channel | iOS'ta kanal yok, kategori kullanilir (opsiyonel) |

---

## D) Dosya Bazli Gorev Listesi

### D.1 -- MVP Gorevleri (Lovable Repo)

| # | Dosya | Islem | Aciklama |
|---|-------|-------|----------|
| 1 | `package.json` | Duzenle | `@capacitor/core`, `@capacitor/cli` (dev), `@capacitor/android`, `@capacitor/ios`, `@capacitor/push-notifications` ekle |
| 2 | `capacitor.config.ts` | Olustur | appId: `com.englishwithdilara.app`, appName: `English with Dilara`, webDir: `dist` |
| 3 | `src/lib/pushNotifications.ts` | Olustur | Token kayit, permission UX, dinleyiciler, logout cleanup |
| 4 | `src/components/TeacherDashboard.tsx` | Duzenle | Login sonrasi `initPushNotifications(userId, 'teacher')` cagir |
| 5 | `src/components/StudentDashboard.tsx` | Duzenle | Login sonrasi `initPushNotifications(userId, 'student')` cagir |
| 6 | `supabase/functions/send-push/index.ts` | Olustur | FCM HTTP v1 push gonderim, token temizleme, CORS |
| 7 | `supabase/functions/lesson-reminder-cron/index.ts` | Olustur | X-CRON-SECRET korumalari, 10dk once ders hatirlatma, override kontrolu, dedup |
| 8 | `supabase/config.toml` | Duzenle | send-push (verify_jwt=false) ve lesson-reminder-cron (verify_jwt=false) ekle |
| 9 | Supabase Migration | `push_tokens` tablosu + RLS |
| 10 | Supabase Migration | `lesson_reminder_log` tablosu + RLS + UNIQUE constraint |

### D.2 -- Kamera Gorevleri (Opsiyonel Ek, Ayri Commit)

| # | Dosya | Islem | Aciklama |
|---|-------|-------|----------|
| 11 | `package.json` | Duzenle | `@capacitor/camera` ekle |
| 12 | `src/lib/nativeCamera.ts` | Olustur | Platform tespiti + Capacitor Camera wrapper + web fallback |
| 13 | `src/components/UploadHomeworkDialog.tsx` | Duzenle | "Kamera ile Cek" butonu, native'de Camera plugin kullan |
| 14 | `src/components/AddResourceDialog.tsx` | Duzenle | "Kamera ile Cek" butonu, native'de Camera plugin kullan |

### D.3 -- Lokal/Android Studio Gorevleri (Sen)

| # | Dosya | Islem | Aciklama |
|---|-------|-------|----------|
| 15 | `android/app/src/main/AndroidManifest.xml` | Duzenle | POST_NOTIFICATIONS, VIBRATE ekle (Plan B icin CAMERA) |
| 16 | `android/app/build.gradle` | Duzenle | compileSdk 35, targetSdk 35, minSdk 24, versionCode 1, versionName "1.0.0" |
| 17 | `android/build.gradle` | Duzenle | `com.google.gms:google-services` classpath ekle |
| 18 | `android/app/build.gradle` | Duzenle | `apply plugin: 'com.google.gms.google-services'` |
| 19 | `android/app/google-services.json` | Ekle | Firebase'den indir |
| 20 | Notification Channel | Beklet | Push uctan uca calistiktan sonra, gerekirse MainActivity'ye ekle (C.8'deki adimlar) |
| 21 | Keystore | Olustur | `keytool -genkey -v -keystore englishwithdilara.keystore ...` |

---

## E) Senin Yapacagin Console Isleri

### Firebase Console:
1. https://console.firebase.google.com -- proje olustur
2. Android uygulamasi ekle: package `com.englishwithdilara.app`
3. `google-services.json` indir, `android/app/` altina koy
4. Project Settings > Service Accounts > "Generate new private key" -- JSON indir
5. Bu JSON icerigini Supabase Edge Function secret olarak ekle: `FCM_SERVICE_ACCOUNT`
6. Cloud Messaging API'nin aktif oldugunu dogrula

### Supabase Dashboard:
1. `FCM_SERVICE_ACCOUNT` secret'i ekle
2. **`CRON_SECRET` secret'i ekle** (rastgele uzun string, `openssl rand -hex 32` ile uret)
3. pg_cron ve pg_net extension'larini etkinlestir (Database > Extensions)
4. Cron job SQL'ini SQL Editor'de calistir (**CRON_SECRET ile, ANON_KEY degil**):
```sql
SELECT cron.schedule(
  'lesson-reminder-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://hwwpbtcgppzuscbvjkde.supabase.co/functions/v1/lesson-reminder-cron',
    headers:='{"Content-Type": "application/json", "x-cron-secret": "BURAYA_CRON_SECRET_DEGERI"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### Play Console:
1. Developer hesabi ($25)
2. Uygulama olustur: "English with Dilara"
3. Store listing hazirla
4. Content rating anketi (egitim, 13 yas ustu)
5. Data Safety formu doldur
6. Privacy policy URL'si ekle
7. AAB yukle: `cd android && ./gradlew bundleRelease`

---

## F) Test Plani

### Emulator Testleri

| Test | API Level | Beklenen |
|------|-----------|----------|
| Uygulama acilis | API 24 (Android 7) | Normal acilis, push permission sorulmaz (API < 33) |
| Dosya yukleme | API 30 (Android 11) | Dosya yoneticisi acilir, secim ve yukleme basarili |
| Push permission dialog | API 33 (Android 13) | POST_NOTIFICATIONS runtime dialog gosterilir |
| Push permission | API 32 (Android 12) | Dialog gosterilmez, otomatik izinli |
| Push teslim (foreground) | API 34 | In-app toast + notification tray |
| Push teslim (background) | API 34 | Notification tray'de gorulur |
| Kamera (Plan B) | API 34 | Permission dialog > kamera > foto > yukleme |
| Cron endpoint guvenlik | curl ile | x-cron-secret olmadan 401 donmeli |
| Cron endpoint guvenlik | curl ile | yanlis secret ile 401 donmeli |
| Cron endpoint guvenlik | curl ile | dogru secret ile 200 donmeli |

### Gercek Cihaz Testleri

| Test | Senaryo | Beklenen |
|------|---------|----------|
| Push - force stop | Uygulama force-stop edilmis | FCM high-priority mesajlar **cogu cihazda** teslim edilir, ancak bazi agresif pil yonetimi olan ureticilerde (Xiaomi, Huawei, Samsung) teslim **gecikebilir veya engellenebilir**. Kullaniciya pil optimizasyonunu kapatmasi onerilebilir. |
| Push - pil tasarrufu | Battery optimization acik | FCM high-priority mesajlar genellikle Doze modunu bypass eder, ancak **garanti degildir** -- cihaz ve ROM'a bagli |
| Push - 10dk hatirlatma | Ders 10dk kala | Bildirim gelir. 1dk sapma kabul edilebilir |
| Push - iptal ders | Override ile iptal edilmis | Bildirim gelmemeli |
| Push - ertelenmis ders | Override ile saat degismis | Yeni saate gore bildirim gelmeli |
| Push - dedup | Ayni ders icin 2. dakikada | Tekrar bildirim gitmemeli |
| Dosya yukleme | 10MB PDF | Basariyla yuklenir |
| Login/logout | Cikis yap, baska hesapla gir | Push token user_id guncellenir (upsert) |
| Offline | Internet yok | Uygun hata mesaji |

### Android 15 (API 35) Ozel Testler

| Test | Beklenen |
|------|----------|
| Edge-to-edge display | Icerik status bar/nav bar arkasina gecmemeli |
| Push teslim | Normal calismali |

### Uygulama Sirasi

```text
 1. [Lovable] Capacitor paketleri + capacitor.config.ts ekle
 2. [Lovable] push_tokens tablosu migration
 3. [Lovable] lesson_reminder_log tablosu migration
 4. [Lovable] pushNotifications.ts olustur
 5. [Lovable] Dashboard'lara push init ekle
 6. [Lovable] send-push edge function olustur ve deploy et
 7. [Lovable] lesson-reminder-cron edge function olustur ve deploy et (X-CRON-SECRET korumasıyla)
 8. [Lovable] supabase/config.toml guncelle
 9. [Sen] Firebase projesi kur, google-services.json + service account JSON al
10. [Sen] FCM_SERVICE_ACCOUNT secret'i Supabase'e ekle
11. [Sen] CRON_SECRET secret'i Supabase'e ekle (openssl rand -hex 32)
12. [Sen] pg_cron + pg_net extension aktif et, cron job SQL calistir (x-cron-secret header ile)
13. [Sen] Lokal: git pull, npm install, npx cap sync
14. [Sen] AndroidManifest izinlerini ekle
15. [Sen] build.gradle ayarlarini yap (SDK, signing, google-services plugin)
16. [Sen] npx cap run android -- test
17. [Sen] Push uctan uca calisiyorsa: Notification Channel gerekiyorsa MainActivity'ye ekle
18. [Opsiyonel - Lovable] Kamera paketi ekle (Plan B, adimlari 11-14)
19. [Sen] Keystore olustur, AAB build, Play Store'a yukle
```

