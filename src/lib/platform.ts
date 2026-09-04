/**
 * Tek platform bayrağı.
 *
 * Handoff kuralı: iOS ve Android için ayrı ekran/bileşen yazılmaz. Farklar
 * yalnızca (a) CSS `env(safe-area-inset-*)` ve (b) burada üretilen tek bir
 * bayrak üzerinden çözülür. Bu yüzden `Capacitor.getPlatform()` uygulamanın
 * geri kalanında doğrudan çağrılmaz.
 */
import { Capacitor } from "@capacitor/core";

export type PlatformName = "web" | "ios" | "android";

export const platform: PlatformName = Capacitor.isNativePlatform()
  ? (Capacitor.getPlatform() as "ios" | "android")
  : "web";

export const isNative = platform !== "web";
export const isIOS = platform === "ios";
export const isAndroid = platform === "android";
