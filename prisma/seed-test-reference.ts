import { PrismaClient } from "@prisma/client";
import { assertDatabaseUrl, loadLocalEnv } from "../server/load-env.js";

loadLocalEnv();
assertDatabaseUrl();

const prisma = new PrismaClient();
const documentTypes = [
  ["dt-purchase-request", "Purchase Request", "PR"],
  ["dt-disbursement-voucher", "Disbursement Voucher", "DV"],
  ["dt-purchase-order", "Purchase Order", "PO"],
  ["dt-business-permit", "Business Permit Application", "BPA"],
  ["dt-travel-order", "Travel Order", "TO"],
  ["dt-leave-application", "Leave Application", "LA"],
  ["dt-resolution", "Sangguniang Bayan Resolution", "RES"],
  ["dt-ordinance", "Municipal Ordinance", "ORD"],
  ["dt-engineering-plan", "Engineering Plan / Project Request", "EPR"],
  ["dt-social-assistance", "Social Welfare Assistance Request", "SWAR"],
  ["dt-memorandum", "Memorandum", "MEMO"],
  ["dt-request-for-payment", "Request for Payment", "RFP"],
] as const;

async function main() {
  if (await prisma.document.count())
    throw new Error(
      "Refusing to replace test reference data while documents exist. Clear test documents first.",
    );

  await prisma.$transaction(async (tx) => {
    await tx.documentType.deleteMany();
    const office = await tx.office.findFirst({ orderBy: { createdAt: "asc" } });
    if (!office) throw new Error("Create an office before seeding document type reference data.");
    for (const [id, name, code] of documentTypes)
      await tx.documentType.create({ data: { id, name, code, active: true, officeId: office.id } });
  });

  console.log(JSON.stringify({ documentTypes: documentTypes.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
