import { ReactNode } from "react";
import { Logo } from "./Logo";

interface HeaderProps {
  children?: ReactNode;
  rightActions?: ReactNode;
}

export function Header({ children, rightActions }: HeaderProps) {
  return (
    <div className="border-b bg-card/50 dark:bg-card/70 backdrop-blur-sm">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Logo size="lg" />
            <div className="hidden sm:block">
              <h1 className="text-lg sm:text-xl font-semibold text-foreground">English with Dilara</h1>
            </div>
          </div>

          <div className="flex-1 flex justify-center min-w-0 px-2">
            <div className="hidden md:block">{children}</div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end flex-shrink-0">
            {rightActions}
          </div>
        </div>
      </div>
    </div>
  );
}
