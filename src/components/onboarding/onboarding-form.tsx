"use client";

import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Check } from "lucide-react";
import type { ThemeId } from "@/lib/worksheets/types";
import { THEME_IDS } from "@/lib/worksheets/theme-list";
import { AVATARS, type AvatarId } from "@/lib/children/avatar-list";
import { createChild } from "@/lib/children/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const tThemes = useTranslations("themes");
  const tAvatars = useTranslations("avatars");
  const locale = useLocale();
  const router = useRouter();

  const [nickname, setNickname] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>("cat");
  const [themes, setThemes] = useState<ThemeId[]>([]);
  const [lowInk, setLowInk] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [motorSupport, setMotorSupport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  function toggleTheme(theme: ThemeId) {
    setThemes((prev) => (prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    const result = await createChild({
      nickname,
      birthMonth,
      avatar,
      preferredThemes: themes,
      accessibility: { lowInk, highContrast, motorSupport },
    });
    if (result.error) {
      setError(true);
      setSubmitting(false);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
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
              <Input
                id="birthMonth"
                type="month"
                required
                max={new Date().toISOString().slice(0, 7)}
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
              />
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
            {submitting ? t("submitting") : t("submit")}
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
