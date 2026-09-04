import { Fragment, useMemo } from "react";

/** Regex'te özel anlamı olan karakterleri kaçır. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface HighlightProps {
  text: string;
  /** Aranan ifade; boşsa metin olduğu gibi çizilir. */
  query: string;
}

/**
 * Arama sonucunda eşleşen parçayı sarı ile işaretler.
 *
 * Eşleştirme orijinal metin üzerinde `i` bayraklı regex ile yapılıyor:
 * `toLocaleLowerCase("tr-TR")` "İ" harfini iki kod noktasına çevirip
 * uzunluğu değiştirdiği için indeks hesabı bozuluyordu.
 */
export function Highlight({ text, query }: HighlightProps) {
  const parts = useMemo(() => {
    const needle = query.trim();
    if (!needle || !text) return null;

    const re = new RegExp(escapeRegExp(needle), "gi");
    const out: { value: string; hit: boolean }[] = [];
    let last = 0;

    for (const match of text.matchAll(re)) {
      const start = match.index ?? 0;
      if (start > last) out.push({ value: text.slice(last, start), hit: false });
      out.push({ value: match[0], hit: true });
      last = start + match[0].length;
      // Sıfır uzunluklu eşleşme sonsuz döngü yapmasın.
      if (match[0].length === 0) break;
    }
    if (!out.length) return null;
    if (last < text.length) out.push({ value: text.slice(last), hit: false });
    return out;
  }, [text, query]);

  if (!parts) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.hit ? (
          <mark key={i} className="pnl-mark">
            {part.value}
          </mark>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        ),
      )}
    </>
  );
}
