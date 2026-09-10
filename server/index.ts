import { documentReport } from "./reports.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import Fastify, { type FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { z } from "zod";
import { assertDatabaseUrl, loadLocalEnv, readSecurityConfig } from "./load-env.js";
import { canMutateDocument, nextStatusAction } from "./custody.js";
import { code128Svg } from "../src/lib/code128.js";

loadLocalEnv();
assertDatabaseUrl();
const security = readSecurityConfig();

const database = new PrismaClient();
const transactionContext = new AsyncLocalStorage<Prisma.TransactionClient>();
const prisma = new Proxy(database, {
  get(target, property) {
    const client = transactionContext.getStore() ?? target;
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
export const app = Fastify({
  logger: process.env.NODE_ENV !== "test",
  bodyLimit: 100 * 1024 * 1024,
  trustProxy: security.trustedProxies,
});
export { database };
const jwtSecret = security.jwtSecret;

type Actor = {
  id: string;
  role: "admin" | "office_head" | "staff" | "receiving";
  officeId: string;
  username: string;
};

declare module "fastify" {
  interface FastifyRequest {
    actor?: Actor;
  }
}

const registerSchema = z.object({
  requestId: z.string().uuid().optional(),
  title: z.string().trim().min(4),
  subject: z.string().trim().default(""),
  typeId: z.string().min(1),
  priority: z.enum(["routine", "urgent", "rush"]),
  requester: z.string().min(2).default("Not specified"),
  pageCount: z.coerce.number().int().min(1).default(1),
  remarks: z.string().optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(255).default("application/octet-stream"),
        size: z.coerce
          .number()
          .int()
          .min(1)
          .max(10 * 1024 * 1024),
        dataUrl: z
          .string()
          .startsWith("data:")
          .max(15 * 1024 * 1024),
      }),
    )
    .optional(),
});

const dispatchSchema = z.object({
  expectedUpdatedAt: z.string().optional(),
  toOfficeId: z.string().min(1),
  remarks: z.string().optional(),
});

const statusSchema = z.object({
  expectedUpdatedAt: z.string().optional(),
  status: z.enum(["in_process", "on_hold", "returned", "completed"]),
  remarks: z.string().optional(),
});

const voidSchema = z.object({
  expectedUpdatedAt: z.string().optional(),
  reason: z.string().trim().min(2),
});

const fileSchema = z.object({
  expectedUpdatedAt: z.string().optional(),
  location: z.string().trim().min(2),
});

const wrongOfficeSchema = z.object({
  scannedOfficeId: z.string().min(1),
});

const officeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  location: z.string().trim().min(2).default("Not specified"),
  keywords: z.string().trim().max(1000).default(""),
  active: z.boolean().default(true),
});

const userPatchSchema = z.object({
  name: z.string().min(2).optional(),
  username: z.string().min(3).optional(),
  password: z.string().min(12).optional(),
  active: z.boolean().optional(),
  role: z.enum(["admin", "office_head", "staff", "receiving"]).optional(),
  officeId: z.string().optional(),
  position: z.string().optional(),
});

const userCreateSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3),
  password: z.string().min(12),
  active: z.boolean().default(true),
  role: z.enum(["admin", "office_head", "staff", "receiving"]),
  officeId: z.string().min(1),
  position: z.string().min(2),
});

const documentTypeSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(2).max(64).optional(),
  active: z.boolean().default(true),
});

const routingPurposeSchema = z.object({
  name: z.string().trim().min(2).max(191),
  active: z.boolean().default(true),
});

const generalSettingsSchema = z
  .object({
    lguName: z.string().trim().min(2).max(160),
    address: z.string().trim().max(500),
  })
  .strict();
const slaSettingsSchema = z
  .object({
    routineHours: z.coerce.number().int().min(1).max(720),
    urgentHours: z.coerce.number().int().min(1).max(720),
    rushHours: z.coerce.number().int().min(1).max(720),
  })
  .strict();
const notificationSettingsSchema = z
  .object({
    overdueAlerts: z.boolean(),
    wrongOfficeScans: z.boolean(),
    dailyDigest: z.boolean(),
  })
  .strict();
const scannerSettingsSchema = z
  .object({
    blockWrongOfficeReceipts: z.boolean(),
    requireRemarksOnHold: z.boolean(),
    vibrateOnSuccessfulScan: z.boolean(),
  })
  .strict();
const settingsSchemas = {
  general: generalSettingsSchema,
  sla: slaSettingsSchema,
  notifications: notificationSettingsSchema,
  scanner: scannerSettingsSchema,
} as const;

const defaultSettings = {
  general: {
    lguName: "City Government of San Lorenzo",
    address: "City Hall Compound, Rizal Street, San Lorenzo",
  },
  sla: { routineHours: 72, urgentHours: 24, rushHours: 8 },
  notifications: {
    overdueAlerts: true,
    wrongOfficeScans: true,
    dailyDigest: false,
  },
  scanner: {
    blockWrongOfficeReceipts: true,
    requireRemarksOnHold: true,
    vibrateOnSuccessfulScan: true,
  },
} satisfies Record<keyof typeof settingsSchemas, Record<string, unknown>>;

async function readSettingsSection<Key extends keyof typeof settingsSchemas>(
  key: Key,
): Promise<Record<string, unknown>> {
  const stored = await prisma.setting.findUnique({ where: { key } });
  const raw = stored?.value;
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const normalized =
    key === "general"
      ? Object.fromEntries(Object.entries(value).filter(([name]) => name !== "trackingCodePrefix"))
      : value;
  const parsed = settingsSchemas[key].safeParse({ ...defaultSettings[key], ...normalized });
  return (parsed.success ? parsed.data : defaultSettings[key]) as Record<string, unknown>;
}

