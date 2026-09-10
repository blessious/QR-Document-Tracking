import { DispatchDialog } from "@/components/common/DocumentActions";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, officeName } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { ScanOutcome, TrackedDocument } from "@/types";
import { Link } from "@tanstack/react-router";
import jsQR from "jsqr";
import { AlertTriangle, Camera, CheckCircle2, Info, Keyboard, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type ScanResult = { outcome: ScanOutcome; doc?: TrackedDocument };
type ScanFeedback = {
  tone: "success" | "error" | "warning" | "info";
  title: string;
  description: string;
};

function readQrValue(rawValue: string) {
  const value = rawValue.trim();
  if (!value.startsWith("{")) return value;

  try {
    const payload = JSON.parse(value) as { qrCode?: unknown; trackingCode?: unknown };
    return typeof payload.qrCode === "string"
      ? payload.qrCode
      : typeof payload.trackingCode === "string"
        ? payload.trackingCode
        : value;
  } catch {
    return value;
  }
}

export function ScanPage() {
  const { session, receiveDocument, flagWrongOffice } = useApp();
  const officeId = session?.officeId ?? "off-accounting";
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const resolving = useRef(false);
  const queuedScansRef = useRef<string[]>([]);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const scanInputLockedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const detectedRef = useRef(false);
  const cameraGeneration = useRef(0);
  const receiptFeedbackTimeoutRef = useRef<number | null>(null);

  scanInputLockedRef.current = actionPending || dispatchOpen;

  const isDesktopScanner = () =>
    !window.matchMedia || window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const restoreScanInputFocus = () => {
    if (!isDesktopScanner()) return;
    window.setTimeout(() => {
      if (!scanInputLockedRef.current && isDesktopScanner()) scanInputRef.current?.focus();
    }, 0);
  };

  const clearReceiptFeedbackTimeout = () => {
    if (receiptFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(receiptFeedbackTimeoutRef.current);
      receiptFeedbackTimeoutRef.current = null;
    }
  };

  const stopCamera = () => {
    cameraGeneration.current++;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const resolve = async (value: string) => {
    const scanValue = readQrValue(value);
    if (!scanValue || dispatchOpen) return;
    if (resolving.current) {
      queuedScansRef.current.push(scanValue);
      setCode("");
      return;
    }
    stopCamera();
    resolving.current = true;
    setActionPending(true);
    setCode("");
    setResult(null);
    clearReceiptFeedbackTimeout();
    setFeedback(null);
    let receiveSucceeded = false;
    try {
      const nextResult = await api.resolveScan(scanValue);
      if (nextResult.outcome === "receive" && nextResult.doc) {
        await receiveDocument(nextResult.doc.id, undefined, nextResult.doc.updatedAt);
        setFeedback({
          tone: "success",
          title: "Document received",
          description: `${nextResult.doc.trackingCode} is now in your custody.`,
        });
        receiptFeedbackTimeoutRef.current = window.setTimeout(() => {
          setFeedback((current) => (current?.title === "Document received" ? null : current));
          receiptFeedbackTimeoutRef.current = null;
        }, 1600);
        toast.success(
          `${nextResult.doc.trackingCode} received.`,
          { id: "scanner-receipt", duration: 1600 },
        );
        receiveSucceeded = true;
        void startCamera();
      } else {
        queuedScansRef.current = [];
        setResult(nextResult);
        setFeedback(getScanFeedback(nextResult));
        setDispatchOpen(nextResult.outcome === "dispatch");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Scan failed. Check your connection and retry.";
      setFeedback({
        tone: "error",
        title: "Scan failed",
        description: message,
      });
      queuedScansRef.current = [];
      toast.error(message);
    } finally {
      resolving.current = false;
      setActionPending(false);
      if (receiveSucceeded) {
        const nextScan = queuedScansRef.current.shift();
        if (nextScan) void resolve(nextScan);
      }
    }
  };

  const startCamera = async () => {
    detectedRef.current = false;
    const generation = ++cameraGeneration.current;
    if (!window.isSecureContext) {
      setFeedback({
        tone: "error",
        title: "Camera unavailable",
        description: "Camera scanning needs HTTPS on mobile.",
      });
      toast.error("Camera needs HTTPS on mobile.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setFeedback({
        tone: "error",
        title: "Camera unavailable",
        description: "Camera access is not supported in this browser.",
      });
      toast.error("Camera access is not supported in this browser.");
      return;
    }

    setResult(null);
    setScanning(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (generation !== cameraGeneration.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }
      const detectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;
      const canvas = document.createElement("canvas");
      const detector = detectorCtor
        ? new detectorCtor({ formats: ["qr_code"] })
        : {
            detect: async (video: HTMLVideoElement) => {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const context = canvas.getContext("2d", { willReadFrequently: true });
              if (!context || !canvas.width || !canvas.height) return [];
              context.drawImage(video, 0, 0);
              const frame = context.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(frame.data, frame.width, frame.height);
              return code ? [{ rawValue: code.data }] : [];
            },
          };
      intervalRef.current = window.setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        void detector
          .detect(video)
          .then((codes) => {
            const value = codes[0]?.rawValue;
            if (!value || detectedRef.current || generation !== cameraGeneration.current) return;
            detectedRef.current = true;
            stopCamera();
            void resolve(value);
          })
          .catch(() => {
            if (generation !== cameraGeneration.current) return;
            stopCamera();
            setFeedback({
              tone: "error",
              title: "QR detection stopped",
              description: "Try starting the camera again and rescan the routing slip.",
            });
            toast.error("QR detection stopped unexpectedly. Try again.");
          });
      }, 500);
    } catch (error) {
      if (generation !== cameraGeneration.current) return;
      stopCamera();
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was denied."
          : "Camera is unavailable on this device or browser.";
      setFeedback({
        tone: "error",
        title: "Camera unavailable",
        description: message,
      });
      toast.error(message);
    }
  };

  useEffect(() => {
    void startCamera();
    return () => {
      clearReceiptFeedbackTimeout();
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!actionPending && !dispatchOpen) restoreScanInputFocus();
  }, [actionPending, dispatchOpen]);

  return (
    <div className="min-w-0 w-full max-w-full space-y-4 overflow-x-hidden">
      {feedback ? <ScanFeedbackBanner feedback={feedback} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-slate-950 shadow-sm">
          <div className="p-3 sm:p-5">
            <div className="relative mx-auto flex aspect-square w-full max-w-[34rem] items-center justify-center overflow-hidden rounded-lg bg-slate-950 shadow-inner lg:max-w-[38rem]">
              <video
                ref={videoRef}
                className="absolute inset-0 size-full object-cover"
                muted
                playsInline
                autoPlay
              />
              <div className="absolute inset-7 rounded-none border border-white/80 shadow-[0_0_0_999px_rgba(2,6,23,0.22)] sm:inset-10" />
              <div className="absolute left-7 top-7 size-8 border-l-4 border-t-4 border-primary sm:left-10 sm:top-10" />
              <div className="absolute right-7 top-7 size-8 border-r-4 border-t-4 border-primary sm:right-10 sm:top-10" />
              <div className="absolute bottom-7 left-7 size-8 border-b-4 border-l-4 border-primary sm:bottom-10 sm:left-10" />
              <div className="absolute bottom-7 right-7 size-8 border-b-4 border-r-4 border-primary sm:bottom-10 sm:right-10" />
              {scanning ? (
                <div className="absolute inset-x-10 h-0.5 animate-bounce bg-primary shadow-[0_0_18px_var(--primary)]" />
              ) : null}
              {!scanning && !actionPending && !dispatchOpen ? (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-4 top-4 z-10 size-10 rounded-full bg-black/45 text-white hover:bg-black/65"
                  onClick={() => void startCamera()}
                  aria-label="Start camera"
                  title="Start camera"
                >
                  <Camera className="size-5" aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <Card className="shadow-sm">
            <CardContent className="space-y-3 p-4 pt-4 sm:pt-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Keyboard className="size-4 text-primary" aria-hidden /> Manual entry
              </p>
              <form
                className="grid gap-2 sm:grid-cols-[1fr_auto] lg:grid-cols-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  void resolve(code);
                }}
              >
                <Input
                  ref={scanInputRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onBlur={restoreScanInputFocus}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void resolve(code);
                    }
                  }}
                  aria-label="QR or barcode"
                  autoComplete="off"
                  className="h-11 font-mono"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="h-11 lg:w-full"
                  disabled={!code.trim() || actionPending || dispatchOpen}
                >
                  Go
                </Button>
              </form>
            </CardContent>
          </Card>

          {result?.outcome === "unknown" ? (
            <Card className="border-destructive/40 shadow-sm">
              <CardContent className="space-y-2 p-4 pt-4 text-center sm:pt-6">
                <AlertTriangle className="mx-auto size-8 text-destructive" aria-hidden />
                <p className="font-medium">Unrecognised scan label</p>
                <p className="text-sm text-muted-foreground">
                  This code is not registered. Ask the releasing office to reprint the routing slip.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {result?.doc ? (
            <Card
              className={
                result.outcome === "wrong_office"
                  ? "border-warning/50 shadow-sm"
                  : result.outcome === "receive"
                    ? "border-success/50 shadow-sm"
                    : "shadow-sm"
              }
            >
              <CardContent className="space-y-3 p-4 pt-4 sm:pt-6">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">
                      {result.doc.trackingCode}
                    </p>
                    <p className="truncate text-sm font-medium">{result.doc.title}</p>
                  </div>
                  <StatusBadge status={result.doc.status} className="self-start sm:shrink-0" />
                </div>

                {result.outcome === "dispatch" ? (
                  <DispatchDialog
                    key={result.doc.id}
                    doc={result.doc}
                    open={dispatchOpen}
                    onSuccess={(destination) => {
                      setFeedback({
                        tone: "success",
                        title: "Document dispatched",
                        description: `${result.doc?.trackingCode ?? "The document"} was sent to ${officeName(destination)}.`,
                      });
                    }}
                    onError={(message) => {
                      setFeedback({
                        tone: "error",
                        title: "Dispatch failed",
                        description: message,
                      });
                    }}
                    onOpenChange={(open) => {
                      setDispatchOpen(open);
                      if (!open) {
                        setResult(null);
                        setFeedback((current) =>
                          current?.title === "Document ready to dispatch" ? null : current,
                        );
                        void startCamera();
                      }
                    }}
                  />
                ) : null}
                {result.outcome === "unavailable" ? (
                  <p>
                    This document is {result.doc.status.replaceAll("_", " ")}. No scan action is
                    available. Review the full record.
                  </p>
                ) : null}

                {result.outcome === "wrong_office" ? (
                  <>
                    <div className="min-w-0 rounded-lg bg-warning-soft p-3 text-sm text-warning">
                      <p className="flex min-w-0 flex-wrap items-start gap-2 font-medium leading-5">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>Wrong office</span>
                      </p>
                      <p className="mt-1 break-words leading-5">
                        This document is routed to{" "}
                        {officeName(result.doc.nextOfficeId ?? result.doc.currentOfficeId)}. Do not
                        accept it here.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="h-12 w-full"
                      onClick={async () => {
                        setActionPending(true);
                        try {
                          const trackingCode = result.doc!.trackingCode;
                          await flagWrongOffice(result.doc!.id, officeId);
                          setFeedback({
                            tone: "success",
                            title: "Misrouting reported",
                            description: `${trackingCode} was flagged and sent back for correction.`,
                          });
                          toast.success(`${trackingCode} misrouting reported.`);
                          setResult(null);
                          void startCamera();
                        } catch (error) {
                          const message =
                            error instanceof Error ? error.message : "Could not report misrouting.";
                          setFeedback({
                            tone: "error",
                            title: "Could not report misrouting",
                            description: message,
                          });
                          toast.error(message);
                        } finally {
                          setActionPending(false);
                        }
                      }}
                      disabled={actionPending}
                    >
                      {actionPending ? "Reporting..." : "Report misrouting"}
                    </Button>
                  </>
                ) : null}

                <Button variant="ghost" className="w-full" asChild>
                  <Link to="/documents/$docId" params={{ docId: result.doc.id }}>
                    View full record
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function getScanFeedback(scan: ScanResult): ScanFeedback {
  switch (scan.outcome) {
    case "dispatch":
      return {
        tone: "info",
        title: "Document ready to dispatch",
        description: `${scan.doc?.trackingCode ?? "This document"} is in your custody. Confirm the destination to continue.`,
      };
    case "wrong_office":
      return {
        tone: "warning",
        title: "Wrong office",
        description: `Do not accept this document here. It is routed to ${officeName(scan.doc?.nextOfficeId ?? scan.doc?.currentOfficeId)}.`,
      };
    case "unavailable":
      return {
        tone: "warning",
        title: "No scan action available",
        description: `This document is already ${scan.doc?.status.replaceAll("_", " ") ?? "unavailable"}. Review the full record.`,
      };
    case "unknown":
      return {
        tone: "error",
        title: "Unrecognised scan label",
        description:
          "This code is not registered. Ask the releasing office to reprint the routing slip.",
      };
    default:
      return {
        tone: "error",
        title: "Scan failed",
        description: "The scan could not be completed. Try again.",
      };
  }
}

function ScanFeedbackBanner({ feedback }: { feedback: ScanFeedback }) {
  const Icon =
    feedback.tone === "success"
      ? CheckCircle2
      : feedback.tone === "error"
        ? AlertTriangle
        : feedback.tone === "warning"
          ? AlertTriangle
          : Info;
  const toneClass =
    feedback.tone === "success"
      ? "border-success/50 bg-success-soft text-success"
      : feedback.tone === "error"
        ? "border-destructive/50 bg-destructive/10 text-destructive"
        : feedback.tone === "warning"
          ? "border-warning/50 bg-warning-soft text-warning"
          : "border-info/50 bg-info-soft text-info";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`sticky top-2 z-20 flex items-start gap-3 rounded-xl border px-4 py-3 shadow-md sm:px-5 ${toneClass}`}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">{feedback.title}</p>
        <p className="mt-1 text-sm text-foreground/80">{feedback.description}</p>
      </div>
    </div>
  );
}
