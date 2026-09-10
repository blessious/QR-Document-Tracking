import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const env = readFileSync(envPath, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

export function assertDatabaseUrl() {
  if (!process.env["DATABASE_URL"]) {
    throw new Error(
      "DATABASE_URL is missing. Copy .env.example to .env and set it to your MySQL connection string.",
    );
  }
}

const unsafeSecrets = new Set([
  "replace-me-in-production",
  "replace-with-a-long-random-secret",
  "demo1234",
]);

export type SecurityConfig = ReturnType<typeof readSecurityConfig>;

export function readSecurityConfig() {
  const production = process.env.NODE_ENV === "production";
  if (production && !process.env.FRONTEND_ORIGIN?.trim())
    throw new Error("FRONTEND_ORIGIN is required in production.");
  const jwtSecret = process.env.JWT_SECRET ?? (production ? "" : "test-or-development-jwt-secret-32-bytes");
  const csrfSecret = process.env.CSRF_SECRET ?? (production ? "" : "test-or-development-csrf-secret-32-bytes");
  const origins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const trustedProxies = (process.env.TRUSTED_PROXY ?? (production ? "" : "127.0.0.1,::1"))
    .split(",").map((value) => value.trim()).filter(Boolean);

  for (const [name, value] of [["JWT_SECRET", jwtSecret], ["CSRF_SECRET", csrfSecret]] as const) {
    if (value.length < 32 || unsafeSecrets.has(value)) throw new Error(`${name} must contain at least 32 characters and must not use a default value.`);
  }
  if (!origins.length || origins.some((origin) => origin === "*" || !/^https?:\/\/[^/]+$/.test(origin)))
    throw new Error("FRONTEND_ORIGIN must contain exact HTTP(S) origins; wildcards and paths are not allowed.");
  if (production && !trustedProxies.length) throw new Error("TRUSTED_PROXY is required in production.");

  const positiveInteger = (name: string, fallback: number) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
    return value;
  };
  return {
    production, jwtSecret, csrfSecret, origins, trustedProxies,
    loginIpLimit: positiveInteger("LOGIN_IP_LIMIT", 20),
    loginAccountLimit: positiveInteger("LOGIN_ACCOUNT_LIMIT", 5),
    loginWindowMinutes: positiveInteger("LOGIN_WINDOW_MINUTES", 15),
    publicTrackIpLimit: positiveInteger("PUBLIC_TRACK_IP_LIMIT", 60),
  };
}
