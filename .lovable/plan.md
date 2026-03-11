

## Implementation Plan — Final (3 Düzeltme Uygulanmış)

### Capacitor Sürüm Eşleşmesi
Projedeki `@capacitor/core: ^8.0.2`. Tüm Capacitor plugin'leri 8.x — `@capacitor/splash-screen` sürümü `^8.0.0` olacak (8.x major ile eşleşir).

---

### KONU 1: Credential Prefill (İki Katman)

**Dosya: `src/lib/capacitorStorage.ts`** — Dosyanın sonuna ekle:
```typescript
const CRED_EMAIL_KEY = 'app-cred-email';
const CRED_PASSWORD_KEY = 'app-cred-password';

export async function saveCredentials(email: string, password: string): Promise<void> {
  if (isNative) {
    await Preferences.set({ key: CRED_EMAIL_KEY, value: email });
    await Preferences.set({ key: CRED_PASSWORD_KEY, value: password });
  } else {
    localStorage.setItem(CRED_EMAIL_KEY, email);
    localStorage.setItem(CRED_PASSWORD_KEY, password);
  }
}

export async function loadCredentials(): Promise<{ email: string; password: string }> {
  if (isNative) {
    const { value: email } = await Preferences.get({ key: CRED_EMAIL_KEY });
    const { value: password } = await Preferences.get({ key: CRED_PASSWORD_KEY });
    return { email: email || '', password: password || '' };
  } else {
    return {
      email: localStorage.getItem(CRED_EMAIL_KEY) || '',
      password: localStorage.getItem(CRED_PASSWORD_KEY) || '',
    };
  }
}
```

`clearSupabaseStorage()` sadece `sb-` key'lerini siliyor — `app-cred-*` key'lerine dokunmuyor. Değişiklik gerekmez.

**Dosya: `src/contexts/AuthContext.tsx`** — `signIn` fonksiyonunda başarılı login sonrası credential kaydet:
```typescript
import { saveCredentials } from "@/lib/capacitorStorage";
// signIn içinde, error yoksa:
await saveCredentials(email, password);
```

**Dosya: `src/components/AuthForm.tsx`** — İki değişiklik:

1. Mount'ta `loadCredentials()` ile state başlat:
```typescript
import { useEffect } from "react";
import { loadCredentials } from "@/lib/capacitorStorage";

// Component içinde, signInData state'inden sonra:
useEffect(() => {
  loadCredentials().then(({ email, password }) => {
    if (email || password) {
      setSignInData({ email, password });
    }
  });
}, []);
```

2. Login input'larına `name` ve `autoComplete` ekle:
- Email input: `name="email" autoComplete="username"`
- Password input: `name="password" autoComplete="current-password"`
- Signup name: `name="fullName" autoComplete="name"`
- Signup email: `name="email" autoComplete="email"`
- Signup password: `name="password" autoComplete="new-password"`

---

### KONU 2: Açılış Hızı Optimizasyonu

**Dosya: `src/contexts/AuthContext.tsx`**

a) Paralel fetch (satır 62-82 arası):
```typescript
const [profileResult, rolesResult] = await Promise.all([
  supabase.from("profiles").select("*").eq("user_id", userId).single(),
  supabase.from("user_roles").select("role").eq("user_id", userId),
]);
// Sonra profileResult ve rolesResult'ı mevcut mantıkla işle
```

b) Timeout 5000 → 3000 (satır 178)

**Dosya: `src/App.tsx`**

a) Dashboard lazy import (satır 10-12 yerine):
```typescript
const TeacherDashboard = lazy(() => import("./components/TeacherDashboard").then(m => ({ default: m.TeacherDashboard })));
const StudentDashboard = lazy(() => import("./components/StudentDashboard").then(m => ({ default: m.StudentDashboard })));
const AdminDashboard = lazy(() => import("./components/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
```

