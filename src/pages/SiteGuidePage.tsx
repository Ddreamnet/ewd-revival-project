// ============================================================================
// SİTE REHBERİ — TASARIM VE MİMARİ
// ============================================================================
// Admin panelinden açılan, sitenin nasıl kurulduğunu tek sayfada anlatan
// başvuru sayfası. Landing ile aynı görsel dili kullanır; menüde yer almaz,
// bağlantısı yalnızca Admin Paneli › Site Yönetimi içindedir.
//
// Sayfa kasıtlı olarak elle yazılmıştır: koddan üretilen bir doküman, "neden"
// sorusunu yanıtlamaz. Yapıyı değiştirdiğinizde buradaki karşılığını da
// güncelleyin.

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Footer } from "@/components/landing/Footer";
import { BackSwipeWrapper } from "@/components/BackSwipeWrapper";

// ─── Veri ────────────────────────────────────────────────────────────────

const PALETTE: { group: string; swatches: { name: string; value: string; note: string }[] }[] = [
  {
    group: "Mor — ana kimlik",
    swatches: [
      { name: "purple", value: "#A253BE", note: "Düğmeler, etiketler, vurgular" },
      { name: "purple-base", value: "#7E3D96", note: "Düğme altındaki kalın gölge" },
      { name: "purple-deep", value: "#6D28D9", note: "Koyu bölüm zeminleri" },
      { name: "ink", value: "#2E1065", note: "Başlıklar ve en koyu zemin" },
    ],
  },
  {
    group: "Pembe — ikinci ses",
    swatches: [
      { name: "pink", value: "#EC4899", note: "El yazısı başlıklar, aktif nokta" },
      { name: "pink-base", value: "#BE185D", note: "Pembe düğme gölgesi" },
      { name: "pink-soft", value: "#FBD5E4", note: "SSS bölümünün zemini" },
      { name: "pink-tint", value: "#FFF1F7", note: "Kart zemini" },
    ],
  },
  {
    group: "Sarı — dikkat çekici",
    swatches: [
      { name: "yellow", value: "#FBD34F", note: "Rozet ve öne çıkan kutular" },
      { name: "yellow-base", value: "#D9A21B", note: "Sarı düğme gölgesi" },
      { name: "yellow-ink", value: "#6B4A00", note: "Sarı üstündeki yazı" },
    ],
  },
  {
    group: "Krem — nefes alanı",
    swatches: [
      { name: "cream", value: "#FFF8EF", note: "Varsayılan sayfa zemini" },
      { name: "cream-hi", value: "#FFFDF8", note: "Kart zemini" },
      { name: "lilac-soft", value: "#EFDFF9", note: "Kart kenarlığı" },
    ],
  },
];

const TYPE_SCALE = [
  { cls: "ewd-h2", label: "Bölüm başlığı", sample: "Oyunla öğrenmek", note: "900 ağırlık, sıkı harf aralığı" },
  { cls: "ewd-script", label: "El yazısı vurgu", sample: "çok eğlenceli!", note: "Başlığın yanına, pembe" },
  { cls: "ewd-lead", label: "Giriş paragrafı", sample: "Her derste quiz ve interaktif etkinlik var.", note: "Başlığın altındaki tek paragraf" },
  { cls: "ewd-label", label: "Rozet / etiket", sample: "DERSTEN KARELER", note: "Büyük harf, hap biçimli zemin" },
];

