// ============================================================================
// DİL BÜTÜNLÜĞÜ DENETİMİ
// ============================================================================
// Site yedi dilde yayında (tr, en, fr, ru, es, de, ar). Bir dil eklerken ya da
// metin düzenlerken en kolay yapılan hata bir yaprağı eksik bırakmaktır:
// TypeScript bunu ancak o yaprak `[language]` ile okunduğunda yakalar, sözlükte
// öylece duran bir alanı fark etmez.
//
// Bu betik kaynağı okuyup şunları doğrular:
//   · `translations.ts` içindeki her metin demeti yedi dili de içeriyor mu,
//   · kelime bankalarında her kartın `meaning`'i yedi dilde dolu mu,
//   · `exampleT` kelimenin kendi dili dışındaki altı dili taşıyor mu,
//   · her seviyede günlük kart yuvalarının istediği türler (isim/sıfat, fiil,
//     zarf) bulunuyor mu — yoksa kartlar yedeğe düşer.
//
// Çalıştırmak için: `node scripts/check-i18n.mjs`

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = ["tr", "en", "fr", "ru", "es", "de", "ar"];
const BANKS = { en: "bank.en.ts", fr: "bank.fr.ts", ru: "bank.ru.ts", es: "bank.es.ts", de: "bank.de.ts", ar: "bank.ar.ts" };
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const STR = `("(?:[^"\\\\]|\\\\.)*")`;
const problems = [];
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/** `{ tr: "…", en: "…", … }` bloğunun dillerini çıkarır. */
function langsIn(body) {
  const found = new Set();
  const pair = new RegExp(`(\\w+):\\s*${STR}`, "g");
  let m;
  while ((m = pair.exec(body)) !== null) if (LANGS.includes(m[1])) found.add(m[1]);
  return found;
}

// ── 1. Sözlük ──────────────────────────────────────────────────────────────
{
  const src = read("src/lib/translations.ts");
  // Sözlükteki yapraklar her zaman `tr` ile başlar; LANGUAGES dizisi bu kalıba
  // uymadığı için denetimin dışında kalır.
  const leaf = new RegExp(`\\{\\s*tr:\\s*${STR}[\\s\\S]*?\\}`, "g");
  let m, count = 0;
  while ((m = leaf.exec(src)) !== null) {
    const body = m[0];
    if (body.includes("code:")) continue;
    count++;
    const have = langsIn(body);
    const missing = LANGS.filter((l) => !have.has(l));
    if (missing.length) {
      problems.push(`translations.ts: ${JSON.parse(m[1]).slice(0, 40)}… → eksik: ${missing.join(", ")}`);
    }
  }
  console.log(`translations.ts — ${count} metin demeti`);
  if (count < 250) problems.push(`translations.ts: beklenenden az demet bulundu (${count})`);
}

// ── 2. Kelime bankaları ────────────────────────────────────────────────────
for (const [lang, file] of Object.entries(BANKS)) {
  const src = read(`src/lib/words/${file}`);
  const entry = new RegExp(
    `id:\\s*${STR},\\s*\\n\\s*word:\\s*${STR},\\s*\\n\\s*pos:\\s*${STR},\\s*\\n\\s*level:\\s*${STR},` +
      `[\\s\\S]*?meaning:\\s*\\{([\\s\\S]*?)\\},[\\s\\S]*?exampleT:\\s*\\{([\\s\\S]*?)\\},`,
    "g",
  );
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, []]));
  let m, count = 0;
  while ((m = entry.exec(src)) !== null) {
    count++;
    const [id, , pos, level] = [1, 2, 3, 4].map((i) => JSON.parse(m[i]));
    if (!byLevel[level]) problems.push(`${file}: ${id} → bilinmeyen seviye ${level}`);
    else byLevel[level].push(pos);

    const missingMeaning = LANGS.filter((l) => !langsIn(m[5]).has(l));
    if (missingMeaning.length) problems.push(`${file}: ${id} → meaning eksik: ${missingMeaning.join(", ")}`);

    const haveEx = langsIn(m[6]);
    const missingEx = LANGS.filter((l) => l !== lang && !haveEx.has(l));
    if (missingEx.length) problems.push(`${file}: ${id} → exampleT eksik: ${missingEx.join(", ")}`);
    if (haveEx.has(lang)) problems.push(`${file}: ${id} → exampleT kendi dilini içeriyor (${lang})`);
  }

  for (const level of LEVELS) {
    const pool = byLevel[level];
    if (pool.length === 0) { problems.push(`${file}: ${level} seviyesinde kelime yok`); continue; }
    if (!pool.some((p) => p === "noun" || p === "adjective")) problems.push(`${file}: ${level} → isim/sıfat yok`);
    if (!pool.includes("verb")) problems.push(`${file}: ${level} → fiil yok`);
    if (!pool.includes("adverb")) problems.push(`${file}: ${level} → zarf yok`);
  }

  const counts = LEVELS.map((l) => `${l}:${byLevel[l].length}`).join(" ");
  console.log(`${file} — ${count} kelime  (${counts})`);
}

// ── Sonuç ──────────────────────────────────────────────────────────────────
if (problems.length) {
  console.error(`\n${problems.length} sorun:`);
  problems.forEach((p) => console.error("  · " + p));
  process.exit(1);
}
console.log("\nTamam — bütün diller eksiksiz.");
