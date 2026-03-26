

# Implementation Plan: Admin Push Notification Sorunları — Revize v2

## Önceki Plandan Aynen Kalan Kısımlar

### Sorun 2: Complete → Undo → Re-complete Dedupe (Aynen korunuyor)
`notify_admin_last_lesson()` trigger'ındaki 30 günlük `NOT EXISTS` kontrolü undo sonrası temizlenmiyor. `rpc_undo_complete_lesson`'a son 1 günlük `last_lesson_warning` kaydını silen DELETE eklenecek.

### Sorun 3: Bildirime Tıklanınca Öğrenci Ayarları (Aynen korunuyor)
Altyapı zaten mevcut — `admin-notifications-push` deep_link payload'ı ve `AdminDashboard` query param handler'ı çalışır durumda. Sorun push'ın hiç gelmemesi. Token fix'i sonrası çalışacak.

---

## Sorun 1: Admin iOS Push Token Registration — Somut Kök Neden İncelemesi (Güçlendirilmiş)

### A) Kod Path Analizi: Admin vs Teacher AYNI Kod

İnceleme sonucu kesin bulgu: `initPushNotifications` ve `registerAndSaveToken` her iki role için **birebir aynı fonksiyon**. Fark sadece parametre:

- Teacher: `initPushNotifications(profile.user_id, 'teacher')` — TeacherDashboard satır 47
- Admin: `initPushNotifications(profile.user_id, 'admin')` — AdminDashboard satır 69

Aynı `pushNotifications.ts` dosyası, aynı `registerAndSaveToken`, aynı `supabase.upsert()`. Dolayısıyla sorun **kodda değil, çalışma zamanı koşullarında**.

### B) Token Registration Zinciri — Adım Adım Ayrıştırma

```text
Adım 1: AdminDashboard mount
  ↓ profile?.user_id truthy → initPushNotifications çağrılır
Adım 2: Capacitor.isNativePlatform() kontrolü
  ↓ iOS cihazda true → devam
Adım 3: PushNotifications.checkPermissions()
  ↓ İlk kez → 'prompt' döner
Adım 4: localStorage 'push_permission_dismissed' kontrolü
  ↓ İlk giriş → null → devam
Adım 5: PushNotifications.requestPermissions()
  ↓ Kullanıcı "İzin Ver" → 'granted' döner
Adım 6: registerAndSaveToken(userId, 'admin') çağrılır
Adım 7: removeAllListeners() → listener temizleme
Adım 8: addListener('registration', callback) → listener ekleme
Adım 9: PushNotifications.register() → iOS APNs registration başlar
Adım 10: AppDelegate didRegisterForRemoteNotifications → FCM token alınır
Adım 11: Capacitor 'registration' event fires → callback çalışır
Adım 12: callback içinde supabase.upsert() → push_tokens'a yazma
```

### C) Her Adım İçin Diagnostic Log ve Kanıt Toplama Planı

Her adımın fail edip etmediğini kesinleştirmek için şu loglar eklenecek:

```typescript
// Adım 1 kanıtı — initPushNotifications gerçekten çağrıldı mı?
console.log('[PUSH-DIAG] initPushNotifications called, userId:', userId, 'role:', role);

// Adım 2 kanıtı — native platform kontrolü
console.log('[PUSH-DIAG] isNativePlatform:', Capacitor.isNativePlatform(), 'platform:', Capacitor.getPlatform());

// Adım 3 kanıtı — permission state
console.log('[PUSH-DIAG] checkPermissions result:', permStatus.receive);

// Adım 5 kanıtı — permission request sonucu
console.log('[PUSH-DIAG] requestPermissions result:', result.receive);

// Adım 6 kanıtı — registerAndSaveToken'a giriş
console.log('[PUSH-DIAG] registerAndSaveToken entered, userId:', userId, 'role:', role);

// Adım 8 kanıtı — listener eklendi
console.log('[PUSH-DIAG] registration listener added, calling register()...');

// Adım 9 kanıtı — register() sonrası
console.log('[PUSH-DIAG] PushNotifications.register() completed');

// Adım 11 kanıtı — registration event fire etti mi?
// registration callback'in İLK satırı:
console.log('[PUSH-DIAG] >>> registration event FIRED, token:', token.value?.substring(0, 20) + '...');

// Adım 12 kanıtı — Supabase session kontrolü + upsert sonucu
const { data: sessionData } = await supabase.auth.getSession();
console.log('[PUSH-DIAG] current session user_id:', sessionData?.session?.user?.id, 'matches userId param:', sessionData?.session?.user?.id === userId);

const { data: upsertData, error } = await supabase.from('push_tokens').upsert({...}, { onConflict: 'token' }).select();
console.log('[PUSH-DIAG] upsert result - data:', upsertData, 'error:', error);

// Ek: registrationError event
console.log('[PUSH-DIAG] >>> registrationError:', error);
```

