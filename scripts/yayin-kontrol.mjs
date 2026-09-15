// ============================================================================
// YAYIN KONTROLÜ
// ============================================================================
// Deploy'un gerçekten tuttuğunu doğrular: canlıdaki her herkese açık sayfa,
// elimizdeki derlemenin varlıklarını mı çağırıyor?
//
// Neden gerekli: 15 Eylül'de dist/ elle yüklenirken blog klasörleri atlandı.
// Sunucuda 8 sayfa eski HTML'i vermeye devam etti; o HTML artık var olmayan
// bir .css/.js istiyordu, SPA geri düşüşü de onlara index.html döndürdü.
// Tarayıcı stylesheet yerine HTML alınca sayfa "ham HTML" gibi göründü.
// Hiçbir şey hata vermedi — yalnızca sayfa bozuktu. Bu betik tam olarak o
// durumu yakalar.
//
// Kullanım:
//   npm run kontrol                  (dist/ ile canlıyı karşılaştırır)
//   SITE=https://... npm run kontrol (başka bir adrese bakar)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const SITE = (process.env.SITE || "https://englishwithdilara.com").replace(/\/$/, "");

/** index.html içindeki ana stil dosyasının adı — derlemenin parmak izi. */
function parmakIzi(html) {
  return html.match(/href="\/assets\/(index-[^"]+\.css)"/)?.[1] ?? null;
}

/** dist/ içindeki her index.html'i, karşılık geldiği yola çevirir. */
function yollar(dizin = DIST, taban = "") {
  const sonuc = [];
  for (const girdi of fs.readdirSync(dizin, { withFileTypes: true })) {
    const tam = path.join(dizin, girdi.name);
    if (girdi.isDirectory()) {
      if (girdi.name === "assets") continue;
      sonuc.push(...yollar(tam, `${taban}/${girdi.name}`));
    } else if (girdi.name === "index.html") {
      sonuc.push(taban === "" ? "/" : taban);
    }
  }
  return sonuc.sort();
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.error("✗ dist/index.html yok — önce `npm run build` çalıştırın.");
    process.exit(1);
  }

  const beklenen = parmakIzi(fs.readFileSync(path.join(DIST, "index.html"), "utf8"));
  if (!beklenen) {
    console.error("✗ dist/index.html içinde stil dosyası bulunamadı.");
    process.exit(1);
  }

  const liste = yollar();
  console.log(`Beklenen derleme: ${beklenen}`);
  console.log(`Adres: ${SITE}  ·  ${liste.length} sayfa\n`);

  const eski = [];
  const hatali = [];

  for (const yol of liste) {
    let satir;
    try {
      const yanit = await fetch(SITE + yol, { redirect: "follow" });
      const metin = await yanit.text();
      const bulunan = parmakIzi(metin);

      if (!yanit.ok) {
        hatali.push(yol);
        satir = `HTTP ${yanit.status}`;
      } else if (bulunan === beklenen) {
        satir = "güncel";
      } else {
        eski.push(yol);
        satir = `ESKİ · ${bulunan ?? "stil yok"}`;
      }
    } catch (e) {
      hatali.push(yol);
      satir = `ULAŞILAMADI · ${e.message}`;
    }
    console.log(`  ${satir.padEnd(34)} ${yol}`);
  }

  // Stil dosyası gerçekten stil mi dönüyor? SPA geri düşüşü devreye girmişse
  // 200 döner ama içerik HTML olur — sayfa sessizce bozulur.
  const stil = await fetch(`${SITE}/assets/${beklenen}`);
  const tip = stil.headers.get("content-type") ?? "";
  const stilTamam = stil.ok && tip.includes("css");
  console.log(`\n  ${stilTamam ? "güncel" : "BOZUK"}${" ".repeat(28)} /assets/${beklenen}  (${tip || "tür yok"})`);

  console.log("");
  if (eski.length === 0 && hatali.length === 0 && stilTamam) {
    console.log("✓ Canlı site derlemeyle birebir aynı.");
    return;
  }
  if (eski.length) console.log(`✗ ${eski.length} sayfa eski sürümü veriyor:\n   ${eski.join("\n   ")}`);
  if (hatali.length) console.log(`✗ ${hatali.length} sayfaya ulaşılamadı:\n   ${hatali.join("\n   ")}`);
  if (!stilTamam) console.log("✗ Ana stil dosyası sunucuda yok ya da yanlış türle dönüyor.");
  process.exit(1);
}

main().catch((e) => {
  console.error("✗ kontrol başarısız:", e.message);
  process.exit(1);
});
