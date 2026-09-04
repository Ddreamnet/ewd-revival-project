/**
 * Panelin son durumunu yerel olarak saklayan küçük stale-while-revalidate
 * önbelleği.
 *
 * Neden: uygulama açılışında (özellikle zayıf bağlantıda) kullanıcı boş ekrana
 * ya da spinner'a bakmasın. Son çizilen veri anında geri yüklenir, tazeleme
 * arkada çalışır.
 *
 * Depolama:
 *  - Web'de `localStorage` — senkron okunur, ilk render'da hazır.
 *  - Native'de `@capacitor/preferences` — asenkron; modül yüklenirken okuma
 *    başlatılır, React ilk kareyi çizene kadar çoğunlukla tamamlanır. Ayrıca
 *    yazılan her değer bellekte de tutulur, ikinci okuma senkron olur.
 *
 * Önbellek yalnızca görüntüleme içindir: doğruluk kaynağı her zaman ağdan
 * gelen yanıttır ve gelir gelmez üstüne yazar.
 */
import { isNative } from "./platform";

const PREFIX = "ewd-panel-cache:";
/** Bundan eski kayıtlar çizilmez — bayat veriyi taze sanmayalım. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Envelope<T> {
  v: number;
  t: number;
  d: T;
}

const memory = new Map<string, unknown>();
let hydrated = !isNative;

/** Native'de tüm önbellek anahtarlarını belleğe çeker. Modül yüklenirken başlar. */
const hydration: Promise<void> = (async () => {
  if (!isNative) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { keys } = await Preferences.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith(PREFIX))
        .map(async (k) => {
          const { value } = await Preferences.get({ key: k });
          if (value) memory.set(k, value);
        }),
    );
  } catch {
    // Önbellek bir kolaylık — okunamazsa panel ağdan çizer.
  } finally {
    hydrated = true;
  }
})();

/** Native açılışta önbelleğin belleğe alınmasını bekler. Web'de anında döner. */
export function whenCacheReady(): Promise<void> {
  return hydrated ? Promise.resolve() : hydration;
}

function readRaw(key: string): string | null {
  const full = PREFIX + key;
  const cached = memory.get(full);
  if (typeof cached === "string") return cached;
  if (!isNative) {
    try {
      return localStorage.getItem(full);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Önbellekten okur. `version` değiştiğinde eski kayıtlar yok sayılır, böylece
 * veri şekli değişince bozuk çizim olmaz.
 */
export function readCache<T>(key: string, version = 1): T | null {
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Envelope<T>;
    if (env.v !== version) return null;
    if (Date.now() - env.t > MAX_AGE_MS) return null;
    return env.d;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T, version = 1): void {
  const full = PREFIX + key;
  let raw: string;
  try {
    raw = JSON.stringify({ v: version, t: Date.now(), d: data } satisfies Envelope<T>);
  } catch {
    return;
  }
  memory.set(full, raw);
  if (isNative) {
    import("@capacitor/preferences")
      .then(({ Preferences }) => Preferences.set({ key: full, value: raw }))
      .catch(() => {});
  } else {
    try {
      localStorage.setItem(full, raw);
    } catch {
      // Kota dolabilir — önbellek kaybı sorun değil.
    }
  }
}

/** Çıkışta çağrılır: başka bir kullanıcı aynı cihazda oturum açarsa bayat veri görünmesin. */
export async function clearPanelCache(): Promise<void> {
  const stale = [...memory.keys()];
  memory.clear();
  if (isNative) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const { keys } = await Preferences.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(PREFIX)).map((key) => Preferences.remove({ key })),
      );
    } catch {
      // yut
    }
    return;
  }
  try {
    const toRemove = new Set(stale);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) toRemove.add(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // yut
  }
}
