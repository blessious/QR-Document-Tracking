import type { TrackedDocument } from "../types";

export function trackingMetrics(documents: TrackedDocument[], officeName: (id: string) => string) {
  const completed = documents.flatMap((doc) => {
    const event = doc.events.find((event) => event.action === "completed");
    return event
      ? [
          {
            doc,
            at: event.timestamp,
            hours: (+new Date(event.timestamp) - +new Date(doc.createdAt)) / 3600000,
          },
        ]
      : [];
  });
  const periods = new Map<string, { day: string; registered: number; completed: number }>();
  const day = (at: string) => {
    const key = at.slice(0, 10);
    if (!periods.has(key)) periods.set(key, { day: key, registered: 0, completed: 0 });
    return periods.get(key)!;
  };
  documents.forEach((doc) => day(doc.createdAt).registered++);
  completed.forEach((item) => day(item.at).completed++);
  const handling = new Map<string, number[]>();
  documents.forEach((doc) => {
    let receipt: { office: string; at: string } | undefined;
    [...doc.events]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .forEach((event) => {
        if (["registered", "received"].includes(event.action) && event.toOfficeId)
          receipt = { office: event.toOfficeId, at: event.timestamp };
        if (["dispatched", "returned", "completed"].includes(event.action) && receipt) {
          const values = handling.get(receipt.office) ?? [];
          values.push(Math.max(0, (+new Date(event.timestamp) - +new Date(receipt.at)) / 3600000));
          handling.set(receipt.office, values);
          receipt = undefined;
        }
      });
  });
  const hours = completed.map((item) => item.hours).sort((a, b) => a - b);
  const median = hours.length
    ? (hours[Math.floor((hours.length - 1) / 2)]! + hours[Math.floor(hours.length / 2)]!) / 2
    : null;
  const compliant = completed.filter(
    (item) => +new Date(item.at) <= +new Date(item.doc.dueAt),
  ).length;
  return {
    completedCount: completed.length,
    average: hours.length ? hours.reduce((sum, value) => sum + value, 0) / hours.length : null,
    median,
    compliance: completed.length ? Math.round((compliant / completed.length) * 100) : null,
    handlers: new Set(
      documents.flatMap((doc) =>
        doc.events
          .filter((event) => ["received", "dispatched"].includes(event.action))
          .map((event) => event.actorId),
      ),
    ).size,
    volumeByDay: [...periods.values()].sort((a, b) => a.day.localeCompare(b.day)),
    turnaroundByOffice: [...handling].map(([id, values]) => ({
      office: officeName(id),
      hours: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)),
    })),
    statusDistribution: Object.entries(
      documents.reduce<Record<string, number>>((counts, doc) => {
        counts[doc.status] = (counts[doc.status] ?? 0) + 1;
        return counts;
      }, {}),
    ).map(([name, value]) => ({ name, value })),
  };
}
