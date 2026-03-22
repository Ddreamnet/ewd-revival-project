

## 1) Back-swipe / soldan sağa geri gelme

### 1. Gerçek root cause
Mevcut gesture sistemi birkaç ayrı sebeple pratikte kilitlenmiş:
- `navDepth` mantığı `window.history.length` üzerinden türetiliyor; SPA + `replace` + auth redirect akışlarında bu güvenilir değil.
- `LandingPage` içinde `/ -> /dashboard` redirect ve aynı sayfada `navigate(..., { replace: true })` kullanımı var; bu yüzden “gerçekten geri gidilebilir mi?” hesabı bozuluyor.
- `useBackSwipe` içindeki `complete` kararı hem `navDepth > 0` koşuluna hem de sert threshold’a bağlı. `navDepth` yanlış 0’da kaldığında kullanıcı en sağa çekse bile hiç geri gitmiyor.
- Hook route bilgisini kendi içinde tahmin etmeye çalışıyor; gesture state ile navigation history state birbirine fazla bağlanmış.

### 2. Neden sorun hâlâ devam ediyor
Önceki fix “double navigate” kısmını iyileştirmiş ama asıl gating mekanizması bozuk kalmış. Yani artık yanlış route’a atlama azalmış olabilir, fakat bu kez gesture çoğu durumda hiç complete olmuyor.

### 3. Önceki fix neden yetersiz kaldı
- `window.history.length` tabanlı depth hesabı React Router için yeterince deterministik değil.
- Disabled route + navDepth + threshold kombinasyonu gereğinden karmaşık hale gelmiş.
- Gesture’ın çalışıp çalışmaması gerçek route state yerine tahmini global sayaçlara bağlanmış.

### 4. Değiştirilecek dosyalar
- `src/hooks/useBackSwipe.ts`
- `src/components/BackSwipeWrapper.tsx`
- `src/App.tsx`
- gerekirse `src/pages/BlogPage.tsx`
- gerekirse `src/pages/PrivacyPolicyPage.tsx`
- gerekirse `src/pages/WorkWithUsPage.tsx`

### 5. Neyi neden değiştireceğim
Daha sade ve güvenli bir mimariye geçeceğim:

1. **History-safe route state yaklaşımı**
   - Global `navDepth` yaklaşımını kaldıracağım.
   - Bunun yerine route transition sırasında `location.key`, `useNavigationType()` ve route bazlı “gesture allowed” mantığını kullanacağım.
   - Swipe yalnızca gerçekten geri dönülebilir public content page’lerde aktif olacak.

2. **Gesture state’i sadeleştirme**
   - `touchstart / move / end / cancel` akışını tek bir state machine gibi yeniden kuracağım:
     - idle
     - tracking
     - settling(cancel)
     - settling(complete)
   - Complete/cancel sonrası reset garantisi olacak.

3. **Threshold ve direction detection refactor**
   - Edge start daha güvenilir ama gereksiz sert olmayacak.
   - Horizontal intent lock daha erken ve daha net yapılacak.
   - Velocity ve distance kararları daha doğal hale getirilecek.

4. **Navigation only at final complete**
   - Route değişimi gesture bitmeden asla olmayacak.
   - `navigate(-1)` tek merkezden, tek guard ile çalışacak.

5. **Visual layer sadeleştirme**
   - Snapshot olmayacak.
   - Sadece current page transform + scrim + hafif shadow kalacak.
   - Transition cleanup deterministik olacak; sonraki swipe’ı bloke eden artık transition state kalmayacak.

### 6. Neden bu çözüm kalıcı
Bu çözüm mevcut patch’leri yamamak yerine gesture’ı history tahmini yapan kırılgan yapıdan çıkarıp, daha sade bir state machine’e indiriyor. Böylece:
- gesture tekrar çalışır
- wrong route riski düşer
- maintainability artar
- snapshot gibi kırılgan yan katmanlara ihtiyaç kalmaz

### 7. iOS + Android test checklist
- Landing → Privacy Policy → soldan sağa swipe = Landing’e tek adım geri
- Landing → Work With Us → soldan sağa swipe = Landing’e tek adım geri
- Landing → Blog → soldan sağa swipe = Landing’e tek adım geri
- Login → Dashboard → Privacy Policy akışında swipe = sadece bir önceki gerçek sayfa
- kısa çekiş = cancel
- hızlı flick = complete
- complete sonrası ikinci swipe hemen çalışmalı
- cancel sonrası swipe kilitlenmemeli
- iOS Safari/WKWebView + Android Chrome/WebView’da aynı davranış
- desktop’ta gesture tetiklenmemeli

---

## 2) Ödev görüntüleme / preview kapatma

