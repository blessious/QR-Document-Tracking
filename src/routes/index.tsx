import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { ROLE_HOME } from "@/lib/permissions";
import { useApp } from "@/store/app-store";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — LGU QR Document Tracking System" },
      {
        name: "description",
        content:
          "Secure sign-in for the local government unit QR-based document tracking system. Route, receive and monitor documents across offices.",
      },
      { property: "og:title", content: "Sign in — LGU QR Document Tracking System" },
      {
        property: "og:description",
        content: "Secure sign-in for the LGU QR-based document tracking and routing system.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

export function LoginPage() {
  const { login } = useApp();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Enter both your username and password.");
      return;
    }
    try {
      const user = await login(username, password);
      const shouldOpenScanner =
        isMobile ||
        (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
      navigate({ to: shouldOpenScanner ? "/scanner" : ROLE_HOME[user.role] });
    } catch {
      setError("Invalid username or password.");
    }
  };

  return (
    <div className="relative grid min-h-screen min-h-[100svh] place-items-center overflow-hidden bg-background p-4 text-foreground sm:p-6">
      <img
        src="/login-qr-tracking-illustration.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.16] blur-[1px]"
      />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px]" />

      <div className="absolute top-[calc(1.25rem+env(safe-area-inset-top))] right-[calc(1.25rem+env(safe-area-inset-right))] z-20">
        <ThemeToggle />
      </div>

      <main className="relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl md:grid md:min-h-[440px] md:grid-cols-[330px_minmax(0,1fr)] lg:min-h-[520px] lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="relative min-h-56 overflow-hidden bg-muted md:hidden">
          <img
            src="/login-qr-tracking-illustration.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[58%_center]"
          />
        </section>

        <section className="relative z-10 flex min-w-0 flex-col justify-center px-6 py-8 sm:px-9 md:px-10">
          <div className="mb-10 flex items-center gap-3">
            <img
              src="/lgu-logo.png"
              alt="Municipality of Boac logo"
              className="size-12 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Municipality of Boac</p>
              <p className="truncate text-xs text-muted-foreground">QR document tracking</p>
            </div>
          </div>

          <div className="mb-7">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">
              <span className="size-1.5 rounded-full bg-primary" />
              Secure workspace
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
            <p className="mt-2 text-sm text-muted-foreground">Welcome to LGU QR Tracking</p>
          </div>

          <form onSubmit={submit} className="space-y-3" noValidate>
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="h-11 rounded-lg border-input bg-background px-4 text-sm shadow-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="password-input h-11 rounded-lg border-input bg-background px-4 pr-11 text-sm shadow-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
            <div className="min-h-5 text-right">
              {error ? (
                <p role="alert" className="mb-1 text-left text-xs text-destructive">
                  {error}
                </p>
              ) : null}
              <Link
                to="/track"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Track document
              </Link>
            </div>
            <Button type="submit" className="h-11 w-full rounded-lg shadow-none">
              Login
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </section>

        <section className="relative hidden overflow-hidden bg-muted md:block">
          <img
            src="/login-qr-tracking-illustration.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[56%_center]"
          />
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="absolute top-6 right-6 z-10 size-10 rounded-md bg-white/26 text-white backdrop-blur hover:bg-white/38 hover:text-white"
            aria-label="Track document"
          >
            <Link to="/track">
              <Search className="size-5" />
            </Link>
          </Button>
        </section>
      </main>
    </div>
  );
}
