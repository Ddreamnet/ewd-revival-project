/**
 * Üretilen ses dosyalarını indirir ve web için düzenler.
 *
 *   node scripts/voice/pull.mjs indirilecekler.json
 *
 * Girdi: [{ out: "public/audio/words/en-apple.mp3", url: "https://..." }]
 *
 * Her dosya indirildikten sonra ffmpeg ile baştaki/sondaki sessizlik kırpılır
 * (butona basınca ses hemen başlasın diye) ve seviyeler eşitlenir; böylece 850
 * kaydın hiçbiri diğerinden yüksek ya da kısık çıkmaz. ffmpeg yoksa ham dosya
 * olduğu gibi kaydedilir.
 *
 * Var olan dosyanın üstüne yazmaz; boş/bozuk inen dosyayı siler ve hata verir.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Sessizlik kırpma + seviye eşitleme. */
const FILTER = [
  "silenceremove=start_periods=1:start_silence=0.04:start_threshold=-45dB",
  "areverse",
  "silenceremove=start_periods=1:start_silence=0.12:start_threshold=-45dB",
  "areverse",
  "loudnorm=I=-16:TP=-1.5:LRA=11",
].join(",");

/** Bu süreden kısa çıktı, sessiz üretim demektir. */
const MIN_DURATION_SEC = 0.25;
/** Bu seviyenin altındaki ortalama ses, duyulmayan kayıt demektir. */
const MIN_MEAN_DB = -50;

const listPath = process.argv[2];
if (!listPath) throw new Error("Kullanım: node scripts/voice/pull.mjs <liste.json>");

/**
 * Üretim bazen tamamen sessiz bir dosya döndürüyor. Böyle bir dosya kartta
 * "bastım, ses çıkmadı" demek olduğu için kaydedilmez; atılır ve listedeki o
 * kayıt eksik kalır, sonraki çalıştırmada yeniden istenir.
 */
async function assertAudible(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    file,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration < MIN_DURATION_SEC) {
    throw new Error(`sessiz üretim (${stdout.trim() || "okunamadı"} sn)`);
  }
  const { stderr } = await run("ffmpeg", ["-v", "info", "-i", file, "-af", "volumedetect", "-f", "null", "-"]);
  const mean = /mean_volume:\s*(-?\d+(?:\.\d+)?) dB/.exec(stderr);
  if (mean && Number.parseFloat(mean[1]) < MIN_MEAN_DB) {
    throw new Error(`ses seviyesi çok düşük (${mean[1]} dB)`);
  }
}

let hasFfmpeg = true;
try {
  await run("ffmpeg", ["-version"]);
} catch {
  hasFfmpeg = false;
  console.log("uyarı: ffmpeg bulunamadı — dosyalar ham hâliyle kaydedilecek");
}

const items = JSON.parse(await readFile(listPath, "utf8"));
let saved = 0;
const failed = [];

for (const { out, url } of items) {
  const target = `${ROOT}/${out}`;
  if (existsSync(target)) continue;
  const raw = `${target}.raw`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(raw, Buffer.from(await res.arrayBuffer()));
    // 1 KB'ın altındaki dosya sessizlik ya da hata sayfasıdır.
    if ((await stat(raw)).size < 1024) throw new Error("dosya çok küçük");

    if (hasFfmpeg) {
      await run("ffmpeg", [
        "-y", "-v", "error",
        "-i", raw,
        "-af", FILTER,
        "-ac", "1",
        "-ar", "44100",
        "-b:a", "64k",
        target,
      ]);
      await assertAudible(target);
      await rm(raw);
    } else {
      await run("mv", [raw, target]);
    }
    saved += 1;
  } catch (err) {
    await rm(raw, { force: true });
    await rm(target, { force: true });
    failed.push(`${out}: ${err.message}`);
  }
}

console.log(`indirilen: ${saved}/${items.length}`);
if (failed.length) {
  console.log(`başarısız (${failed.length}):`);
  for (const f of failed) console.log("  " + f);
  process.exitCode = 1;
}
