import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

// In-memory theme state (no localStorage in sandboxed iframe)
let currentTheme: "light" | "dark" = "dark";
const listeners = new Set<() => void>();

function setTheme(theme: "light" | "dark") {
  currentTheme = theme;
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  listeners.forEach(l => l());
}

function getTheme(): "light" | "dark" {
  return currentTheme;
}

export function ThemeToggle({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const [theme, setLocal] = useState(getTheme);

  useEffect(() => {
    const update = () => setLocal(getTheme());
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  return (
    <Button
      variant={variant}
      size="icon"
      className="size-8 shrink-0"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      data-testid="btn-theme-toggle"
      title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {theme === "dark" ? (
        <Sun className="size-4 text-amber-400" />
      ) : (
        <Moon className="size-4 text-primary" />
      )}
    </Button>
  );
}
