import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleButtonProps {
  className?: string;
  variant?: "landing" | "panel";
}

export function ThemeToggleButton({ className, variant = "panel" }: ThemeToggleButtonProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (variant === "landing") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        className={cn(
          "rounded-full bg-landing-purple/10 text-landing-purple-dark",
          "hover:bg-landing-purple/20 hover:scale-110",
          "hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]",
          "transition-all duration-300",
          className
        )}
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} className={cn("rounded-full", className)}>
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
