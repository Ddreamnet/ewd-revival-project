
# 1) Landing page contact form — iOS scroll jump

## Gerçek kök neden
Sorun yalnızca font-size değil. `src/index.css` içindeki `html` kuralı düzeltilmiş olsa da `index.html` satır 2’de hâlâ inline `style="overflow-x:hidden"` var. Bu, iOS WKWebView tarafında `html` scroll container’ını yine bozmaya devam ediyor. Yani önceki CSS düzeltmesi fiilen override edilmiyor, bug bu yüzden sürüyor.

Ek olarak:
- `body` üzerinde çift `overflow-x: hidden` var
- landing yapısında `fixed` header (`LandingHeader`) ve `fixed` bubble (`StickyBubble`) bulunuyor
- `window.scrollTo(0, 0)` route değişiminde global çalışıyor
- keyboard resize `body` modunda (`capacitor.config.ts`) çalışıyor

Bunların kombinasyonunda asıl tetikleyici yine root scroll container’ın iOS tarafından farklı yorumlanması. `select` için de aynı risk var çünkü trigger button focus alıyor; `textarea` ve `input` ile aynı familyadan etkileniyor.

## Neden hâlâ devam ediyor
Önceki düzeltme yalnızca `src/index.css` içindeki `html { overflow-x: hidden; }` satırını kaldırmış. Ama `index.html` içindeki inline style daha güçlü kaldığı için iOS hâlâ `html` üzerinde overflow görüyor.

## Değiştirilecek dosyalar
- `index.html`
- `src/index.css`
- `src/components/landing/ContactSection.tsx`
- gerekirse `src/components/landing/LandingHeader.tsx` (yalnızca iOS-safe küçük stabilite düzeltmesi gerekiyorsa)

## Yapılacak düzeltmeler
1. `index.html` içinden `html` inline `overflow-x:hidden` tamamen kaldırılacak.
2. `src/index.css` içinde root scroll ownership sadeleştirilecek:
   - `html`, `body`, `#root` için yatay overflow yalnızca güvenli katmanda tutulacak
   - `body`’de tekrarlı `overflow-x: hidden` sadeleştirilecek
3. Landing contact form container’ında iOS keyboard ile çakışabilecek gereksiz clipping/overflow kombinasyonları azaltılacak:
   - form kartında sadece gereken seviyede `overflow-hidden` bırakılacak
   - focus alanlarında layout shift yaratabilecek container zinciri sadeleştirilecek
4. `ContactSection` içinde input/textarea/select focus olduğunda custom scroll çalışan bir kod var mı diye baktım; doğrudan yok. Bu yüzden çözüm scroll container seviyesinde yapılacak, workaround event hack’i eklenmeyecek.
5. iPhone + iPad için özellikle `select`, `textarea`, `input[type=tel]` ve `input[type=text]` birlikte hedeflenecek.

## Neden kalıcı çözüm
Bu çözüm semptomu değil, iOS’un yanlış gördüğü scroll root sebebini temizliyor. Inline html overflow kaldırılmadan bu bug kalıcı kapanmaz.

## Test checklist
- iPhone Safari/WKWebView: Contact form içindeki ad alanına tıkla → sayfa üste fırlamamalı
- telefon alanı → aynı
- textarea → aynı
- select trigger → aynı
- iPad portrait/landscape → aynı
- landing page yatay scroll oluşturmamalı
- header ve sticky bubble yerleşimi bozulmamalı

# 2) Geri swipe gesture — snapshot tamamen kaldırılacak

## Gerçek kök neden
İki ayrı problem var:

### A. Yanlış sayfaya gitme
`useBackSwipe.ts` içinde double-navigate koruması eklenmiş görünüyor; ama mevcut gesture hâlâ history güvenli değil çünkü:
- gesture, her touch cihazda yalnızca `window.innerWidth < 1024` ile açılıyor
- route gerçekten geri gidilebilir mi kontrol edilmiyor
- `navigate(-1)` koşulsuz çağrılıyor
- login/landing tarafında `replace: true` redirect’ler var (`LandingPage.tsx`)
- auth akışında `/login -> /dashboard` ve sonra landing/public page geçişlerinde history stack beklenenden farklı olabiliyor