const SECTIONS = [
  { name: "LandingHeader", tone: "#FFF8EF", ink: "#2E1065", note: "Menü, dil seçimi, giriş düğmesi" },
  { name: "HeroSection", tone: "#FFF8EF", ink: "#2E1065", note: "Ana vaat ve deneme dersi çağrısı" },
  { name: "RibbonBand", tone: "#A253BE", ink: "#FFF8EF", note: "Kayan yazı şeridi" },
  { name: "DailyWordsSection", tone: "#F7ECFF", ink: "#2E1065", note: "Günün üç kelimesi, çevrilebilir kartlar" },
  { name: "WhySection", tone: "#6D28D9", ink: "#FFF8EF", note: "Neden biz — koyu blok" },
  { name: "KidsPackages", tone: "#FFF8EF", ink: "#2E1065", note: "Çocuk ders paketleri" },
  { name: "AdultPackages", tone: "#FFFDF8", ink: "#2E1065", note: "Yetişkin ders paketleri" },
  { name: "MomentsSection", tone: "#6D28D9", ink: "#FFF8EF", note: "Dersten kareler — foto/video şeritleri" },
  { name: "TestimonialsSection", tone: "#FFF8EF", ink: "#2E1065", note: "Veli yorumları karuseli" },
  { name: "FAQSection", tone: "#FBD5E4", ink: "#2E1065", note: "Sık sorulan sorular" },
  { name: "BlogSection", tone: "#FFFDF8", ink: "#2E1065", note: "Son blog yazıları" },
  { name: "ValuesSection", tone: "#2E1065", ink: "#FFF8EF", note: "Değerlerimiz — en koyu blok" },
  { name: "ContactSection", tone: "#FFF8EF", ink: "#2E1065", note: "İletişim formu ve WhatsApp" },
  { name: "Footer", tone: "#2E1065", ink: "#FFF8EF", note: "Bağlantılar, uygulama rozetleri" },
];

const ROUTES = [
  { path: "/", what: "Landing sayfası", who: "Herkes — girişli kullanıcı /dashboard'a yönlenir" },
  { path: "/blog, /blog/:slug", what: "Blog listesi ve yazı", who: "Herkes" },
  { path: "/bizimle-calisin", what: "İş başvurusu sayfası", who: "Herkes" },
  { path: "/gizlilik-politikasi", what: "Gizlilik metni", who: "Herkes" },
  { path: "/site-rehberi", what: "Bu sayfa", who: "Menüde yok — bağlantısı admin panelinde" },
  { path: "/login", what: "Giriş formu", who: "Herkes" },
  { path: "/dashboard", what: "Rol neyse o panel", who: "Admin / öğretmen / öğrenci" },
];

const TABLES = [
  {
    group: "Site içeriği",
    rows: [
      ["site_content", "Landing metinlerinin admin tarafından değiştirilmiş hâli (yol → {tr,en,fr,ru,es,de,ar})"],
      ["site_testimonials", "Veli yorumları — sıra ve yayın durumu ile"],
      ["site_moments", "Ders içi fotoğraf ve videolar"],
      ["blog_posts", "Blog yazıları (taslak / yayında)"],
    ],
  },
  {
    group: "Kişiler ve roller",
    rows: [
      ["profiles", "Ad, e-posta, temel profil ve dil şubesi (language: en / fr)"],
      ["user_roles", "admin / teacher / student — yetki buradan okunur"],
      ["students", "Öğrenci–öğretmen eşleşmesi, arşiv durumu, Zoom bağlantısı"],
    ],
  },
  {
    group: "Dersler",
    rows: [
      ["student_lessons", "Haftalık şablon: hangi gün, hangi saat"],
      ["lesson_instances", "Şablondan üretilen tekil ders kayıtları"],
      ["student_lesson_tracking", "Paket döngüsü ve haftalık ders sayısı"],
      ["trial_lessons", "Ücretsiz deneme dersleri"],
      ["teacher_balance, balance_events, payment_history", "Öğretmen hakediş ve ödeme geçmişi"],
    ],
  },
  {
    group: "Öğrenme materyali",
    rows: [
      ["global_topics, global_topic_resources", "Şubedeki bütün öğrencilere açık ortak konular (language)"],
      ["topics, resources", "Öğrenciye özel konular ve kaynaklar"],
      ["student_resource_completion", "Hangi kaynak tamamlandı"],
      ["homework_submissions", "Yüklenen ödevler"],
    ],
  },
  {
    group: "Bildirim ve diğer",
    rows: [
      ["notifications, admin_notifications", "Uygulama içi bildirimler"],
      ["push_tokens", "Mobil bildirim jetonları"],
      ["lesson_reminder_log", "Gönderilmiş ders hatırlatmaları — aynı hatırlatma iki kez gitmesin"],
    ],
  },
];

const BUCKETS = [
  ["site-media", "Herkese açık", "Landing için yüklenen ders fotoğraf ve videoları"],
  ["blog-media", "Herkese açık", "Blog kapak görselleri ve yazı içi medya"],
  ["learning-resources", "Herkese açık", "Konu kaynakları"],
  ["homework-files", "Kapalı", "Ödev dosyaları — yalnızca ilgili öğrenci, öğretmeni ve admin"],
];

