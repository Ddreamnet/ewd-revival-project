// ============================================================================
// ÖN İŞLEME (PRERENDER)
// ============================================================================
// Site tek sayfalık: sunucu boş bir `<div id="root">` gönderiyor, içeriği
// tarayıcıda React çiziyor. Sonuçları:
//   · WhatsApp, Instagram ve yapay zekâ botları JavaScript çalıştırmaz —
//     paylaşılan her blog yazısı ana sayfanın kartıyla görünüyordu.
//   · Googlebot çalıştırır ama çizim kuyruğu ayrı ve yavaş; içerik günler
//     sonra indeksleniyor.
//
// Bu betik derlemeden SONRA çalışır: `dist/` klasörünü yerelde sunar, her
// herkese açık yolu gerçek bir tarayıcıda açar ve çizilmiş HTML'i o yolun
// kendi `index.html`ine yazar. Ziyaretçi yine tam uygulamayı alır — React
// açılışta `#root`u kendi çizimiyle değiştirir.
//
// Bağımlılık eklemiyor: sistemde zaten kurulu olan Chrome ya da Edge'i
// `--dump-dom` ile çalıştırıyor. Tarayıcı bulunamazsa uyarı basıp çıkar,
// derlemeyi düşürmez — o durumda site bugünkü hâliyle yayına gider.
//
// Elle çalıştırmak için: `npm run build` (otomatik) ya da
// `node scripts/prerender.mjs` (dist/ hazırken).
//
// Barındırma koşulu: sunucu `/blog/yazi` için önce `dist/blog/yazi/index.html`
// dosyasını aramalı, yoksa `dist/index.html`e düşmeli. Vercel, Netlify,
// Cloudflare Pages ve nginx'in `try_files $uri $uri/index.html /index.html`
// kalıbı bunu zaten yapar.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const SITEMAP = path.join(DIST, "sitemap.xml");

/** Sayfanın çizilmesi için tanınan süre (ms). Blog yazısı Supabase'i bekliyor. */
const SURE = 15000;

// ── tarayıcıyı bul ──────────────────────────────────────────────────────────
function tarayiciBul() {
  const elle = process.env.PRERENDER_BROWSER;
  if (elle) return fs.existsSync(elle) ? elle : null;

  const pf = process.env["ProgramFiles"] || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA || "";

  const adaylar = {
    win32: [
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${local}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
    ],
  }[process.platform] ?? [];

  // Playwright önbelleğindeki headless shell — geliştirme makinelerinde sık bulunur.
  const pw = path.join(process.env.HOME || "", ".cache/ms-playwright");
  if (fs.existsSync(pw)) {
    for (const d of fs.readdirSync(pw).filter((d) => d.startsWith("chromium"))) {
      for (const alt of ["chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/chrome"]) {
        adaylar.push(path.join(pw, d, alt));
      }
    }
  }
  return adaylar.find((p) => p && fs.existsSync(p)) ?? null;
}

// ── dist/ için küçük statik sunucu (SPA geri düşüşüyle) ─────────────────────
const TIPLER = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain",
  ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
};

function sunucuBaslat() {
  const server = http.createServer((req, res) => {
    const temiz = decodeURIComponent(req.url.split("?")[0]);
    let dosya = path.join(DIST, path.normalize(temiz).replace(/^(\.\.[/\\])+/, ""));
    if (!fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) {
      const dizinli = path.join(dosya, "index.html");
      dosya = fs.existsSync(dizinli) ? dizinli : path.join(DIST, "index.html");
    }
    res.writeHead(200, { "Content-Type": TIPLER[path.extname(dosya)] ?? "application/octet-stream" });
    fs.createReadStream(dosya).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// ── bir yolu çiz ────────────────────────────────────────────────────────────
function ciz(tarayici, url) {
  return new Promise((ok) => {
    const p = spawn(tarayici, [
      "--headless", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
      "--hide-scrollbars", "--no-first-run", "--disable-extensions",
      `--virtual-time-budget=${SURE}`, "--dump-dom", url,
    ], { stdio: ["ignore", "pipe", "ignore"] });

    let cikti = "";
    p.stdout.on("data", (d) => (cikti += d));
    const zamanAsimi = setTimeout(() => p.kill("SIGKILL"), SURE + 20000);
    p.on("close", () => { clearTimeout(zamanAsimi); ok(cikti); });
    p.on("error", () => { clearTimeout(zamanAsimi); ok(""); });
  });
}

/**
 * Çıktı işe yarar mı?
 *
 * Boş ya da yarım çizilmiş bir sayfayı diske yazmak, hiç yazmamaktan kötü:
 * ziyaretçi de arama motoru da boş bir kabuk görür. Şüphedeysek atlıyoruz.
 */
function saglam(html) {
  if (!html || html.length < 2000) return false;
  const govde = html.match(/<div id="root"[^>]*>([\s\S]*)<\/div>/)?.[1] ?? "";
  if (govde.replace(/\s/g, "").length < 500) return false;
  if (!/<title>[^<]{3,}<\/title>/.test(html)) return false;
  // Sayfa burada yerel sunucuda açılıyor; canonical/og:url gibi mutlak
  // adreslerin `@/lib/site`teki alan adından kurulması gerekiyor. Yerel adres
  // çıktıya sızdıysa bu bozulmuş demektir — yayına böyle bir dosya gitmesin.
  if (/127\.0\.0\.1|localhost/.test(html)) return false;
  return true;
}

// ── ana akış ────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.warn("⚠ prerender: dist/ yok — önce `vite build` çalışmalı, atlanıyor");
    return;
  }

  const tarayici = tarayiciBul();
  if (!tarayici) {
    console.warn(
      "⚠ prerender: Chrome/Edge bulunamadı — atlanıyor (site ön işlemesiz yayına gider).\n" +
      "  Yolu elle vermek için: PRERENDER_BROWSER=\"...\\chrome.exe\" npm run build",
    );
    return;
  }

  // Yollar sitemap'ten geliyor: blog yazıları eklendikçe buraya elle
  // dokunmaya gerek kalmasın.
  if (!fs.existsSync(SITEMAP)) {
    console.warn("⚠ prerender: dist/sitemap.xml yok — atlanıyor");
    return;
  }
  const yollar = [...fs.readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => new URL(m[1]).pathname);

  const server = await sunucuBaslat();
  const kok = `http://127.0.0.1:${server.address().port}`;
  console.log(`  prerender: ${path.basename(tarayici)} · ${yollar.length} yol`);

  let yazilan = 0, atlanan = 0;
  for (const yol of yollar) {
    const html = await ciz(tarayici, kok + yol);
    if (!saglam(html)) {
      console.warn(`  ⚠ atlandı (çizim boş geldi): ${yol}`);
      atlanan++;
      continue;
    }
    const hedef = yol === "/"
      ? path.join(DIST, "index.html")
      : path.join(DIST, decodeURIComponent(yol), "index.html");
    fs.mkdirSync(path.dirname(hedef), { recursive: true });
    fs.writeFileSync(hedef, html, "utf8");
    yazilan++;
    const baslik = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    console.log(`  ✓ ${yol}  →  ${baslik.slice(0, 58)}`);
  }

  server.close();
  console.log(`✓ prerender — ${yazilan} sayfa yazıldı${atlanan ? `, ${atlanan} atlandı` : ""}`);
}

main().catch((e) => {
  // Ön işleme derlemeyi düşürmesin: olmazsa site eski davranışıyla yayına gider.
  console.warn(`⚠ prerender atlandı: ${e.message}`);
});
