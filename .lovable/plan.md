

# Oturum Dusme Sorunu — Duzeltme Plani

## Tespit Edilen Sorun

Kod mimarisi (tek client, initializing guard, appStateChange) dogru kurulmus. Ancak Supabase JS v2'de bilinen bir sorun var:

**Custom async storage (Capacitor Preferences) kullanildiginda, `onAuthStateChange` listener'i `INITIAL_SESSION` event'ini session henuz async storage'dan okunmadan once `null` ile fire edebilir.** Bu durumda:

1. App aciliyor, `onAuthStateChange` subscribe ediliyor
2. Supabase JS dahili olarak `INITIAL_SESSION` event'ini fire ediyor — AMA Preferences.get() henuz tamamlanmadi, session `null` geliyor
3. `initDoneRef.current = true` set ediliyor, `initializing = false` oluyor
4. `user = null` oldugu icin `AuthForm` (login) gosteriliyor
5. Ardindan `getSession()` gercek session'i donduruyor ama `initDoneRef.current` zaten `true` oldugu icin bu sonuc ignore ediliyor

## Cozum

`onAuthStateChange`'den gelen ilk `INITIAL_SESSION` event'ine HEMEN guvenmek yerine, `getSession()` sonucunu birincil kaynak olarak kullanmak ve race condition'i ortadan kaldirmak.

### Degisiklik: `src/contexts/AuthContext.tsx`

**Mevcut akis:**
```
onAuthStateChange (ilk event) -> initDone = true, initializing = false
getSession() -> initDone zaten true, sonuc ignore edilir
```

**Yeni akis:**
```
onAuthStateChange -> INITIAL_SESSION event'inde initDone'u set ETME, sadece session'i kaydet
getSession() -> HER ZAMAN calis, initDone = true yap, initializing = false yap
onAuthStateChange -> sonraki event'ler (SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT) normal islensin
```

Somut degisiklikler:

1. `onAuthStateChange` callback'inde `event === 'INITIAL_SESSION'` ise `initDoneRef` set edilMEyecek — sadece session state guncellenecek ama `initializing` false yapilmayacak.

2. `getSession()` blogu `initDoneRef` kontrolu olmadan HER ZAMAN calisacak ve `initializing = false` yapacak. Bu, async storage'in tamamen okunmasini bekledikten sonra karari veriyor.

3. Ek guvenlik: `getSession()` promise'ine bir timeout (5 saniye) eklenerek, storage tamamen bozulsa bile uygulamanin sonsuza kadar spinner'da kalmamasi saglanacak.

4. Debug loglari eklenerek native platform'da Preferences'tan okunan token key'inin varligini dogrulama.

## Degistirilecek Dosyalar

| Dosya | Islem |
|---|---|
| `src/contexts/AuthContext.tsx` | INITIAL_SESSION race condition fix + timeout + debug log |

## Teknik Detay

```text
BOOT AKISI (duzeltme sonrasi):

1. AuthProvider mount
2. initializing = true, loading = true
3. onAuthStateChange subscribe
4. INITIAL_SESSION event gelir:
   - event === 'INITIAL_SESSION' -> session/user state guncelle
   - AMA initDoneRef set ETME, initializing = true kalsin
5. getSession() async tamamlanir (Preferences.get bitmis olur):
   - Session varsa -> user/session set et, profile fetch et
   - Session yoksa -> loading = false
   - HER DURUMDA: initDoneRef = true, initializing = false
6. Sonraki auth event'leri (SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT) normal islensin

TIMEOUT KORUMASI:
- getSession() 5 saniye icinde donmezse -> initializing = false, loading = false
- Kullanici login ekranini gorur (session gercekten yokmus gibi)
```

## Test Senaryolari

Duzeltme sonrasi asagidaki senaryolar test edilmeli:
- Login -> swipe away -> tekrar ac: direkt dashboard
- Login -> 2-3 dk bekle -> tekrar ac: direkt dashboard
- Manuel logout -> login ekrani
- Ilk kurulum (hic login yok) -> login ekrani

