"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Check } from "lucide-react";
import type { DevelopmentGoal, ThemeId, Difficulty } from "@/lib/worksheets/types";
import type { MaterialId, SessionRequest } from "@/lib/activities/engine";
import type { ChildRow } from "@/lib/children/queries";
import { GOALS } from "@/lib/worksheets/goal-list";
import { THEME_IDS } from "@/lib/worksheets/theme-list";
import { MATERIALS } from "@/lib/activities/material-list";
import { getAvatarIcon } from "@/lib/children/avatar-list";
import { ageFromBirthMonth } from "@/lib/children/age";
import { defaultDifficulty } from "@/lib/activities/difficulty";
import { startSession } from "@/lib/sessions/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const DURATIONS: SessionRequest["durationMin"][] = [10, 20, 30, 45];

export function SessionWizard({ children, defaultChildId }: { children: ChildRow[]; defaultChildId?: string }) {
  const t = useTranslations("wizard");
  const tGoals = useTranslations("goals");
  const tGoalDesc = useTranslations("goalDescriptions");
  const tThemes = useTranslations("themes");
  const tMaterials = useTranslations("materials");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [childId, setChildId] = useState(defaultChildId ?? children[0]?.id ?? "");
  const child = children.find((c) => c.id === childId) ?? children[0]!;
  const age = useMemo(() => ageFromBirthMonth(child.birth_month), [child]);

  const [goals, setGoals] = useState<DevelopmentGoal[]>(["attention"]);
  const [theme, setTheme] = useState<ThemeId>((child.preferred_themes[0] as ThemeId) ?? "nature");
  const [durationMin, setDurationMin] = useState<SessionRequest["durationMin"]>(20);
  const [materials, setMaterials] = useState<MaterialId[]>(["pencil", "paper"]);
  const [manualDifficulty, setManualDifficulty] = useState<Difficulty | null>(null);
  const difficulty = manualDifficulty ?? defaultDifficulty(age);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);

  function toggleGoal(goal: DevelopmentGoal) {
    setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
  }
  function toggleMaterial(material: MaterialId) {
    setMaterials((prev) => (prev.includes(material) ? prev.filter((m) => m !== material) : [...prev, material]));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(false);
    setRateLimited(false);
    const result = await startSession({
      childId: child.id,
      goals: goals.length ? goals : ["attention"],
      theme,
      durationMin,
      materials,
      // null ⇒ let calibration pick a level per goal.
      difficulty: manualDifficulty,
      locale,
    });
    if (result.error === "rate_limited") {
      setRateLimited(true);
      setSubmitting(false);
      return;
    }
    if (result.error || !result.sessionId) {
      setError(true);
      setSubmitting(false);
      return;
    }
    router.push(`/app/sessions/${result.sessionId}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink">{t("title")}</h1>
        <p className="mt-1 text-ink-soft">{t("subtitle")}</p>
      </div>

      {children.length > 1 && (
        <section className="space-y-2">
          <p className="text-sm font-medium text-ink">{t("childLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => {
              const Icon = getAvatarIcon(c.avatar);
              const selected = c.id === childId;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setChildId(c.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                    selected
                      ? "border-crayon bg-crayon-soft text-crayon-text"
                      : "border-line bg-card text-ink-soft hover:bg-mist",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {c.nickname}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("goalsLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GOALS.map(({ id, icon: Icon }) => {
            const selected = goals.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleGoal(id)}
                className={cn(
                  "flex flex-col gap-1 rounded-card border p-3 text-left transition-colors",
                  selected ? "border-crayon bg-crayon-soft" : "border-line bg-card hover:bg-mist",
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon
                    className={cn("size-4 shrink-0", selected ? "text-crayon-text" : "text-ink-soft")}
                    aria-hidden="true"
                  />
                  <span className={cn("text-sm font-semibold", selected ? "text-crayon-text" : "text-ink")}>
                    {tGoals(id)}
                  </span>
                  {selected && <Check className="ml-auto size-4 shrink-0 text-crayon-text" aria-hidden="true" />}
                </span>
                <span className="text-xs leading-snug text-ink-soft">{tGoalDesc(id)}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("themeLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {THEME_IDS.map((id) => {
            const selected = theme === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTheme(id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-2 text-sm transition-colors",
                  selected
                    ? "border-crayon bg-crayon-soft text-crayon-text"
                    : "border-line bg-card text-ink-soft hover:bg-mist",
                )}
              >
                {selected && <Check className="size-3.5" aria-hidden="true" />}
                {tThemes(id)}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("durationLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => {
            const selected = durationMin === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={selected}
                onClick={() => setDurationMin(d)}
                className={cn(
                  "min-w-20 rounded-card border px-4 py-3 text-center text-sm font-semibold transition-colors",
                  selected
                    ? "border-crayon bg-crayon-soft text-crayon-text"
                    : "border-line bg-card text-ink-soft hover:bg-mist",
                )}
              >
                {tCommon("minutes", { count: d })}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("materialsLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {MATERIALS.map(({ id, icon: Icon }) => {
            const selected = materials.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleMaterial(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                  selected
                    ? "border-crayon bg-crayon-soft text-crayon-text"
                    : "border-line bg-card text-ink-soft hover:bg-mist",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {tMaterials(id)}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("difficultyLabel")} — {manualDifficulty === null ? t("difficultyAuto") : `${difficulty}/5`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs text-ink-soft">{t("difficultyAutoHint")}</p>
            <Switch
              checked={manualDifficulty === null}
              onCheckedChange={(on: boolean) => setManualDifficulty(on ? null : defaultDifficulty(age))}
              aria-label={t("difficultyAuto")}
            />
          </div>
          {manualDifficulty !== null && (
            <>
              <Slider
                value={[difficulty]}
                min={1}
                max={5}
                step={1}
                onValueChange={([v]) => setManualDifficulty(v as Difficulty)}
              />
              <p className="text-sm font-medium text-ink" aria-live="polite">
                {t(`difficultyHint.${difficulty}`)}
              </p>
              <p className="text-xs text-ink-soft">{t("difficultyManualHint")}</p>
            </>
          )}
        </CardContent>
      </Card>

      {rateLimited && <p className="text-sm text-ink-soft">{t("rateLimited")}</p>}
      {error && <p className="text-sm text-destructive">{t("errorGeneric")}</p>}

      <Button size="lg" className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}
