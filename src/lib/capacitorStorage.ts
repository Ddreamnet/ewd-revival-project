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

// ── Login prefill ───────────────────────────────────────────────────────
// Only the e-mail is remembered. Earlier builds also persisted the password in
// plaintext (Preferences on native, localStorage on web) purely to prefill the
// form — which meant anyone with the device, a device backup, or a foothold in
// the page could read the actual password rather than a revocable session
// token. Supabase already persists the session, so the password bought nothing.
const CRED_EMAIL_KEY = 'app-cred-email';
const LEGACY_PASSWORD_KEY = 'app-cred-password';

export async function saveLastEmail(email: string): Promise<void> {
  try {
    if (isNative) {
      await Preferences.set({ key: CRED_EMAIL_KEY, value: email });
    } else {
      localStorage.setItem(CRED_EMAIL_KEY, email);
    }
  } catch {
    // Prefill is a convenience — never block sign-in on a storage failure.
  }
}

export async function loadLastEmail(): Promise<string> {
  try {
    if (isNative) {
      const { value } = await Preferences.get({ key: CRED_EMAIL_KEY });
      return value || '';
    }
    return localStorage.getItem(CRED_EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Deletes the plaintext password left behind by older installs.
 * Runs once at startup so upgrading devices stop carrying the credential.
 */
export async function purgeLegacyStoredPassword(): Promise<void> {
  try {
    if (isNative) {
      await Preferences.remove({ key: LEGACY_PASSWORD_KEY });
    } else {
      localStorage.removeItem(LEGACY_PASSWORD_KEY);
    }
  } catch {
    // Best effort.
  }
}

// ── Supabase session storage cleanup ────────────────────────────────────
export async function clearSupabaseStorage(): Promise<void> {
  if (isNative) {
    // Derived from the configured project ref rather than hardcoded, so this
    // keeps working if the Supabase project is ever migrated.
    const projectRef =
      import.meta.env.VITE_SUPABASE_PROJECT_ID || 'hwwpbtcgppzuscbvjkde';
    const { keys } = await Preferences.keys();
    const supabaseKeys = keys.filter((k) => k.startsWith('sb-') || k.includes('supabase'));
    const toRemove = supabaseKeys.length > 0 ? supabaseKeys : [`sb-${projectRef}-auth-token`];
    await Promise.all(toRemove.map((key) => Preferences.remove({ key })));
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
