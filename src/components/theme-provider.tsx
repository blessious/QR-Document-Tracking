import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

export interface ThemeTransitionOrigin {
  x: number;
  y: number;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme, origin?: ThemeTransitionOrigin) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "lgu-doctrack-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Keep the first client render identical to the SSR fallback. The saved or
  // system theme is applied immediately after hydration to avoid a mismatch.
  const [theme, setThemeState] = useState<Theme>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initialTheme = getInitialTheme();
    applyTheme(initialTheme);
    setThemeState(initialTheme);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) applyTheme(theme);
  }, [hydrated, theme]);

  const setTheme = useCallback(
    (next: Theme, origin?: ThemeTransitionOrigin) => {
      if (next === theme) return;

      const root = document.documentElement;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.localStorage.setItem(STORAGE_KEY, next);

      const transitionDocument = document as Document & {
        startViewTransition?: (update: () => void) => { finished: Promise<void> };
      };

      if (origin && transitionDocument.startViewTransition && !reducedMotion) {
        root.style.setProperty("--theme-x", `${origin.x}px`);
        root.style.setProperty("--theme-y", `${origin.y}px`);
        const transition = transitionDocument.startViewTransition(() => {
          applyTheme(next);
          setThemeState(next);
        });
        const clearOrigin = () => {
          root.style.removeProperty("--theme-x");
          root.style.removeProperty("--theme-y");
        };
        void transition.finished.then(clearOrigin, clearOrigin);
        return;
      }

      root.classList.add("theme-transition");
      applyTheme(next);
      setThemeState(next);
      window.setTimeout(() => root.classList.remove("theme-transition"), reducedMotion ? 120 : 360);
    },
    [theme],
  );

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
