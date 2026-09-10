import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${nextTheme} mode`}
      className="relative overflow-hidden rounded-lg"
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        setTheme(nextTheme, {
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        });
      }}
    >
      <Sun
        aria-hidden="true"
        className={cn(
          "absolute size-4.5 transition-all duration-300 ease-out",
          theme === "dark"
            ? "translate-y-5 rotate-90 opacity-0"
            : "translate-y-0 rotate-0 opacity-100",
        )}
      />
      <Moon
        aria-hidden="true"
        className={cn(
          "absolute size-4.5 transition-all duration-300 ease-out",
          theme === "dark"
            ? "translate-y-0 rotate-0 opacity-100"
            : "-translate-y-5 -rotate-90 opacity-0",
        )}
      />
      <span className="sr-only">Switch to {nextTheme} mode</span>
    </Button>
  );
}
