import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileTransfer } from '@capacitor/file-transfer';
import { Share } from '@capacitor/share';

interface DownloadOptions {
  url: string;
  fileName: string;
  /** Optional: if Supabase auth is needed, provide the blob fallback */
  blobFallback?: Blob;
}

/**
 * Native download — downloads file to device cache via @capacitor/file-transfer,
 * then opens native share/save sheet.
 * 
 * Falls back to blob+writeFile if FileTransfer fails (e.g. auth-protected URLs).
 * Returns true if successful.
 */
export async function downloadFileNative(options: DownloadOptions): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false; // web'de kullanılmaz
  }

  const { fileName, blobFallback } = options;
  let fileUri: string;

  try {
    // Hedef path: Cache directory (temizlenebilir, kalıcılık gerekmez)
    const targetPath = `downloads/${Date.now()}_${fileName}`;

    // Önce FileTransfer ile dene (daha verimli, native HTTP)
    if (!blobFallback) {
      try {
        const result = await FileTransfer.download({
          url: options.url,
          path: targetPath,
          directory: Directory.Cache,
        });
        fileUri = result.path;
      } catch (transferError) {
        console.warn('FileTransfer failed, will use blob fallback:', transferError);
        // FileTransfer başarısız oldu — blob ile devam et
        throw transferError;
      }
    } else {
      throw new Error('Use blob fallback');
    }

    // Share sheet ile kullanıcıya sun
    await Share.share({
      title: fileName,
      url: fileUri,
    });

    return true;
  } catch {
    // Fallback: blob → base64 → Filesystem.writeFile
    if (blobFallback) {
      try {
        const base64 = await blobToBase64(blobFallback);
        const targetPath = `downloads/${Date.now()}_${fileName}`;

        const writeResult = await Filesystem.writeFile({
          path: targetPath,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: fileName,
          url: writeResult.uri,
        });

        return true;
      } catch (fallbackError) {
        console.error('Blob fallback download failed:', fallbackError);
        return false;
      }
    }
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove "data:...;base64," prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