const STACK = [
  ["Arayüz", "React 18 + TypeScript, Vite ile derlenir"],
  ["Yönlendirme", "react-router-dom — bütün rotalar src/App.tsx içinde"],
  ["Görünüm", "Tailwind + shadcn/ui; markaya ait her şey src/styles/ewd.css"],
  ["Veri", "Supabase (Postgres + Auth + Storage), erişim RLS ile sınırlanır"],
  ["Mobil", "Capacitor — aynı web kodu Android ve iOS kabuğunda çalışır"],
  ["Diller", "TR / EN / FR — src/lib/translations.ts"],
];

// ─── Parçalar ────────────────────────────────────────────────────────────

function Section({
  id,
  badge,
  title,
  script,
  lead,
  tone,
  /** Koyu zeminli bölümlerde başlık ve rozet açık renge çevrilir. */
  onDark = false,
  children,
}: {
  id: string;
  badge: string;
  title: string;
  script?: string;
  lead: string;
  tone: string;
  onDark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="relative px-5 py-14 sm:px-8 md:py-16" style={{ background: tone }}>
      <div className="mx-auto max-w-[980px]">
        <span
          className="ewd-label rounded-full px-5 py-2.5"
          style={
            onDark
              ? { background: "#FBD34F", color: "#6B4A00" }
              : { background: "#A253BE", color: "#FFFFFF" }
          }
        >
          {badge}
        </span>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="ewd-h2" style={onDark ? { color: "#FFF8EF" } : undefined}>
            {title}
          </h2>
          {script && (
            <span
              className="ewd-script text-[34px] leading-none sm:text-[44px]"
              style={{ color: onDark ? "#FBD34F" : "#EC4899" }}
            >
              {script}
            </span>
          )}
        </div>
        <p className="ewd-lead mt-2 max-w-[680px]" style={onDark ? { color: "#E4D3F5" } : undefined}>
          {lead}
        </p>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[28px] border-[3px] px-5 py-5 sm:px-6"
      style={{ background: "#FFFDF8", borderColor: "#EFDFF9", boxShadow: "var(--ewd-shadow-card)" }}
    >
      {title && <h3 className="mb-3 text-[17px] font-black text-[#2E1065] sm:text-[19px]">{title}</h3>}
      {children}
    </div>
  );
}

