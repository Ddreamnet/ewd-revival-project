import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Zoom kamera işareti.
 * Lucide'da marka ikonu yok; butonun üstünde tanınsın diye Zoom'un
 * kamera gövdesi + objektif kaması biçimi doğrudan çiziliyor.
 */
export function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn("h-5 w-5 shrink-0", className)}
    >
      <path d="M3.4 7.7c0-1.2.98-2.2 2.2-2.2h7.2c1.22 0 2.2 1 2.2 2.2v8.6c0 1.2-.98 2.2-2.2 2.2H5.6c-1.22 0-2.2-1-2.2-2.2V7.7Z" />
      <path d="M16.75 10.2 20 7.85c.46-.33 1.1-.01 1.1.56v7.18c0 .57-.64.89-1.1.56l-3.25-2.35a.7.7 0 0 1-.29-.56v-2.48c0-.22.11-.43.29-.56Z" />
    </svg>
  );
}

interface ZoomButtonProps {
  href: string;
  /** Tam genişlik (mobil / birincil eylem). */
  block?: boolean;
  /** Dar yerlerde küçük varyant (ders listesi satırı). */
  compact?: boolean;
  className?: string;
  /** Dar ekranda kısaltılabilsin diye düğüm kabul eder. */
  label?: ReactNode;
}

/**
 * Zoom'a bağlanma düğmesi — Zoom'un kendi mavisiyle, marka işaretiyle.
 * Derse girmek panelin tek birincil eylemi olduğu için her yerde aynı
 * görünür: öğretmenin sıradaki ders bandında, öğrencinin bugün ekranında
 * ve ders listesinde.
 */
export function ZoomButton({
  href,
  block = false,
  compact = false,
  className,
  label = "Zoom'a Bağlan",
}: ZoomButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("pnl-btn pnl-btn--zoom", block && "pnl-btn--block", compact && "pnl-btn--zoom-sm", className)}
    >
      <ZoomIcon className={compact ? "h-4 w-4" : undefined} />
      {label}
    </a>
  );
}
