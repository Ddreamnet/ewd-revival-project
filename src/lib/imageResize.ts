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

export async function shrinkImage(file: File): Promise<File> {
  if (!RESIZABLE.includes(file.type) || file.size < SKIP_BELOW_BYTES) return file;

  try {
    // `imageOrientation` olmadan EXIF ile döndürülmüş fotoğraflar yan yatıyor.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
