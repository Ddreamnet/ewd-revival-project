import type { ReactNode } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  /** Dosya kartın üstünde sürükleniyor — bkz. `useFileDrop`. */
  dragging: boolean;
  onPick: () => void;
  disabled?: boolean;
  pickLabel?: string;
  /** Seçilmiş dosyalar; verilirse düğmenin altında çizilir. */
  children?: ReactNode;
}

/**
 * Kaynak ve ödev yükleme diyaloglarının ortak bırakma alanı.
 *
 * Bırakma hedefi bu kutu değil, diyaloğun tamamı (`useFileDrop` karta
 * bağlanır); kutu yalnızca "buraya bırakabilirsin"i gösterir. Sürükleme
 * ipucu telefonda yazılmaz — orada sürüklenecek bir şey yok.
 */
export function FileDropZone({
  dragging,
  onPick,
  disabled,
  pickLabel = "Dosya Seç",
  children,
}: FileDropZoneProps) {
  return (
    <div
      className={cn(
        "box-border flex w-full max-w-full flex-col gap-2 rounded-lg border-2 border-dashed p-3 transition-colors md:p-4",
        dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
      )}
    >
      <div className="flex items-center gap-3">
        <p className="hidden min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground md:flex">
          <Upload className="h-4 w-4 shrink-0" aria-hidden />
          {dragging ? "Bırakın, eklensin" : "Dosyayı buraya sürükleyip bırakın"}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onPick}
          disabled={disabled}
          className="w-full md:w-auto"
        >
          {pickLabel}
        </Button>
      </div>
      {children}
    </div>
  );
}