### D) Hipotez Daraltma — Somut Senaryolar ve Test Yöntemleri

| # | Hipotez | Nasıl Kanıtlanır | Olasılık |
|---|---------|------------------|----------|
| H1 | `initPushNotifications` admin için hiç çağrılmıyor | `[PUSH-DIAG] initPushNotifications called` logu yok | Düşük — kod açık |
| H2 | Web preview'de çalışıyor, `isNativePlatform()` false dönüyor | `[PUSH-DIAG] isNativePlatform: false` logu | Düşük — izin prompt'u göründü |
| H3 | Permission 'granted' ama `registerAndSaveToken` çağrılmıyor | `registerAndSaveToken entered` logu yok, `requestPermissions` logu var | Düşük |
| H4 | `register()` çağrılıyor ama iOS 'registration' event hiç fire etmiyor | `register() completed` var ama `registration event FIRED` yok | **Orta-Yüksek** |
| H5 | Token alınıyor ama `supabase.auth.getSession()` null dönüyor (session yok) | `current session user_id: undefined` | **Yüksek** |
| H6 | Session var ama upsert RLS tarafından engelleniyor | `upsert result - error: {code: '42501'}` veya data=null, error=null (RLS silent reject) | Orta |
| H7 | Aynı token daha önce teacher user_id ile kaydedilmiş, `onConflict: 'token'` update deniyor ama RLS eski user_id'yi kontrol ediyor | `upsert result - error` veya silent fail | **Yüksek** |
| H8 | `registrationError` event fire ediyor (APNs/FCM hatası) | `registrationError` logu var | Orta |

#### H5 Detaylı Analiz (En Güçlü Hipotez):
iOS'ta ilk kez giriş yapıldığında `AdminDashboard` mount olur → `useEffect` `initPushNotifications` çağırır. Ancak `requestPermissions()` native dialog gösterir — bu dialog süresince React uygulaması bekler. Dialog kapandıktan sonra `registerAndSaveToken` çağrılır ve `register()` ile APNs başlar. APNs token async döner (birkaç saniye sürebilir). Bu sürede eğer `supabase.auth` session'ı henüz tam stabilize olmamışsa veya token refresh gerçekleşmişse, `registration` callback'i içindeki `supabase.upsert()` anonim kullanıcı gibi davranır ve RLS tarafından reddedilir.

**Kanıt testi:** Callback içinde `supabase.auth.getSession()` sonucunu logla. `session` null ise bu hipotez doğrulanır.

#### H7 Detaylı Analiz (İkinci Güçlü Hipotez):
Aynı fiziksel cihaz daha önce teacher hesabıyla kullanıldıysa, APNs/FCM token aynı kalır. `push_tokens` tablosunda bu token teacher'ın `user_id`'si ile kayıtlıdır. Admin girince aynı token ile `upsert(..., { onConflict: 'token' })` çalışır. Bu bir UPDATE'e dönüşür. RLS politikası "Users manage own tokens": `auth.uid() = user_id` — burada `user_id` mevcut satırdaki (teacher'ın) user_id'dir. Admin'in `auth.uid()` ≠ teacher'ın user_id → RLS UPDATE'i **sessizce engeller** (Supabase RLS UPDATE engelinde hata dönmez, `data: null, error: null` döner).

Admin RLS politikası "Admin full access" bunu kurtarmalı ama **Supabase PostgREST, OR mantığında birden fazla policy varsa UPDATE için `USING` ve `WITH CHECK` her ikisinin de geçmesi gerekir**. Admin politikasının `USING` kısmı `has_role(auth.uid(), 'admin')` — bu true. `WITH CHECK` de `has_role(auth.uid(), 'admin')` — bu da true. Bu durumda admin politikası geçerli olmalı.

