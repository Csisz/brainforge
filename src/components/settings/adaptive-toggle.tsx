"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setAdaptiveEnabled } from "@/lib/children/actions";
import { Switch } from "@/components/ui/switch";

/**
 * Per-child adaptive difficulty opt-out. Optimistic: the switch answers to the
 * parent immediately and reverts if the write fails — this is a preference, not
 * a transaction, and a laggy toggle feels broken.
 */
export function AdaptiveToggle({
  childId,
  nickname,
  enabled,
}: {
  childId: string;
  nickname: string;
  enabled: boolean;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setOn(next);
    startTransition(async () => {
      const result = await setAdaptiveEnabled(childId, next);
      if (result.error) setOn(!next);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{nickname}</p>
        <p className="text-xs text-ink-soft">{on ? t("adaptiveOn") : t("adaptiveOff")}</p>
      </div>
      <Switch
        checked={on}
        disabled={pending}
        onCheckedChange={toggle}
        aria-label={`${t("adaptiveTitle")} — ${nickname}`}
      />
    </div>
  );
}
