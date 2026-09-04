import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelShellProps {
  children: ReactNode;
  /** Alt sekme çubuğu varsa içerik altına onun yüksekliği kadar pay bırakılır. */
  hasTabBar?: boolean;
  className?: string;
}

/**
 * Panel sayfa kabuğu — krem zemin, tam yükseklik, alt sekme çubuğu payı.
 * Üç panel (öğretmen / öğrenci / admin) de bunun içinde yaşar.
 */
export function PanelShell({ children, hasTabBar = false, className }: PanelShellProps) {
  return (
    <div className={cn("pnl", hasTabBar && "pnl--tabbar", className)}>
      {children}
      {hasTabBar && <div aria-hidden="true" style={{ height: "var(--pnl-tabbar-h)" }} />}
    </div>
  );
}
