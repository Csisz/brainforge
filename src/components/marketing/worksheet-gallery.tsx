"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { regenerateGallery, type GalleryItem } from "@/lib/worksheets/actions";
import { Button } from "@/components/ui/button";
import { SeedChip } from "./seed-chip";

export function WorksheetGallery({ locale, initialItems }: { locale: string; initialItems: GalleryItem[] }) {
  const t = useTranslations();
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

  function regenerateAll() {
    startTransition(async () => {
      setItems(await regenerateGallery(locale));
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-crayon-text">{t("gallery.eyebrow")}</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">{t("gallery.title")}</h2>
          <p className="mt-2 max-w-xl text-ink-soft">{t("gallery.body")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={regenerateAll}
          disabled={isPending}
          className="hidden shrink-0 gap-1.5 sm:inline-flex"
        >
          <RefreshCw className={isPending ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
          {t("gallery.regenerateAll")}
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.generatorId}
            className="flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-soft"
          >
            <div className="border-b border-line bg-white p-2 [&>svg]:h-auto [&>svg]:w-full">
              <div dangerouslySetInnerHTML={{ __html: item.svg }} />
            </div>
            <div className="flex flex-1 items-center justify-between gap-2 p-3">
              <span className="font-display text-sm font-bold text-ink">
                {t(`generators.${item.generatorId}`)}
              </span>
              <SeedChip seed={item.seed} className="hidden sm:inline-flex" />
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={regenerateAll}
        disabled={isPending}
        className="mt-6 w-full gap-1.5 sm:hidden"
      >
        <RefreshCw className={isPending ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
        {t("gallery.regenerateAll")}
      </Button>
    </div>
  );
}
