

# Revize Plan: Production iOS Push Delivery — 401 Kök Neden Netleştirmesi

## Önceki Plandan Aynen Kalan Kısımlar
- `aps-environment` entitlement düzeltmesi (development → production)
- App resume refetch (AdminNotificationBell) — zaten uygulandı
- admin_notification_webhook trigger — zaten uygulandı
- admin_notifications realtime publication — zaten uygulandı

---

## YENİ ANALİZ: 401 THIRD_PARTY_AUTH_ERROR Tam Ayrımı

### Hata Hangi Aşamada Oluşuyor?

`send-push/index.ts` satır 61'de `getAccessToken()` çağrılıyor. Bu fonksiyon başarısız olursa exception fırlatır ve dış catch bloğu `"send-push error:"` loglar. **Loglarda bu mesaj YOK.**

Loglarda görünen hata formatı:
```
FCM error for token ffR1BGSezU...: { "error": { "code": 401, ... "THIRD_PARTY_AUTH_ERROR" } }
```

Bu mesaj satır 127-128'deki `fcmResponse` kontrol bloğundan geliyor — yani `getAccessToken()` **başarılı olmuş**, OAuth2 access token alınmış, FCM API'ye istek gönderilmiş, ve **FCM send response'unda** 401 dönmüş.

### Sonuç: Service Account Geçerli, APNs Credential Eksik/Hatalı

`THIRD_PARTY_AUTH_ERROR`, Firebase dokümanına göre şu anlama gelir:
> "The APNs certificate or web push auth key was invalid or missing."

Bu, FCM'in Google OAuth2 token'ı kabul ettiği ama **APNs'e mesaj iletmeye çalışırken üçüncü taraf kimlik doğrulamasında başarısız olduğu** anlamına gelir.

**Kök neden service account key DEĞİL.** Service account yenilenmesine gerek yok.

### Gerçek Kök Neden: Firebase Console APNs Yapılandırması

Firebase Console → Project Settings → Cloud Messaging → Apple app configuration bölümünde:
1. APNs Authentication Key (p8 dosyası) yüklenmemiş olabilir
2. Veya yüklenen key'in Team ID / Key ID / Bundle ID eşleşmesi hatalı olabilir
3. Veya sadece development (sandbox) APNs certificate yüklenmiş, production certificate eksik olabilir

### App Store Build Entitlements Doğrulaması

Kaynak koddaki `ios/App/App/App.entitlements` dosyası `development` diyor — ama bu dosya **App Store'a giden signed binary'nin effective entitlements'ını garanti etmez**. Xcode, distribution provisioning profile'dan `aps-environment: production` override edebilir.

Gerçek doğrulama yöntemi:
1. App Store'a gönderilen `.ipa` dosyasını indir
2. `.ipa`'yı `.zip` olarak aç → `Payload/App.app/` içindeki embedded provisioning profile'ı ve entitlements'ı kontrol et
3. `codesign -d --entitlements - Payload/App.app/` komutuyla effective entitlements'ı oku
4. `aps-environment` değerinin `production` olduğunu doğrula

Kaynak dosyayı `production` yapmak yine iyi bir pratik ama **asıl doğrulama signed binary üzerinden yapılmalı**.

---

## Güncellenmiş Aksiyon Planı

### Adım 1 (KRİTİK — Manuel, Kullanıcı): Firebase APNs Credential Düzeltmesi
1. Apple Developer Portal'dan APNs Authentication Key (p8) indir (veya mevcut olanı bul)
   - Certificates, Identifiers & Profiles → Keys → APNs key
2. Firebase Console → Project Settings → Cloud Messaging → Apple app configuration
3. "APNs Authentication Key" bölümüne p8 dosyasını yükle
4. Key ID, Team ID ve Bundle ID (`com.englishwithdilara.app`) doğru girildiğinden emin ol
5. Eğer sadece APNs Certificate kullanılıyorsa: hem development hem production certificate'ın yüklendiğinden emin ol

### Adım 2 (Kod — Diagnostic Log): getAccessToken başarısını logla
`send-push/index.ts`'e `getAccessToken()` sonrası başarı logu ekle — böylece gelecekte OAuth2 vs APNs hatası kesin ayrılabilsin:

```typescript
const accessToken = await getAccessToken(serviceAccount);
console.log(`[SEND-PUSH] OAuth2 access token obtained successfully`);
```

### Adım 3 (Kod): aps-environment → production
`ios/App/App/App.entitlements` dosyasında `development` → `production` değişikliği. Bu, signed build'in effective entitlements'ında doğru değerin olmasını garanti eder.

### Adım 4 (Manuel, Kullanıcı): Signed Build Doğrulaması
Yeni bir App Store archive alındıktan sonra:
```bash
codesign -d --entitlements - Payload/App.app/
```
komutuyla `aps-environment: production` olduğunu doğrula.

---

## Özet Tablo

| Bulgu | Önceki Yorum | Düzeltilmiş Yorum |
|-------|-------------|-------------------|
| 401 kaynağı | getAccessToken() başarısız (service account geçersiz) | FCM send response (APNs credential eksik/hatalı) |
| Çözüm | Service account key yenile | Firebase Console'da APNs auth key yükle/düzelt |
| Entitlements doğrulaması | Kaynak dosyayı değiştir | Kaynak dosyayı değiştir + signed binary'den effective entitlements doğrula |

## Dosyalar
1. `supabase/functions/send-push/index.ts` — diagnostic log ekleme (1 satır)
2. `ios/App/App/App.entitlements` — development → production (1 satır)

