/**
 * Dialog — artık ortada açılan bir pencere değil, tek örtü yüzeyi (sheet).
 *
 * Adlar korundu (`Dialog`, `DialogContent`, `DialogHeader`, …): çağrı yerleri
 * eskisi gibi yazılır, yüzey masaüstünde sağ çekmeceye, telefonda alttan
 * çıkan sürüklenebilir karta döner. Davranış `ui/sheet-core.tsx`, biçim
 * `styles/sheet.css` içinde.
 */
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useAnimatedHeight,
  useDragToDismiss,
  useIsNarrow,
  useKeyboardInset,
  useMountedRef,
  useSheetStack,
} from "@/components/ui/sheet-core";

/**
 * Masaüstünde çekmece genişliği / telefonda kart yüksekliği.
 *  sm   → 400px / içeriği kadar   (kısa bir soru, birkaç alanlı form)
 *  md   → 480px / içeriği kadar   (formların çoğu)              ← varsayılan
 *  lg   → 640px / 92dvh           (liste, düzenleyici)
 *  full → min(1080px, 92vw) / 94dvh (görüntüleyici, haftalık program)
 */
export type DialogSize = "sm" | "md" | "lg" | "full";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn("ewd-sheet-scrim", className)} {...props} />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: DialogSize;
  /** İçerikle birlikte büyüyüp küçülsün, zıplamasın (yalnızca telefonda). */
  animateHeight?: boolean;
  /**
   * Kart kabuğunu tümden atla: kendi geometrisini kuran tam ekran
   * görüntüleyici gibi tek tük yer için. Sürükleme, tutamak, kaydırma
   * gövdesi — hiçbiri kurulmaz.
   */
  bare?: boolean;
}

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  (
    { className, children, size = "md", animateHeight, bare, onPointerDownOutside, onOpenAutoFocus, ...props },
    forwardedRef,
  ) => {
    const [ref, setRef, mounted] = useMountedRef<HTMLDivElement>();
    const overlayRef = React.useRef<HTMLDivElement>(null);
    // Radix `open`ı kendi tutar ve buyurgan bir kapatma sunmaz — ama bir
    // Close DÜĞMESİ sunar. Gizli bir tanesine tıklamak, sürüklemenin (ve
    // Android geri tuşunun) kartı kapatma yolu.
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const dismiss = React.useCallback(() => closeRef.current?.click(), []);
    const narrow = useIsNarrow();

    useDragToDismiss(ref, dismiss, { open: mounted, scrim: overlayRef, disabled: bare, narrow });
    useAnimatedHeight(ref, !!animateHeight && mounted && !bare);
    useKeyboardInset(mounted && !bare);
    useSheetStack(mounted, dismiss);

    const setRefs = React.useCallback(
      (el: HTMLDivElement | null) => {
        setRef(el);
        if (typeof forwardedRef === "function") forwardedRef(el);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      },
      [setRef, forwardedRef],
    );

    return (
      <DialogPortal>
        <DialogOverlay ref={overlayRef} data-bare={bare ? "" : undefined} />
        <DialogPrimitive.Content
          ref={setRefs}
          data-size={size}
          data-animate-height={animateHeight ? "" : undefined}
          tabIndex={-1}
          className={cn(bare ? "ewd-sheet-bare" : "ewd-sheet", className)}
          onOpenAutoFocus={(e) => {
            onOpenAutoFocus?.(e);
            if (e.defaultPrevented || !narrow) return;
            // Telefonda kart açılır açılmaz klavye fırlıyordu: Radix ilk
            // odaklanabilir öğeye odaklanır, bir form kartında bu ilk alan.
            // Klavye ekranın yarısını kaplayıp kartı ittiği için kullanıcı
            // daha neye baktığını görmeden yazmaya çağrılmış oluyordu.
            // Odak kartın kendisine gider: tuzak içeride kalır, Escape ve
            // ekran okuyucu çalışır, klavye ise ancak bir alana DOKUNULUNCA
            // açılır. Masaüstünde ilk alana odaklanmak doğru davranış, orada
            // dokunulmuyor.
            e.preventDefault();
            ref.current?.focus({ preventScroll: true });
          }}
          onPointerDownOutside={(e) => {
            onPointerDownOutside?.(e);
            // Telefonda perde bir sürükleme yüzeyi (bkz. useDragToDismiss):
            // parmağın çekecek mi yoksa yalnızca dokunacak mı olduğu
            // bilinmeden, pointerdown'da kart kapanmamalı. Fareyle dışarı
            // tıklamak yine anında kapatır.
            if (!bare && !e.defaultPrevented && narrow && (e.detail.originalEvent as PointerEvent).pointerType === "touch")
              e.preventDefault();
          }}
          {...props}
        >
          {bare ? (
            children
          ) : (
            <>
              <DialogPrimitive.Close asChild>
                <button ref={closeRef} type="button" hidden tabIndex={-1} aria-hidden />
              </DialogPrimitive.Close>

              {/* Tutamak yalnızca dar ekranda çizilir (CSS): "bu aşağı
                  çekilebilir" işareti — kartın tamamı çekilebilse de. */}
              <div className="ewd-sheet-grab" data-sheet-grab>
                <span aria-hidden className="ewd-sheet-grip" />
              </div>

              <div className="ewd-sheet-body">{children}</div>

              {/* İçerikten SONRA basılır, konumu mutlak olduğu için görünürde
                  yine sağ üstte. Önce basıldığında masaüstünde açılış odağı
                  (Radix ilk odaklanabilir öğeyi seçer) ilk alan yerine ✕'e
                  gidiyordu; sekme sırası da kapatmayla başlıyordu. */}
              <DialogPrimitive.Close className="ewd-sheet-x" aria-label="Kapat">
                <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
              </DialogPrimitive.Close>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

/** Kartın üstüne yapışan başlık şeridi; gövde altında kayar. */
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-sheet-grab className={cn("ewd-sheet-head", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

/** Kartın altına yapışan eylem şeridi. */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("ewd-sheet-foot", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("ewd-sheet-title", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("ewd-sheet-desc", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
