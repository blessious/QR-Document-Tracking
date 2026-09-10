import { afterEach, describe, expect, it } from "vitest";
import { readSecurityConfig } from "./load-env.js";

const original = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
});

describe("production security configuration", () => {
  it("rejects default secrets", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "replace-me-in-production";
    process.env.CSRF_SECRET = "a-secure-csrf-secret-containing-32-chars";
    process.env.FRONTEND_ORIGIN = "https://doctrack.example";
    process.env.TRUSTED_PROXY = "127.0.0.1";
    expect(() => readSecurityConfig()).toThrow(/JWT_SECRET/);
  });

  it("rejects wildcard credentialed origins", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-secure-jwt-secret-containing-32-chars";
    process.env.CSRF_SECRET = "a-secure-csrf-secret-containing-32-chars";
    process.env.FRONTEND_ORIGIN = "*";
    process.env.TRUSTED_PROXY = "127.0.0.1";
    expect(() => readSecurityConfig()).toThrow(/FRONTEND_ORIGIN/);
  });

  it("requires an explicit frontend origin in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-secure-jwt-secret-containing-32-chars";
    process.env.CSRF_SECRET = "a-secure-csrf-secret-containing-32-chars";
    delete process.env.FRONTEND_ORIGIN;
    process.env.TRUSTED_PROXY = "127.0.0.1";
    expect(() => readSecurityConfig()).toThrow(/FRONTEND_ORIGIN/);
  });
});
