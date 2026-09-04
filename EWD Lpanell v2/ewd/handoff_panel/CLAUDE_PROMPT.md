# Claude Code görev metni — Öğretmen Paneli (web + iOS/Android)

> Bu dosyayı Claude Code'a olduğu gibi verin. `handoff_panel/` klasörünün tamamı repo'ya kopyalanmış olmalı.

---

## Rol ve bağlam

Sen `ewd-revival-project` (React + Vite, Capacitor ile iOS/Android'e paketleniyor) üzerinde çalışan bir kıdemli frontend mühendisisin. Ürün: **English with Dilara** — çocuklara ve yetişkinlere online İngilizce dersi veren bir eğitim platformu. Kullanıcılar: dersi yürüten öğretmen (bu görevin konusu), öğrenci ve veli.

Görev: **öğretmen panelini** yeni onaylanmış tasarıma göre yeniden yazmak. Tasarım hem masaüstü web hem de mobil uygulama için hazır.

## Girdiler (bunları okumadan koda başlama)

1. `handoff_panel/README.md` — tam spesifikasyon: token'lar, bölüm bölüm ölçüler, mobil kurallar, veri ihtiyacı, korunması gereken kullanılabilirlik kararları.
2. `handoff_panel/design/EWD Öğretmen Paneli.dc.html` — masaüstü tasarım. Tarayıcıda aç, gör.
3. `handoff_panel/design/EWD Panel Mobil.dc.html` — mobil tasarım, 4 ekran, telefon çerçeveleri içinde.
4. `handoff_panel/reference/landing-handoff-README.md` — landing v2 ile paylaşılan görsel dil sözlüğü. **Panelin dili landing ile aynı olmalı**; renk/tipografi/gölge/dekor kararlarında bu dosya referans.
5. `handoff_panel/reference/EWD Panel Varyasyonları.dc.html` — 1a ve 1b. **Yalnızca 1a uygulanacak**; 1b reddedildi, sadece bağlam için duruyor.

Tasarım dosyaları prototiptir: stiller inline, `{{ … }}` runtime değeri, `support.js` / `ios-frame.jsx` / `android-frame.jsx` sadece önizleme altyapısı. **Bunları production'a kopyalama.** Değerleri (hex, px, radius, gölge, metin) birebir al, repo'nun kendi bileşen ve stil yaklaşımına çevir.

## Önce keşif, sonra plan, sonra kod

1. Repo'daki mevcut öğretmen paneli kodunu oku: `src/components/TeacherDashboard.tsx`, `LessonTracker.tsx`, `StudentTopics.tsx`, `Header.tsx`, `src/styles/ewd.css`. Hangi veri modelleri, hangi API çağrıları, hangi routing var — çıkar.
2. **Kısa bir plan yaz** (dosya dosya ne değişecek, hangi bileşenler yeni, hangileri silinecek) ve onay için sun. Plan onaylanmadan büyük yazıma geçme.
3. Sonra uygula: küçük, çalışan adımlar; her adımda derlenebilir durum.

## Kapsam

- Öğretmen paneli: **Bugün / Öğrencilerim**, **Öğrenci detayı (konular + ders rayı)**, **Ödevler**, **Bakiye**.
- Masaüstü (1440px tasarım, akışkan olacak) + mobil (Capacitor).
- Kapsam dışı: landing (ayrı pakette teslim edildi), öğrenci paneli, admin paneli. Bunlara dokunma.

## Kesin kurallar

**Tasarım sadakati**
- Renk, ölçü, radius, gölge, yazı ağırlığı ve metinler tasarımdan birebir. Kendi rengini/fontunu ekleme.
- Tasarımda **bilinçli olarak kaldırılmış** öğeleri geri getirme: "Dersi işle" butonu, "Bekleyen ödev" sayacı, "için konular" alt başlığı, "2 / 76 konu tamamlandı", "Takvimi düzenle", "PAKET 1 · 12 DERS" satırı, konu filtre çipleri, "Notu düzenle". Bunlar ya gereksizdi ya da admin panelinin işi.
- "Hakkında" notu öğretmen panelinde **salt okunur**.

**Tek kod tabanı, iki platform**
- iOS ve Android için ayrı ekran/bileşen yazma. Aynı bileşenler; farklar yalnızca:
  - `env(safe-area-inset-top/bottom)` (iOS home indicator ~34px, Android gesture bar ~24px) ve `<meta name="viewport" content="... viewport-fit=cover">`,
  - `Capacitor.getPlatform()` ile tek bir `platform` bayrağı (yalnızca gerçekten davranış değiştiren yerlerde),
  - Android'de `@capacitor/app` `backButton` dinleyicisi — ekrandaki `‹` butonuyla **aynı** route'a gider.
- Tüm dokunma hedefleri **≥ 48px**. FAB kullanma; birincil eylem her iki platformda tam genişlikte buton.

**Performans — bu görevin birinci sınıf gereksinimi**

Panel her gün, ders başında, zayıf bağlantıda açılıyor. Hedefler ölçülebilir olmalı:

- **Uygulama açılışı (iOS/Android): daha önce giriş yapmış kullanıcı splash'tan sonra doğrudan panelde olmalı — login ekranı görünmemeli, spinner'da beklememeli.**
  - Oturum token'ı `@capacitor/preferences` (native, senkron okunur) içinde tutulsun; uygulama açılışında ilk iş token'ı okuyup route'u belirlemek olsun — ağ isteğinin dönmesini bekleyerek karar verme.
  - Panelin son durumunu (öğrenci listesi, sıradaki ders, konu listesi) yerel önbellekten **anında** çiz, arkada tazele (stale-while-revalidate). Kullanıcı hiçbir zaman boş ekrana bakmasın.
  - Token doğrulaması arkada çalışsın; geçersizse o zaman login'e yönlendir.
  - Splash ekranı elle kapatılsın (`@capacitor/splash-screen`, `autoHide: false` + ilk ekran boyandığında `hide()`), böylece beyaz flaş olmasın.
- **Sayfa geçişleri (web ve mobil) anında ve akıcı olmalı.** Nav pill'lerine / alt sekmelere basınca beklenen davranış: içerik anında yer değiştirir, yeniden yükleme hissi olmaz.
  - Route'lar `React.lazy` + `Suspense` ile bölünsün, ama sekmeler **prefetch** edilsin (hover / mount sonrası idle'da) — böylece geçişte indirme beklemesi olmaz.
  - Sekme durumu korunsun (scroll pozisyonu, açık öğrenci) — geri dönünce liste baştan yüklenmesin.
  - Geçiş animasyonu varsa yalnızca `transform` ve `opacity` üzerinden, 150–200ms; `width/height/top/left` animasyonu yasak. `prefers-reduced-motion` desteklensin.