b) SplashHider component (AuthProvider children'ı olarak):
```typescript
function SplashHider() {
  const { initializing } = useAuthContext();
  useEffect(() => {
    if (!initializing && Capacitor.isNativePlatform()) {
      import('@capacitor/splash-screen').then(({ SplashScreen }) => {
        SplashScreen.hide({ fadeOutDuration: 200 });
      });
    }
  }, [initializing]);
  return null;
}
```

**Dosya: `src/hooks/useBlogPosts.ts`** — Hedefli staleTime (blog sorguları sık değişmez):

`usePublishedPosts`, `usePublishedPostsPaginated`, `useBlogPostBySlug` hook'larına `staleTime: 1000 * 60 * 5` ekle. Global QueryClient'a dokunulmaz.

---

### KONU 3: iOS Splash

**Storyboard/asset bağlantıları doğru görünüyor** — `LaunchScreen.storyboard` → `Splash` image referansı var, `Info.plist` → `UILaunchStoryboardName: LaunchScreen` bağlı, 3 scale asset mevcut. Ancak kesin çalıştığını doğrulamak için build + test gerekli.

**Plugin eksikliği beyaz boşluk için güçlü aday** — `@capacitor/splash-screen` paketi yok. Bu paket olmadan native launch screen kapandıktan sonra WebView yüklenene kadar boşluk oluşur. Kesin neden olduğu build sonrası test ile doğrulanacak.

**Dosya: `package.json`** — dependency ekle:
```json
"@capacitor/splash-screen": "^8.0.0"
```
(Projedeki tüm Capacitor paketleri 8.x major — eşleşiyor.)

**Dosya: `capacitor.config.ts`** — plugins'e ekle:
```typescript
SplashScreen: {
  launchAutoHide: false,
  backgroundColor: "#fdf2f8",
  showSpinner: false,
  splashFullScreen: true,
  splashImmersive: true,
  androidScaleType: "CENTER_CROP",
}
```

`launchAutoHide: false` — splash otomatik kapanmaz. `SplashHider` component'i `initializing === false` olduğunda `hide()` çağırır. Sabit timeout yok — gerçek readiness anına bağlı.

---

### KONU 4: Android Splash + Dark Splash

**Android 12+ davranışı:** Android 12+ kendi splash API'sını kullanır — küçük merkezi ikon + düz renk arka plan modeli. Eski tam ekran splash PNG'ler 12+'da farklı render edilir. `androidScaleType: "CENTER_CROP"` **sadece plugin'in kendi ara splash window'u** için geçerlidir, Android 12+ native launch splash'ı doğrudan kontrol etmez. Plugin eklenmesi geçiş boşluğunu kapatır ama Android 12+ launch splash'ın görünümü asset kompozisyonuna ve adaptive icon spec'ine bağlıdır — test sonrası değerlendirilecek.

**Dark splash (Android):** Generate edilmiş `drawable-night/splash.png` ve `drawable-port-night-*` klasörleri mevcut. Android resource qualifier sistemi `night` mode'da otomatik olarak doğru varyantı seçer.

**Dark splash (iOS):** `Contents.json`'da dark appearance varyantı yok. `capacitor-assets generate` genellikle dark varyantı `Contents.json`'a eklemez. Manuel Xcode müdahalesi gerekecek (aşağıda).

---

### Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/lib/capacitorStorage.ts` | `saveCredentials()` ve `loadCredentials()` ekle |
| `src/components/AuthForm.tsx` | `name` + `autoComplete` + mount'ta `loadCredentials()` |
| `src/contexts/AuthContext.tsx` | signIn'de `saveCredentials`, paralel fetch, timeout 3s |
| `src/App.tsx` | Dashboard lazy import, SplashHider component |
| `src/hooks/useBlogPosts.ts` | Blog sorgularına `staleTime: 5 min` ekle |
| `capacitor.config.ts` | SplashScreen plugin config |
| `package.json` | `@capacitor/splash-screen: ^8.0.0` dependency |

---

### Manuel Yapman Gerekenler

1. **`bun install`** — `@capacitor/splash-screen` paketini yükle
2. **`npx cap sync`** — her iki platforma sync et
3. **iOS PrivacyInfo.xcprivacy:** `@capacitor/preferences` UserDefaults API kullandığı için Apple App Store gönderiminde privacy manifest gerekir. `ios/App/App/PrivacyInfo.xcprivacy` dosyasının varlığını doğrula; yoksa Xcode'da oluştur ve `NSPrivacyAccessedAPIType: NSPrivacyAccessedAPICategoryUserDefaults` + `NSPrivacyAccessedAPITypeReasons: ["CA92.1"]` ekle.
4. **iOS dark splash:** Xcode'da `Assets.xcassets > Splash` image set'ini aç → Attributes Inspector'da "Appearances" → "Any, Dark" seç → dark slot'a splash-dark asset'ini sürükle. (`capacitor-assets generate` bunu otomatik yapmıyor.)
5. **iOS test:** Xcode'da Product → Clean Build Folder, sonra run. Splash'ın görünüp `initializing` false olunca kaybolduğunu doğrula. Hala beyaz boşluk varsa storyboard cache sorunu olabilir — cihazdan app sil + yeniden yükle.
6. **Android test:** `npx cap run android` ile Android 12+ cihazda test et. Splash görünümü hala bozuksa asset kompozisyonu (logo boyutu / boşluk oranı) ayarlanmalı — bu Android 12+ adaptive icon spec'ine bağlı.
7. **Credential test:** Gerçek cihazda login → logout → login ekranına dön → alanların dolu geldiğini doğrula.

