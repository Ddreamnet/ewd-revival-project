/**
 * AlertDialog — "Emin misin?" için aynı örtü yüzeyi.
 *
 * Dialog ile tek fark davranışta: dışarı tıklamak kapatmaz, odak "Vazgeç"e
 * gider ve telefonda kartı aşağı çekmek "Vazgeç" sayılır. Biçim, hareket ve
 * geometri Dialog ile birebir aynı (bkz. ui/sheet-core.tsx, styles/sheet.css).
 */
import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { DialogSize } from "@/components/ui/dialog";
import {
  useAnimatedHeight,
  useDragToDismiss,
  useIsNarrow,
  useKeyboardInset,
  useMountedRef,
  useSheetStack,
} from "@/components/ui/sheet-core";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay ref={ref} className={cn("ewd-sheet-scrim", className)} {...props} />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

interface AlertDialogContentProps extends React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> {
  size?: DialogSize;
  animateHeight?: boolean;
}

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(({ className, children, size = "sm", animateHeight, onOpenAutoFocus, ...props }, forwardedRef) => {
  const [ref, setRef, mounted] = useMountedRef<HTMLDivElement>();
  const overlayRef = React.useRef<HTMLDivElement>(null);
  // Sürükleyerek kapatmak "Vazgeç"tir: gizli bir Cancel düğmesine tıklanır,
  // böylece sahibin `onOpenChange`i ve odak dönüşü normal yolundan işler.
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const dismiss = React.useCallback(() => cancelRef.current?.click(), []);
  const narrow = useIsNarrow();

  useDragToDismiss(ref, dismiss, { open: mounted, scrim: overlayRef, narrow });
  useAnimatedHeight(ref, !!animateHeight && mounted);
  useKeyboardInset(mounted);
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
    <AlertDialogPortal>
      <AlertDialogOverlay ref={overlayRef} />
      <AlertDialogPrimitive.Content
        ref={setRefs}
        data-size={size}
        data-animate-height={animateHeight ? "" : undefined}
        tabIndex={-1}
        className={cn("ewd-sheet", className)}
        onOpenAutoFocus={(e) => {
          onOpenAutoFocus?.(e);
          if (e.defaultPrevented || !narrow) return;
          // Bkz. ui/dialog.tsx — telefonda klavye kendiliğinden açılmasın.
          // Onay kartında zaten yazılacak bir alan yok; odak kartın kendisine
          // gidince "Vazgeç"e basmak da tek dokunuş kalıyor.
          e.preventDefault();
          ref.current?.focus({ preventScroll: true });
        }}
        {...props}
      >
        <AlertDialogPrimitive.Cancel asChild>
          <button ref={cancelRef} type="button" hidden tabIndex={-1} aria-hidden />
        </AlertDialogPrimitive.Cancel>

        <div className="ewd-sheet-grab" data-sheet-grab>
          <span aria-hidden className="ewd-sheet-grip" />
        </div>

        <div className="ewd-sheet-body">{children}</div>
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-sheet-grab className={cn("ewd-sheet-head ewd-sheet-head--plain", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("ewd-sheet-foot", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("ewd-sheet-title", className)} {...props} />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn("ewd-sheet-desc", className)} {...props} />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel ref={ref} className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
