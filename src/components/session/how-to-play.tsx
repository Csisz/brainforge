"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const COLLAPSED_LINES = 2;
/** Pre-measurement cap (≈2 lines of text-xs/leading-snug) so the first paint is
 * already collapsed — no flash of the full text before the effect runs. */
const COLLAPSED_FALLBACK = "2.75em";

/**
 * Expandable "how to play" copy (Sprint 7 M3). The old inline version always
 * rendered the toggle and clamped to 2 lines — but the activity text usually
 * *fits* in 2 lines at normal widths, so clicking did nothing visible and the
 * control read as broken. Here the toggle appears only when the text genuinely
 * overflows two lines (re-checked on resize, since that depends on width), and
 * the height animates so the expand is felt. Below the threshold the full text
 * simply shows with no dead button.
 */
export function HowToPlay({ text, label }: { text: string; label: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [measured, setMeasured] = useState(false);
  const [collapsedPx, setCollapsedPx] = useState(0);
  const [fullPx, setFullPx] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 16;
      const collapsed = Math.round(lineHeight * COLLAPSED_LINES);
      // scrollHeight is the full content height regardless of the current cap,
      // so this reading is stable whether we're expanded or collapsed.
      setCollapsedPx(collapsed);
      setFullPx(el.scrollHeight);
      setOverflowing(el.scrollHeight > collapsed + 1);
      setMeasured(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const maxHeight = !measured
    ? COLLAPSED_FALLBACK
    : !overflowing
      ? undefined // fits in ≤2 lines: show it all, no toggle
      : expanded
        ? fullPx
        : collapsedPx;

  return (
    <div className="mt-2">
      <p
        ref={ref}
        style={{ maxHeight, overflow: "hidden" }}
        className="text-xs leading-snug text-ink-soft transition-[max-height] duration-300 ease-out"
      >
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 py-1 text-xs font-medium text-crayon-text hover:underline"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
          {label}
        </button>
      )}
    </div>
  );
}
