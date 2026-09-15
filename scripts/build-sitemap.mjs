// ============================================================================
// SITEMAP ÜRETİCİ
// ============================================================================
// Blog yazıları sitemap'te yoktu. Site tek sayfalık olduğu için Google onları
// ancak /blog sayfasını JavaScript ile çizip bağlantıları toplayarak
// bulabiliyordu — yani en uzun kuyruklu aramaları getiren içerik, taranma
// sırasının en sonunda kalıyordu. Bu betik yayındaki yazıları Supabase'ten
// çekip `public/sitemap.xml` dosyasını baştan yazar.
//
// `npm run build` içinde vite'tan ÖNCE çalışır; dosya `public/` altında
// üretildiği için derlemeyle birlikte `dist/`e kopyalanır.
//
// Ağ yoksa ya da istek başarısızsa build'i düşürmez: uyarı basıp mevcut
// sitemap'i olduğu gibi bırakır.
//
// Elle çalıştırmak için: `node scripts/build-sitemap.mjs`

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://englishwithdilara.com";
const CIKTI = path.join(ROOT, "public", "sitemap.xml");

/** Menüden ulaşılan herkese açık yollar. Panel ve kişisel sayfalar burada yok. */
const STATIK = [
  { yol: "/", changefreq: "weekly", priority: "1.0" },
  { yol: "/blog", changefreq: "weekly", priority: "0.8" },
  { yol: "/bizimle-calisin", changefreq: "monthly", priority: "0.6" },
  { yol: "/gizlilik-politikasi", changefreq: "yearly", priority: "0.3" },
];

/** Supabase kimliği tek kaynaktan okunsun — istemciyle ayrışmasın. */
function supabaseKimligi() {
  const src = fs.readFileSync(path.join(ROOT, "src/integrations/supabase/client.ts"), "utf8");
  const url = src.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
  const key = src.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*\n?\s*"([^"]+)"/)?.[1];
  if (!url || !key) throw new Error("client.ts içinde Supabase URL/anahtarı bulunamadı");
  return { url, key };
}

async function yayindakiYazilar() {
  const { url, key } = supabaseKimligi();
  const sorgu = "select=slug,published_at,updated_at,created_at&status=eq.published&order=published_at.desc";
  const res = await fetch(`${url}/rest/v1/blog_posts?${sorgu}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

/** `<lastmod>` yalnızca gerçek tarih varken yazılır; uydurma tarih güveni düşürür. */
const gun = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : null);

const xmlKacir = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function url({ loc, lastmod, changefreq, priority, image }) {
  const satir = [`    <loc>${xmlKacir(loc)}</loc>`];
  if (lastmod) satir.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) satir.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) satir.push(`    <priority>${priority}</priority>`);
  if (image) {
    satir.push("    <image:image>");
    satir.push(`      <image:loc>${xmlKacir(image.loc)}</image:loc>`);
    if (image.title) satir.push(`      <image:title>${xmlKacir(image.title)}</image:title>`);
    satir.push("    </image:image>");
  }
  return `  <url>\n${satir.join("\n")}\n  </url>`;
}

async function main() {
  let yazilar = [];
  try {
    yazilar = await yayindakiYazilar();
  } catch (e) {
    console.warn(`⚠ sitemap: blog yazıları alınamadı (${e.message}) — mevcut sitemap.xml korundu`);
    return;
  }

  // /blog listesinin tazeliği en yeni yazının tarihidir.
  const enYeni = yazilar
    .map((p) => p.updated_at || p.published_at || p.created_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  const girdiler = [
    ...STATIK.map((s) => ({
      loc: SITE + s.yol,
      changefreq: s.changefreq,
      priority: s.priority,
      ...(s.yol === "/blog" ? { lastmod: gun(enYeni) } : {}),
      ...(s.yol === "/"
        ? {
            image: {
              loc: `${SITE}/uploads/og-cover.jpg`,
              title: "English with Dilara — online İngilizce dersleri",
            },
          }
        : {}),
    })),
    // Slug'lar başlığın kendisi olabildiği için kodlanmadan yazılamaz:
    // boşluk ve `?` çıplak hâlde geçersiz bir <loc> üretir.
    ...yazilar.map((p) => ({
      loc: `${SITE}/blog/${encodeURIComponent(p.slug)}`,
      lastmod: gun(p.updated_at || p.published_at || p.created_at),
      changefreq: "monthly",
      priority: "0.7",
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
  Kaynak: scripts/build-sitemap.mjs · \`npm run build\` sırasında yenilenir.
  Statik yollar betiğin içinde, blog yazıları Supabase'ten geliyor.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${girdiler.map(url).join("\n")}
</urlset>
`;

  fs.writeFileSync(CIKTI, xml, "utf8");
  console.log(`✓ sitemap.xml — ${STATIK.length} statik yol + ${yazilar.length} blog yazısı`);
}

main();