- **Genel bütçe:** ilk anlamlı boyama < 1.5s (3G/orta cihaz), sekme geçişi < 100ms, listede kaydırma 60fps.
  - Ağ: aynı veriyi iki kez isteyen çağrı olmasın; öğrenci listesi + sıradaki ders tek istekte gelsin (mümkünse). İstekler paralel, seri değil.
  - Render: uzun konu listesi (76 kayıt) için sanallaştırma veya sayfalama — tasarımdaki "Kalan 69 konuyu göster" bunun için var; hepsini birden DOM'a basma.
  - Gereksiz yeniden render yok: liste satırları `memo`, event handler'lar kararlı referans.
  - Görseller: ikonlar `webp/png` olarak boyutunda servis edilsin, `loading="lazy"` (görünür alandaki hariç), sabit `width/height` ile layout shift sıfır.
  - "42 dk sonra" sayacı gibi canlı değerler için tüm sayfayı değil sadece o düğümü güncelle (saniye değil dakika bazında tick).
  - Ağır bağımlılık eklemeden çöz; yeni paket eklemen gerekirse önce gerekçesini yaz.

**Kalite**
- Erişilebilirlik: buton olan her şey gerçek `<button>`; ikon butonlarında `aria-label`; klavye ile gezilebilir; odak halkası görünür.
- Semantik HTML; tasarımdaki `<span>` yığınları gerçek `button`/`a`/`ul` yapısına çevrilsin.
- Hata ve boş durumlar: öğrencisi olmayan öğretmen, ders olmayan gün, ödev kutusu boş — tasarım diline uygun kısa boş durum metinleri yaz.
- Mevcut testler geçmeye devam etsin; yeni kritik akışlar (oturum açılışı, sekme geçişi) için test ekle.

## Teslim

1. Değişen dosyaların kısa listesi ve her birinin ne yaptığı.
2. Nasıl doğruladığın: build çıktısı, ölçtüğün açılış süresi ve sekme geçiş süresi, hangi cihaz/emülatörde denediğin.
3. Bilinçli verdiğin ödünler ve önerdiğin sonraki adımlar.
4. Tasarımda belirsiz bulduğun bir yer varsa **uydurma** — sor.
