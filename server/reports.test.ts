import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { documentReport } from "./reports.js";
import type { TrackedDocument } from "../src/types/index.js";

const doc = {
  id: "doc",
  trackingCode: "LGU-2026-000001",
  title: "Test",
  typeId: "type",
  status: "filed",
  currentOfficeId: "b",
  originOfficeId: "a",
  createdAt: "2026-09-01T00:00:00.000Z",
  dueAt: "2026-09-03T00:00:00.000Z",
  events: [
    { action: "registered", toOfficeId: "a", timestamp: "2026-09-01T00:00:00.000Z" },
    {
      action: "dispatched",
      fromOfficeId: "a",
      toOfficeId: "b",
      timestamp: "2026-09-01T02:00:00.000Z",
    },
    {
      action: "received",
      fromOfficeId: "a",
      toOfficeId: "b",
      timestamp: "2026-09-01T03:00:00.000Z",
    },
    { action: "completed", toOfficeId: "b", timestamp: "2026-09-01T06:00:00.000Z" },
    { action: "filed", toOfficeId: "b", timestamp: "2026-09-02T00:00:00.000Z" },
  ],
} as unknown as TrackedDocument;

describe("tracking outputs", () => {
  it("filters dispatch events by sender and date, rather than current custody", () => {
    expect(documentReport([doc], "transmittal", "a", "2026-09-01", "2026-09-01").rows).toHaveLength(
      1,
    );
    expect(documentReport([doc], "transmittal", "b", undefined, undefined).rows).toHaveLength(0);
    expect(documentReport([doc], "transmittal", "a", "2026-09-02", undefined).rows).toHaveLength(0);
  });
  it("calculates office handling and monthly event counts", () => {
    expect(documentReport([doc], "turnaround", "b", undefined, undefined).rows).toEqual([
      { office: "b", type: "type", transfers: 1, averageHours: 3 },
    ]);
    expect(documentReport([doc], "volume", undefined, undefined, undefined).rows).toEqual([
      { month: "2026-09", registered: 1, completed: 1, filed: 1 },
    ]);
    expect(documentReport([doc], "aging", undefined, undefined, undefined).rows).toHaveLength(0);
  });
  it("generates a QR payload that the fallback camera decoder can read", () => {
    const payload = JSON.stringify({ trackingCode: doc.trackingCode, qrCode: "QR-2026-000001" });
    const qr = QRCode.create(payload);
    const scale = 8,
      margin = 4,
      size = (qr.modules.size + margin * 2) * scale;
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < qr.modules.size; y++)
      for (let x = 0; x < qr.modules.size; x++) {
        if (!qr.modules.get(y, x)) continue;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
          }
      }
    const decode = jsQR as unknown as (
      data: Uint8ClampedArray,
      width: number,
      height: number,
    ) => { data: string } | null;
    expect(decode(pixels, size, size)?.data).toBe(payload);
  });
});
