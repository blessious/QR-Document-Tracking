import type { TrackedDocument } from "../src/types/index.js";

export function documentReport(
  documents: TrackedDocument[],
  template: string,
  office: string | undefined,
  from: string | undefined,
  to: string | undefined,
) {
  const inPeriod = (at: string) =>
    (!from || at >= `${from}T00:00:00.000Z`) && (!to || at <= `${to}T23:59:59.999Z`);
  const rows: Record<string, string | number>[] = [];
  if (template === "transmittal") {
    documents.forEach((doc) =>
      doc.events
        .filter(
          (e) =>
            ["dispatched", "returned"].includes(e.action) &&
            (!office || e.fromOfficeId === office) &&
            inPeriod(e.timestamp),
        )
        .forEach((event) =>
          rows.push({
            code: doc.trackingCode,
            title: doc.title,
            from: event.fromOfficeId ?? "",
            to: event.toOfficeId ?? "",
            dispatched: event.timestamp,
            remarks: event.remarks ?? "",
          }),
        ),
    );
    return { columns: ["code", "title", "from", "to", "dispatched", "remarks"], rows };
  }
  if (template === "aging") {
    documents
      .filter(
        (doc) =>
          !["completed", "filed", "voided"].includes(doc.status) &&
          +new Date(doc.dueAt) < Date.now() &&
          (!office || doc.currentOfficeId === office) &&
          inPeriod(doc.createdAt),
      )
      .forEach((doc) =>
        rows.push({
          code: doc.trackingCode,
          title: doc.title,
          office: doc.currentOfficeId,
          status: doc.status,
          due: doc.dueAt,
          overdueHours: Math.floor((Date.now() - +new Date(doc.dueAt)) / 3600000),
        }),
      );
    return { columns: ["code", "title", "office", "status", "due", "overdueHours"], rows };
  }
  if (template === "volume") {
    const counts = new Map<
      string,
      { month: string; registered: number; completed: number; filed: number }
    >();
    documents.forEach((doc) =>
      doc.events
        .filter(
          (e) =>
            ["registered", "completed", "filed"].includes(e.action) &&
            inPeriod(e.timestamp) &&
            (!office || (e.toOfficeId ?? doc.currentOfficeId) === office),
        )
        .forEach((event) => {
          const month = event.timestamp.slice(0, 7);
          const row = counts.get(month) ?? { month, registered: 0, completed: 0, filed: 0 };
          row[event.action as "registered" | "completed" | "filed"]++;
          counts.set(month, row);
        }),
    );
    return {
      columns: ["month", "registered", "completed", "filed"],
      rows: [...counts.values()].sort((a, b) => a.month.localeCompare(b.month)),
    };
  }
  const groups = new Map<
    string,
    { office: string; type: string; transfers: number; totalHours: number }
  >();
  documents.forEach((doc) => {
    let receipt: { at: string; office: string } | undefined;
    doc.events.forEach((event) => {
      if (["registered", "received"].includes(event.action) && event.toOfficeId)
        receipt = { at: event.timestamp, office: event.toOfficeId };
      if (["dispatched", "returned", "completed"].includes(event.action) && receipt) {
        if ((!office || receipt.office === office) && inPeriod(event.timestamp)) {
          const key = `${receipt.office}:${doc.typeId}`;
          const row = groups.get(key) ?? {
            office: receipt.office,
            type: doc.typeId,
            transfers: 0,
            totalHours: 0,
          };
          row.transfers++;
          row.totalHours += Math.max(
            0,
            (+new Date(event.timestamp) - +new Date(receipt.at)) / 3600000,
          );
          groups.set(key, row);
        }
        receipt = undefined;
      }
    });
  });
  return {
    columns: ["office", "type", "transfers", "averageHours"],
    rows: [...groups.values()].map(({ totalHours, ...row }) => ({
      ...row,
      averageHours: Number((totalHours / row.transfers).toFixed(2)),
    })),
  };
}
