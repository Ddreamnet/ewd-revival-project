// EWD büyük görselleri (kart sanatları) —  `node scripts/build-art.mjs public/ewd/assets`
//
// Hero ve paket kartlarındaki 3B objelerin vektör karşılıkları. Eski tasarımdaki
// kesiksiz hâlleri örnek alındı; her şekil viewBox içinde payla durur, bu yüzden
// hiçbir ölçekte kırpılmaz.
import { writeFileSync, mkdirSync } from 'fs';

const P = {
  pink: '#F9599C', pinkLo: '#FB8FC0', pinkHi: '#FFA8CE', pinkDk: '#D63A7C',
  violet: '#A78BFA', violetLo: '#C4B0FC', violetDk: '#7C4DE0', violetDp: '#6B39CE',
  yellow: '#FBCE45', yellowDk: '#E5A81F', yellowLo: '#FDE08A',
  cream: '#FFF6E6', creamDk: '#F0E2C6', ink: '#FFFFFF',
};

const wrap = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">
  <defs>
    <linearGradient id="pk" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${P.pinkHi}"/><stop offset="1" stop-color="${P.pink}"/></linearGradient>
    <linearGradient id="vi" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${P.violetLo}"/><stop offset="1" stop-color="${P.violet}"/></linearGradient>
    <linearGradient id="ye" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${P.yellowLo}"/><stop offset="1" stop-color="${P.yellow}"/></linearGradient>
    <linearGradient id="cr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFDF6"/><stop offset="1" stop-color="${P.creamDk}"/></linearGradient>
  </defs>
