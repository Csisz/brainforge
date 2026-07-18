"use client";

import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Check, Sparkles } from "lucide-react";
import type { ThemeId } from "@/lib/worksheets/types";
import { THEME_IDS } from "@/lib/worksheets/theme-list";
import { AVATARS, type AvatarId } from "@/lib/children/avatar-list";
import { createChild, updateChild } from "@/lib/children/actions";
import { isValidBirthMonth } from "@/lib/children/age";
import { BirthMonthPicker } from "@/components/children/birth-month-picker";
import { UpgradeNotice } from "@/components/plan/upgrade-notice";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ChildFormValues = {
  nickname: string;
  birthMonth: string; // "YYYY-MM"
  avatar: AvatarId;
  themes: ThemeId[];
  accessibility: { lowInk: boolean; highContrast: boolean; motorSupport: boolean };
};

/**
 * The child profile form, shared by onboarding (create) and the child-edit page
 * (edit, prefilled). One set of fields — nickname, birth month, avatar, themes,
 * accessibility — behind one "YYYY-MM" birth value, so both flows stay in sync.
 */
export function ChildForm({
  mode,
  childId,
  initial,
  stripeConfigured = true,
}: {
  mode: "create" | "edit";
  childId?: string;
  initial?: ChildFormValues;
  /** Beta runs without Stripe — the child-limit prompt then shows the beta
   * notice instead of a plan CTA that dead-ends (Sprint 7 M8). */
  stripeConfigured?: boolean;
}) {
  const t = useTranslations("onboarding");
  const tThemes = useTranslations("themes");
  const tAvatars = useTranslations("avatars");
  const locale = useLocale();
  const router = useRouter();

  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [birthMonth, setBirthMonth] = useState(initial?.birthMonth ?? "");
  const [avatar, setAvatar] = useState<AvatarId>(initial?.avatar ?? "cat");
  const [themes, setThemes] = useState<ThemeId[]>(initial?.themes ?? []);
  const [lowInk, setLowInk] = useState(initial?.accessibility.lowInk ?? false);
  const [highContrast, setHighContrast] = useState(initial?.accessibility.highContrast ?? false);
  const [motorSupport, setMotorSupport] = useState(initial?.accessibility.motorSupport ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [birthError, setBirthError] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  function toggleTheme(theme: ThemeId) {
    setThemes((prev) => (prev.includes(theme) ? prev.filter((x) => x !== theme) : [...prev, theme]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Two selects can express a future month or an >10y-old that the native
    // input's `max` used to guard, so gate it here before saving.
    if (!isValidBirthMonth(birthMonth)) {
      setBirthError(true);
      return;
    }
    setSubmitting(true);
    setError(false);
    const payload = {
      nickname,
      birthMonth,
      avatar,
      preferredThemes: themes,
      accessibility: { lowInk, highContrast, motorSupport },
    };
    const result =
      mode === "edit" && childId
        ? await updateChild(childId, payload)
        : await createChild({ ...payload, locale });

    if (result.error === "child_limit_reached") {
      setLimitReached(true);
      setSubmitting(false);
      return;
    }
    if (result.error) {
      setError(true);
      setSubmitting(false);
      return;
    }
    router.push(mode === "edit" ? "/app/children" : "/app");
    router.refresh();
  }

  // Warm, never punitive: the child was not added, but nothing is broken — the
  // existing child is untouched, and this simply names what the family plan adds.
  if (limitReached) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>{t("childLimit.title")}</CardTitle>
          <p className="max-w-sm text-sm text-ink-soft">{t("childLimit.body")}</p>
          {!stripeConfigured && <UpgradeNotice className="mt-1 flex flex-col items-center" />}
          <div className="mt-2 flex gap-2">
            {stripeConfigured && (
              <Button asChild>
                <Link href="/app/settings">{t("childLimit.cta")}</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/app">{t("childLimit.back")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "edit" ? t("editTitle") : t("title")}</CardTitle>
        <CardDescription>{mode === "edit" ? t("editSubtitle") : t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nickname">{t("nicknameLabel")}</Label>
              <Input
                id="nickname"
                required
                placeholder={t("nicknamePlaceholder")}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthMonth">{t("birthMonthLabel")}</Label>
              <BirthMonthPicker
                value={birthMonth}
                onChange={(v) => {
                  setBirthMonth(v);
                  setBirthError(false);
                }}
                yearTriggerId="birthMonth"
                invalid={birthError}
              />
              {birthError && <p className="text-sm text-destructive">{t("birthDateError")}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("avatarLabel")}</Label>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={avatar === id}
                  aria-label={tAvatars(id)}
                  onClick={() => setAvatar(id)}
                  className={cn(
                    "flex size-12 items-center justify-center rounded-full border transition-colors",
                    avatar === id
                      ? "border-crayon bg-crayon-soft text-crayon-text"
                      : "border-line bg-card text-ink-soft hover:bg-mist",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("themesLabel")}</Label>
            <div className="flex flex-wrap gap-2">
              {THEME_IDS.map((theme) => {
                const selected = themes.includes(theme);
                return (
                  <button
                    key={theme}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTheme(theme)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selected
                        ? "border-crayon bg-crayon-soft text-crayon-text"
                        : "border-line bg-card text-ink-soft hover:bg-mist",
                    )}
                  >
                    {selected && <Check className="size-3.5" aria-hidden="true" />}
                    {tThemes(theme)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Label>{t("accessibilityLabel")}</Label>
            <AccessibilityToggle
              label={t("accessibility.lowInk")}
              description={t("accessibility.lowInkDesc")}
              checked={lowInk}
              onCheckedChange={setLowInk}
            />
            <AccessibilityToggle
              label={t("accessibility.highContrast")}
              description={t("accessibility.highContrastDesc")}
              checked={highContrast}
              onCheckedChange={setHighContrast}
            />
            <AccessibilityToggle
              label={t("accessibility.motorSupport")}
              description={t("accessibility.motorSupportDesc")}
              checked={motorSupport}
              onCheckedChange={setMotorSupport}
            />
          </div>

          {error && <p className="text-sm text-destructive">{t("errorGeneric")}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t("submitting") : mode === "edit" ? t("saveChild") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AccessibilityToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-line px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-soft">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