Yani bug sadece “iki kere navigate” değildi; history entry’nin gerçekten ne olduğu da doğrulanmıyor.

### B. Snapshot sisteminin kendisi
Snapshot yaklaşımı:
- `App.tsx` içinde her route değişiminde DOM clone alıyor
- `BackSwipeWrapper` içinde `innerHTML` basıyor
- route değişiminden sonra `window.scrollTo(0, 0)` ile birlikte çalışıyor

Bu yapı:
- ağır sayfalarda clone maliyeti oluşturuyor
- görsel olarak stale/fake layer üretiyor
- gerçek route state’i korumuyor
- “önceki sayfa canlı” hissi vermek yerine fake DOM gösteriyor
- kullanıcı özellikle kaldırılmasını istiyor

## Neden hâlâ devam ediyor
Çünkü snapshot eklendi ama gerçek sorun olan history güvenliği, “geri gidilebilir route var mı”, “gesture hangi sayfalarda aktif olmalı”, “cancel/complete akışı ve cleanup” bunları tam çözmedi. Ayrıca snapshot sahte previous-page verdiği için hissi daha da kötüleştirmiş.

## Değiştirilecek dosyalar
- `src/lib/pageSnapshot.ts` — tamamen kaldırılacak
- `src/App.tsx`
- `src/components/BackSwipeWrapper.tsx`
- `src/hooks/useBackSwipe.ts`
- gerekirse swipe kullanılan page dosyaları:
  - `src/pages/PrivacyPolicyPage.tsx`
  - `src/pages/BlogPage.tsx`
  - `src/pages/WorkWithUsPage.tsx`

## Yapılacak düzeltmeler
1. Snapshot sistemi tamamen sökülecek:
   - `captureSnapshot/getSnapshot/clearSnapshot` import ve kullanımını kaldır
   - `BackSwipeWrapper` içindeki snapshot layer sil
2. `useBackSwipe.ts` refactor:
   - `navigate(-1)` tek sefer garantisi korunacak
   - transitionend + timeout cleanup akışı tek guard ile merkezileştirilecek
   - gesture sırasında route değişimi yalnızca completion sonunda olacak
   - cancel akışı navigation’a hiç dokunmayacak
3. History güvenliği eklenecek:
   - yalnızca gerçekten geri dönülebilir route varsa swipe complete edilecek
   - public page’lerde “fallback to wrong route” riskini azaltmak için history depth / referrer-safe yaklaşımı kullanılacak
   - no-history durumda gesture cancel olacak veya disabled olacak
4. Gesture scope daraltılacak:
   - sadece gerçekten istenen public content page’lerde aktif kalacak
   - auth/dashboard gibi stack’i bozabilecek alanlarda etkisi olmayacak
5. Görsel kalite snapshot olmadan iyileştirilecek:
   - scrim + transform + shadow sadeleştirilecek
   - easing ve threshold daha doğal hale getirilecek
   - içerik katmanında re-render tetiklemeyen doğrudan DOM transform korunacak
6. “yeniden mount hissi” için güvenli yaklaşım:
   - fake page yerine animation timing optimize edilecek
   - gereksiz will-change / transition kalıntıları temizlenecek
   - özellikle completion sonrası ani flash etkisi azaltılacak

## Neden kalıcı çözüm
Bu yaklaşım fake DOM yerine doğru history mantığını düzeltiyor. Gesture stack’i kandırmak yerine history ile uyumlu çalışıyor. Snapshot söküldüğü için performans ve stale-state riskleri de ortadan kalkıyor.

## Test checklist
- login → dashboard → privacy policy → swipe back = yalnızca bir önceki gerçek route
- landing → blog → swipe back = landing
- landing → work with us → swipe back = landing
- kısa swipe = cancel
- hızlı flick = tek geri
- çift navigate olmamalı
- boş/fake snapshot görünmemeli
- iOS/Android’de animasyon stabil olmalı
- dashboard ve auth akışında regression olmamalı

# 3) Ödev preview kapanışı kasıyor

## Gerçek kök neden
`HomeworkListDialog.tsx` içinde preview overlay kapanışı sırasında iki kritik sorun var:

### A. Ağır cleanup click event’in içinde senkron çalışıyor
`closePreview()` içinde:
- aktif object URL’ler hemen `URL.revokeObjectURL(...)` ile iptal ediliyor
- sonra state null’lanıyor

Bu işlem özellikle PDF/iframe preview veya büyük image blob’larda close interaction anında ana thread’i bloklayabiliyor. Kullanıcı “kapat”a basıyor ama önce cleanup oluyor, UI sonra kapanıyor. Bu tam tarif edilen “ilk tıklamada kapanmıyor / 2-3 saniye bekliyor” hissiyle uyumlu.

### B. Close handler `onPointerDown` üzerinde
Overlay ve close button `onPointerDown` ile kapanıyor. Bu:
- iframe/image üstünde pointer event sıralamasıyla çakışabiliyor
- bazı cihazlarda pointerdown anında focus/pointer capture ve portal katmanı yüzünden beklenmeyen davranış üretebiliyor
- React/Radix dialog katmanıyla birlikte ilk etkileşimin swallow edilmesine neden olabiliyor

Özellikle portal + iframe + pointerdown kombinasyonu close reliability için kırılgan.

## Neden hâlâ devam ediyor
Şu an kapanış “önce cleanup, sonra UI kapanış state’i” mantığında. Oysa doğru sıralama tam tersi olmalı: önce UI hemen kapansın, ağır cleanup sonra çalışsın.

## Değiştirilecek dosyalar
- `src/components/HomeworkListDialog.tsx`

## Yapılacak düzeltmeler
1. Preview state tek objede merkezileştirilecek:
   - `previewImage` / `previewPdf` ikili state yerine tek preview state
   - race condition azaltılacak
2. Kapanış akışı değişecek:
   - ilk adımda preview state hemen `null`
   - object URL revoke işlemi effect cleanup veya microtask/requestIdleCallback benzeri deferred cleanup ile sonra yapılacak
3. `onPointerDown` yerine daha stabil close handling:
   - close button için `onClick`
   - backdrop close için güvenli target kontrolü korunarak `onClick`
4. Iframe/image unmount blocking azaltılacak:
   - revoke, component unmount sonrasına alınacak
   - kapanış sırasında synchronous blob revoke yapılmayacak
5. Preview açma sırasında da eski URL cleanup düzenlenecek:
   - stale closure riskleri azaltılacak
   - state bazlı cleanup tek yerden yönetilecek

## Neden kalıcı çözüm
Bu çözüm semptomu değil interaction sıralamasını düzeltiyor: kullanıcı aksiyonu önce UI’ı kapatır, pahalı cleanup arkadan gelir. Bu yüzden ilk tıklamada stabil kapanış sağlar ve blob/iframe maliyeti UI thread’i bloke etmez.

## Test checklist
- image preview aç → close butonu tek tıkta kapansın
- backdrop click ile tek tıkta kapansın
- art arda aç/kapat yap → gecikme olmamalı
- büyük görsel dosyada da close anı takılmamalı
- PDF preview web’de tek tıkta kapanmalı
- native platformda PDF share/download akışı bozulmamalı
- object URL leak oluşmamalı
- homework dialog ana akışı bozulmamalı

# Son özet

- Sorun 1: sebep = `index.html` içindeki inline html overflow ve iOS scroll root bozulması / çözüm = root scroll container yapısını gerçekten temizlemek, inline overflow’u kaldırmak, landing form wrapper zincirini sadeleştirmek / durum = kök neden net bulundu, önceki düzeltme bu yüzden yetersiz kalmış
- Sorun 2: sebep = snapshot’ın fake previous-page üretmesi ve history güvenliğini tam çözmemesi / çözüm = snapshot sistemini tamamen söküp history-safe, tek navigate’li, sade swipe mimarisi / durum = snapshot’sız kalıcı refactor gerekli
- Sorun 3: sebep = preview kapanışında senkron blob revoke + pointerdown tabanlı kırılgan close handling / çözüm = önce UI state kapanışı, sonra deferred cleanup; onClick tabanlı stabil close / durum = close lag’ın gerçek nedeni net bulundu