app.register(cors, {
  origin: (origin, callback) => {
    const isAllowed =
      !origin ||
      security.origins.includes(origin);
    callback(null, isAllowed);
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["content-type", "x-csrf-token"],
  credentials: true,
});
app.register(cookie);
app.register(sensible);

app.addHook("onSend", async (_request, reply, payload) => {
  reply.headers({
    "content-security-policy": "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; form-action 'self'",
    "permissions-policy": "camera=(self), microphone=(), geolocation=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    ...(security.production ? { "strict-transport-security": "max-age=31536000; includeSubDomains" } : {}),
  });
  return payload;
});

app.setErrorHandler((error, request, reply) => {
  if (error instanceof z.ZodError)
    return reply.code(400).send({
      message: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    });
  const failure = error as Error & { statusCode?: number };
  request.log.error(error);
  if (failure.statusCode === 429 && "retryAfter" in failure)
    reply.header("retry-after", String((failure as typeof failure & { retryAfter: number }).retryAfter));

  return reply.code(failure.statusCode ?? 500).send({
    message: failure.statusCode
      ? failure.message
      : "The operation could not be saved. Refresh and retry.",
  });
});

app.addHook("preHandler", async (request) => {
  if (!request.url.startsWith("/api/") || isPublicRoute(request)) return;
  if (request.url.split("?", 1)[0] === "/api/auth/logout") {
    request.actor = await readActor(request).catch(() => undefined);
    if (request.actor) verifyCsrf(request);
    return;
  }
  request.actor = await readActor(request);
  if (["POST", "PATCH", "DELETE"].includes(request.method)) verifyCsrf(request);
});

function isPublicRoute(request: FastifyRequest) {
  const path = request.url.split("?", 1)[0];
  return new Set(["/api/auth/login", "/api/public/track", "/api/health"]).has(path ?? "");
}

async function readActor(request: FastifyRequest): Promise<Actor> {
  const token = request.cookies.session;
  if (!token) throw app.httpErrors.unauthorized("Sign in required.");
  try {
    const payload = jwt.verify(token, jwtSecret) as Actor;
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { office: true },
    });
    if (!user?.active || !user.office.active) throw new Error("inactive");
    return { id: user.id, role: user.role, officeId: user.officeId, username: user.username };
  } catch {
    throw app.httpErrors.unauthorized("Invalid session.");
  }
}

function requireActor(request: FastifyRequest) {
  if (!request.actor) throw app.httpErrors.unauthorized("Sign in required.");
  return request.actor;
}

function requireRoles(request: FastifyRequest, roles: Actor["role"][]) {
  const actor = requireActor(request);
  if (!roles.includes(actor.role))
    throw app.httpErrors.forbidden("You do not have access to this action.");
  return actor;
}

function clientIp(request: FastifyRequest) {
  return request.ip;
}

function csrfToken(request: FastifyRequest) {
  const session = request.cookies.session;
  if (!session) throw app.httpErrors.unauthorized("Sign in required.");
  return createHmac("sha256", security.csrfSecret).update(session).digest("base64url");
}

function verifyCsrf(request: FastifyRequest) {
  const origin = request.headers.origin;
  if (origin && !security.origins.includes(origin)) throw app.httpErrors.forbidden("Request origin is not allowed.");
  const supplied = request.headers["x-csrf-token"];
  const expected = csrfToken(request);
  if (typeof supplied !== "string") throw app.httpErrors.forbidden("Invalid CSRF token.");
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right))
    throw app.httpErrors.forbidden("Invalid CSRF token.");
}

type RateBucket = { startedAt: number; count: number };
const rateBuckets = new Map<string, RateBucket>();
function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (rateBuckets.size > 10_000) {
    for (const [storedKey, stored] of rateBuckets)
      if (now - stored.startedAt >= windowMs) rateBuckets.delete(storedKey);
  }
  const current = rateBuckets.get(key);
  const bucket = !current || now - current.startedAt >= windowMs ? { startedAt: now, count: 0 } : current;
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000));
    const error = app.httpErrors.tooManyRequests("Too many requests. Try again later.");
    Object.assign(error, { retryAfter });
    throw error;
  }
}

function publicTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function newPublicToken() {
  return randomBytes(24).toString("base64url");
}
async function newUniquePublicToken() {
  for (;;) {
    const token = newPublicToken();
    const exists = await prisma.document.findUnique({
      where: { publicTokenHash: publicTokenHash(token) },
      select: { id: true },
    });
    if (!exists) return token;
  }
}

function validatePassword(password: string) {
  if (password.length < 12 || ["demo1234", "password1234", "superadmin.user"].includes(password.toLowerCase()))
    throw app.httpErrors.badRequest("Password must be at least 12 characters and must not be a default password.");
}

async function audit(
  request: FastifyRequest,
  action: string,
  target: string,
  severity: "low" | "medium" | "high" = "low",
) {
  const actor = request.actor;
  await prisma.auditEntry.create({
    data: { actorId: actor?.id, action, target, ip: clientIp(request), severity },
  });
}

function mapUser(user: Prisma.UserGetPayload<Record<string, never>>) {
  const {
    passwordHash,
    createdAt,
    updatedAt,
    failedLoginAttempts: _failedLoginAttempts,
    lastFailedLoginAt: _lastFailedLoginAt,
    lockedUntil: _lockedUntil,
    ...safe
  } = user;
  return {
    ...safe,
    lastLogin: safe.lastLogin?.toISOString() ?? new Date(0).toISOString(),
  };
}

function mapOffice(
  office: Prisma.OfficeGetPayload<{ include: { _count: { select: { users: true } } } }>,
) {
  return {
    id: office.id,
    code: office.code,
    name: office.name,
    location: office.location,
    keywords: office.keywords,
    active: office.active,
    staffCount: office._count.users,
  };
}

