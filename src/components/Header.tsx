import { ReactNode } from "react";
import { Logo } from "./Logo";
import { ContactDialog } from "./ContactDialog";

interface HeaderProps {
  children?: ReactNode;
  rightActions?: ReactNode;
}

export function Header({ children, rightActions }: HeaderProps) {
  return (
    <div className="border-b bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="lg" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-semibold text-foreground">English with Dilara</h1>
            </div>
          </div>

          <div className="flex-1 flex justify-center">{children}</div>

          <div className="flex items-center gap-3">
            {rightActions}
            <ContactDialog />
          </div>
        </div>
      </div>
    </div>
  );
}
