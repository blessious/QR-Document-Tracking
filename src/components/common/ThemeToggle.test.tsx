// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
    Reflect.deleteProperty(document, "startViewTransition");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.className = "";
    Reflect.deleteProperty(document, "startViewTransition");
  });

  it("uses the system preference only for first visit, then persists an explicit mode", () => {
    window.localStorage.setItem("lgu-doctrack-theme", "system");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = screen.getByRole("button", { name: "Switch to light mode" });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.queryByText("System")).toBeNull();

    fireEvent.click(toggle);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("lgu-doctrack-theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeTruthy();
  });

  it("starts a supported page wipe from the toggle center", () => {
    window.localStorage.setItem("lgu-doctrack-theme", "light");
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
    Object.defineProperty(toggle, "getBoundingClientRect", {
      value: () => ({ left: 100, top: 40, width: 32, height: 32 }),
    });
    fireEvent.click(toggle);

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--theme-x")).toBe("116px");
    expect(document.documentElement.style.getPropertyValue("--theme-y")).toBe("56px");
  });
});
