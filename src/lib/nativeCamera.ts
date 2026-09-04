import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Native camera wrapper — on native platforms opens Camera/Gallery prompt,
 * returns a File object compatible with existing upload flows.
 * Returns null if user cancels or an error occurs.
 * 
 * @param source Optional CameraSource override. Defaults to CameraSource.Prompt.
 *   - CameraSource.Camera  → only camera
 *   - CameraSource.Photos  → only gallery
 *   - CameraSource.Prompt  → system prompt (Camera + Gallery)
 */
export async function pickImageNative(
  source: CameraSource = CameraSource.Prompt
): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) {
    return null; // web'de kullanılmaz
  }

  try {
    const photo = await Camera.getPhoto({
      source,
      resultType: CameraResultType.DataUrl,
      quality: 85,
      width: 1920,
      height: 1920,
      allowEditing: false,
    });

    if (!photo.dataUrl) return null;

    // DataUrl → Blob → File
    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();

    const extension = photo.format || 'jpeg';
    const fileName = `photo_${Date.now()}.${extension}`;
    const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

    return new File([blob], fileName, { type: mimeType });
  } catch (error: any) {
    // User cancelled — CameraSource.Prompt returns "User cancelled" error
    if (error?.message?.includes('cancel') || error?.message?.includes('Cancel')) {
      return null;
    }
    console.error('Native camera error:', error);
    throw error; // gerçek hataları yukarı ilet
  }
}

/**
 * Returns true if running on a native platform (iOS/Android)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Native çoklu galeri seçimi — bir seferde birçok fotoğraf.
 *
 * Web'de `null` döner; orada `<input type="file" multiple>` kullanılır.
 * Kullanıcı vazgeçerse boş dizi döner.
 */
export async function pickImagesNative(): Promise<File[] | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    // `width` verilmiyor: küçültmeyi shrinkImage yapıyor, orası her platformda aynı.
    const { photos } = await Camera.pickImages({ quality: 92, correctOrientation: true });

    const files: File[] = [];
    for (const [i, photo] of photos.entries()) {
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const format = photo.format || "jpeg";
      const type = blob.type || `image/${format === "jpg" ? "jpeg" : format}`;
      files.push(new File([blob], `photo_${Date.now()}_${i}.${format}`, { type }));
    }
    return files;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("cancel")) return [];
    console.error("Native gallery error:", error);
    throw error;
  }
}
