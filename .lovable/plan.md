
# Dashboard "Refresh" Sorunu - Kok Neden Analizi ve Cozum

## Tespit

Sorun gercek bir sayfa yenilemesi (browser refresh) degil. React component'in unmount ve remount olmasi — yani dashboard'un tamamen kaldirilip yeniden yuklenmesi.

### Kok Neden: `DashboardRoutes` ve AuthContext `loading` state'i

`App.tsx` icindeki `DashboardRoutes` componenti:

```text
if (initializing || loading) {
   return <spinner />;     <-- Dashboard unmount olur
}
```

`AuthContext.tsx` icindeki `onAuthStateChange` handler'i:

```text
TOKEN_REFRESHED eventi geldiginde:
  setLoading(true)           <-- loading = true
  fetchProfile(user.id)      <-- profil tekrar yukle
```

Olay akisi:

```text
1. Supabase token refresh olur (her ~60 dk veya realtime baglanti yenilendiginde)
2. onAuthStateChange TOKEN_REFRESHED event'i tetiklenir
3. AuthContext loading = true yapar
4. DashboardRoutes loading=true gorur --> spinner gosterir
5. AdminDashboard / TeacherDashboard / StudentDashboard UNMOUNT olur
6. Profile fetch tamamlanir --> loading = false
7. Dashboard REMOUNT olur --> fetchTeachers/fetchStudents bastan calisir
8. Kullanici icin sayfa "refresh" olmus gibi gorunur
```

Bu durum her token yenilenmesinde tekrarlanir. Realtime subscription'lar (admin-trial-lessons-changes, admin-notifications vb.) token yenilenmesini tetikleyebilir.

## Cozum

`DashboardRoutes`'da `loading` kontrolunu degistir: eger zaten bir `profile` varsa (yani ilk yuklemeden sonra), `loading=true` oldugunda spinner gosterme. Profili sessizce arka planda yenilesin.

### Degisiklik: `src/App.tsx`

Mevcut kod:
```typescript
if (initializing || loading) {
  return <spinner />;
}
```

Yeni kod:
```typescript
// Sadece ilk yuklemede spinner goster.
// Token refresh sirasinda (profile zaten var) spinner gosterme
// boylece dashboard unmount olmaz.
if (initializing) {
  return <spinner />;
}

// Ilk yuklemede henuz profil yoksa bekle
if (loading && !profile) {
  return <spinner />;
}
```

Bu sayede:
- Ilk giris: `initializing=true` --> spinner (dogru)
- Profil henuz yuklenmedi: `loading=true, profile=null` --> spinner (dogru)
- Token refresh: `loading=true, profile={...}` --> spinner YOK, dashboard kalir (dogru!)

Ek olarak, AuthContext'teki `loading` mekanizmasini da iyilestirmek faydali olacaktir: token refresh sirasinda profile zaten varsa `setLoading(true)` cagirmamak.

### Degisiklik: `src/contexts/AuthContext.tsx`

`onAuthStateChange` handler'inda, `TOKEN_REFRESHED` event'inde profile zaten yukluyse `loading` state'ini degistirme:

```typescript
if (newSession?.user && !isSigningOutRef.current) {
  // Sadece profil henuz yoksa loading goster
  // Token refresh'te gereksiz spinner'i onle
  if (!profile) {
    setLoading(true);
  }
  setTimeout(() => {
    if (!isSigningOutRef.current) {
      fetchProfile(newSession.user.id);
    }
  }, 0);
}
```

## Degistirilecek Dosyalar

| Dosya | Degisiklik |
|---|---|
| `src/App.tsx` | `DashboardRoutes`'da loading kontrolunu guncelle — profile varsa spinner gosterme |
| `src/contexts/AuthContext.tsx` | Token refresh sirasinda profile zaten varsa `setLoading(true)` cagirma |

## Neden Simdi Fark Edildi?

Bu sorun aslinda basından beri vardi ama token refresh suresi, realtime subscription yenilenmesi ve kullanicinin aktif kullanim zamanlamasiyla bagli olarak bazen daha sik gorunebilir. Son degisikliklerdeki ek Supabase sorguları (trial lesson date filtering) realtime aktivitesini artirmis olabilir.