${body}
</svg>
`;

/* ── defter/kitap ──────────────────────────────────────────────────────── */
// Kapakta yazı yok; hacim sayfa kenarları, sırt kabartması, ince lastik bant
// ve ayraçtan geliyor.
const book = wrap(152, 176, `  <g transform="rotate(-7 76 88)">
    <rect x="32" y="26" width="92" height="124" rx="14" fill="${P.violetDk}"/>
    <rect x="30" y="24" width="92" height="120" rx="12" fill="url(#cr)"/>
    <g fill="${P.creamDk}" opacity=".85">
      <rect x="113" y="42" width="3" height="86" rx="1.5"/>
      <rect x="118" y="48" width="3" height="74" rx="1.5"/>
    </g>
    <path d="M50 130h18v38l-9-10-9 10z" fill="${P.violet}"/>
    <rect x="22" y="20" width="90" height="122" rx="14" fill="url(#pk)"/>
    <path d="M22 34a14 14 0 0 1 14-14v122a14 14 0 0 1-14-14z" fill="#E84C8E"/>
    <rect x="34" y="20" width="3" height="122" fill="#fff" opacity=".28"/>
    <rect x="29" y="27" width="76" height="108" rx="10" fill="none" stroke="#fff" stroke-width="2.5" opacity=".22"/>
    <rect x="92" y="14" width="8" height="136" fill="${P.yellow}"/>
    <rect x="92" y="14" width="8" height="8" fill="${P.yellowDk}"/>
    <rect x="92" y="142" width="8" height="8" fill="${P.yellowDk}"/>
  </g>`);

/* ── sırt çantası ──────────────────────────────────────────────────────── */
const backpack = wrap(170, 196, `  <g transform="rotate(5 85 100)">
    <path d="M62 62V52a23 23 0 0 1 46 0v10" fill="none" stroke="${P.violetDk}" stroke-width="13" stroke-linecap="round"/>
    <rect x="22" y="80" width="20" height="92" rx="10" fill="${P.violetDk}"/>
    <rect x="128" y="80" width="20" height="92" rx="10" fill="${P.violetDk}"/>
    <rect x="34" y="70" width="102" height="116" rx="30" fill="#A82659"/>
    <rect x="30" y="64" width="110" height="116" rx="30" fill="url(#pk)"/>
    <path d="M30 94a30 30 0 0 1 30-30h50a30 30 0 0 1 30 30v20H30z" fill="${P.pinkHi}"/>
    <path d="M85 70l6.6 13.4L106 85.4l-10.7 10.4L97.8 111 85 103.8 72.2 111l2.5-14.9L64 85.4l14.4-2z" fill="${P.violetDk}"/>
    <rect x="30" y="112" width="110" height="13" rx="6.5" fill="${P.yellow}"/>
    <circle cx="128" cy="118.5" r="9" fill="${P.yellowDk}"/>
    <rect x="48" y="134" width="74" height="40" rx="15" fill="${P.violet}"/>
    <rect x="48" y="134" width="74" height="10" rx="5" fill="${P.yellow}"/>
    <rect x="77" y="139" width="16" height="13" rx="4" fill="${P.yellow}"/>
    <rect x="22" y="140" width="20" height="12" rx="5" fill="${P.yellow}"/>
    <rect x="128" y="140" width="20" height="12" rx="5" fill="${P.yellow}"/>
  </g>`);

/* ── konuşma balonları + mezuniyet kepi ────────────────────────────────── */
const graduation = wrap(230, 194, `  <g fill="${P.yellow}">
    <rect x="20" y="36" width="9" height="22" rx="4.5" transform="rotate(-28 24 47)"/>
    <circle cx="24" cy="122" r="7"/><circle cx="74" cy="170" r="5"/>
  </g>
  <path d="M204 60l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="${P.violet}"/>
  <g>
    <path d="M132 70h62a22 22 0 0 1 22 22v34a22 22 0 0 1-22 22h-22l-16 22-2-22h-22a22 22 0 0 1-22-22V92a22 22 0 0 1 22-22z" fill="${P.yellowDk}"/>
    <path d="M130 66h62a22 22 0 0 1 22 22v34a22 22 0 0 1-22 22h-22l-16 22-2-22h-22a22 22 0 0 1-22-22V88a22 22 0 0 1 22-22z" fill="url(#ye)"/>
    <g fill="${P.ink}"><rect x="138" y="86" width="68" height="11" rx="5.5"/><rect x="138" y="104" width="68" height="11" rx="5.5"/><rect x="138" y="122" width="52" height="11" rx="5.5"/></g>
  </g>
  <g>
    <path d="M46 42h78a26 26 0 0 1 26 26v38a26 26 0 0 1-26 26H78l-22 26 2-26h-12a26 26 0 0 1-26-26V68a26 26 0 0 1 26-26z" fill="${P.violetDk}"/>
    <path d="M44 38h78a26 26 0 0 1 26 26v38a26 26 0 0 1-26 26H76l-22 26 2-26h-12a26 26 0 0 1-26-26V64a26 26 0 0 1 26-26z" fill="url(#vi)"/>
    <g fill="${P.ink}"><circle cx="64" cy="84" r="10"/><circle cx="92" cy="84" r="10"/><circle cx="120" cy="84" r="10"/></g>
  </g>
  <g>
    <path d="M140 54v18c0 9 10 15 24 15s24-6 24-15V54z" fill="${P.violetDp}"/>
    <path d="M118 40l46-22 46 22-46 21z" fill="${P.violetDk}"/>
    <path d="M118 40l46 21v6l-46-21z" fill="${P.violetDp}"/>
    <path d="M206 42v26" stroke="${P.yellowDk}" stroke-width="4" stroke-linecap="round"/>
    <path d="M199 66h14l-3 14a4 4 0 0 1-8 0z" fill="${P.yellow}"/>
    <circle cx="206" cy="66" r="6" fill="${P.yellowDk}"/>
  </g>`);

/* ── kart kurdelesi (yıldızlı sarı şerit) ──────────────────────────────── */
const ribbon = (star) => wrap(104, 118, `  <path d="M20 8h64a6 6 0 0 1 6 6v84L52 78 20 98z" fill="${P.yellowDk}"/>
  <path d="M20 6h58a6 6 0 0 1 6 6v84L52 76 20 96z" fill="url(#ye)"/>
  <path d="M20 6h58a6 6 0 0 1 6 6v6H20z" fill="#fff" opacity=".35"/>
  <path d="M52 28l7.2 14.6 16.1 2.3-11.6 11.4 2.7 16L52 64.7 37.6 72.3l2.7-16-11.6-11.4 16.1-2.3z" fill="${star}"/>`);

const OUT = process.argv[2] || 'public/ewd/assets';
mkdirSync(OUT, { recursive: true });
const files = {
  'art-book-aa': book,
  'art-backpack': backpack,
  'art-graduation': graduation,
  'art-ribbon-purple': ribbon(P.violetDk),
  'art-ribbon-pink': ribbon(P.pink),
};
for (const [name, body] of Object.entries(files)) writeFileSync(`${OUT}/${name}.svg`, body);
console.log(Object.keys(files).length + ' svg yazıldı →', OUT);
