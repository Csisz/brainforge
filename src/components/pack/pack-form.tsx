"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createPack } from "@/lib/pack/actions";
import type { PackDays } from "@/lib/pack/types";
import { UpgradeNotice } from "@/components/plan/upgrade-notice";
import { THEME_IDS } from "@/lib/worksheets/theme-list";
import type { ThemeId } from "@/lib/worksheets/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DAYS: PackDays[] = [3, 5, 7];
const DURATIONS = [10, 20, 30, 45] as const;

export function PackForm({
  childId,
  defaultTheme,
  stripeConfigured,
}: {
  childId: string;
  defaultTheme: ThemeId;
  stripeConfigured: boolean;
}) {
  const t = useTranslations("pack");
  const tThemes = useTranslations("themes");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [days, setDays] = useState<PackDays>(5);
  const [durationMin, setDurationMin] = useState<(typeof DURATIONS)[number]>(20);
  const [theme, setTheme] = useState<ThemeId>(defaultTheme);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [invalidInput, setInvalidInput] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [gated, setGated] = useState(false);
  // One pack id per visit — a double-submit reuses it, so the server returns the
  // same pack instead of building two (B1). Success redirects, so a new visit
  // gets a fresh id.
  const [packId] = useState(() => crypto.randomUUID());

  function submit() {
    startTransition(async () => {
      setError(false);
      setInvalidInput(false);
      setRateLimited(false);
      setGated(false);
      const result = await createPack({ childId, days, durationMin, theme, packId, locale });
      if (result?.gated) return setGated(true);
      if (result?.error === "rate_limited") return setRateLimited(true);
      if (result?.error === "invalid_input") return setInvalidInput(true);
      if (result?.error) return setError(true);
      // success → the action redirects to the print document
    });
  }

  if (gated) {
    return (
      <Card className="border-crayon/40">
        <CardContent className="space-y-3 py-6 text-center">
          <CardTitle>{t("gatedTitle")}</CardTitle>
          <p className="mx-auto max-w-sm text-sm text-ink-soft">{t("gatedBody")}</p>
          {stripeConfigured ? (
            <Button asChild>
              <Link href="/app/settings">{t("gatedCta")}</Link>
            </Button>
          ) : (
            <UpgradeNotice className="flex flex-col items-center" />
          )}
          <div>
            <Button variant="ghost" size="sm" onClick={() => setGated(false)}>
              {t("gatedBack")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("daysLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <Chip key={d} selected={days === d} onClick={() => setDays(d)}>
              {t("daysCount", { count: d })}
            </Chip>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("lengthLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <Chip key={d} selected={durationMin === d} onClick={() => setDurationMin(d)}>
              {tCommon("minutes", { count: d })}
            </Chip>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("themeLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {THEME_IDS.map((id) => (
            <Chip key={id} selected={theme === id} onClick={() => setTheme(id)}>
              {tThemes(id)}
            </Chip>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-card border border-line bg-mist/60 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden="true" />
        <p className="text-sm leading-snug text-ink-soft">{t("fixedNote")}</p>
      </div>

      {rateLimited && <p className="text-sm text-ink-soft">{t("rateLimited")}</p>}
      {invalidInput && <p className="text-sm text-destructive">{tCommon("invalidInput")}</p>}
      {error && <p className="text-sm text-destructive">{t("error")}</p>}

      <Button size="lg" className="w-full" onClick={submit} disabled={pending}>
        {pending ? t("creating") : t("submit")}
      </Button>
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        selected
          ? "border-crayon bg-crayon-soft text-crayon-text"
          : "border-line bg-card text-ink-soft hover:bg-mist",
      )}
    >
      {children}
    </button>
  );
}
