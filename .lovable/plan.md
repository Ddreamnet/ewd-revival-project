
# Kapasitor Oturumu Kaybı — Kök Neden Analizi ve Çözüm Planı

## Mevcut Durumun Analizi

Kodun incelenmesinde aşağıdaki gerçek sorunlar tespit edildi:

### Sorun A — `onAuthStateChange` listener, `getSession()` sonrasında kurulmuş (Bootstrap Sırası Yanlış)

`useAuth.ts` içinde listener VE `getSession()` aynı `useEffect` içinde var, ancak listener `getSession()` ÖNCE kurulmalıdır. Mevcut kod şu anda önce listener kuruyor gibi görünse de, `getSession()` Capacitor Preferences üzerinden **async** çalıştığı için — native depolama async olduğundan — `INITIAL_SESSION` eventi `getSession()` tamamlanmadan gelip geçebilir ya da tam tersi bir yarış koşulu oluşabilir.

Daha kritik olan: `getSession()` async okuma sırasında (özellikle uyku sonrası açılışlarda) zaman alabilir. Bu süreçte `onAuthStateChange` henüz `INITIAL_SESSION` eventi atmamış olabilir, `loading` state `false`'a düşebilir ve uygulama login sayfasına yönlendirebilir.

### Sorun B — `initializing` Bayrağı Yetersiz

`loading` state şu anda `getSession()` yalnızca session yoksa `false` yapıyor:
```ts
if (!user && !session) {
  setLoading(false);
}
```
Eğer `onAuthStateChange` session'lı ateşlenirse `loading` hiç `false`'a düşmeyebilir (profil fetch tamamlanana kadar). Bu kılçık yok ama tersine: native depolamadan session okuma yavaş gelirse `loading=true` state'i tam çözülmeden ekran `false` görünebilir.

### Sorun C — App Foreground/Background Token Refresh Yönetimi Yok

`App.addListener('appStateChange', ...)` hiçbir yerde yok. Uygulama background'dan geri döndüğünde `autoRefreshToken` mekanizması WebView tarafından durdurulmuş olabilir. Refresh token'ı yenilemek için `startAutoRefresh()` / `stopAutoRefresh()` çağrısı yapılmalıdır.

### Sorun D — `useAuth` Hook Birden Fazla Örnek Yaratıyor

`useAuth` bir hook olduğundan `App.tsx`'deki `DashboardRoutes` component'i her render'da kendi listener örneğini başlatıyor. Context API kullanılmıyor, dolayısıyla singleton session yönetimi garanti değil.

---

## Yapılacak Değişiklikler

### 1. `src/contexts/AuthContext.tsx` — Yeni Merkezi Auth Context

`useAuth` hook'unun içeriği React Context'e taşınacak. Böylece:
- Tüm uygulama tek bir session state paylaşır
- `initializing` state net olarak yönetilir
- App foreground/background listener tek bir yerde kaydedilir
- `onAuthStateChange` her zaman `getSession()`'dan ÖNCE kurulur

```
bootstrap sırası:
1. onAuthStateChange subscribe et
2. getSession() çağır → session varsa state'i güncelle
3. initializing = false
```

### 2. `src/hooks/useAuth.ts` — Sadeleştirilecek

Context'ten okuma yapar hale gelecek, kendi listener kurma mantığı kaldırılacak.

### 3. `src/App.tsx` — `AuthProvider` ile Sarılacak

`DashboardRoutes` içindeki `loading` kontrolü `initializing` flag'ini kullanacak.

### 4. `src/lib/capacitorStorage.ts` — Değişmeyecek

Mevcut `capacitorStorage` adapter doğru implemente edilmiş. `@capacitor/preferences` kullanımı zaten mevcut ve doğru.

### 5. `src/integrations/supabase/client.ts` — Değişmeyecek

Supabase client konfigürasyonu doğru. Tüm importlar zaten bu tek dosyaya bakıyor.

---

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/contexts/AuthContext.tsx` | YENİ: merkezi AuthProvider + useAuthContext hook |
| `src/hooks/useAuth.ts` | Context'ten okur hale getirilecek, listener mantığı kaldırılacak |
| `src/App.tsx` | `AuthProvider` ile wrap edilecek |

---

## Yeni Bootstrap Sırası (AuthContext)

```text
AuthProvider mount
  │
  ├─► onAuthStateChange subscribe (ilk)
  │     • INITIAL_SESSION eventi → session state set, initializing=false
  │     • SIGNED_IN / TOKEN_REFRESHED → session güncelle
  │     • SIGNED_OUT → session = null
  │
  ├─► getSession() (ikinci — fallback güvencesi)
  │     • Eğer onAuthStateChange henüz INITIAL_SESSION atmadıysa,
  │       bu sonuç session'ı set eder ve initializing=false yapar
  │
  └─► App.addListener('appStateChange')
        • isActive=true  → supabase.auth.startAutoRefresh()
        • isActive=false → supabase.auth.stopAutoRefresh()
```

DashboardRoutes:
```text
initializing=true  → Loading spinner (login'e yönlendirme YOK)
initializing=false, session=null → AuthForm göster
initializing=false, session var → Profile yükle, dashboard göster
```

---

## Teknik Detaylar

### AuthContext İçindeki Kritik Kod Akışı

```typescript
// ÖNCE listener kur
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  if (DEV) console.log('[Auth] event:', event, 'user:', session?.user?.id ?? 'none');
  setSession(session);
  setUser(session?.user ?? null);
  setInitializing(false); // Her event'te initialize tamamlanmış sayılır
  
  if (session?.user) {
    fetchProfile(session.user.id);
  } else {
    setProfile(null);
    setLoading(false);
  }
});

// SONRA getSession çağır
const { data: { session } } = await supabase.auth.getSession();
if (DEV) console.log('[Auth] boot getSession ->', session ? `user: ${session.user.id}` : 'no session');

// Eğer onAuthStateChange henüz INITIAL_SESSION atmadıysa, manuel set et
setSession(prev => prev ?? session);
setUser(prev => prev ?? session?.user ?? null);
setInitializing(false);
```

### App State Listener (Capacitor)

```typescript
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;
  
  const handle = CapApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
  
  return () => { handle.then(h => h.remove()); };
}, []);
```

---

## Kabul Testleri (Acceptance Tests)

1. Fresh install → login → uygulamayı kapatıp aç: Kullanıcı login kalır
2. 2+ dakika arka planda → ön plana gel: Hâlâ login
3. Access token süresi dolmuşken aç: Refresh çalışır, login kalır
4. Explicit logout: Tüm cihazlarda çıkış, yeniden açılınca login ekranı

---

## Özet: Etkilenen Dosya Sayısı

3 dosya değiştirilecek:
- `src/contexts/AuthContext.tsx` (yeni — ~120 satır)
- `src/hooks/useAuth.ts` (kısaltılacak — ~30 satır)
- `src/App.tsx` (minimal — AuthProvider wrap, ~5 satır)

`capacitorStorage.ts` ve `client.ts` dokunulmayacak.
