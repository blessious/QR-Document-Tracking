import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertDatabaseUrl, loadLocalEnv } from "../server/load-env.js";
import {
  auditEntries,
  documentTypes,
  documents,
  notifications,
  offices,
  users,
} from "../src/data/mock.js";

loadLocalEnv();
assertDatabaseUrl();
if (process.env.NODE_ENV === "production") {
  throw new Error("Demo seed is disabled in production.");
}

const prisma = new PrismaClient();

async function main() {
  await prisma.auditEntry.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.trackingEvent.deleteMany();
  await prisma.documentAttachment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.documentType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.office.deleteMany();
  await prisma.setting.deleteMany();

  for (const office of offices) {
    await prisma.office.create({
      data: {
        id: office.id,
        code: office.code,
        name: office.name,
        location: office.location,
        keywords: office.keywords,
        active: office.active,
      },
    });
  }

  const passwordHash = await bcrypt.hash("demo1234", 12);
  for (const user of users) {
    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        officeId: user.officeId,
        position: user.position,
        active: user.active,
        lastLogin: new Date(user.lastLogin),
        avatarInitials: user.avatarInitials,
        passwordHash,
      },
    });
  }

  const fallbackOfficeId = offices[0]?.id;
  if (!fallbackOfficeId) throw new Error("At least one office is required to seed document types.");
  for (const type of documentTypes) {
    const firstDocumentUsingType = documents.find((document) => document.typeId === type.id);
    await prisma.documentType.create({
      data: {
        id: type.id,
        name: type.name,
        code: type.code,
        officeId: firstDocumentUsingType?.originOfficeId ?? fallbackOfficeId,
      },
    });
  }

  for (const document of documents) {
    await prisma.document.create({
      data: {
        id: document.id,
        trackingCode: document.trackingCode,
        qrCode: document.qrCode,
        qrPayload: document.qrCode,
        title: document.title,
        subject: document.subject,
        typeId: document.typeId,
        status: document.status,
        priority: document.priority,
        originOfficeId: document.originOfficeId,
        currentOfficeId: document.currentOfficeId,
        nextOfficeId: document.nextOfficeId,
        createdById: document.createdBy,
        createdAt: new Date(document.createdAt),
        updatedAt: new Date(document.updatedAt),
        dueAt: new Date(document.dueAt),
        remarks: document.remarks,
        requester: document.requester,
        pageCount: document.pageCount,
        fileLocation: document.fileLocation,
      },
    });

    for (const event of document.events) {
      await prisma.trackingEvent.create({
        data: {
          id: `${document.id}-${event.id}`,
          documentId: document.id,
          action: event.action,
          fromOfficeId: event.fromOfficeId,
          toOfficeId: event.toOfficeId,
          actorId: event.actorId,
          remarks: event.remarks,
          timestamp: new Date(event.timestamp),
        },
      });
    }
  }

  for (const notification of notifications) {
    await prisma.notification.create({
      data: {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        kind: notification.kind,
        read: notification.read,
        documentId: notification.documentId,
        timestamp: new Date(notification.timestamp),
      },
    });
  }

  for (const entry of auditEntries) {
    await prisma.auditEntry.create({
      data: {
        id: entry.id,
        actorId: entry.actorId,
        action: entry.action,
        target: entry.target,
        ip: entry.ip,
        timestamp: new Date(entry.timestamp),
        severity: entry.severity,
      },
    });
  }

  await prisma.setting.createMany({
    data: [
      {
        key: "general",
        value: {
          lguName: "City Government of San Lorenzo",
          address: "City Hall Compound, Rizal Street, San Lorenzo",
        },
      },
      {
        key: "sla",
        value: { routineHours: 72, urgentHours: 24, rushHours: 8 },
      },
      {
        key: "scanner",
        value: {
          blockWrongOfficeReceipts: true,
          requireRemarksOnHold: true,
          vibrateOnSuccessfulScan: true,
        },
      },
      {
        key: "notifications",
        value: {
          overdueAlerts: true,
          wrongOfficeScans: true,
          dailyDigest: false,
        },
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
