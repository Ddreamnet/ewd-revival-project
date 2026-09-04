// EWD ikon seti üreteci —  `node scripts/build-icons.mjs public/ewd/assets/ic`
//
// 128x128 vektör "jeton" ikonlar.
// Plaka: arkada koyu kenar dairesi + önde degradeli yüz + üstte parlama.
// Glif: beyaz/aksan renkli, yumuşak gölgeli.
import { writeFileSync, mkdirSync } from 'fs';

const PALETTES = {
  // ic-* — çocuk "temel" kartındaki lila jetonlar
  lilac:  { light: '#DCC6FF', dark: '#A87BF0', edge: '#8B5AD8' },
  // ic-*-p — çocuk "okul" kartındaki pembe jetonlar
  pink:   { light: '#FFE2EC', dark: '#F9A7C4', edge: '#EE7BA6' },
  // n-* ve y-* — koyu mor zeminlerde duran jetonlar
  violet: { light: '#CBACF9', dark: '#9A6BE9', edge: '#7C46CF' },
  // nav-* — menüdeki iki renkli jetonlar
  navPink:   { light: '#FF8DBC', dark: '#F43F8E', edge: '#9558DC', ring: true },
  navViolet: { light: '#BE93F2', dark: '#8B4FD4', edge: '#F43F8E', ring: true },
};

const INK = '#FFFFFF';
const YELLOW = '#FBD34F';
const HOTPINK = '#FB6FA8';
const SKY = '#7EC8F5';
const GRAPE = '#8B5AD8';
const DEEP = '#5B21B6';

