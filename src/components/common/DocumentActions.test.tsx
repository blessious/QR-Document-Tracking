// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DispatchDialog, DocumentActions } from "./DocumentActions";
import { ScanPage } from "../scanner/ScanPage";
import type { TrackedDocument } from "../../types";

const mocks = vi.hoisted(() => ({
  receive: vi.fn(),
  dispatch: vi.fn(),
  resolve: vi.fn(),
  setStatus: vi.fn(),
  voidDocument: vi.fn(),
  listPurposes: vi.fn(),
  createPurpose: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
const doc = {
  id: "doc",
  trackingCode: "LGU-2026-1",
  qrCode: "QR-2026-1",
  title: "Routing test",
  status: "received",
  currentOfficeId: "b",
  updatedAt: "2026-09-07T00:00:00.000Z",
  events: [],
} as unknown as TrackedDocument;
vi.mock("@/store/app-store", () => ({
  useApp: () => ({
    documents: [],
    session: { officeId: "b", role: "staff" },
    receiveDocument: mocks.receive,
    setStatus: mocks.setStatus,
    voidDocument: mocks.voidDocument,
    fileDocument: vi.fn(),
    dispatchDocument: mocks.dispatch,
    flagWrongOffice: vi.fn(),
    offices: [
      { id: "b", name: "Budget", active: true },
      { id: "c", name: "Cashier", active: true },
      { id: "x", name: "External office", active: true },
    ],
  }),
}));
vi.mock("@/services/api", () => ({
  api: {
    resolveScan: mocks.resolve,
    listRoutingPurposes: mocks.listPurposes,
    createRoutingPurpose: mocks.createPurpose,
  },
  officeName: (id: string) => id,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.receive.mockResolvedValue(undefined);
  mocks.dispatch.mockResolvedValue(undefined);
  mocks.voidDocument.mockResolvedValue(undefined);
  mocks.listPurposes.mockResolvedValue([]);
  mocks.createPurpose.mockResolvedValue({ id: "purpose", name: "For review", active: true });
});
afterEach(cleanup);

describe("dispatch confirmation", () => {
  it("does not mutate when opened or cancelled", () => {
    const close = vi.fn();
    render(<DispatchDialog doc={doc} open onOpenChange={close} />);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Cancel"));
    expect(close).toHaveBeenCalledWith(false);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("saves the selected destination only after confirmation", async () => {
    render(<DispatchDialog doc={doc} open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Destination office" }));
    fireEvent.click(screen.getByRole("option", { name: "Cashier" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm dispatch" }));
    await waitFor(() =>
      expect(mocks.dispatch).toHaveBeenCalledWith("doc", "c", undefined, doc.updatedAt),
    );
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });
  it("marks a document completed from the second-scan action dialog", async () => {
    const close = vi.fn();
    render(<DispatchDialog doc={doc} open onOpenChange={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark completed" }));
    await waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith("doc", "completed"));
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(false);
  });
  it("keeps the modal open and reports a failed save", async () => {
    mocks.dispatch.mockRejectedValue(new Error("Connection unavailable"));
    const close = vi.fn();
    render(<DispatchDialog doc={doc} open onOpenChange={close} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Destination office" }));
    fireEvent.click(screen.getByRole("option", { name: "Cashier" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm dispatch" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Connection unavailable"));
    expect(close).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("shows all active offices except the current custody office", () => {
    render(<DispatchDialog doc={doc} open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Destination office" }));
    expect(screen.getByRole("option", { name: /External office/ })).toBeDefined();
    expect(screen.queryByRole("option", { name: /Budget/ })).toBeNull();
  });
  it("filters destination offices by keyword", () => {
    render(<DispatchDialog doc={doc} open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Destination office" }));
    fireEvent.change(screen.getByPlaceholderText("Search destination offices..."), {
      target: { value: "cash" },
    });
    expect(screen.getByRole("option", { name: "Cashier" })).toBeDefined();
    expect(screen.queryByRole("option", { name: /External office/ })).toBeNull();
  });
  it("uses a manually typed purpose when dispatching", async () => {
    render(<DispatchDialog doc={doc} open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "For signature" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Destination office" }));
    fireEvent.click(screen.getByRole("option", { name: "Cashier" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm dispatch" }));
    await waitFor(() =>
      expect(mocks.dispatch).toHaveBeenCalledWith("doc", "c", "For signature", doc.updatedAt),
    );
  });
});

describe("void action", () => {
  it("requires a reason and voids a registered document", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DocumentActions doc={{ ...doc, status: "registered" }} />);
    const button = screen.getByRole("button", { name: "Void document" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Remarks / return reason"), {
      target: { value: "Mistaken duplicate" },
    });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() =>
      expect(mocks.voidDocument).toHaveBeenCalledWith("doc", "Mistaken duplicate"),
    );
    confirm.mockRestore();
  });
});

describe("deliberate QR/barcode/manual scans", () => {
  it("does not autofocus the manual scanner field on touch devices", async () => {
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });

    try {
      render(<ScanPage />);
      const input = screen.getByLabelText("QR or barcode");
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      expect(document.activeElement).not.toBe(input);
    } finally {
      if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
      else delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
    }
  });

  it("keeps the scanner input focused while no scan action is in progress", async () => {
    render(<ScanPage />);
    const input = screen.getByLabelText("QR or barcode");
    await waitFor(() => expect(document.activeElement).toBe(input));

    fireEvent.blur(input);
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("auto-receives the first scan and opens dispatch confirmation on the next", async () => {
    mocks.resolve
      .mockResolvedValueOnce({ outcome: "receive", doc: { ...doc, status: "in_transit" } })
      .mockResolvedValueOnce({ outcome: "dispatch", doc });
    render(<ScanPage />);
    const input = screen.getByLabelText("QR or barcode");
    fireEvent.change(input, { target: { value: doc.trackingCode } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledWith(doc.trackingCode));
    await waitFor(() => expect(mocks.receive).toHaveBeenCalledTimes(1));
    expect(mocks.success).toHaveBeenCalledWith("LGU-2026-1 received.", {
      id: "scanner-receipt",
      duration: 1600,
    });
    await waitFor(() =>
      expect((screen.getByLabelText("QR or barcode") as HTMLInputElement).value).toBe(""),
    );
    expect(mocks.dispatch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("QR or barcode"), { target: { value: doc.qrCode } });
    fireEvent.click(screen.getByText("Go"));
    await screen.findByRole("dialog");
    expect(mocks.receive).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("queues a fast follow-up scan until the preceding receipt is saved", async () => {
    let finishFirstScan: ((result: unknown) => void) | undefined;
    mocks.resolve
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirstScan = resolve;
          }),
      )
      .mockResolvedValueOnce({ outcome: "receive", doc: { ...doc, id: "doc-2" } });
    render(<ScanPage />);
    const input = screen.getByLabelText("QR or barcode");

    fireEvent.change(input, { target: { value: doc.trackingCode } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(1));

    fireEvent.change(input, { target: { value: doc.qrCode } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(mocks.resolve).toHaveBeenCalledTimes(1);

    finishFirstScan?.({ outcome: "receive", doc });
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(2));
    expect(mocks.resolve).toHaveBeenLastCalledWith(doc.qrCode);
    await waitFor(() => expect(mocks.receive).toHaveBeenCalledTimes(2));
  });
  it("does not invent a receipt after a failed lookup", async () => {
    mocks.resolve.mockRejectedValue(new Error("Sign in required"));
    render(<ScanPage />);
    fireEvent.change(screen.getByLabelText("QR or barcode"), { target: { value: doc.qrCode } });
    fireEvent.click(screen.getByText("Go"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Sign in required"));
    expect(mocks.receive).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
