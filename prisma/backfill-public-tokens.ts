import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseUrl, loadLocalEnv } from "../server/load-env.js";

loadLocalEnv();
assertDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const documents = await prisma.document.findMany({ where: { publicTokenHash: null }, select: { id: true, trackingCode: true } });
  console.log("tracking_reference,public_token");
  for (const document of documents) {
    const token = randomBytes(24).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    await prisma.document.update({ where: { id: document.id }, data: { publicTokenHash: hash, publicTokenIssuedAt: new Date() } });
    console.log(`${document.trackingCode},${token}`);
  }
  console.error(`Backfilled ${documents.length} public tracking tokens. Store stdout securely; tokens cannot be recovered later.`);
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
