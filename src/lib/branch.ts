/**
 * Dil şubeleri — İngilizce ve Fransızca paralel panel sistemleri.
 *
 * Şube bilgisi veritabanında tek yerde durur: `profiles.language`. Öğretmeni
 * admin oluştururken seçer, öğrenci öğretmeninden devralır (DB trigger'ı).
 * Admin iki şubeyi de görür ve panel başlığındaki anahtarla aralarında geçer;
 * öğretmen ve öğrenci yalnızca kendi şubesini görür.
 *
 * Landing sayfası bu ayrımdan habersizdir — dışarıya henüz Fransızca
 * duyurulmuyor, sistem yalnızca panel tarafında hazır bekliyor.
 */
import type { Database } from "@/integrations/supabase/types";

export type Branch = Database["public"]["Enums"]["app_language"];

export const BRANCHES: readonly { code: Branch; label: string; short: string }[] = [
  { code: "en", label: "İngilizce", short: "EN" },
  { code: "fr", label: "Fransızca", short: "FR" },
] as const;

export const DEFAULT_BRANCH: Branch = "en";

export function isBranch(value: unknown): value is Branch {
  return value === "en" || value === "fr";
}

/** Şubenin Türkçe adı — "İngilizce" / "Fransızca". */
export function branchLabel(code: Branch): string {
  return BRANCHES.find((b) => b.code === code)?.label ?? code;
}

/** Kısa kod — dar alanlarda "EN" / "FR". */
export function branchShort(code: Branch): string {
  return BRANCHES.find((b) => b.code === code)?.short ?? code.toUpperCase();
}

const STORAGE_KEY = "ewd-admin-branch";

/** Adminin en son baktığı şube; yoksa İngilizce. */
export function readStoredBranch(): Branch {
  if (typeof window === "undefined") return DEFAULT_BRANCH;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isBranch(stored)) return stored;
  } catch {
    // Özel sekme / kapalı depolama — varsayılana düş.
  }
  return DEFAULT_BRANCH;
}

export function storeBranch(branch: Branch): void {
  try {
    localStorage.setItem(STORAGE_KEY, branch);
  } catch {
    // Depolama kapalıysa seçim yalnızca bu oturum boyunca geçerli olur.
  }
}
