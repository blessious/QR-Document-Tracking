import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

export function QrPlaceholder({
  value,
  size = 128,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    setDataUrl("");
    void QRCode.toDataURL(value, { margin: 1, width: size * 2 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [size, value]);

  return (
    <div
      className={cn("rounded-xl bg-white p-2 shadow-sm ring-1 ring-border", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`QR label for ${value}`}
    >
      {dataUrl ? (
        <img src={dataUrl} alt="" className="size-full" />
      ) : (
        <span className="text-xs text-slate-600">Generating QR…</span>
      )}
    </div>
  );
}