**Ama:** "Users manage own tokens" politikasının `USING` kısmı `auth.uid() = user_id` (eski satırın user_id'si, yani teacher). Bu false döner. Supabase **permissive** politikalarında OR mantığı kullandığı için en az bir politika geçerse yeterli. Dolayısıyla H7 teorik olarak geçersiz — admin politikası yeterli olmalı. **Yine de** diagnostic log ile kesinleştirilecek.

### E) Teacher Çalışan Path ile Karşılaştırmalı Analiz

| Özellik | Teacher | Admin |
|---------|---------|-------|
| `initPushNotifications` çağrısı | TeacherDashboard useEffect satır 45-48 | AdminDashboard useEffect satır 66-71 |
| Çağrı zamanlaması | `profile` dependency'si ile | `profile?.user_id` dependency'si ile |
| Kod path | Aynı `pushNotifications.ts` | Aynı `pushNotifications.ts` |
| `registerAndSaveToken` | Aynı fonksiyon | Aynı fonksiyon |
| Token kaynağı | Aynı cihaz = aynı FCM token | Aynı cihaz = aynı FCM token |
| RLS erişimi | `auth.uid() = user_id` ✓ | `has_role('admin')` ✓ |

**Kritik fark:** Teacher dependency `[profile]` (tüm profile objesi), Admin dependency `[profile?.user_id]` (sadece user_id). Bu fark önemsiz — her ikisi de profile yüklenince çalışır.

**Asıl fark:** Eğer aynı cihazda önce teacher giriş yapıp token kaydettiyse ve sonra admin giriş yaptıysa, token zaten tabloda teacher user_id ile var. Admin'in upsert'ü aynı token için UPDATE yapmaya çalışır. Eğer bu update sessizce başarısız oluyorsa (RLS veya PostgREST davranışı), teacher'ın token'ı kalır, admin'in token'ı eklenmez.

### F) Kesinleştirme Planı — Uygulama Adımları

**Adım 1: `pushNotifications.ts`'e diagnostic logging ekle**
- Yukarıdaki C bölümündeki tüm log'ları ekle
- Özellikle `registration` callback'inde:
  - Session kontrolü
  - Upsert öncesi ve sonrası detaylı log
  - Token değerinin ilk 20 karakteri
  - Role ve userId değerleri

**Adım 2: Upsert öncesi mevcut token kontrolü ekle**
```typescript
// registration callback'inde, upsert'ten ÖNCE:
const { data: existingToken } = await supabase
  .from('push_tokens')
  .select('user_id, role')
  .eq('token', token.value)
  .maybeSingle();
console.log('[PUSH-DIAG] existing token owner:', existingToken);
```
Bu log, H7 hipotezini kesinleştirir — token başka bir user_id'ye mi ait?

**Adım 3: Eğer H5 doğrulanırsa (session yok)**
→ `registration` callback'inde session kontrolü ekle, session yoksa 2 saniye bekleyip tekrar dene.

**Adım 4: Eğer H7 doğrulanırsa (token başka user'a ait)**
→ Upsert'ten önce `delete().eq('token', token.value)` ile eski kaydı sil, sonra `insert()` yap. Admin RLS politikası delete'e izin verir.

**Adım 5: Eğer H4 doğrulanırsa (registration event fire etmiyor)**
→ iOS AppDelegate'teki FCM bridge kodunu kontrol et. `capacitorDidRegisterForRemoteNotifications` notification'ının Capacitor plugin tarafından dinlenip dinlenmediğini doğrula.

### G) Uygulama

Bu diagnostic log'lar production'da kalacak şekilde tasarlanacak (`[PUSH-DIAG]` prefix ile). iOS cihazda Xcode console'dan veya Safari remote debugger'dan okunabilecek.

Diagnostic sonuçlarına göre:
- H5 doğrulanırsa → session retry mekanizması eklenir
- H7 doğrulanırsa → delete-then-insert stratejisine geçilir
- H4 doğrulanırsa → iOS native kod incelemesi gerekir

---

## Özet: Ne Değişti, Ne Kaldı

### Aynen kaldı:
- Sorun 2 (undo dedupe): `rpc_undo_complete_lesson`'a DELETE ekle
- Sorun 3 (bildirim tap → öğrenci ayarları): Mevcut altyapı yeterli, token fix'i sonrası çalışacak

### Push tokens kısmında eklenen yeni somut adımlar:
1. 12 adımlık registration zinciri ayrıştırması
2. Her adım için spesifik diagnostic log
3. 8 hipotezin daraltılması — en güçlü: H5 (session yok) ve H7 (token başka user'a ait)
4. Mevcut token sahibini sorgulayan pre-upsert kontrol
5. Teacher path ile satır satır karşılaştırma
6. Her hipotez için "doğrulanırsa ne yapılacak" kesin çözüm

### Hipotez listesinden nasıl çıkılacak:
Diagnostic log'lar eklendikten sonra admin iOS'tan giriş yapılacak. Xcode/Safari console'dan:
- `registration event FIRED` varsa → token alınmış (H4 elenmiş)
- `current session user_id` doluysa → session var (H5 elenmiş)
- `existing token owner` teacher gösteriyorsa → H7 kesinleşmiş
- `upsert result - error` doluysa → spesifik hata kodu ile RLS/constraint ayrımı yapılmış

En fazla 1 test-login ile kök neden kesinleşecek.

