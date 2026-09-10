import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { loadLocalEnv, assertDatabaseUrl } from "../server/load-env.js";

loadLocalEnv();
assertDatabaseUrl();

const offices = [
  ["municipal-budget", "Municipal Budget Office", "budget"],
  ["commission-elections", "Commission on Elections", "comelec"],
  ["dilg", "Department of the Interior and Local Government", "dilg"],
  ["meo-plaza-parks", "MEO - Maintenance of Plaza's, Parks and Monuments", "meo_plaza"],
  ["meo-garbage", "MEO - Garbage Collection", "meo_garbage"],
  ["meo-roads-bridges", "MEO - Maintenance of Roads and Bridges", "meo_roads"],
  ["meo-street-cleaning", "MEO - Street Cleaning", "meo_cleaning"],
  ["meo-street-lighting", "MEO - Street Lighting", "meo_lighting"],
  ["mo-business-permit", "MO - Business Permit and Licensing Section", "business_permit"],
  ["mo-human-resource", "MO - Human Resource and Management Section", "human_resource"],
  ["mo-ict", "MO - Information and Communications Technology Section", "ict"],
  ["mo-library", "MO - Information and Library Services Section", "library"],
  ["mo-nutrition", "MO - Nutrition Center", "nutrition"],
  ["mo-sports", "MO - Sports and Games Section", "sports"],
  ["mpoc-traffic", "MPOC - Traffic Aide", "traffic"],
  ["municipal-accounting", "Municipal Accounting Office", "accounting"],
  ["municipal-administrator", "Municipal Administrator's Office", "administrator"],
  ["municipal-agriculture", "Municipal Agriculture's Office", "agriculture"],
  ["municipal-assessor", "Municipal Assessor's Office", "assessor"],
  ["municipal-civil-registrar", "Municipal Civil Registrar's Office", "civil_registrar"],
  ["municipal-drrm", "Municipal Disaster Risk Reduction and Management Office", "drrm"],
  ["municipal-engineering", "Municipal Engineering Office", "engineering"],
  ["municipal-health", "Municipal Health Office", "health"],
  ["rhu-ii", "Rural Health Unit (RHU) II", "rhu_ii"],
  ["municipal-planning", "Municipal Planning and Development Office", "planning"],
  ["municipal-social-welfare", "Municipal Social Welfare and Development Office", "social_welfare"],
  ["municipal-treasurer", "Municipal Treasurer's Office", "treasurer"],
  ["mayor", "Office of the Mayor", "mayor"],
  ["vice-mayor", "Office of the Vice Mayor", "vice_mayor"],
  ["waterworks", "Operation of Waterworks System", "waterworks"],
  ["market", "Operation of Market", "market"],
  ["pnp-boac", "Philippine National Police - Boac", "pnp_boac"],
  ["sb-legislative-capitol", "SB Legislative (Capitol)", "sb_capitol"],
  ["sb-legislative-office", "Sangguniang Bayan - Legislative Office", "sb_legislative"],
  ["sb-secretariat", "Sangguniang Bayan - Secretariat Office", "sb_secretariat"],
  ["slaughter-house", "Operation of Slaughter House", "slaughter_house"],
  ["pao", "PAO", "pao"],
] as const;

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("superadmin.user", 12);
  const officeUsers = await Promise.all(
    offices.map(async ([officeId, name, username]) => ({
      id: `user-${officeId}`,
      name: `${name} User`,
      username,
      passwordHash: await bcrypt.hash(`${username}.user`, 12),
      role: "staff" as const,
      officeId,
      position: "Office Staff",
      avatarInitials: username.slice(0, 2).toUpperCase(),
      active: true,
    })),
  );
  await prisma.$transaction(
    async (tx) => {
      // These records reference users/offices and must be removed first for a clean test reset.
      await tx.notification.deleteMany();
      await tx.trackingEvent.deleteMany();
      await tx.auditEntry.deleteMany();
      await tx.document.deleteMany();
      await tx.documentType.deleteMany();
      await tx.setting.deleteMany();
      await tx.user.deleteMany();
      await tx.office.deleteMany();

      await tx.office.createMany({
        data: offices.map(([id, name, code]) => ({
          id,
          name,
          code: code.toUpperCase(),
          location: "Main office",
          keywords: "",
          active: true,
        })),
      });

      await tx.user.create({
        data: {
          id: "user-superadmin",
          name: "Super Administrator",
          username: "superadmin",
          passwordHash,
          role: "admin",
          officeId: "municipal-administrator",
          position: "System Administrator",
          avatarInitials: "SA",
          active: true,
        },
      });

      await tx.user.createMany({
        data: officeUsers,
      });
    },
    { timeout: 30000 },
  );
  console.log(JSON.stringify({ offices: offices.length, users: offices.length + 1 }, null, 2));
}

main().finally(() => prisma.$disconnect());