/** Ortak sarmalayıcı: plaka + gölge filtresi + glif. */
function svg(pal, glyph) {
  const ring = pal.ring;
  const backR = ring ? 60 : 58, faceR = ring ? 51 : 58;
  const backCy = ring ? 64 : 68, faceCy = ring ? 61 : 62;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${pal.light}"/>
      <stop offset="1" stop-color="${pal.dark}"/>
    </linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".55"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="d" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#3B1E6E" flood-opacity=".3"/>
    </filter>
  </defs>
  <circle cx="64" cy="${backCy}" r="${backR}" fill="${pal.edge}"/>
  <circle cx="64" cy="${faceCy}" r="${faceR}" fill="url(#f)"/>
  <ellipse cx="48" cy="${faceCy - 30}" rx="27" ry="15" fill="url(#g)" transform="rotate(-20 48 ${faceCy - 30})"/>
  <g filter="url(#d)">${glyph}</g>
</svg>
`;
}

// ── glifler ───────────────────────────────────────────────────────────────
// Hepsi (64,60) merkezli ~58'lik kutuya çizilir.
const person = (x, y, s, body, head = body) => `
    <circle cx="${x}" cy="${y - 9 * s}" r="${8 * s}" fill="${head}"/>
    <path d="M${x - 13 * s} ${y + 15 * s}a${13 * s} ${13 * s} 0 0 1 ${26 * s} 0z" fill="${body}"/>`;

const G = {
  abc: `
    <g fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" transform="translate(-2 0)">
      <path d="M36 76 44 46 52 76M39 66h10" stroke="${HOTPINK}"/>
      <path d="M60 46v30M60 46h8a7 7 0 0 1 0 14h-8m0 0h9a7 7 0 0 1 0 14h-9" stroke="${SKY}"/>
      <path d="M97 54A13 13 0 1 0 97 70" stroke="${INK}"/>
    </g>`,

  group2: `${person(45, 56, 1, HOTPINK)}${person(83, 56, 1, SKY)}${person(64, 64, 1.3, INK)}`,

  personStar: `${person(60, 60, 1.5, HOTPINK, HOTPINK)}
    <path d="M92 62l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3-9.3-4.9-9.3 4.9 1.8-10.3-7.5-7.3 10.4-1.5z" fill="${YELLOW}"/>`,

  pencil: `
    <g transform="rotate(-38 64 60)">
      <rect x="52" y="24" width="24" height="46" rx="4" fill="${YELLOW}"/>
      <rect x="64" y="24" width="12" height="46" fill="#F3B72E"/>
      <path d="M52 70h24l-12 20z" fill="#FFF3D6"/>
      <path d="M58 82l6 8 6-8z" fill="${DEEP}"/>
      <rect x="52" y="12" width="24" height="14" rx="5" fill="${HOTPINK}"/>
      <rect x="52" y="24" width="24" height="5" fill="#C9A9F8"/>
    </g>`,

  book: `
    <path d="M64 38c-8-6-18-8-27-7a3 3 0 0 0-3 3v40a3 3 0 0 0 3 3c9-1 19 1 27 7z" fill="${INK}"/>
    <path d="M64 38c8-6 18-8 27-7a3 3 0 0 1 3 3v40a3 3 0 0 1-3 3c-9-1-19 1-27 7z" fill="#F0E6FF"/>
    <path d="M64 38v46" stroke="${GRAPE}" stroke-width="4" stroke-linecap="round"/>
    <path d="M30 84c10-2 22 0 34 8 12-8 24-10 34-8v6c0 3-2 5-5 5-10-1-20 1-29 7-9-6-19-8-29-7-3 0-5-2-5-5z" fill="${HOTPINK}"/>`,

  bubble: `
    <path d="M40 32h48a12 12 0 0 1 12 12v24a12 12 0 0 1-12 12H62L44 94l2-14h-6a12 12 0 0 1-12-12V44a12 12 0 0 1 12-12z" fill="${INK}"/>
    <g fill="${GRAPE}"><circle cx="50" cy="56" r="5.5"/><circle cx="66" cy="56" r="5.5"/><circle cx="82" cy="56" r="5.5"/></g>`,

  headphones: `
    <path d="M34 66V60a30 30 0 0 1 60 0v6" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <rect x="24" y="58" width="20" height="30" rx="9" fill="${HOTPINK}"/>
    <rect x="84" y="58" width="20" height="30" rx="9" fill="${HOTPINK}"/>
    <rect x="30" y="64" width="8" height="18" rx="4" fill="#FFD3E4"/>
    <rect x="90" y="64" width="8" height="18" rx="4" fill="#FFD3E4"/>`,

  trophy: `
    <path d="M44 28h40v18a20 20 0 0 1-40 0z" fill="${YELLOW}"/>
    <path d="M44 34H32v6a12 12 0 0 0 12 12zM84 34h12v6a12 12 0 0 1-12 12z" fill="none" stroke="${YELLOW}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
    <rect x="58" y="64" width="12" height="12" fill="#F3B72E"/>
    <rect x="44" y="76" width="40" height="12" rx="5" fill="${YELLOW}"/>
    <path d="M64 34l3.4 6.9 7.6 1.1-5.5 5.4 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6-5.5-5.4 7.6-1.1z" fill="${GRAPE}"/>`,

  gamepad: `
    <path d="M44 40h40a22 22 0 0 1 21 28l-4 14a11 11 0 0 1-19 4l-6-8H52l-6 8a11 11 0 0 1-19-4l-4-14a22 22 0 0 1 21-28z" fill="${YELLOW}"/>
    <g fill="${GRAPE}">
      <rect x="40" y="58" width="18" height="6" rx="3"/><rect x="46" y="52" width="6" height="18" rx="3"/>
      <circle cx="82" cy="56" r="5"/><circle cx="92" cy="66" r="5"/>
    </g>`,

  clock: `
    <path d="M38 30l-8-8M90 30l8-8" stroke="${YELLOW}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="64" cy="62" r="30" fill="${INK}"/>
    <circle cx="64" cy="62" r="24" fill="#F5EEFF"/>
    <path d="M64 46v16h12" stroke="${GRAPE}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,

  calendar: `
    <rect x="30" y="34" width="68" height="60" rx="10" fill="${INK}"/>
    <path d="M30 44a10 10 0 0 1 10-10h48a10 10 0 0 1 10 10v8H30z" fill="${HOTPINK}"/>
    <g fill="${GRAPE}"><rect x="44" y="22" width="9" height="22" rx="4.5"/><rect x="75" y="22" width="9" height="22" rx="4.5"/></g>
    <g fill="${HOTPINK}">
      <rect x="42" y="62" width="12" height="10" rx="3"/><rect x="58" y="62" width="12" height="10" rx="3"/><rect x="74" y="62" width="12" height="10" rx="3"/>
      <rect x="42" y="78" width="12" height="10" rx="3"/><rect x="58" y="78" width="12" height="10" rx="3"/>
    </g>`,

  gift: `
    <rect x="32" y="52" width="64" height="42" rx="8" fill="${INK}"/>
    <rect x="28" y="40" width="72" height="18" rx="7" fill="#F5EEFF"/>
    <rect x="57" y="40" width="14" height="54" fill="${HOTPINK}"/>
    <path d="M64 40c-4-10-12-14-18-10s-2 12 8 12M64 40c4-10 12-14 18-10s2 12-8 12" fill="none" stroke="${HOTPINK}" stroke-width="7" stroke-linecap="round"/>`,

  clipboard: `
    <rect x="34" y="32" width="60" height="66" rx="9" fill="${INK}"/>
    <rect x="52" y="24" width="24" height="16" rx="6" fill="${YELLOW}"/>
    <g stroke="${SKY}" stroke-width="6" stroke-linecap="round" fill="none">
      <path d="M46 56l6 6 10-12"/><path d="M46 76l6 6 10-12"/>
    </g>
    <g fill="#DCC6FF"><rect x="68" y="52" width="18" height="6" rx="3"/><rect x="68" y="72" width="18" height="6" rx="3"/></g>`,

  camera: `
    <rect x="26" y="40" width="52" height="44" rx="11" fill="${INK}"/>
    <path d="M84 56l16-11a3 3 0 0 1 5 3v28a3 3 0 0 1-5 3L84 68z" fill="${INK}"/>
    <circle cx="42" cy="52" r="5" fill="${HOTPINK}"/>`,

  notePencil: `
    <rect x="30" y="30" width="52" height="66" rx="9" fill="${INK}"/>
    <g fill="${HOTPINK}"><rect x="40" y="46" width="32" height="6" rx="3"/><rect x="40" y="60" width="32" height="6" rx="3"/><rect x="40" y="74" width="20" height="6" rx="3"/></g>
    <g transform="rotate(38 88 62)">
      <rect x="80" y="30" width="16" height="42" rx="3" fill="${YELLOW}"/>
      <path d="M80 72h16l-8 14z" fill="#FFF3D6"/><path d="M84 80h8l-4 6z" fill="${DEEP}"/>
      <rect x="80" y="22" width="16" height="10" rx="4" fill="${HOTPINK}"/>
    </g>`,

  briefcase: `
    <path d="M50 40a8 8 0 0 1 8-8h12a8 8 0 0 1 8 8v6h-9v-5H59v5h-9z" fill="${YELLOW}"/>
    <rect x="26" y="44" width="76" height="50" rx="10" fill="${INK}"/>
    <rect x="26" y="62" width="76" height="8" fill="#E7D8FF"/>
    <rect x="56" y="58" width="16" height="14" rx="4" fill="${YELLOW}"/>`,

  target: `
    <circle cx="62" cy="62" r="32" fill="${INK}"/>
    <circle cx="62" cy="62" r="22" fill="${HOTPINK}"/>
    <circle cx="62" cy="62" r="12" fill="${INK}"/>
    <circle cx="62" cy="62" r="5" fill="${HOTPINK}"/>
    <path d="M62 62l34-32" stroke="${GRAPE}" stroke-width="8" stroke-linecap="round"/>
    <path d="M96 30l-2-12 12 2z" fill="${YELLOW}"/><path d="M96 30l12-2-2 12z" fill="${YELLOW}"/>`,

  bulb: `
    <path d="M64 22a26 26 0 0 1 16 46v6H48v-6a26 26 0 0 1 16-46z" fill="${YELLOW}"/>
    <path d="M56 68v-6l8-8 8 8v6" fill="none" stroke="#F3B72E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="48" y="76" width="32" height="9" rx="4.5" fill="${INK}"/>
    <rect x="52" y="88" width="24" height="9" rx="4.5" fill="${INK}"/>`,

  bars: `
    <rect x="32" y="66" width="16" height="30" rx="7" fill="${SKY}"/>
    <rect x="56" y="46" width="16" height="50" rx="7" fill="${INK}"/>
    <rect x="80" y="30" width="16" height="66" rx="7" fill="${YELLOW}"/>`,

  check: `<path d="M42 64l14 15 30-32" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`,
};

