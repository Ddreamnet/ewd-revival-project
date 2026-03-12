import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface DownloadOptions {
  url: string;
  fileName: string;
  /** If Supabase auth is needed, provide the blob directly */
  blob?: Blob;
}

/**
 * Native download — writes file to device cache via Filesystem,
 * then opens native share/save sheet via Share plugin.
 * 
 * Two modes:
 * 1. blob provided → base64 encode → Filesystem.writeFile
 * 2. url only → fetch → blob → same flow
 * 
 * Returns true if successful.
 */
export async function downloadFileNative(options: DownloadOptions): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false; // web'de kullanılmaz
  }

  const { url, fileName } = options;

  try {
    // Get blob — either provided or fetch from URL
    let blob = options.blob;
    if (!blob) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      blob = await response.blob();
    }

    // Blob → base64
    const base64 = await blobToBase64(blob);

    // Ensure downloads directory exists
    try {
      await Filesystem.mkdir({
        path: 'downloads',
        directory: Directory.Cache,
        recursive: true,
      });
    } catch (e: any) {
      // Directory already exists — ignore
      if (!e?.message?.includes('exist')) {
        console.warn('mkdir warning:', e);
      }
    }

    // Write to cache directory
    const targetPath = `downloads/${Date.now()}_${fileName}`;
    const writeResult = await Filesystem.writeFile({
      path: targetPath,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    // Open native share/save sheet
    await Share.share({
      title: fileName,
      url: writeResult.uri,
    });

    return true;
  } catch (error) {
    console.error('Native download failed:', error);
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
