import { cn } from "@/lib/utils";

/**
 * Parent-facing outcome chips for a development goal (Sprint 7 M2). Parents think
 * in outcomes — "patience", "concentration" — not the skill taxonomy, so every
 * goal carries 2-4 short outcome words (messages `goalOutcomes.<goal>`) rendered
 * as small pills under its description, in the wizard tiles and the catalog.
 *
 * Purely presentational (no hooks): the caller resolves the label + strings from
 * next-intl, so this renders identically in server (catalog) and client (wizard).
 */
export function GoalOutcomes({
  label,
  outcomes,
  className,
}: {
  label: string;
  outcomes: string[];
  className?: string;
}) {
  if (!outcomes.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <span className="text-[11px] font-medium text-ink-soft">{label}</span>
      {outcomes.map((outcome) => (
        <span
          key={outcome}
          className="rounded-full bg-mint/70 px-2 py-0.5 text-[11px] font-medium text-ink"
        >
          {outcome}
        </span>
      ))}
    </div>
  );
}
