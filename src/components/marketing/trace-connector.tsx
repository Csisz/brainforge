import { cn } from "@/lib/utils";

/**
 * The recurring motif: a dashed traceable stroke with a small start dot,
 * borrowed from the tracing worksheets. Used sparingly as a section divider
 * and the "how it works" step connector — never as decoration on its own.
 */
export function TraceConnector({
  orientation,
  className,
}: {
  orientation: "horizontal" | "vertical";
  className?: string;
}) {
  const horizontal = orientation === "horizontal";
  return (
    <svg
      viewBox={horizontal ? "0 0 100 10" : "0 0 10 100"}
      preserveAspectRatio="none"
      className={cn(horizontal ? "h-2.5 w-full" : "h-full w-2.5", className)}
      aria-hidden="true"
    >
      <circle cx={horizontal ? 5 : 5} cy={horizontal ? 5 : 5} r="3" className="fill-crayon" />
      <line
        x1={horizontal ? 9 : 5}
        y1={horizontal ? 5 : 9}
        x2={horizontal ? 100 : 5}
        y2={horizontal ? 5 : 100}
        className="stroke-ink-soft/35"
        strokeWidth="1.5"
        strokeDasharray="4 3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
