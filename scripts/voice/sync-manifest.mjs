/**
 * `public/audio/` altındaki dosyalara bakıp `src/lib/words/voiceManifest.ts`
 * dosyasını yeniden yazar. Ses üretiminden sonra çalıştırılır:
 *
 *   node scripts/voice/sync-manifest.mjs
 */
import { readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function ids(dir) {
  try {
    const files = await readdir(`${ROOT}/${dir}`);
    return files.filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4)).sort();
  } catch {
    return [];
  }
}

const words = await ids("public/audio/words");
const examples = await ids("public/audio/examples");
const list = (arr) => (arr.length ? "\n" + arr.map((id) => `  "${id}",`).join("\n") + "\n" : "");

await writeFile(
  `${ROOT}/src/lib/words/voiceManifest.ts`,
  `/**
 * OTOMATİK ÜRETİLİR — elle düzenleme. Yenilemek için: \`node scripts/voice/sync-manifest.mjs\`
 *
 * \`public/audio/\` altında sesi hazır olan kelimelerin kimlikleri. Listede olmayan
 * kelimeler tarayıcının konuşma motoruyla okunur.
 */

/** Kayıtlı kelime sesi olan kimlikler. */
export const VOICE_WORD_IDS = new Set<string>([${list(words)}]);

/** Kayıtlı örnek cümle sesi olan kimlikler. */
export const VOICE_EXAMPLE_IDS = new Set<string>([${list(examples)}]);
`,
  "utf8",
);

console.log(`kelime: ${words.length} · örnek cümle: ${examples.length}`);
