import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { loadLocalEnv } from "./load-env.js";

// Every run uses a newly created database. Never migrate, seed, or clear the app database.
loadLocalEnv();
const sourceUrl = process.env.DATABASE_URL;
const testName = `doctrack_test_${randomUUID().replaceAll("-", "")}`;
let control: PrismaClient;
let db: PrismaClient;
let app: (typeof import("./index.js"))["app"];
const cookie = (id: string) =>
  `session=${jwt.sign({ id }, process.env.JWT_SECRET ?? "replace-me-in-production")}`;
async function call(method: "GET" | "POST" | "PATCH", url: string, user = "a", payload?: unknown) {
  const session = jwt.sign({ id: user }, process.env.JWT_SECRET ?? "test-or-development-jwt-secret-32-bytes");
  const csrf = createHmac("sha256", process.env.CSRF_SECRET ?? "test-or-development-csrf-secret-32-bytes")
    .update(session).digest("base64url");
  return app.inject({
    method,
    url,
    headers: { cookie: `session=${session}`, ...(method === "GET" ? {} : { "x-csrf-token": csrf }) },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
}
async function register() {
  const response = await call("POST", "/api/documents", "a", {
    title: "Lifecycle test",
    subject: "Physical routing",
    typeId: "type",
    priority: "routine",
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}

beforeAll(async () => {
  if (!sourceUrl) throw new Error("DATABASE_URL is required for isolated MySQL integration tests.");
  control = new PrismaClient({ datasourceUrl: sourceUrl });
  await control.$executeRawUnsafe(`CREATE DATABASE \`${testName}\``);
  const url = new URL(sourceUrl);
  url.pathname = `/${testName}`;
  process.env.DATABASE_URL = url.toString();
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"],
    { env: process.env, stdio: "pipe" },
  );
  const server = await import("./index.js");
  app = server.app;
  db = server.database;
  await app.ready();
  await db.office.createMany({
    data: ["a", "b", "c", "x", "y", "z"].map((id) => ({
      id,
      code: id,
      name: `Office ${id}`,
      location: "Main",
      keywords: "",
      active: id !== "z",
    })),
  });
  await db.user.createMany({
    data: ["a", "b", "c", "x", "y", "admin", "receiver"].map((id) => ({
      id,
      username: id,
      name: id,
      officeId: id === "admin" ? "a" : id === "receiver" ? "b" : id,
      role: id === "admin" ? "admin" : id === "receiver" ? "receiving" : "staff",
      position: "Staff",
      passwordHash: "unused",
      avatarInitials: id,
    })),
  });
  await db.documentType.createMany({
    data: [
      { id: "type", code: "TEST", name: "Test", officeId: "a" },
      { id: "type-x", code: "TEST", name: "Test", officeId: "x" },
    ],
  });
}, 60000);

afterAll(async () => {
  await app?.close();
  await db?.$disconnect();
  if (control && /^doctrack_test_[a-f0-9]{32}$/.test(testName)) {
    await control.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${testName}\``);
    await control.$disconnect();
  }
  if (sourceUrl) process.env.DATABASE_URL = sourceUrl;
}, 60000);

describe("persisted document lifecycle", () => {
  it("requires CSRF protection for authenticated mutations", async () => {
    const session = jwt.sign({ id: "a" }, process.env.JWT_SECRET ?? "test-or-development-jwt-secret-32-bytes");
    const missing = await app.inject({
      method: "POST", url: "/api/documents", headers: { cookie: `session=${session}` },
      payload: { title: "Blocked request", typeId: "type", priority: "routine" },
    });
    expect(missing.statusCode).toBe(403);

    const csrf = createHmac("sha256", process.env.CSRF_SECRET ?? "test-or-development-csrf-secret-32-bytes")
      .update(session).digest("base64url");
    const hostile = await app.inject({
      method: "POST", url: "/api/documents",
      headers: { cookie: `session=${session}`, "x-csrf-token": csrf, origin: "https://evil.example" },
      payload: { title: "Blocked origin", typeId: "type", priority: "routine" },
    });
    expect(hostile.statusCode).toBe(403);
  });

  it("exposes only minimal public tracking data through random tokens", async () => {
    const doc = await register();
    expect(doc.publicTrackingToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const byCode = await app.inject({ method: "GET", url: `/api/public/track?token=${doc.trackingCode}` });
    expect(byCode.statusCode).toBe(404);
    const tracked = await app.inject({ method: "GET", url: `/api/public/track?token=${doc.publicTrackingToken}` });
    expect(tracked.statusCode, tracked.body).toBe(200);
    expect(tracked.json()).toEqual({
      trackingReference: doc.trackingCode,
      status: "active",
      updatedAt: doc.updatedAt,
    });
  });

  it("keeps document type lists local to each office", async () => {
    expect((await call("GET", "/api/document-types", "b")).json()).toEqual([]);

    const typeA = await call("POST", "/api/document-types", "a", {
      name: "Job Order Payroll",
    });
    expect(typeA.statusCode, typeA.body).toBe(200);
    expect(typeA.json()).toMatchObject({
      name: "Job Order Payroll",
      code: "JOB-ORDER-PAYROLL",
      officeId: "a",
    });
    expect((await call("GET", "/api/document-types", "b")).json()).toEqual([]);

    const typeB = await call("POST", "/api/document-types", "b", {
      name: "Job Order Payroll",
    });
    expect(typeB.statusCode, typeB.body).toBe(200);
    expect(typeB.json()).toMatchObject({ code: "JOB-ORDER-PAYROLL", officeId: "b" });

    const aTypes = (await call("GET", "/api/document-types", "a")).json();
    expect(aTypes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: typeA.json().id })]),
    );
    expect(aTypes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: typeB.json().id })]),
    );
    expect(
      (
        await call("POST", "/api/documents", "b", {
          title: "Foreign document type",
          typeId: typeA.json().id,
          priority: "routine",
        })
      ).statusCode,
    ).toBe(400);
  });

  it("keeps saved dispatch purposes local to each office", async () => {
    expect((await call("GET", "/api/routing-purposes", "b")).json()).toEqual([]);

    const purposeA = await call("POST", "/api/routing-purposes", "a", {
      name: "For review and approval",
    });
    expect(purposeA.statusCode, purposeA.body).toBe(200);
    expect(purposeA.json()).toMatchObject({
      name: "For review and approval",
      officeId: "a",
    });
    expect((await call("GET", "/api/routing-purposes", "b")).json()).toEqual([]);

    const purposeB = await call("POST", "/api/routing-purposes", "b", {
      name: "For review and approval",
    });
    expect(purposeB.statusCode, purposeB.body).toBe(200);
    expect(purposeB.json()).toMatchObject({ officeId: "b" });
    expect((await call("GET", "/api/routing-purposes", "a")).json()).toEqual([
      expect.objectContaining({ id: purposeA.json().id }),
    ]);
  });

  it("renders a Code 128 barcode in the printable routing slip", async () => {
    const doc = await register();
    const response = await call("GET", `/api/documents/${doc.id}/slip`, "a");
    expect(response.statusCode, response.body).toBe(200);
    expect(response.body).toContain('data-barcode-format="code128"');
    expect(response.body).toContain(`alt="Code 128 barcode for ${doc.trackingCode}"`);
    expect(response.body).toContain("<title></title>");
    expect(response.body).not.toContain(`<title>${doc.trackingCode}</title>`);
    expect(response.body).not.toContain("City Hall Compound, Rizal Street, San Lorenzo");
    expect(response.body).not.toContain("Barcode reserved");

    const encodedBarcode = /src="data:image\/svg\+xml;base64,([^"]+)"/.exec(response.body)?.[1];
    expect(encodedBarcode).toBeDefined();
    const barcodeSvg = Buffer.from(encodedBarcode ?? "", "base64").toString("utf8");
    expect(barcodeSvg).toContain('viewBox="0 0');
    expect(barcodeSvg).toContain("<rect");
  });

  it("rejects invalid registration and lets expired sessions sign out", async () => {
    const invalid = await call("POST", "/api/documents", "a", {
      title: "Bad",
      subject: " ",
      typeId: "type",
      priority: "routine",
    });
    expect(invalid.statusCode).toBe(400);
    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: "session=expired" },
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.headers["set-cookie"]).toBeDefined();
  });
  it("returns the same document for a registration retry", async () => {
    const payload = {
      requestId: randomUUID(),
      title: "Retry test",
      subject: "Retry",
      typeId: "type",
      priority: "routine",
    };
    const first = await call("POST", "/api/documents", "a", payload);
    const second = await call("POST", "/api/documents", "a", payload);
    expect(first.statusCode, first.body).toBe(200);
    expect(second.json().id).toBe(first.json().id);
    expect(second.json().publicTrackingToken).toBeUndefined();
    expect(
      (await app.inject({
        method: "GET",
        url: `/api/public/track?token=${first.json().publicTrackingToken}`,
      })).statusCode,
    ).toBe(200);
    expect(await db.document.count({ where: { title: "Retry test" } })).toBe(1);
  });
  it("lets staff void a mistaken registered document and blocks further routing", async () => {
    const doc = await register();
    const response = await call("POST", `/api/documents/${doc.id}/void`, "a", {
      reason: "Mistaken duplicate registration",
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ id: doc.id, status: "voided" });
    expect(response.json().events.map((event: { action: string }) => event.action)).toEqual([
      "registered",
      "voided",
    ]);
    expect((await call("GET", `/api/scans/resolve?code=${doc.qrCode}`, "a")).json()).toEqual(
      expect.objectContaining({ outcome: "unavailable" }),
    );
    expect(
      (await call("POST", `/api/documents/${doc.id}/dispatch`, "a", { toOfficeId: "b" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await call("POST", `/api/documents/${doc.id}/status`, "a", { status: "in_process" }))
        .statusCode,
    ).toBe(400);
  });
  it("rolls back custody and events when audit persistence fails", async () => {
    const doc = await register();
    const originalTransaction = db.$transaction.bind(db);
    const mock = vi.spyOn(db, "$transaction").mockImplementationOnce(((
      handler: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options: Parameters<typeof db.$transaction>[1],
    ) =>
      originalTransaction(
        async (tx) =>
          handler(
            new Proxy(tx, {
              get(target, property) {
                if (property === "auditEntry")
                  return {
                    ...target.auditEntry,
                    create: async () => {
                      throw new Error("Injected audit failure");
                    },
                  };
                return Reflect.get(target, property);
              },
            }),
          ),
        options,
      )) as typeof db.$transaction);
    try {
      expect(
        (await call("POST", `/api/documents/${doc.id}/dispatch`, "a", { toOfficeId: "b" }))
          .statusCode,
      ).toBe(500);
      expect((await db.document.findUniqueOrThrow({ where: { id: doc.id } })).status).toBe(
        "registered",
      );
      expect(await db.trackingEvent.count({ where: { documentId: doc.id } })).toBe(1);
    } finally {
      mock.mockRestore();
    }
  });
  it("registers, resolves receive then dispatch, completes and archives with one custody event per action", async () => {
    const doc = await register();
    expect(doc.currentOfficeId).toBe("a");
    expect(doc.status).toBe("registered");
    expect((await call("GET", `/api/scans/resolve?code=${doc.qrCode}`)).json().outcome).toBe(
      "dispatch",
    );
    expect(
      (await call("POST", `/api/documents/${doc.id}/dispatch`, "a", { toOfficeId: "b" }))
        .statusCode,
    ).toBe(200);
    expect((await call("GET", `/api/scans/resolve?code=${doc.qrCode}`, "a")).json().outcome).toBe(
      "unavailable",
    );
    expect((await call("GET", `/api/scans/resolve?code=${doc.qrCode}`, "b")).json().outcome).toBe(
      "receive",
    );
    const received = await call("POST", `/api/documents/${doc.id}/receive`, "b", {});
    expect(received.statusCode, received.body).toBe(200);
    expect(received.json()).toMatchObject({ currentOfficeId: "b", status: "received" });
    expect(received.json().nextOfficeId).toBeUndefined();
    expect(
      (await call("POST", `/api/documents/${doc.id}/status`, "a", { status: "on_hold", remarks: "No longer in custody" }))
        .statusCode,
    ).toBe(403);
    expect((await call("GET", `/api/scans/resolve?code=${doc.qrCode}`, "b")).json().outcome).toBe(
      "dispatch",
    );
    expect(
      (await call("POST", `/api/documents/${doc.id}/status`, "admin", { status: "completed" }))
        .statusCode,
    ).toBe(403);
    expect(
      (await call("POST", `/api/documents/${doc.id}/status`, "receiver", { status: "completed" }))
        .statusCode,
    ).toBe(403);
    await call("POST", `/api/documents/${doc.id}/dispatch`, "b", { toOfficeId: "c" });
    await call("POST", `/api/documents/${doc.id}/receive`, "c", {});
    expect((await call("GET", `/api/scans/resolve?code=${doc.qrCode}`, "c")).json().outcome).toBe(
      "dispatch",
    );
    expect(
      (await call("POST", `/api/documents/${doc.id}/status`, "c", { status: "completed" }))
        .statusCode,
    ).toBe(200);
    const filed = await call("POST", `/api/documents/${doc.id}/file`, "c", {
      location: "Room 1 / Box 2",
    });
    expect(filed.statusCode, filed.body).toBe(200);
    expect(filed.json().events.map((event: { action: string }) => event.action)).toEqual([
      "registered",
      "dispatched",
      "received",
      "dispatched",
      "received",
      "completed",
      "filed",
    ]);
    expect(
      (await call("POST", `/api/documents/${doc.id}/status`, "c", { status: "in_process" }))
        .statusCode,
    ).toBe(400);
    expect((await db.document.findUniqueOrThrow({ where: { id: doc.id } })).fileLocation).toBe(
      "Room 1 / Box 2",
    );
  });
  it("registers a document in the creating office without a destination", async () => {
    const response = await call("POST", "/api/documents", "x", {
      title: "External origin test",
      subject: "Created outside the route",
      typeId: "type-x",
      priority: "routine",
    });
    expect(response.statusCode, response.body).toBe(200);
    const doc = response.json();
    expect(doc.originOfficeId).toBe("x");
    expect(doc.currentOfficeId).toBe("x");
    expect(doc.nextOfficeId).toBeUndefined();
    expect((await call("GET", `/api/documents/${doc.id}`, "x")).statusCode).toBe(200);
    expect((await call("GET", "/api/documents", "x")).json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: doc.id })]),
    );

    const dispatched = await call("POST", `/api/documents/${doc.id}/dispatch`, "x", {
      toOfficeId: "a",
    });
    expect(dispatched.statusCode, dispatched.body).toBe(200);
    const received = await call("POST", `/api/documents/${doc.id}/receive`, "a", {});
    expect(received.statusCode, received.body).toBe(200);
    expect(received.json()).toMatchObject({ currentOfficeId: "a", status: "received" });
  });

  it("rejects wrong offices, self dispatch, stale confirmations, duplicate requests and premature filing", async () => {
    const doc = await register();
    expect(
      (await call("POST", `/api/documents/${doc.id}/dispatch`, "x", { toOfficeId: "b" }))
        .statusCode,
    ).toBe(403);
    expect(
      (await call("POST", `/api/documents/${doc.id}/dispatch`, "a", { toOfficeId: "a" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await call("POST", `/api/documents/${doc.id}/dispatch`, "a", { toOfficeId: "z" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await call("POST", `/api/documents/${doc.id}/file`, "admin", { location: "Box 1" }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await call("POST", `/api/documents/${doc.id}/dispatch`, "a", {
          toOfficeId: "b",
          expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
        })
      ).statusCode,
    ).toBe(409);
    const dispatched = await Promise.all(
      [1, 2].map(() => call("POST", `/api/documents/${doc.id}/dispatch`, "a", { toOfficeId: "b" })),
    );
    expect(dispatched.map((r) => r.statusCode).sort()).toEqual([200, 400]);
    expect(
      (await call("POST", `/api/documents/${doc.id}/status`, "a", { status: "on_hold", remarks: "Too late" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await call("POST", `/api/documents/${doc.id}/dispatch`, "a", { toOfficeId: "c" })).statusCode,
    ).toBe(400);
    expect((await call("POST", `/api/documents/${doc.id}/receive`, "x", {})).statusCode).toBe(403);
    const receipts = await Promise.all(
      [1, 2].map(() => call("POST", `/api/documents/${doc.id}/receive`, "b", {})),
    );
    expect(receipts.map((r) => r.statusCode).sort()).toEqual([200, 400]);
    expect(
      await db.trackingEvent.count({ where: { documentId: doc.id, action: "received" } }),
    ).toBe(1);
  });
  it("uses the priority SLA as the total deadline", async () => {
    for (const [priority, hours] of [
      ["routine", 72],
      ["urgent", 24],
      ["rush", 8],
    ] as const) {
      const before = Date.now();
      const response = await call("POST", "/api/documents", "a", {
        title: `${priority} deadline test`,
        typeId: "type",
        priority,
      });
      expect(response.statusCode, response.body).toBe(200);
      const deadline = new Date(response.json().dueAt).getTime();
      expect(deadline).toBeGreaterThanOrEqual(before + hours * 60 * 60 * 1000);
      expect(deadline).toBeLessThanOrEqual(Date.now() + hours * 60 * 60 * 1000 + 1000);
    }
  });
  it("supports repeated direct custody transfers", async () => {
    const doc = await register();
    const dispatchedToExternal = await call("POST", `/api/documents/${doc.id}/dispatch`, "a", {
      toOfficeId: "x",
    });
    expect(dispatchedToExternal.statusCode, dispatchedToExternal.body).toBe(200);
    expect((await call("GET", `/api/documents/${doc.id}`, "x")).statusCode).toBe(200);
    expect((await call("GET", `/api/scans/resolve?code=${doc.qrCode}`, "x")).json().outcome).toBe(
      "receive",
    );
    const receivedExternally = await call("POST", `/api/documents/${doc.id}/receive`, "x", {});
    expect(receivedExternally.statusCode, receivedExternally.body).toBe(200);
    expect(receivedExternally.json()).toMatchObject({ currentOfficeId: "x", status: "received" });
    expect((await call("GET", `/api/documents?q=${doc.trackingCode}`, "x")).json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: doc.id })]),
    );
    const returnedToNextStep = await call("POST", `/api/documents/${doc.id}/dispatch`, "x", {
      toOfficeId: "b",
    });
    expect(returnedToNextStep.statusCode, returnedToNextStep.body).toBe(200);
    const receivedAtNextStep = await call("POST", `/api/documents/${doc.id}/receive`, "b", {});
    expect(receivedAtNextStep.json()).toMatchObject({ currentOfficeId: "b", status: "received" });
    expect((await call("GET", `/api/documents/${doc.id}`, "y")).statusCode).toBe(403);
    expect((await call("GET", `/api/scans/resolve?code=${doc.qrCode}`, "y")).json()).toEqual({
      outcome: "unknown",
    });
  });
  it("scopes searches and notifications and allocates unique codes concurrently", async () => {
    const docs = await Promise.all([register(), register(), register()]);
    expect(new Set(docs.map((d) => d.qrCode)).size).toBe(3);
    expect((await call("GET", `/api/documents?q=${docs[0].trackingCode}`, "x")).json()).toEqual([]);
    expect((await call("GET", `/api/documents/${docs[0].id}`, "x")).statusCode).toBe(403);
    await call("POST", `/api/documents/${docs[0].id}/dispatch`, "a", { toOfficeId: "b" });
    const bNotifications = (await call("GET", "/api/notifications", "b")).json();
    await call("POST", "/api/notifications/read-all", "a", {});
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: bNotifications[0].id } })).read,
    ).toBe(false);
  });
});
