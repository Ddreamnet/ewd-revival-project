import { useId } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Hero ile sonraki bölüm arasındaki çapraz kurdele şeridi. İki eğri yol
 * üzerinde akan büyük harf metin — tasarımdaki "Şerit" bölümü.
 */
export function RibbonBand() {
  const { language, t } = useLanguage();
  const uid = useId().replace(/:/g, "");
  const yellowPath = `ribbon-y-${uid}`;
  const pinkPath = `ribbon-p-${uid}`;

  // Yolu doldurmak için metni tekrarla — kısa dillerde boşluk kalmasın.
  const top = `${t.marquee.top[language]} · `.repeat(3);
  const bottom = `${t.marquee.bottom[language]} · `.repeat(2);

  return (
    <div
      className="relative h-[132px] overflow-hidden sm:h-[180px] lg:h-[236px]"
      style={{ background: "var(--ewd-cream)" }}
      aria-hidden="true"
    >
      {/* `slice`: şerit her genişlikte bandı doldurur, uçları ekranın dışına taşar. */}
      {/* Şerit her zaman soldan sağa akar: yollar bu yönde çizili ve `startOffset`
          sağdan sola bir belgede metni yolun başından geriye taşıyıp kırpıyordu.
          Arapça metnin kendi içindeki sıralaması bundan etkilenmez. */}
      <svg
        viewBox="0 0 1440 236"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
        style={{ direction: "ltr" }}
      >
        <defs>
          <path id={yellowPath} d="M-60 168 C 300 66, 560 62, 770 138 C 990 216, 1200 196, 1500 108" fill="none" />
          <path id={pinkPath} d="M-60 96 C 300 194, 560 200, 770 122 C 990 44, 1200 62, 1500 158" fill="none" />
        </defs>

        <use href={`#${yellowPath}`} stroke="#FBD34F" strokeWidth={44} fill="none" />
        <text fontFamily="Poppins, sans-serif" fontSize={15} fontWeight={900} letterSpacing={2} fill="#6B4A00">
          <textPath href={`#${yellowPath}`} startOffset="6%" dominantBaseline="middle">
            {top}
          </textPath>
        </text>

        <use href={`#${pinkPath}`} stroke="#EC4899" strokeWidth={54} fill="none" />
        <text fontFamily="Poppins, sans-serif" fontSize={19} fontWeight={900} letterSpacing={1.6} fill="#FFF8EF">
          <textPath href={`#${pinkPath}`} startOffset="4%" dominantBaseline="middle">
            {bottom}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
