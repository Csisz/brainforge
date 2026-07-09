"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile } from "@/lib/profile/actions";
import type { PaperSize } from "@/lib/worksheets/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Status = "idle" | "saving" | "saved" | "error";

export function ProfileForm({
  email,
  initialDisplayName,
  initialPaperSize,
}: {
  email: string;
  initialDisplayName: string;
  initialPaperSize: PaperSize;
}) {
  const t = useTranslations("settings");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [paperSize, setPaperSize] = useState<PaperSize>(initialPaperSize);
  const [status, setStatus] = useState<Status>("idle");

  async function handleSave() {
    setStatus("saving");
    const result = await updateProfile({ displayName, paperSize });
    setStatus(result.error ? "error" : "saved");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input id="email" value={email} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">{t("displayNameLabel")}</Label>
          <Input
            id="displayName"
            placeholder={t("displayNamePlaceholder")}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("paperSizeTitle")}</Label>
        <div className="flex gap-2">
          {(["a4", "letter"] as const).map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={paperSize === size}
              onClick={() => setPaperSize(size)}
              className={cn(
                "rounded-card border px-4 py-2 text-sm font-semibold transition-colors",
                paperSize === size
                  ? "border-crayon bg-crayon-soft text-crayon-text"
                  : "border-line bg-card text-ink-soft hover:bg-mist",
              )}
            >
              {t(size === "a4" ? "paperSizeA4" : "paperSizeLetter")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={status === "saving"}>
          {status === "saving" ? t("saving") : t("saveButton")}
        </Button>
        {status === "saved" && <span className="text-sm text-ink-soft">{t("savedConfirmation")}</span>}
        {status === "error" && <span className="text-sm text-destructive">{t("errorGeneric")}</span>}
      </div>
    </div>
  );
}