// ── dosya eşlemesi ────────────────────────────────────────────────────────
const ICONS = {
  'ic-abc': ['lilac', 'abc'],
  'ic-grup': ['lilac', 'group2'],
  'ic-kalem': ['lilac', 'pencil'],
  'ic-konusma': ['lilac', 'bubble'],
  'ic-kulaklik': ['lilac', 'headphones'],
  'ic-kupa': ['lilac', 'trophy'],
  'ic-oyun': ['lilac', 'gamepad'],
  'ic-saat': ['lilac', 'clock'],
  'ic-takvim': ['lilac', 'calendar'],
  'ic-grup-p': ['pink', 'group2'],
  'ic-kitap-p': ['pink', 'book'],
  'ic-saat-p': ['pink', 'clock'],
  'ic-takvim-p': ['pink', 'calendar'],
  'n-kisi': ['violet', 'personStar'],
  'n-ikili': ['violet', 'group2'],
  'n-video': ['violet', 'camera'],
  'n-sohbet': ['violet', 'bubble'],
  'n-pano': ['violet', 'clipboard'],
  'n-hediye': ['violet', 'gift'],
  'y-ampul': ['violet', 'bulb'],
  'y-bar': ['violet', 'bars'],
  'y-canta': ['violet', 'briefcase'],
  'y-check': ['violet', 'check'],
  'y-grup': ['violet', 'group2'],
  'y-hedef': ['violet', 'target'],
  'y-konusma': ['violet', 'bubble'],
  'y-kulaklik': ['violet', 'headphones'],
  'y-takvim': ['violet', 'calendar'],
  'nav-dersler': ['navPink', 'book'],
  'nav-iletisim': ['navViolet', 'bubble'],
  'nav-blog': ['navPink', 'notePencil'],
};

const out = process.argv[2];
mkdirSync(out, { recursive: true });
for (const [name, [pal, glyph]] of Object.entries(ICONS)) {
  writeFileSync(`${out}/${name}.svg`, svg(PALETTES[pal], G[glyph]));
}
console.log(Object.keys(ICONS).length + ' svg yazıldı →', out);
