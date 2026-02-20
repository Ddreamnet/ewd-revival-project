

# Oturum Dusme Sorunu — Gercek Kok Neden ve Cozum

## Debug Checklist Sonuclari

| Kontrol | Sonuc |
|---|---|
| Tek Supabase client | TAMAM — tek `createClient` (`src/integrations/supabase/client.ts`) |
| Storage adapter native mi | TAMAM — `capacitorStorage` (Preferences) aktif, config dogru |
| INITIAL_SESSION race condition | TAMAM — onceki fix uygulanmis, `getSession()` authoritative |
| Kazara signOut/clear var mi | TAMAM — sadece kullanici logout'unda cagiriliyor |
| AppState auto refresh | TAMAM — `startAutoRefresh`/`stopAutoRefresh` dogru |

**Tum auth altyapisi dogru calisiyor. Session persist ediliyor. Bug auth'da degil.**

## Gercek Sorun: Routing

```text
Route "/"        -->  LandingPage (public pazarlama sayfasi)
Route "/login"   -->  AuthForm
Route "/dashboard" --> DashboardRoutes (session kontrol + role-based dashboard)
```

Android uygulamasi her acilista `/` adresini yukler. Bu adres `LandingPage` gosteriyor — login/session kontrolu yapmiyor. Kullanici oturum acik olsa bile landing page'i goruyor ve "cikis yapilmis" saniyor.

**Sorun: Session kaybolmuyor, sadece kullaniciya dashboard gosterilmiyor.**

## Cozum

### Degisiklik 1: `LandingPage.tsx` — otomatik redirect

LandingPage component'ine session kontrolu eklenir. Eger kullanici login durumundaysa otomatik olarak `/dashboard`'a yonlendirilir:

```typescript
const { user, initializing } = useAuthContext();
const navigate = useNavigate();

useEffect(() => {
  if (!initializing && user) {
    navigate('/dashboard', { replace: true });
  }
}, [initializing, user, navigate]);
```

Bu sayede:
- Native app acilista `/` yukler -> session varsa aninda `/dashboard`'a gider
- Session yoksa landing page normal gosterilir
- Web'de de ayni davranis (login olan kullanici landing page'de takilmaz)

### Degisiklik 2: Splash/loading gosterimi

`initializing` true iken landing page icerigi yerine kisa bir loading spinner gosterilir (native'de splash screen zaten bunu kapatiyor, ama web'de de tutarli olur).

## Degistirilecek Dosyalar

| Dosya | Islem |
|---|---|
| `src/pages/LandingPage.tsx` | Session kontrolu + auto redirect to /dashboard |

## Neden Auth'da Degil

- `getSession()` dogru calisiyor (Preferences'tan token okunuyor)
- `onAuthStateChange` event'leri dogru isleniyor
- `DashboardRoutes` component'i zaten session varsa dashboard gosteriyor
- Ama kullanici `/dashboard`'a hic ulasmiyor cunku app `/` aciliyor ve orada session kontrolu yok

## Test Senaryolari

Duzeltme sonrasi:
- Login -> swipe away -> tekrar ac -> OTOMATIK dashboard (landing page degil)
- Logout -> tekrar ac -> landing page gosterilir
- Web'de login olan kullanici `/` adresine giderse -> otomatik `/dashboard`

