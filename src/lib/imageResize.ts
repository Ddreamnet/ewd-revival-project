/**
 * Yüklemeden önce fotoğrafı küçültür.
 *
 * Telefon fotoğrafları 4-6 MB geliyor; sayfa onları zaten en fazla birkaç yüz
 * piksellik kutularda ve tam ekranda gösteriyor. Küçültmek hem yüklemeyi hem
 * de sonradan açılışı hızlandırıyor.
 *
 * Çözemediği bir dosyayla karşılaşırsa (ör. iPhone'un HEIC'i — tarayıcı
 * kodlayamaz) dosyayı olduğu gibi geri verir; yükleme yine de sürsün.
 */

/** Uzun kenar bu değere iner; altındakilere dokunulmaz. */
const MAX_EDGE = 2400;
const QUALITY = 0.86;
/** Bu boyutun altındaki dosyayı yeniden kodlamak kazanç getirmiyor. */
const SKIP_BELOW_BYTES = 500 * 1024;

const RESIZABLE = ["image/jpeg", "image/png", "image/webp"];

export interface ShrinkOptions {
  /** Uzun kenarın ineceği piksel. Varsayılan 2400 (gezi fotoğrafları). */
  maxEdge?: number;
  /** JPEG kalitesi 0-1. */
  quality?: number;
  /** Bu boyutun altındaki dosyaya dokunma. */
  skipBelowBytes?: number;
}

/**
 * Blog kapak/içerik görselleri için daha sıkı ayar.
 *
 * Kapak en geniş yerinde (masaüstü blog detayı) 820px kutuda duruyor; 2x
 * ekranlar için 1600px fazlasıyla yetiyor. Denetimde canlıdaki kapaklar
 * 1,9 MB ve 2,5 MB PNG olarak ölçülmüştü — liste sayfasında dokuz kart
 * neredeyse 20 MB ediyordu.
 */
export const BLOG_IMAGE: ShrinkOptions = { maxEdge: 1600, quality: 0.82, skipBelowBytes: 120 * 1024 };

export async function shrinkImage(file: File, options: ShrinkOptions = {}): Promise<File> {
  const maxEdge = options.maxEdge ?? MAX_EDGE;
  const quality = options.quality ?? QUALITY;
  const skipBelow = options.skipBelowBytes ?? SKIP_BELOW_BYTES;

  if (!RESIZABLE.includes(file.type) || file.size < skipBelow) return file;

  try {
    // `imageOrientation` olmadan EXIF ile döndürülmüş fotoğraflar yan yatıyor.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