/** Yatayda taşan tabloların sayfayı kaydırmaması için kendi kutusunda kayar. */
function Rows({ rows }: { rows: [string, string, string?][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <tbody>
          {rows.map(([a, b, c], i) => (
            <tr key={a + i} className="border-b border-[#F0E1FA] last:border-0">
              <td className="w-[38%] py-2.5 pr-4 align-top font-mono text-[12px] font-bold text-[#6D28D9] sm:text-[13px]">
                {a}
              </td>
              {c !== undefined && (
                <td className="w-[16%] py-2.5 pr-4 align-top text-[13px] font-bold text-[#BE185D]">{c}</td>
              )}
              <td className="py-2.5 align-top text-[13px] font-medium leading-[1.55] text-[#4C3A5E] sm:text-[14px]">
                {b}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sayfa ───────────────────────────────────────────────────────────────

export default function SiteGuidePage() {
  // Arama motorlarına kapalı: bu sayfa ekibin başvuru belgesi, pazarlama
  // yüzeyi değil.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <BackSwipeWrapper>
      <div className="landing-body ewd-light min-h-screen">
        <LandingHeader />

        {/* ------------------------------------------------------------ giriş */}
        <header className="px-5 pb-10 pt-12 sm:px-8" style={{ background: "var(--ewd-cream)" }}>
          <div className="mx-auto max-w-[980px]">
            <span className="ewd-label rounded-full bg-[#FBD34F] px-5 py-2.5 text-[#6B4A00]">
              EKİP İÇİ BAŞVURU BELGESİ
            </span>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="ewd-h2">Site rehberi</h1>
              <span className="ewd-script text-[38px] leading-none text-[#EC4899] sm:text-[52px]">
                tasarım &amp; mimari
              </span>
            </div>
            <p className="ewd-lead mt-2 max-w-[720px]">
              Sitenin neyden kurulduğu, hangi rengin nerede kullanıldığı ve verinin nereden geldiği. Yeni bir
              bölüm eklerken ya da bir şeyi değiştirirken buraya bakın.
            </p>

            <nav className="mt-6 flex flex-wrap gap-2">
              {[
                ["#tasarim", "Tasarım dili"],
                ["#bolumler", "Sayfa haritası"],
                ["#icerik", "İçerik nereden geliyor"],
                ["#mimari", "Mimari"],
                ["#veri", "Veritabanı"],
                ["#isler", "Sık yapılan işler"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-full border-2 border-[#DCC9F2] bg-[#FFFDF8] px-4 py-2 text-[13px] font-bold text-[#2E1065] transition-colors hover:bg-[#F4EDFF]"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main>
          {/* --------------------------------------------------------- tasarım */}
          <Section
            id="tasarim"
            badge="TASARIM DİLİ"
            title="Renk, yazı"
            script="ve düğmeler"
            lead="Marka değerleri tek dosyada tutulur: src/styles/ewd.css. Bileşenlerde doğrudan renk kodu yazmak yerine oradaki değişkenleri kullanın, koyu mod da kendiliğinden çalışsın."
            tone="var(--ewd-cream)"
          >
            <div className="space-y-4">
              {PALETTE.map((group) => (
                <Panel key={group.group} title={group.group}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {group.swatches.map((swatch) => (
                      <div key={swatch.name} className="flex items-center gap-3">
                        <span
                          className="h-11 w-11 shrink-0 rounded-2xl border-2 border-[#EFDFF9]"
                          style={{ background: swatch.value }}
                        />
                        <div className="min-w-0">
                          <p className="font-mono text-[12px] font-bold text-[#2E1065]">--ewd-{swatch.name}</p>
                          <p className="text-[11px] font-semibold text-[#8B7A9E]">{swatch.value}</p>
                          <p className="text-[12px] font-medium text-[#5B4A6E]">{swatch.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              ))}

              <Panel title="Yazı ölçeği">
                <div className="space-y-4">
                  {TYPE_SCALE.map((row) => (
                    <div key={row.cls} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="w-[110px] shrink-0 font-mono text-[12px] font-bold text-[#6D28D9]">
                        .{row.cls}
                      </span>
                      <span className={row.cls === "ewd-label" ? `${row.cls} text-[#A253BE]` : row.cls}>
                        {row.sample}
                      </span>
                      <span className="text-[12px] font-medium text-[#8B7A9E]">{row.note}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Düğmeler">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="ewd-btn ewd-btn--purple">Mor</span>
                  <span className="ewd-btn ewd-btn--pink">Pembe</span>
                  <span className="ewd-btn ewd-btn--yellow">Sarı</span>
                  <span className="ewd-btn ewd-btn--outline">Çerçeveli</span>
                  <span className="ewd-btn ewd-btn--purple ewd-btn--sm">Küçük</span>
                </div>
                <p className="mt-3 text-[13px] font-medium text-[#5B4A6E]">
                  Düğmelerin altındaki kalın gölge markanın imzası: her renk için <code>--ewd-*-base</code>{" "}
                  tonu kullanılır ve basılınca düğme gölgesinin üstüne oturur.
                </p>
              </Panel>

              <Panel title="Biçim ve doku">
                <Rows
                  rows={[
                    ["--ewd-r-card (42px)", "Büyük kartların köşesi"],
                    ["--ewd-r-card-sm (30px)", "Küçük kart ve panel köşesi"],
                    ["--ewd-r-pill (999px)", "Rozet, etiket ve düğmeler"],
                    ["--ewd-shadow-card", "Kartların altındaki yumuşak gölge"],
                    [".ewd-bulge", "Bölümlerin birbirine geçtiği tarak dikişi"],
                    ["/ewd/pat/*.png", "Bölüm zeminlerindeki desen dosyaları"],
                  ]}
                />
              </Panel>
            </div>
          </Section>

          {/* ------------------------------------------------------- bölümler */}
          <Section
            id="bolumler"
            badge="SAYFA HARİTASI"
            title="Landing"
            script="sırayla"
            lead="Bölümler src/pages/LandingPage.tsx içinde bu sırayla dizilir. Zeminler krem → koyu → krem diye dönüşür; iki koyu bölüm yan yana gelmez."
            tone="#F7ECFF"
          >
            <Panel>
              <div className="space-y-1.5">
                {SECTIONS.map((section, i) => (
                  <div key={section.name} className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-right font-mono text-[12px] font-bold text-[#8B7A9E]">
                      {i + 1}
                    </span>
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-[#EFDFF9] text-[10px] font-black"
                      style={{ background: section.tone, color: section.ink }}
                    >
                      Aa
                    </span>
                    <span className="w-[150px] shrink-0 truncate font-mono text-[12px] font-bold text-[#6D28D9] sm:w-[190px] sm:text-[13px]">
                      {section.name}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#4C3A5E]">
                      {section.note}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </Section>

          {/* --------------------------------------------------------- içerik */}
          <Section
            id="icerik"
            badge="İÇERİK AKIŞI"
            title="Metin nereden"
            script="geliyor?"
            lead="Sayfadaki hiçbir metin bileşenin içine yazılmaz. Üç katman var; üstteki alttakini ezer."
            tone="var(--ewd-cream)"
          >
            <div className="space-y-4">
              <Panel>
                <ol className="space-y-4">
                  {[
                    {
                      n: "1",
                      title: "src/lib/translations.ts — varsayılan",
                      body: "Bütün metinlerin TR/EN/FR karşılığı. Veritabanı boşken site bu dosyayla çalışır; yeni bir alan önce burada tanımlanır.",
                    },
                    {
                      n: "2",
                      title: "site_content tablosu — admin değişiklikleri",
                      body: "Admin panelinden bir kutu değiştirildiğinde \"hero.title\" gibi bir yol ile kaydedilir ve varsayılanın üstüne biner. \"Sıfırla\" satırı siler, alan varsayılana döner.",
                    },
                    {
                      n: "3",
                      title: "site_testimonials / site_moments — listeler",
                      body: "Veli yorumları ile ders fotoğraf ve videoları kendi tablolarında durur, sıralanır ve yayından kaldırılabilir. Tablo boşsa varsayılan liste görünür.",
                    },
                  ].map((step) => (
                    <li key={step.n} className="flex gap-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#A253BE] text-[15px] font-black text-white">
                        {step.n}
                      </span>
                      <div>
                        <p className="text-[15px] font-black text-[#2E1065]">{step.title}</p>
                        <p className="mt-0.5 text-[13px] font-medium leading-[1.6] text-[#4C3A5E] sm:text-[14px]">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Panel>

              <Panel title="Birleştirme nerede oluyor">
                <Rows
                  rows={[
                    ["src/hooks/useSiteData.ts", "Üç tabloyu tek seferde çeker"],
                    ["src/lib/siteContent.ts", "Varsayılanın üstüne bindirir, düzenlenebilir alanları çıkarır"],
                    ["src/contexts/LanguageContext.tsx", "Sonucu useLanguage().t olarak bütün sayfaya dağıtır"],
                  ]}
                />
                <p className="mt-3 text-[13px] font-medium text-[#5B4A6E]">
                  İlk kare her zaman varsayılan sözlükle çizilir; veri gelince üstüne biner. Bu yüzden landing
                  açılışta beklemez.
                </p>
              </Panel>
            </div>
          </Section>

          {/* --------------------------------------------------------- mimari */}
          <Section
            id="mimari"
            badge="MİMARİ"
            title="Neyin üstünde"
            script="duruyor?"
            lead="Tek bir React uygulaması hem web sitesini hem panelleri hem de mobil uygulamayı çalıştırır."
            tone="#6D28D9"
            onDark
          >
            <div className="space-y-4">
              <Panel title="Teknoloji">
                <Rows rows={STACK as [string, string][]} />
              </Panel>

              <Panel title="Rotalar">
                <Rows rows={ROUTES.map((r) => [r.path, r.who, r.what] as [string, string, string])} />
              </Panel>

              <Panel title="Roller">
                <Rows
                  rows={[
                    ["admin", "Öğretmen ve öğrenci açar, ders programını kurar, ödemeleri ve site içeriğini yönetir"],
                    ["teacher", "Kendi öğrencilerini, derslerini ve ödevlerini görür"],
                    ["student", "Kendi ders programını, konularını ve ödevlerini görür"],
                  ]}
                />
                <p className="mt-3 text-[13px] font-medium text-[#5B4A6E]">
                  Yetki tarayıcıda değil veritabanında karara bağlanır: her tablo RLS ile korunur ve rol{" "}
                  <code>user_roles</code> tablosundan <code>has_role()</code> ile okunur. Arayüzdeki gizleme
                  yalnızca görsel kolaylıktır.
                </p>
              </Panel>

              <Panel title="Dil şubeleri">
                <Rows
                  rows={[
                    ["İngilizce (en)", "Bugüne kadarki sistemin tamamı — mevcut öğretmen ve öğrenciler burada"],
                    ["Fransızca (fr)", "Paralel ikinci sistem; öğretmen ve öğrenciler ileride eklenecek"],
                  ]}
                />
                <p className="mt-3 text-[13px] font-medium text-[#5B4A6E]">
                  Şube <code>profiles.language</code> alanında durur. Öğretmen oluşturulurken admin seçer,
                  öğrenci öğretmeninden devralır. Admin panelin başlığındaki anahtardan iki şube arasında
                  geçer; öğretmen ve öğrenci yalnızca kendi şubesini görür. Global konular da şubeye göre
                  ayrıdır. Landing sayfası bu ayrımdan bağımsızdır — dışarıya Fransızca henüz duyurulmuyor.
                </p>
              </Panel>

              <Panel title="Dosya depoları">
                <Rows rows={BUCKETS as [string, string, string][]} />
              </Panel>
            </div>
          </Section>

          {/* ----------------------------------------------------------- veri */}
          <Section
            id="veri"
            badge="VERİTABANI"
            title="Tablolar"
            script="ne işe yarıyor"
            lead="Supabase üzerindeki Postgres şeması. İsimler koddaki sorgularla birebir aynıdır."
            tone="var(--ewd-cream)"
          >
            <div className="space-y-4">
              {TABLES.map((group) => (
                <Panel key={group.group} title={group.group}>
                  <Rows rows={group.rows as [string, string][]} />
                </Panel>
              ))}
            </div>
          </Section>

          {/* ---------------------------------------------------------- işler */}
          <Section
            id="isler"
            badge="SIK YAPILAN İŞLER"
            title="Bir şeyi"
            script="değiştirmek"
            lead="En çok ihtiyaç duyulan işlemler ve nereden yapıldıkları."
            tone="#FBD5E4"
          >
            <Panel>
              <div className="space-y-4">
                {[
                  ["Veli yorumu eklemek / gizlemek", "Admin Paneli › Site › Veli yorumları. Sıra oklarla değişir; gizlenen yorum silinmez."],
                  ["Ders fotoğrafı veya videosu eklemek", "Admin Paneli › Site › Dersten kareler. Yüz ve isimler dosyanın içine işlenmiş şekilde kapatılmış olmalı."],
                  ["Bir başlığı veya paragrafı değiştirmek", "Admin Paneli › Site › Site metinleri. Arama kutusuna metnin bir bölümünü yazın; yedi dilin kutusu yan yana gelir."],
                  ["Blog yazısı yayımlamak", "Admin Paneli › Blog."],
                  ["Yeni bir bölüm eklemek", "src/components/landing/ altına bileşen, src/lib/translations.ts içine metinler, LandingPage.tsx içine sırası. Metinler otomatik olarak Site metinleri ekranında görünür."],
                  ["Yeni bir renk kullanmak", "Önce src/styles/ewd.css içine değişken olarak ekleyin; bileşende doğrudan renk kodu yazmayın."],
                ].map(([title, body]) => (
                  <div key={title}>
                    <p className="text-[15px] font-black text-[#2E1065]">{title}</p>
                    <p className="mt-0.5 text-[13px] font-medium leading-[1.6] text-[#4C3A5E] sm:text-[14px]">
                      {body}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/dashboard" className="ewd-btn ewd-btn--purple">
                  Admin paneline dön
                </Link>
                <Link to="/" className="ewd-btn ewd-btn--outline">
                  Siteyi görüntüle
                </Link>
              </div>
            </Panel>
          </Section>
        </main>

        <Footer />
      </div>
    </BackSwipeWrapper>
  );
}