### 1. Gerçek root cause
Sorun yalnızca cleanup gecikmesi değil; asıl problem birden fazla katmanın çakışması:
- Preview overlay, `Dialog` dışında `createPortal(document.body)` ile ayrı bir katman olarak render ediliyor.
- Altta Radix `Dialog` hâlâ açık ve kendi overlay/focus-lock/scroll-lock sistemini çalıştırıyor.
- Üstteki preview overlay ise kendi başına scroll-lock uygulamıyor.
- PDF `iframe` tam ekranı kaplıyor; close butonu dışında kalan alanlarda iframe pointer olaylarını yutabiliyor.
- Overlay container `fixed inset-0` olsa da içeriğin düzeni yüzünden üst/alt bölgelerde body scroll etkisi hissediliyor; çünkü preview katmanı scroll’u aktif olarak kilitlemiyor, sadece görsel overlay sağlıyor.

### 2. Neden sorun hâlâ devam ediyor
Önceki çözüm sadece `revokeObjectURL` zamanlamasına odaklanmış. Ama close interaction problemi tek başına cleanup maliyeti değil:
- modal mimarisi iki ayrı overlay sistemi kullanıyor
- preview görünürlük state’i ile gerçek interaction layer aynı şey değil
- arka sayfanın scroll lock’u preview için ayrıca yönetilmiyor
- iframe/image preview üst katmanı dismiss davranışını tam kontrol etmiyor

### 3. Önceki fix neden yetersiz kaldı
- `requestAnimationFrame` ile cleanup ertelemek iyi ama tek başına yeterli değil.
- Ayrı portal overlay yapısı korununca close ve scroll-lock sorunları devam ediyor.
- Preview halen “dialog üstüne bindirilmiş bağımsız fullscreen layer” olarak durduğu için davranış parçalı kalıyor.

### 4. Değiştirilecek dosyalar
- `src/components/HomeworkListDialog.tsx`
- gerekirse `src/components/ui/dialog.tsx` (yalnızca reusable bir fullscreen variant gerekiyorsa)

### 5. Neyi neden değiştireceğim
Bu kısmı daha temiz kuracağım:

1. **Preview’ı bağımsız portal hack’i olmaktan çıkaracağım**
   - Ayrı `createPortal(body)` katmanı yerine controlled, tek kaynaklı bir preview dialog/overlay akışına taşıyacağım.
   - Homework dialog açıkken preview için ikinci ama düzgün controlled fullscreen dialog kullanılacak ya da tek component içinde gerçek modal layer kurulacak.

2. **Open state ve görünürlük state’ini merkezileştirme**
   - Preview state tek obje olacak: tür, url, dosya adı, visible.
   - “close” aksiyonu ilk tıklamada görünürlüğü hemen kapatacak.

3. **Gerçek scroll lock**
   - Preview açıkken body/root scroll kesin kilitlenecek.
   - Üst/alt siyah alanlardan arka ekran scroll edilebilmesi tamamen kapatılacak.

4. **Dismiss logic güvenli hale getirme**
   - Close button tek tıkta çalışacak.
   - Overlay click yalnızca gerçekten backdrop’a tıklanırsa kapanacak.
   - iframe/image alanı close event’i swallow etse bile close butonu her zaman en üstte ve güvenilir olacak.

5. **Cleanup’ı görünürlükten ayırma**
   - UI anında kapanacak.
   - `URL.revokeObjectURL` ve benzeri cleanup sonraya bırakılacak.
   - unmount öncesi ağır iş yapılmayacak.

6. **PDF/image için stabil fullscreen layout**
   - Preview container viewport’u tamamen kaplayacak.
   - Close butonu sabit, yüksek z-index’li ve iframe’den bağımsız olacak.
   - pointer-events zinciri netleştirilecek.

### 6. Neden bu çözüm kalıcı
Bu çözüm, semptomu değil modal mimarisini düzeltiyor. Preview artık “ana dialog üstüne aceleyle eklenmiş ekstra katman” olmayacak. Tek kaynaklı, controlled, scroll-lock’lu, dismiss davranışı net bir yapıya taşınınca:
- tek tıkta kapanma
- scroll lock
- stabil overlay
aynı anda çözülmüş olacak.

### 7. iOS + Android test checklist
- Göz ikonuna bas → image preview aç
- Close’a tek tık → preview anında kaybolmalı
- Büyük image’da da aynı
- PDF preview aç → close’a tek tık → anında kapanmalı
- Preview açıkken arka sayfa scroll edilememeli
- Üst/alt siyah alanlardan scroll yapılamamalı
- Backdrop click doğru çalışmalı
- Close butonu her zaman tıklanabilir kalmalı
- Art arda aç/kapat döngüsünde donma olmamalı
- Teacher dashboard / student dashboard / student topics içinden açılan tüm varyantlarda aynı davranış
- iOS ve Android’de regression olmamalı

---

## Kesin kapatmayı hedeflediğim bug’lar
- **Back-swipe bugı:** gesture’ın hiç complete olmaması, yanlış threshold davranışı, state reset sorunları
- **Homework preview bugı:** close’un birden fazla tık istemesi, preview görünürken arka sayfanın scroll olması, overlay/dismiss akışının güvenilmez olması