const documentInclude = {
  type: { select: { name: true, code: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
  events: { include: { actor: { select: { name: true } } } },
} satisfies Prisma.DocumentInclude;

function mapDocument(
  document: Prisma.DocumentGetPayload<{
    include: typeof documentInclude;
  }>,
) {
  return {
    id: document.id,
    trackingCode: document.trackingCode,
    qrCode: document.qrCode,
    qrPayload: document.qrPayload,
    title: document.title,
    subject: document.subject,
    typeId: document.typeId,
    typeName: document.type.name,
    typeCode: document.type.code,
    status: document.status,
    priority: document.priority,
    originOfficeId: document.originOfficeId,
    currentOfficeId: document.currentOfficeId,
    nextOfficeId: document.nextOfficeId ?? undefined,
    createdBy: document.createdById,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    dueAt: document.dueAt.toISOString(),
    remarks: document.remarks ?? undefined,
    requester: document.requester,
    pageCount: document.pageCount,
    fileLocation: document.fileLocation ?? undefined,
    attachments: document.attachments.map((attachment) => ({
      id: attachment.id,
      documentId: attachment.documentId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      uploadedBy: attachment.uploadedById,
      createdAt: attachment.createdAt.toISOString(),
    })),
    events: document.events
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((event) => ({
        id: event.id,
        documentId: event.documentId,
        action: event.action,
        fromOfficeId: event.fromOfficeId ?? undefined,
        toOfficeId: event.toOfficeId ?? undefined,
        actorId: event.actorId,
        actorName: (event as typeof event & { actor?: { name: string } }).actor?.name,
        remarks: event.remarks ?? undefined,
        timestamp: event.timestamp.toISOString(),
      })),
  };
}

function readQrValue(rawValue: string) {
  const value = rawValue.trim();
  if (!value.startsWith("{")) return value;

  try {
    const payload = JSON.parse(value) as { qrCode?: unknown; trackingCode?: unknown };
    return typeof payload.qrCode === "string"
      ? payload.qrCode.trim()
      : typeof payload.trackingCode === "string"
        ? payload.trackingCode.trim()
        : value;
  } catch {
    return value;
  }
}

function mapNotification(notification: Prisma.NotificationGetPayload<Record<string, never>>) {
  return {
    ...notification,
    documentId: notification.documentId ?? undefined,
    userId: notification.userId ?? undefined,
    timestamp: notification.timestamp.toISOString(),
  };
}

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function usernameFromLegacyValue(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .split("@")[0]
      ?.replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || value.trim().toLowerCase()
  );
}

async function normalizeLegacyUsernames() {
  const knownUsernames: Record<string, string> = {
    "admin@lgu.gov.ph": "admin",
    "treasury.head@lgu.gov.ph": "treasury_head",
    "receiving@lgu.gov.ph": "receiving",
    "staff@lgu.gov.ph": "staff",
    "engineering.head@lgu.gov.ph": "engineering_head",
  };

  for (const [legacyValue, username] of Object.entries(knownUsernames)) {
    await prisma.user.updateMany({
      where: { username: legacyValue },
      data: { username },
    });
  }

  const legacyUsers = await prisma.user.findMany({ where: { username: { contains: "@" } } });
  for (const user of legacyUsers) {
    const base = usernameFromLegacyValue(user.username);
    let username = base;
    let suffix = 2;

    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${base}_${suffix}`;
      suffix += 1;
    }

    await prisma.user.update({ where: { id: user.id }, data: { username } });
  }
}

async function ensureCanChangeAdmin(
  userId: string,
  patch: { role?: Actor["role"]; active?: boolean },
) {
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) throw app.httpErrors.notFound("User not found.");
  const removesActiveAdmin =
    current.role === "admin" &&
    current.active &&
    ((patch.role !== undefined && patch.role !== "admin") || patch.active === false);
  if (!removesActiveAdmin) return current;

  const activeAdmins = await prisma.user.count({ where: { role: "admin", active: true } });
  if (activeAdmins <= 1) {
    throw app.httpErrors.badRequest("At least one active administrator account is required.");
  }
  return current;
}

async function validateOffices(ids: string[]) {
  if (!ids.length) throw app.httpErrors.badRequest("Select a destination office.");
  const count = await prisma.office.count({
    where: { id: { in: [...new Set(ids)] }, active: true },
  });
  if (count !== new Set(ids).size) throw app.httpErrors.badRequest("Choose active offices only.");
}
async function requireDocumentAccess(
  request: FastifyRequest,
  document: Awaited<ReturnType<typeof findDocument>>,
) {
  const actor = requireActor(request);
  if (actor.role === "admin") return;
  const participated = await prisma.trackingEvent.count({
    where: {
      documentId: document.id,
      OR: [{ fromOfficeId: actor.officeId }, { toOfficeId: actor.officeId }],
    },
  });
  if (
    document.originOfficeId !== actor.officeId &&
    document.currentOfficeId !== actor.officeId &&
    document.nextOfficeId !== actor.officeId &&
    !participated
  )
    throw app.httpErrors.forbidden("This document is outside your office.");
}

async function findDocument(id: string) {
  if (transactionContext.getStore()) {
    await prisma.$queryRaw`SELECT id FROM documents WHERE id = ${id} FOR UPDATE`;
  }
  const document = await prisma.document.findUnique({
    where: { id },
    include: documentInclude,
  });
  if (!document) throw app.httpErrors.notFound("Document not found.");
  return document;
}

async function createEventAndNotification(args: {
  request: FastifyRequest;
  documentId: string;
  action:
    | "registered"
    | "dispatched"
    | "received"
    | "processed"
    | "held"
    | "returned"
    | "completed"
    | "filed"
    | "wrong_office"
    | "voided";
  target: string;
  fromOfficeId?: string;
  toOfficeId?: string;
  remarks?: string;
  notification?: {
    title: string;
    body: string;
    kind: "info" | "warning" | "success" | "danger";
    userId?: string;
  };
}) {
  const actor = requireActor(args.request);
  await prisma.trackingEvent.create({
    data: {
      documentId: args.documentId,
      action: args.action,
      actorId: actor.id,
      fromOfficeId: args.fromOfficeId,
      toOfficeId: args.toOfficeId,
      remarks: args.remarks,
    },
  });
  const notifications = await readSettingsSection("notifications");
  const notificationEnabled =
    args.action !== "wrong_office" || notifications.wrongOfficeScans === true;
  if (args.notification && notificationEnabled) {
    const doc = await findDocument(args.documentId);
    const recipients = await prisma.user.findMany({
      where: {
        active: true,
        OR: [
          { role: "admin" },
          {
            officeId: {
              in: [
                doc.originOfficeId,
                doc.currentOfficeId,
                doc.nextOfficeId ?? doc.currentOfficeId,
              ],
            },
          },
        ],
      },
      select: { id: true },
    });
    await prisma.notification.createMany({
      data: recipients.map(({ id }) => ({
        ...args.notification!,
        documentId: args.documentId,
        userId: id,
      })),
    });
  }
  await audit(
    args.request,
    `document.${args.action}`,
    args.target,
    args.action === "wrong_office" || args.action === "voided" ? "medium" : "low",
  );
}

async function generateTrackingCode(officeCode: string) {
  const year = new Date().getFullYear();
  const key = `tracking-sequence-${year}`;
  await prisma.$executeRaw`INSERT INTO settings (\`key\`, value, updated_at) VALUES (${key}, '0', NOW()) ON DUPLICATE KEY UPDATE updated_at = updated_at`;
  await prisma.$queryRaw`SELECT \`key\` FROM settings WHERE \`key\` = ${key} FOR UPDATE`;
  const existing = await prisma.document.findMany({
    where: { trackingCode: { contains: `-${year}-` } },
    select: { trackingCode: true },
  });
  const maximum = existing.reduce(
    (max, doc) => Math.max(max, Number(doc.trackingCode.split("-").at(-1)) || 0),
    0,
  );
  const counter = await prisma.setting.findUniqueOrThrow({ where: { key } });
  const next = Math.max(maximum, Number(counter.value) || 0) + 1;
  await prisma.setting.update({ where: { key }, data: { value: next } });
  return `${officeCode}-${year}-${String(next).padStart(6, "0")}`;
}

function documentPost(path: string, handler: (request: FastifyRequest) => Promise<unknown>) {
  app.post(path, async (request) =>
    database.$transaction((tx) => transactionContext.run(tx, () => handler(request)), {
      isolationLevel: "ReadCommitted",
      timeout: 15000,
    }),
  );
}

app.get("/api/health", async () => ({ ok: true }));

app.post("/api/auth/login", async (request, reply) => {
  const body = z
    .object({ username: z.string().min(1), password: z.string().min(1) })
    .parse(request.body);
  const username = body.username.trim().toLowerCase();
  const windowMs = security.loginWindowMinutes * 60 * 1000;
  enforceRateLimit(`login-ip:${clientIp(request)}`, security.loginIpLimit, windowMs);
  const user = await prisma.user.findUnique({
    where: { username },
  });
  const now = new Date();
  const locked = Boolean(user?.lockedUntil && user.lockedUntil > now);
  const validPassword = user && !locked && user.active && (await bcrypt.compare(body.password, user.passwordHash));
  if (!validPassword) {
    if (user && !locked) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= security.loginAccountLimit;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lastFailedLoginAt: now,
          lockedUntil: shouldLock ? new Date(now.getTime() + windowMs) : null,
        },
      });
    }
    await prisma.auditEntry.create({
      data: {
        action: "user.login_failed",
        target: username,
        ip: clientIp(request),
        severity: "high",
      },
    });
    throw app.httpErrors.unauthorized("Invalid credentials.");
  }
  if (!user) throw app.httpErrors.unauthorized("Invalid credentials.");
  const actor: Actor = {
    id: user.id,
    role: user.role,
    officeId: user.officeId,
    username: user.username,
  };
  const token = jwt.sign(actor, jwtSecret, { expiresIn: "8h" });
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: now, failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null },
  });
  reply.setCookie("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  request.actor = actor;
  await audit(request, "user.login", user.username);
  return { user: mapUser(user), csrfToken: csrfToken(request) };
});

