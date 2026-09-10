import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertDatabaseUrl, loadLocalEnv } from "../server/load-env.js";

loadLocalEnv();
assertDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() ?? "System Administrator";
  const officeId = process.env.BOOTSTRAP_ADMIN_OFFICE_ID?.trim();
  if (!username || !officeId || password.length < 12)
    throw new Error("BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_OFFICE_ID, and a 12+ character BOOTSTRAP_ADMIN_PASSWORD are required.");
  if (["demo1234", "password1234", "superadmin.user"].includes(password.toLowerCase()))
    throw new Error("A default password cannot be used.");
  if (await prisma.user.count({ where: { role: "admin" } }))
    throw new Error("An administrator already exists; bootstrap is one-time only.");
  const office = await prisma.office.findUnique({ where: { id: officeId } });
  if (!office?.active) throw new Error("BOOTSTRAP_ADMIN_OFFICE_ID must identify an active office.");
  await prisma.user.create({
    data: {
      name, username, passwordHash: await bcrypt.hash(password, 12), role: "admin", officeId,
      position: "System Administrator", active: true,
      avatarInitials: name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join(""),
    },
  });
  console.log(`Created bootstrap administrator ${username}. Clear BOOTSTRAP_ADMIN_PASSWORD now.`);
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
