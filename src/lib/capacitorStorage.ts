import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Custom storage adapter for Supabase Auth.
 * Uses @capacitor/preferences on native platforms (Android/iOS)
 * and falls back to localStorage on web.
 */
const isNative = Capacitor.isNativePlatform();

export const capacitorStorage = isNative
  ? {
      getItem: async (key: string): Promise<string | null> => {
        const { value } = await Preferences.get({ key });
        return value;
      },
      setItem: async (key: string, value: string): Promise<void> => {
        await Preferences.set({ key, value });
      },
      removeItem: async (key: string): Promise<void> => {
        await Preferences.remove({ key });
      },
    }
  : {
      // Web fallback – localStorage (synchronous but wrapped as async for the interface)
      getItem: async (key: string): Promise<string | null> => {
        return localStorage.getItem(key);
      },
      setItem: async (key: string, value: string): Promise<void> => {
        localStorage.setItem(key, value);
      },
      removeItem: async (key: string): Promise<void> => {
        localStorage.removeItem(key);
      },
    };

/**
 * Helper to clear all Supabase auth keys from the active storage.
 */
export async function clearSupabaseStorage(): Promise<void> {
  if (isNative) {
    // On native, Preferences doesn't expose "list all keys",
    // so we clear the known Supabase key pattern.
    const knownKey = `sb-hwwpbtcgppzuscbvjkde-auth-token`;
    await Preferences.remove({ key: knownKey });
  } else {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}
