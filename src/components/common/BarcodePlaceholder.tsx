import { code128Barcode } from "@/lib/code128";
import { cn } from "@/lib/utils";

export function BarcodePlaceholder({ value, className }: { value: string; className?: string }) {
  const barcode = code128Barcode(value);

  return (
    <div
      className={cn("space-y-1 rounded-md border border-border bg-white px-3 py-2", className)}
      role="img"
      aria-label={`Code 128 barcode for ${value}`}
    >
      <svg
        className="block h-8 w-full"
        viewBox={`0 0 ${barcode.width} 42`}
        preserveAspectRatio="none"
        aria-hidden="true"
        shapeRendering="crispEdges"
      >
        {barcode.bars.map(({ x, width }) => (
          <rect key={`${x}-${width}`} x={x} y="0" width={width} height="42" />
        ))}
      </svg>
      <p className="text-center font-mono text-[10px] leading-3 text-slate-700">{value}</p>
    </div>
  );
}
