/**
 * Seslendirilecek metinlerin listesini çıkarır.
 *
 *   node --experimental-strip-types scripts/voice/jobs.mjs [--kind=word|example|all]
 *                                                          [--lang=en|fr|all]
 *                                                          [--all] [--limit=N]
 *
 * Varsayılan olarak yalnızca **dosyası henüz olmayan** kayıtları listeler, yani
 * üretim yarıda kalırsa aynı komut kaldığı yerden devam eder. `--all` hepsini verir.
 * Çıktı: JSON dizisi — [{ index, id, kind, lang, text, out }]
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const { EN_WORDS } = await import(`${ROOT}/src/lib/words/bank.en.ts`);
const { FR_WORDS } = await import(`${ROOT}/src/lib/words/bank.fr.ts`);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const kindFilter = args.kind ?? "all";
const langFilter = args.lang ?? "all";
const onlyMissing = args.all !== "true";
const limit = args.limit ? Number(args.limit) : Infinity;

/** Fransızca kelimelerde tanımlık okunmaz — `spokenWord` ile aynı kural. */
const spokenWord = (word) => word.replace(/^(le |la |l'|les )/, "");

const banks = { en: EN_WORDS, fr: FR_WORDS };
const jobs = [];

for (const [lang, bank] of Object.entries(banks)) {
  if (langFilter !== "all" && langFilter !== lang) continue;
  for (const entry of bank) {
    const candidates = [
      { kind: "word", text: spokenWord(entry.word), out: `public/audio/words/${entry.id}.mp3` },
      { kind: "example", text: entry.example, out: `public/audio/examples/${entry.id}.mp3` },
    ];
    for (const c of candidates) {
      if (kindFilter !== "all" && kindFilter !== c.kind) continue;
      if (onlyMissing && existsSync(`${ROOT}/${c.out}`)) continue;
      jobs.push({ index: jobs.length, id: entry.id, lang, ...c });
    }
  }
}

process.stdout.write(JSON.stringify(jobs.slice(0, limit), null, 2));
