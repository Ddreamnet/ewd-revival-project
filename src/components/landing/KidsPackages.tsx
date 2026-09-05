import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/lib/translations";

type ItemRow = { key: string; icon: string };

const CLASSIC_ITEMS: ItemRow[] = [
  { key: "lessonsPerWeek", icon: "ic-takvim.svg" },
  { key: "speaking", icon: "ic-konusma.svg" },
  { key: "coreEnglish", icon: "ic-abc.svg" },
  { key: "listening", icon: "ic-kulaklik.svg" },
  { key: "games", icon: "ic-oyun.svg" },
  { key: "duration", icon: "ic-saat.svg" },
  { key: "options", icon: "ic-grup.svg" },
];

const SCHOOL_ITEMS: ItemRow[] = [
  { key: "lessonsPerWeek", icon: "ic-takvim-p.svg" },
  { key: "parallel", icon: "ic-kitap-p.svg" },
  { key: "exams", icon: "ic-kupa.svg" },
  { key: "homework", icon: "ic-kalem.svg" },
  { key: "support", icon: "ic-abc.svg" },
  { key: "duration", icon: "ic-saat-p.svg" },
  { key: "options", icon: "ic-grup-p.svg" },
];

/** Çocuk ders paketleri — iki büyük kart, taşan 3D objeler ve şerit. */
export function KidsPackages() {
  const { language, t } = useLanguage();

  return (
    <section
      id="kids-packages"
      className="scroll-section ewd-section relative overflow-hidden px-5 sm:px-8"
      style={{ background: "var(--ewd-cream)" }}
    >
      <img
        src="/ewd/assets/sparkle-yellow.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-[70px] top-[88px] hidden w-12 opacity-85 lg:block"
      />

      <div className="mx-auto max-w-[1180px]">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_430px] lg:gap-12">
          <h2 className="ewd-h2 whitespace-pre-line">{t.kidsPackages.title[language]}</h2>
          <p
            className="ewd-lead mb-1.5 border-l-[3px] border-dotted pl-5"
            style={{ borderColor: "#D6C0F0" }}
          >
            {t.kidsPackages.description[language]}
          </p>
        </div>

        <div className="grid gap-8 pt-12 lg:grid-cols-2 lg:gap-[34px]">
          <PackageCard
            pack={t.kidsPackages.classicPackage}
            items={CLASSIC_ITEMS}
            bg="#A253BE"
            titleAccent="#EBCBF7"
            medallionInk="#6D28D9"
            rowTitle="#6D28D9"
            dotted="#D6C6F7"
            ribbon="art-ribbon-purple.svg"
            art="art-book-aa.svg"
            artClass="right-3 top-3 w-[124px] lg:w-[152px]"
            sloganInk="#F6E3FD"
            shadow="0 30px 44px -22px rgba(46,16,101,0.45)"
          />
          <PackageCard
            pack={t.kidsPackages.schoolPackage}
            items={SCHOOL_ITEMS}
            bg="#EC4899"
            titleAccent="#FBD0E4"
            medallionInk="#BE185D"
            rowTitle="#DB2777"
            dotted="#FAD3E4"
            ribbon="art-ribbon-pink.svg"
            art="art-backpack.svg"
            artClass="right-3 top-2 w-[126px] lg:w-[156px]"
            sloganInk="#FFE9F2"
            shadow="0 30px 44px -22px rgba(190,24,93,0.45)"
          />
        </div>
      </div>
    </section>
  );
}

type PackageContent =
  | typeof translations.kidsPackages.classicPackage
  | typeof translations.kidsPackages.schoolPackage;

interface PackageCardProps {
  pack: PackageContent;
  items: ItemRow[];
  bg: string;
  titleAccent: string;
  medallionInk: string;
  rowTitle: string;
  dotted: string;
  ribbon: string;
  art: string;
  artClass: string;
  sloganInk: string;
  shadow: string;
}

function PackageCard({
  pack,
  items,
  bg,
  titleAccent,
  medallionInk,
  rowTitle,
  dotted,
  ribbon,
  art,
  artClass,
  sloganInk,
  shadow,
}: PackageCardProps) {
  const { language } = useLanguage();
  // İçerik sözlüğü sabit anahtarlı; satır listesi burada gevşek indekslenir.
  const packItems = pack.items as Record<string, { title: Record<string, string>; sub: Record<string, string> }>;

  return (
    <article
      className="relative rounded-[36px] p-5 pb-5 sm:rounded-[44px] sm:p-6"
      style={{ background: bg, boxShadow: shadow }}
    >
      <img src={`/ewd/assets/${ribbon}`} alt="" aria-hidden="true" className="ewd-bookmark left-[42px]" />
      <img
        src={`/ewd/assets/${art}`}
        alt=""
        aria-hidden="true"
        className={`pointer-events-none absolute ${artClass}`}
        style={{ filter: "drop-shadow(0 12px 18px rgba(20,4,50,0.32))" }}
      />

      <header className="relative flex items-center gap-3.5 pt-3">
        <span
          className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full text-[22px] font-black"
          style={{ background: "var(--ewd-cream)", color: medallionInk }}
        >
          {pack.number[language]}
        </span>
        <h3 className="ewd-h3 text-[#FFF8EF]">
          {pack.titleTop[language]}
          <br />
          <span style={{ color: titleAccent }}>{pack.titleBottom[language]}</span>
        </h3>
      </header>

      {/* `relative` + sağ pay: üstteki 3D obje `absolute right-3 w-[124px]` ile
          duruyor ve dar ekranda sloganın sağ yarısını kapatıyordu
          ("THE PROGRAMME THAT MA▉▉▉H FUN"). Başlık satırı `relative` olduğu için
          kurtuluyordu, bu satır değildi. Masaüstünde kart geniş, pay gerekmiyor. */}
      <div className="relative flex items-center gap-2.5 px-1 pb-4 pt-[18px] pr-[112px] lg:pr-0">
        <img src="/ewd/assets/sparkle-yellow.webp" alt="" aria-hidden="true" className="w-[15px] shrink-0" />
        <span
          className="text-[11px] font-extrabold uppercase leading-tight tracking-[0.1em] sm:text-[12px]"
          style={{ color: sloganInk }}
        >
          {pack.slogan[language]}
        </span>
      </div>

      <div
        className="flex flex-col gap-2.5 rounded-[24px] p-4 sm:rounded-[30px] sm:p-[18px]"
        style={{ background: "var(--ewd-cream)" }}
      >
        {items.map(({ key, icon }) => {
          const item = packItems[key];
          if (!item) return null;
          return (
            <div key={key} className="ewd-feat">
              <img src={`/ewd/assets/ic/${icon}`} alt="" loading="lazy" className="ewd-feat__icon" />
              <div className="ewd-feat__body" style={{ borderColor: dotted }}>
                <div className="ewd-feat__title" style={{ color: rowTitle }}>
                  {item.title[language]}
                </div>
                <div className="ewd-feat__sub">{item.sub[language]}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-4 flex items-center justify-center gap-3 rounded-full px-5 py-3.5"
        style={{ background: "rgba(255,248,239,0.22)" }}
      >
        <img src="/ewd/assets/sparkle-yellow.webp" alt="" aria-hidden="true" className="w-4" />
        <span className="text-center text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#FFF8EF] sm:text-[13px]">
          {pack.footer[language]}
        </span>
        <img src="/ewd/assets/sparkle-yellow.webp" alt="" aria-hidden="true" className="w-4" />
      </div>
    </article>
  );
}
