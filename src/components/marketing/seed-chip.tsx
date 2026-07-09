import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function SeedChip({ seed, className }: { seed: string; className?: string }) {
  const t = useTranslations("worksheet");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-mist px-2.5 py-1 font-mono text-[11px] text-ink-soft",
        className,
      )}
    >
      {t("seedLabel")} · {seed.slice(0, 8)}
    </span>
  );
}
