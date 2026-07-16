import { getFormatter } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import type { LegalDoc } from "@/lib/legal/content";

const REVIEW_MARKER = "<!-- LEGAL REVIEW NEEDED -->";

/**
 * Renders a legal document as prose. These are unreviewed DRAFTS, so we show a
 * visible "pending legal review" banner — an unfinished legal page must not read
 * as final, authoritative text. The in-source review markers are stripped from
 * the displayed paragraphs (they are notes for the reviewer, not the reader),
 * but the placeholder content they flag stays visible so the gaps are obvious.
 */
export async function LegalArticle({
  doc,
  labels,
}: {
  doc: LegalDoc;
  labels: { updated: string; draft: string };
}) {
  const format = await getFormatter();

  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-start gap-2 rounded-card border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>{labels.draft}</p>
      </div>

      <h1 className="font-display text-3xl font-extrabold text-ink">{doc.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {labels.updated} {format.dateTime(new Date(doc.updated), { dateStyle: "long" })}
      </p>

      <div className="mt-8 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-lg font-bold text-ink">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="mt-2 leading-relaxed text-ink-soft">
                {paragraph.replace(REVIEW_MARKER, "").trim()}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