app.post("/api/auth/logout", async (request, reply) => {
  request.actor = await readActor(request).catch(() => undefined);
  if (request.actor && ["POST", "PATCH", "DELETE"].includes(request.method)) verifyCsrf(request);
  if (request.actor) await audit(request, "user.logout", request.actor.username);
  reply.clearCookie("session", { path: "/" });
  return { ok: true };
});

app.get("/api/auth/me", async (request) => {
  const actor = requireActor(request);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  return { user: mapUser(user) };
});
app.get("/api/auth/csrf", async (request) => {
  requireActor(request);
  return { csrfToken: csrfToken(request) };
});

app.get("/api/offices", async () => {
  const offices = await prisma.office.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
  return offices.map(mapOffice);
});
app.post("/api/offices", async (request) => {
  requireRoles(request, ["admin"]);
  const office = await prisma.office.create({
    data: officeSchema.parse(request.body),
    include: { _count: { select: { users: true } } },
  });
  await audit(request, "office.create", office.name, "medium");
  return mapOffice(office);
});
app.patch("/api/offices/:id", async (request) => {
  requireRoles(request, ["admin"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const office = await prisma.office.update({
    where: { id },
    data: officeSchema.partial().parse(request.body),
    include: { _count: { select: { users: true } } },
  });
  await audit(request, "office.update", office.name, "medium");
  return mapOffice(office);
});
app.delete("/api/offices/:id", async (request, reply) => {
  requireRoles(request, ["admin"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const office = await prisma.office.findUniqueOrThrow({ where: { id } });
  const [users, documentTypes, documents, routingEvents] = await Promise.all([
    prisma.user.count({ where: { officeId: id } }),
    prisma.documentType.count({ where: { officeId: id } }),
    prisma.document.count({
      where: {
        OR: [{ originOfficeId: id }, { currentOfficeId: id }, { nextOfficeId: id }],
      },
    }),
    prisma.trackingEvent.count({ where: { OR: [{ fromOfficeId: id }, { toOfficeId: id }] } }),
  ]);
  if (users || documentTypes || documents || routingEvents) {
    throw app.httpErrors.conflict(
      "This office has linked users, document types, documents, or routing history. Deactivate it instead.",
    );
  }
  await prisma.office.delete({ where: { id } });
  await audit(request, "office.delete", office.name, "high");
  reply.code(204);
});

app.get("/api/users", async (request) => {
  // Admins manage accounts; other roles only need their own session from /auth/me.
  // The frontend keeps seeded fallback users for the demo-account buttons in offline preview.
  requireRoles(request, ["admin"]);
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return users.map(mapUser);
});
app.post("/api/users", async (request) => {
  requireRoles(request, ["admin"]);
  const body = userCreateSchema.parse(request.body);
  validatePassword(body.password);
  const user = await prisma.user.create({
    data: {
      name: body.name.trim(),
      username: body.username.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(body.password, 12),
      role: body.role,
      officeId: body.officeId,
      position: body.position.trim(),
      active: body.active,
      avatarInitials: initialsFor(body.name),
    },
  });
  await audit(request, "user.create", user.username, "medium");
  return mapUser(user);
});
app.patch("/api/users/:id", async (request) => {
  requireRoles(request, ["admin"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const body = userPatchSchema.parse(request.body);
  if (body.password) validatePassword(body.password);
  await ensureCanChangeAdmin(id, { role: body.role, active: body.active });
  const { password, username, name, position, ...rest } = body;
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(name ? { name: name.trim(), avatarInitials: initialsFor(name) } : {}),
      ...(username ? { username: username.trim().toLowerCase() } : {}),
      ...(position ? { position: position.trim() } : {}),
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    },
  });
  await audit(request, "user.update", user.username, "medium");
  return mapUser(user);
});
app.delete("/api/users/:id", async (request) => {
  const actor = requireRoles(request, ["admin"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  if (id === actor.id) throw app.httpErrors.badRequest("You cannot delete your own account.");
  const user = await ensureCanChangeAdmin(id, { active: false, role: "staff" });
  try {
    await prisma.user.delete({ where: { id } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2003") {
      throw app.httpErrors.badRequest(
        "This user has document history. Deactivate the account instead of deleting it.",
      );
    }
    throw error;
  }
  await audit(request, "user.delete", user.username, "medium");
  return { ok: true };
});

function typeCodeFromName(name: string) {
  const code = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return code.length >= 2 ? code : "TYPE";
}

async function uniqueDocumentTypeCode(officeId: string, name: string, requestedCode?: string) {
  const base = (requestedCode?.trim().toUpperCase() || typeCodeFromName(name)).slice(0, 64);
  let code = base;
  for (let suffix = 2; ; suffix += 1) {
    const existing = await prisma.documentType.findFirst({
      where: { officeId, code },
      select: { id: true },
    });
    if (!existing) return code;
    const suffixText = `-${suffix}`;
    code = `${base.slice(0, 64 - suffixText.length)}${suffixText}`;
  }
}

async function officeDocumentType(id: string, officeId: string) {
  const type = await prisma.documentType.findFirst({ where: { id, officeId } });
  if (!type) throw app.httpErrors.notFound("Document type was not found in your office.");
  return type;
}

app.get("/api/document-types", async (request) => {
  const actor = requireActor(request);
  return prisma.documentType.findMany({
    where: { officeId: actor.officeId },
    orderBy: { name: "asc" },
  });
});
app.post("/api/document-types", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head", "staff"]);
  const input = documentTypeSchema.parse(request.body);
  const type = await prisma.documentType.create({
    data: {
      name: input.name,
      code: await uniqueDocumentTypeCode(actor.officeId, input.name, input.code),
      active: input.active,
      officeId: actor.officeId,
    },
  });
  await audit(request, "document_type.create", type.name, "medium");
  return type;
});
app.patch("/api/document-types/:id", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head", "staff"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  await officeDocumentType(id, actor.officeId);
  const input = documentTypeSchema.partial().parse(request.body);
  const type = await prisma.documentType.update({
    where: { id },
    data: {
      ...input,
      ...(input.code !== undefined ? { code: input.code.trim().toUpperCase() } : {}),
    },
  });
  await audit(request, "document_type.update", type.name, "medium");
  return type;
});
app.delete("/api/document-types/:id", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head", "staff"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const type = await officeDocumentType(id, actor.officeId);
  try {
    await prisma.documentType.delete({ where: { id } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2003") {
      throw app.httpErrors.badRequest(
        "This document type is used by document history. Deactivate it instead of deleting it.",
      );
    }
    throw error;
  }
  await audit(request, "document_type.delete", type.name, "medium");
  return { ok: true };
});

app.get("/api/routing-purposes", async (request) => {
  const actor = requireActor(request);
  return prisma.routingPurpose.findMany({
    where: { officeId: actor.officeId, active: true },
    orderBy: { name: "asc" },
  });
});
app.post("/api/routing-purposes", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head", "staff", "receiving"]);
  const input = routingPurposeSchema.parse(request.body);
  try {
    const purpose = await prisma.routingPurpose.create({
      data: { ...input, officeId: actor.officeId },
    });
    await audit(request, "routing_purpose.create", purpose.name, "low");
    return purpose;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw app.httpErrors.badRequest("This purpose already exists for your office.");
    }
    throw error;
  }
});

app.get("/api/documents", async (request) => {
  const actor = requireActor(request);
  const query = z
    .object({
      officeId: z.string().optional(),
      status: z.string().optional(),
      q: z.string().optional(),
    })
    .parse(request.query);
  const officeScope = actor.role === "admin" ? query.officeId : actor.officeId;
  const documents = await prisma.document.findMany({
    where: {
      ...(officeScope
        ? {
            OR: [
              { originOfficeId: officeScope },
              { currentOfficeId: officeScope },
              { nextOfficeId: officeScope },
              {
                events: {
                  some: {
                    OR: [{ fromOfficeId: officeScope }, { toOfficeId: officeScope }],
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.q
        ? {
            AND: [
              {
                OR: [
                  { trackingCode: { contains: query.q } },
                  { qrCode: { contains: query.q } },
                  { title: { contains: query.q } },
                  { requester: { contains: query.q } },
                ],
              },
            ],
          }
        : {}),
    },
    include: documentInclude,
    orderBy: { updatedAt: "desc" },
  });
  return documents.map(mapDocument);
});

documentPost("/api/documents", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head", "staff"]);
  const body = registerSchema.parse(request.body);
  const requestKey = body.requestId ? `registration-${actor.id}-${body.requestId}` : undefined;
  if (requestKey) {
    await prisma.$executeRaw`INSERT INTO settings (\`key\`, value, updated_at) VALUES (${requestKey}, 'null', NOW()) ON DUPLICATE KEY UPDATE updated_at = updated_at`;
    const previous = await prisma.setting.findUniqueOrThrow({ where: { key: requestKey } });
    if (typeof previous.value === "string" && previous.value !== "null") {
      // The original public token is deliberately never stored in plaintext. A retry must
      // therefore return the same document without silently rotating an already-issued token.
      return mapDocument(await findDocument(previous.value));
    }
  }
  const documentType = await prisma.documentType.findFirst({
    where: { id: body.typeId, officeId: actor.officeId },
  });
  if (!documentType) throw app.httpErrors.badRequest("Select a document type from your office.");
  const originOffice = await prisma.office.findUniqueOrThrow({
    where: { id: actor.officeId },
    select: { code: true },
  });
  const trackingCode = await generateTrackingCode(originOffice.code);
  const publicTrackingToken = await newUniquePublicToken();
  const qrCode = `QR-${trackingCode.substring(trackingCode.indexOf("-") + 1)}`;
  const qrPayload = JSON.stringify({ trackingCode, qrCode });
  if (!documentType.active) throw app.httpErrors.badRequest("Select an active document type.");
  const slaSettings = await readSettingsSection("sla");
  const slaHours = Number(slaSettings[`${body.priority}Hours`]);
  const originOfficeId = actor.officeId;
  const document = await prisma.document.create({
    data: {
      trackingCode,
      qrCode,
      qrPayload,
      publicTokenHash: publicTokenHash(publicTrackingToken),
      publicTokenIssuedAt: new Date(),
      title: body.title,
      subject: body.subject,
      typeId: body.typeId,
      priority: body.priority,
      originOfficeId,
      currentOfficeId: originOfficeId,
      nextOfficeId: null,
      createdById: actor.id,
      dueAt: new Date(Date.now() + slaHours * 60 * 60 * 1000),
      remarks: body.remarks,
      requester: body.requester,
      pageCount: body.pageCount,
      attachments: body.attachments?.length
        ? {
            create: body.attachments.map((attachment) => ({
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              size: attachment.size,
              dataUrl: attachment.dataUrl,
              uploadedById: actor.id,
            })),
          }
        : undefined,
      events: {
        create: { action: "registered", actorId: actor.id, toOfficeId: originOfficeId },
      },
      notifications: {
        create: {
          userId: actor.id,
          title: "Document registered",
          body: `${trackingCode} was registered and a QR and barcode label is ready for printing.`,
          kind: "success",
        },
      },
    },
    include: documentInclude,
  });
  if (requestKey)
    await prisma.setting.update({ where: { key: requestKey }, data: { value: document.id } });
  await audit(request, "document.registered", trackingCode);
  return { ...mapDocument(document), publicTrackingToken };
});

documentPost("/api/documents/:id/void", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head", "staff"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const body = voidSchema.parse(request.body);
  const document = await findDocument(id);
  if (body.expectedUpdatedAt && document.updatedAt.toISOString() !== body.expectedUpdatedAt)
    throw app.httpErrors.conflict("Document changed since you opened it. Refresh and try again.");
  if (!canMutateDocument(actor, document.currentOfficeId))
    throw app.httpErrors.forbidden("Document is not in your custody.");
  if (document.status !== "registered")
    throw app.httpErrors.badRequest("Only registered documents can be voided before dispatch.");
  await prisma.document.update({
    where: { id },
    data: { status: "voided", nextOfficeId: null },
  });
  await createEventAndNotification({
    request,
    documentId: id,
    action: "voided",
    target: document.trackingCode,
    fromOfficeId: document.currentOfficeId,
    toOfficeId: document.currentOfficeId,
    remarks: body.reason,
    notification: {
      title: "Document voided",
      body: `${document.trackingCode} was voided before dispatch.`,
      kind: "warning",
    },
  });
  return mapDocument(await findDocument(id));
});

app.get("/api/documents/:id", async (request) => {
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const document = await findDocument(id);
  await requireDocumentAccess(request, document);
  return mapDocument(document);
});

documentPost("/api/documents/:id/dispatch", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head", "staff", "receiving"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const body = dispatchSchema.parse(request.body);
  const document = await findDocument(id);
  if (body.expectedUpdatedAt && document.updatedAt.toISOString() !== body.expectedUpdatedAt)
    throw app.httpErrors.conflict("Document changed since you opened it. Refresh and try again.");
  if (!canMutateDocument(actor, document.currentOfficeId))
    throw app.httpErrors.forbidden("Document is not in your custody.");
  if (!["registered", "received", "in_process", "returned"].includes(document.status))
    throw app.httpErrors.badRequest("Document cannot be dispatched from this status.");
  const targetOfficeId = body.toOfficeId;
  if (targetOfficeId === document.currentOfficeId)
    throw app.httpErrors.badRequest("Destination must be another office.");
  await validateOffices([targetOfficeId]);
  const updated = await prisma.document.update({
    where: { id },
    data: { status: "in_transit", nextOfficeId: targetOfficeId },
    include: documentInclude,
  });
  await createEventAndNotification({
    request,
    documentId: id,
    action: "dispatched",
    target: document.trackingCode,
    fromOfficeId: document.currentOfficeId,
    toOfficeId: targetOfficeId,
    remarks: body.remarks,
    notification: {
      title: "Document dispatched",
      body: `${document.trackingCode} is now in transit.`,
      kind: "info",
    },
  });
  return mapDocument(await findDocument(updated.id));
});

documentPost("/api/documents/:id/receive", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head", "staff", "receiving"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const body = z
    .object({ remarks: z.string().optional(), expectedUpdatedAt: z.string().optional() })
    .parse(request.body ?? {});
  const document = await findDocument(id);
  if (body.expectedUpdatedAt && document.updatedAt.toISOString() !== body.expectedUpdatedAt)
    throw app.httpErrors.conflict("Document changed since you opened it. Refresh and try again.");
  const scannerSettings = await readSettingsSection("scanner");
  const isWrongOffice =
    document.nextOfficeId !== null && document.nextOfficeId !== actor.officeId;
  if (isWrongOffice && scannerSettings.blockWrongOfficeReceipts === true) {
    throw app.httpErrors.forbidden("Document is not expected at your office.");
  }
  const targetOfficeId = isWrongOffice
    ? actor.officeId
    : (document.nextOfficeId ?? document.currentOfficeId);
  if (document.status !== "in_transit")
    throw app.httpErrors.badRequest("Only in-transit documents can be received.");
  await prisma.document.update({
    where: { id },
    data: {
      status: "received",
      currentOfficeId: targetOfficeId,
      nextOfficeId: null,
    },
  });
  await createEventAndNotification({
    request,
    documentId: id,
    action: "received",
    target: document.trackingCode,
    fromOfficeId: document.currentOfficeId,
    toOfficeId: targetOfficeId,
    remarks: body.remarks,
    notification: {
      title: "Document received",
      body: `${document.trackingCode} was received successfully.`,
      kind: "success",
    },
  });
  return mapDocument(await findDocument(id));
});

documentPost("/api/documents/:id/status", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head", "staff"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const body = statusSchema.parse(request.body);
  const document = await findDocument(id);
  if (body.expectedUpdatedAt && document.updatedAt.toISOString() !== body.expectedUpdatedAt)
    throw app.httpErrors.conflict("Document changed since you opened it. Refresh and try again.");
  if (!canMutateDocument(actor, document.currentOfficeId))
    throw app.httpErrors.forbidden("Document is not in your custody.");
  const scannerSettings = await readSettingsSection("scanner");
  if (
    body.status === "on_hold" &&
    scannerSettings.requireRemarksOnHold === true &&
    !body.remarks?.trim()
  )
    throw app.httpErrors.badRequest("Hold requires remarks.");
  if (["in_transit", "completed", "filed", "voided"].includes(document.status))
    throw app.httpErrors.badRequest("This document cannot change status now.");
  if (body.status === document.status) throw app.httpErrors.conflict("Status already recorded.");
  if (
    body.status === "completed" &&
    (actor.officeId !== document.currentOfficeId || document.status === "on_hold")
  )
    throw app.httpErrors.forbidden(
      "Only authorized staff at the current custody office can complete this document.",
    );
  if (
    body.status === "returned" &&
    (!body.remarks?.trim() || document.currentOfficeId === document.originOfficeId)
  )
    throw app.httpErrors.badRequest("Return requires a reason and a different origin office.");
  await prisma.document.update({
    where: { id },
    data: {
      status: body.status === "returned" ? "in_transit" : body.status,
      nextOfficeId: body.status === "returned" ? document.originOfficeId : null,
    },
  });
  const action = nextStatusAction(body.status);
  await createEventAndNotification({
    request,
    documentId: id,
    action,
    fromOfficeId: document.currentOfficeId,
    toOfficeId: body.status === "returned" ? document.originOfficeId : document.currentOfficeId,
    target: document.trackingCode,
    remarks: body.remarks,
    notification:
      body.status === "on_hold"
        ? {
            title: "Document on hold",
            body: `${document.trackingCode} was placed on hold.`,
            kind: "warning",
          }
        : {
            title: body.status === "returned" ? "Return dispatched" : "Document updated",
            body: `${document.trackingCode}: ${body.status.replaceAll("_", " ")}`,
            kind: "info",
          },
  });
  return mapDocument(await findDocument(id));
});

documentPost("/api/documents/:id/file", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head", "staff"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const body = fileSchema.parse(request.body);
  const document = await findDocument(id);
  if (body.expectedUpdatedAt && document.updatedAt.toISOString() !== body.expectedUpdatedAt)
    throw app.httpErrors.conflict("Document changed since you opened it. Refresh and try again.");
  if (!canMutateDocument(actor, document.currentOfficeId))
    throw app.httpErrors.forbidden("Document is not in your custody.");
  if (document.status !== "completed")
    throw app.httpErrors.badRequest("Only completed documents can be filed.");
  await prisma.document.update({
    where: { id },
    data: { status: "filed", fileLocation: body.location },
  });
  await createEventAndNotification({
    request,
    documentId: id,
    action: "filed",
    fromOfficeId: document.currentOfficeId,
    toOfficeId: document.currentOfficeId,
    target: document.trackingCode,
    remarks: `Filed at ${body.location}`,
    notification: {
      title: "Document filed",
      body: `${document.trackingCode} was filed to archives.`,
      kind: "success",
    },
  });
  return mapDocument(await findDocument(id));
});

documentPost("/api/documents/:id/wrong-office", async (request) => {
  requireRoles(request, ["admin", "office_head", "staff", "receiving"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const body = wrongOfficeSchema.parse(request.body);
  if (body.scannedOfficeId !== requireActor(request).officeId)
    throw app.httpErrors.forbidden("Report only for your office.");
  const document = await findDocument(id);
  if (document.status === "voided")
    throw app.httpErrors.badRequest("Voided documents cannot be scanned.");
  if ([document.currentOfficeId, document.nextOfficeId].includes(body.scannedOfficeId))
    throw app.httpErrors.badRequest("This office is already part of the current transfer.");
  await createEventAndNotification({
    request,
    documentId: id,
    action: "wrong_office",
    target: document.trackingCode,
    fromOfficeId: document.currentOfficeId,
    toOfficeId: body.scannedOfficeId,
    remarks: "Scanned outside the expected routing office.",
    notification: {
      title: "Wrong office scan",
      body: `${document.trackingCode} was scanned at an unexpected office.`,
      kind: "warning",
    },
  });
  return mapDocument(await findDocument(id));
});

app.get("/api/scans/resolve", async (request) => {
  const actor = requireActor(request);
  const rawCode = z.object({ code: z.string().min(1) }).parse(request.query).code;
  const code = readQrValue(rawCode);
  const document = await prisma.document.findFirst({
    where: { OR: [{ qrCode: code }, { trackingCode: code }, { qrPayload: rawCode.trim() }] },
    include: documentInclude,
  });
  if (!document) return { outcome: "unknown" };
  if (document.status === "voided") return { outcome: "unavailable", doc: mapDocument(document) };
  if (
    actor.role !== "admin" &&
    document.originOfficeId !== actor.officeId &&
    document.currentOfficeId !== actor.officeId &&
    document.nextOfficeId !== actor.officeId &&
    !document.events.some(
      (event) => event.fromOfficeId === actor.officeId || event.toOfficeId === actor.officeId,
    )
  )
    return { outcome: "unknown" };
  const scannerSettings = await readSettingsSection("scanner");
  if (document.nextOfficeId === actor.officeId && document.status === "in_transit")
    return { outcome: "receive", doc: mapDocument(document) };
  if (
    actor.role !== "admin" &&
    document.status === "in_transit" &&
    document.nextOfficeId !== null &&
    document.nextOfficeId !== actor.officeId &&
    scannerSettings.blockWrongOfficeReceipts === false
  )
    return { outcome: "receive", doc: mapDocument(document) };
  if (
    document.currentOfficeId === actor.officeId &&
    ["completed", "filed", "on_hold", "in_transit"].includes(document.status)
  )
    return { outcome: "unavailable", doc: mapDocument(document) };
  if (document.currentOfficeId === actor.officeId)
    return { outcome: "dispatch", doc: mapDocument(document) };
  return {
    outcome: "wrong_office",
    doc: {
      ...mapDocument(document),
      subject: "",
      requester: "",
      remarks: undefined,
      fileLocation: undefined,
      attachments: [],
      events: [],
      createdBy: "",
    },
  };
});

app.get("/api/public/track", async (request) => {
  enforceRateLimit(`public-track:${clientIp(request)}`, security.publicTrackIpLimit, 60_000);
  const parsed = z.object({ token: z.string().min(24).max(128) }).safeParse(request.query);
  if (!parsed.success) throw app.httpErrors.notFound("Tracking reference not found.");
  const token = parsed.data.token;
  const document = await prisma.document.findFirst({
    where: { publicTokenHash: publicTokenHash(token), publicTokenRevokedAt: null },
    select: { trackingCode: true, status: true, updatedAt: true },
  });
  if (!document) throw app.httpErrors.notFound("Tracking reference not found.");
  const status = ["completed", "filed"].includes(document.status)
    ? "completed"
    : document.status === "voided"
      ? "unavailable"
      : document.status === "in_transit"
        ? "in_transit"
        : "active";
  return { trackingReference: document.trackingCode, status, updatedAt: document.updatedAt.toISOString() };
});

documentPost("/api/documents/:id/public-token/rotate", async (request) => {
  requireRoles(request, ["admin"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const document = await findDocument(id);
  const token = await newUniquePublicToken();
  await prisma.document.update({
    where: { id },
    data: { publicTokenHash: publicTokenHash(token), publicTokenIssuedAt: new Date(), publicTokenRevokedAt: null },
  });
  await audit(request, "document.public_token_rotated", document.trackingCode, "medium");
  return { token };
});

documentPost("/api/documents/:id/public-token/revoke", async (request) => {
  requireRoles(request, ["admin"]);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const document = await findDocument(id);
  await prisma.document.update({ where: { id }, data: { publicTokenRevokedAt: new Date() } });
  await audit(request, "document.public_token_revoked", document.trackingCode, "medium");
  return { ok: true };
});

app.get("/api/notifications", async (request) => {
  const actor = requireActor(request);
  const notifications = await prisma.notification.findMany({
    where: { userId: actor.id },
    orderBy: { timestamp: "desc" },
  });
  return notifications.map(mapNotification);
});
app.patch("/api/notifications/:id", async (request) => {
  requireActor(request);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const body = z.object({ read: z.boolean() }).parse(request.body);
  return mapNotification(
    await prisma.notification.update({
      where: { id, userId: requireActor(request).id },
      data: { read: body.read },
    }),
  );
});
app.post("/api/notifications/read-all", async (request) => {
  const actor = requireActor(request);
  await prisma.notification.updateMany({
    where: { userId: actor.id },
    data: { read: true },
  });
  return { ok: true };
});

app.get("/api/audit", async (request) => {
  requireRoles(request, ["admin"]);
  const entries = await prisma.auditEntry.findMany({ orderBy: { timestamp: "desc" }, take: 500 });
  return entries.map((entry) => ({
    ...entry,
    actorId: entry.actorId ?? "system",
    timestamp: entry.timestamp.toISOString(),
  }));
});

app.get("/api/settings", async (request) => {
  requireRoles(request, ["admin"]);
  const [general, sla, notifications, scanner] = await Promise.all([
    readSettingsSection("general"),
    readSettingsSection("sla"),
    readSettingsSection("notifications"),
    readSettingsSection("scanner"),
  ]);
  return {
    general,
    sla,
    notifications,
    scanner,
  };
});
app.patch("/api/settings/:key", async (request) => {
  requireRoles(request, ["admin"]);
  const key = z.object({ key: z.string() }).parse(request.params).key;
  if (/^(registration-|tracking-sequence-)/.test(key))
    throw app.httpErrors.forbidden("Reserved system setting.");
  if (!(key in settingsSchemas)) throw app.httpErrors.badRequest("Unknown settings section.");
  const schema = settingsSchemas[key as keyof typeof settingsSchemas];
  const value = schema.parse(request.body) as Prisma.InputJsonObject;
  const setting = await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  await audit(request, "settings.update", key, "medium");
  return setting.value;
});

app.get("/api/analytics", async (request) => {
  const actor = requireRoles(request, ["admin", "office_head"]);
  const documents = await prisma.document.findMany({
    where:
      actor.role === "admin"
        ? undefined
        : {
            OR: [
              { currentOfficeId: actor.officeId },
              { nextOfficeId: actor.officeId },
              { originOfficeId: actor.officeId },
            ],
          },
  });
  const active = documents.filter((d) => !["completed", "filed", "voided"].includes(d.status));
  const completed = documents.filter((d) => ["completed", "filed"].includes(d.status));
  const overdue = active.filter((d) => d.dueAt.getTime() < Date.now());
  const statusDistribution = Object.entries(
    documents.reduce<Record<string, number>>((acc, doc) => {
      acc[doc.status] = (acc[doc.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));
  return {
    summary: { active: active.length, completed: completed.length, overdue: overdue.length },
    statusDistribution,
  };
});

app.get("/api/reports/:template", async (request, reply) => {
  const actor = requireRoles(request, ["admin", "office_head"]);
  const template = z
    .object({ template: z.enum(["transmittal", "turnaround", "aging", "volume"]) })
    .parse(request.params).template;
  const query = z
    .object({
      format: z.enum(["json", "csv"]).default("json"),
      officeId: z.string().optional(),
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .parse(request.query);
  if (query.from && query.to && query.from > query.to)
    throw app.httpErrors.badRequest("From date must not be after To date.");
  const office = actor.role === "admin" ? query.officeId : actor.officeId;
  const documents = await prisma.document.findMany({
    where: office
      ? {
          OR: [
            { originOfficeId: office },
            { currentOfficeId: office },
            { nextOfficeId: office },
            {
              events: {
                some: {
                  OR: [{ fromOfficeId: office }, { toOfficeId: office }],
                },
              },
            },
          ],
        }
      : {},
    include: documentInclude,
    orderBy: { createdAt: "desc" },
  });
  const report = documentReport(documents.map(mapDocument), template, office, query.from, query.to);
  const offices = await prisma.office.findMany();
  const types = await prisma.documentType.findMany();
  const rows = report.rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        ["office", "from", "to"].includes(key)
          ? (offices.find((o) => o.id === value)?.name ?? value)
          : key === "type"
            ? (types.find((t) => t.id === value)?.name ?? value)
            : value,
      ]),
    ),
  );
  if (query.format === "csv") {
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${template}-report.csv"`);
    return [
      report.columns.map(csvCell).join(","),
      ...rows.map((row) =>
        report.columns.map((column) => csvCell(String(row[column] ?? ""))).join(","),
      ),
    ].join("\r\n");
  }
  return { columns: report.columns, rows };
});

app.get("/api/documents/:id/attachments/:attachmentId", async (request, reply) => {
  requireActor(request);
  const params = z.object({ id: z.string(), attachmentId: z.string() }).parse(request.params);
  const document = await findDocument(params.id);
  await requireDocumentAccess(request, document);
  const attachment = await prisma.documentAttachment.findFirst({
    where: { id: params.attachmentId, documentId: params.id },
  });
  if (!attachment) throw app.httpErrors.notFound("Attachment not found.");
  const match = /^data:([^;,]+)?;base64,(.*)$/s.exec(attachment.dataUrl);
  if (!match) throw app.httpErrors.badRequest("Attachment data is invalid.");
  const buffer = Buffer.from(match[2] ?? "", "base64");
  reply.header("content-type", attachment.mimeType);
  reply.header(
    "content-disposition",
    `attachment; filename="${attachment.fileName.replaceAll('"', "")}"`,
  );
  return buffer;
});

app.get("/api/documents/:id/slip", async (request, reply) => {
  requireActor(request);
  const id = z.object({ id: z.string() }).parse(request.params).id;
  const document = await findDocument(id);
  await requireDocumentAccess(request, document);
  const qr = await QRCode.toDataURL(document.qrPayload);
  const barcode = `data:image/svg+xml;base64,${Buffer.from(code128Svg(document.trackingCode), "utf8").toString("base64")}`;
  const generalSettings = await readSettingsSection("general");
  const institutionName = String(generalSettings.lguName);
  reply.header("content-type", "text/html; charset=utf-8");
  return `<!doctype html><html><head><title></title><style>
    @page{margin:0}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;padding:.35in;color:#111}
    .slip{width:340px;border:1px solid #111;padding:12px}
    .brand{margin:0;font-size:16px;line-height:1.1}
    .main{display:flex;align-items:center;gap:12px}
    .qr{width:118px;height:118px;flex:none}
    .details{min-width:0}
    .tracking{margin:0 0 6px;font-size:16px;line-height:1.15;word-break:break-word}
    .title{margin:0;font-size:12px;line-height:1.3;overflow-wrap:anywhere}
    .barcode-slot{height:66px;margin-top:10px;border:1px solid #111;display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:3px;padding:5px 8px}
    .barcode{display:block;width:100%;height:40px}
    .barcode-label{margin:0;text-align:center;font:10px/1 monospace}
  </style></head><body><div class="slip"><h1 class="brand">${escapeHtml(institutionName)}</h1><div class="main"><img class="qr" src="${qr}" alt="QR code"><div class="details"><p class="tracking"><strong>${escapeHtml(document.trackingCode)}</strong></p><p class="title">${escapeHtml(document.title)}</p></div></div><div class="barcode-slot" data-barcode-format="code128"><img class="barcode" src="${barcode}" alt="Code 128 barcode for ${escapeHtml(document.trackingCode)}"><p class="barcode-label">${escapeHtml(document.trackingCode)}</p></div></div><script src="/print-routing-slip.js"></script></body></html>`;
});

function csvCell(value: string) {
  if (/^[=+@-]/.test(value)) value = "'" + value;
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const port = Number(process.env.API_PORT ?? 3001);
if (process.env.NODE_ENV !== "test")
  normalizeLegacyUsernames()
    .then(() => app.listen({ port, host: "0.0.0.0" }))
    .catch((error) => {
      app.log.error(error);
      process.exit(1);
    });
