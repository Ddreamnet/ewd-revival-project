/**
 * Fotoğrafın çekildiği anı EXIF'ten okur.
 *
 * Toplu yükleme bunu kullanıyor: karışık seçilen fotoğraflar çekim tarihine
 * göre günlere dağıtılıyor. Küçültmeden ÖNCE okunmalı — `shrinkImage` tuvale
 * çizip yeniden kodladığı için EXIF (ve konum bilgisi) orada siliniyor.
 *
 * Yalnızca JPEG'i çözer. HEIC, PNG ve WhatsApp'tan gelen (EXIF'i silinmiş)
 * dosyalarda null döner; çağıran taraf dosya tarihine düşer.
 */

/** EXIF her zaman dosyanın başındadır; tamamını belleğe almaya gerek yok. */
const HEADER_BYTES = 256 * 1024;

const TAG_DATETIME = 0x0132; // IFD0 — dosyanın değiştirilme anı
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003; // deklanşöre basılan an
const TAG_DATETIME_DIGITIZED = 0x9004;

export async function readCaptureDate(file: File): Promise<Date | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const view = new DataView(await file.slice(0, HEADER_BYTES).arrayBuffer());
    const tiff = findExifTiff(view);
    if (tiff === null) return null;
    return readDate(view, tiff);
  } catch {
    return null;
  }
}

/** JPEG işaretçilerini gezip APP1 (Exif) bloğundaki TIFF başlangıcını bulur. */
function findExifTiff(view: DataView): number | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // JPEG değil

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null; // hizalama bozuldu
    const marker = view.getUint8(offset + 1);

    // Boyutsuz işaretçiler
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) return null; // görüntü verisi başladı, EXIF yok

    const size = view.getUint16(offset + 2);
    if (size < 2) return null;

    // APP1 + "Exif\0\0"
    if (
      marker === 0xe1 &&
      offset + 10 <= view.byteLength &&
      view.getUint32(offset + 4) === 0x45786966 &&
      view.getUint16(offset + 8) === 0x0000
    ) {
      return offset + 10;
    }
    offset += 2 + size;
  }
  return null;
}

interface Entry {
  type: number;
  count: number;
  /** Değerin bulunduğu mutlak konum (4 bayta sığıyorsa girdinin içinde). */
  valueAt: number;
}

function readDate(view: DataView, tiff: number): Date | null {
  const order = view.getUint16(tiff);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return null;
  if (view.getUint16(tiff + 2, little) !== 42) return null;

  const ifd0 = readIfd(view, tiff, tiff + view.getUint32(tiff + 4, little), little);
  if (!ifd0) return null;

  // Çekim anı Exif alt dizininde; IFD0'daki DateTime son çareye kalır.
  const pointer = ifd0.get(TAG_EXIF_IFD);
  if (pointer) {
    const exifIfd = readIfd(view, tiff, tiff + view.getUint32(pointer.valueAt, little), little);
    const captured =
      exifIfd &&
      (parseExifDate(ascii(view, exifIfd.get(TAG_DATETIME_ORIGINAL))) ??
        parseExifDate(ascii(view, exifIfd.get(TAG_DATETIME_DIGITIZED))));
    if (captured) return captured;
  }
  return parseExifDate(ascii(view, ifd0.get(TAG_DATETIME)));
}

function readIfd(view: DataView, tiff: number, at: number, little: boolean): Map<number, Entry> | null {
  if (at < tiff || at + 2 > view.byteLength) return null;
  const count = view.getUint16(at, little);
  const entries = new Map<number, Entry>();

  for (let i = 0; i < count; i += 1) {
    const entry = at + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const valueCount = view.getUint32(entry + 4, little);
    const bytes = sizeOf(type) * valueCount;
    // 4 bayta sığmayan değer, TIFF başına göre bir konumda duruyor.
    const valueAt = bytes <= 4 ? entry + 8 : tiff + view.getUint32(entry + 8, little);
    entries.set(tag, { type, count: valueCount, valueAt });
  }
  return entries;
}

function sizeOf(type: number): number {
  switch (type) {
    case 1:
    case 2:
    case 6:
    case 7:
      return 1;
    case 3:
    case 8:
      return 2;
    case 4:
    case 9:
    case 11:
      return 4;
    default:
      return 8;
  }
}

function ascii(view: DataView, entry: Entry | undefined): string | null {
  if (!entry || entry.type !== 2) return null;
  if (entry.valueAt + entry.count > view.byteLength) return null;
  let out = "";
  for (let i = 0; i < entry.count; i += 1) {
    const code = view.getUint8(entry.valueAt + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

/** "2026:08:19 21:40:05" → yerel Date. EXIF saati zaten çekim yerinin saati. */
function parseExifDate(value: string | null): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number) as unknown as number[];
  const date = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(date.getTime()) || date.getFullYear() < 2000 ? null : date;
}
