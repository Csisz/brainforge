import type { GeneratorContext, RenderOptions, WorksheetRecipe } from "./types";
import { getGenerator } from "./registry";
import { createRng } from "@/lib/random";
import { esc } from "./svg";

/**
 * PAGE COMPOSER
 * -------------
 * Generators produce pure content; this module wraps it in the printable
 * page: paper size, margins, header (title + child name + date line),
 * instruction line, and footer. Keeping chrome out of generators means a
 * rebrand or layout change never touches generation logic — and the same
 * content can be composed into single sheets, booklets, or offline packs.
 *
 * Print pipeline decision: the SVG is sized in real millimetres
 * (width="210mm" viewBox="0 0 210 297"), so browser print → PDF is
 * dimensionally exact with @page { size: A4; margin: 0 }. Server-side PDF
 * (resvg + pdf-lib in an Edge Function) is a Sprint-3 TODO for batch export;
 * the SVG contract stays identical.
 */

const PAPERS = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
} as const;

const MARGIN = 14; // mm — generous whitespace per PRD §6

export type ComposedPage = {
  svg: string;
  answerKeySvg?: string;
};

/** Minimal i18n for on-sheet strings; will be replaced by next-intl messages. */
const INSTRUCTIONS: Record<string, Record<string, string>> = {
  "worksheet.maze.instruction": {
    en: "Find the way from the dot to the star!",
    hu: "Találd meg az utat a ponttól a csillagig!",
    de: "Finde den Weg vom Punkt zum Stern!",
  },
  "worksheet.tracing.instruction": {
    en: "Start at the green dot and trace each line.",
    hu: "Indulj a zöld pontról, és rajzold át a vonalakat!",
    de: "Beginne am grünen Punkt und fahre die Linien nach.",
  },
  "worksheet.pattern.instruction": {
    en: "What comes next? Draw the missing shape.",
    hu: "Mi következik? Rajzold be a hiányzó formát!",
    de: "Was kommt als Nächstes? Zeichne die fehlende Form.",
  },
  "worksheet.mirror.instruction": {
    en: "Draw the mirror image on the other side of the dashed line.",
    hu: "Rajzold meg a tükörképet a szaggatott vonal másik oldalán!",
    de: "Zeichne das Spiegelbild auf der anderen Seite der Linie.",
  },
  "worksheet.gridcopy.instruction": {
    en: "Copy the top grid into the empty grid below.",
    hu: "Másold át a felső rácsot az alsó üres rácsba!",
    de: "Übertrage das obere Gitter in das leere Gitter unten.",
  },
  "worksheet.arrows.instruction": {
    en: "Hang it up! Say each arrow's direction out loud, fast.",
    hu: "Tedd ki a falra! Mondd ki hangosan és gyorsan a nyilak irányát!",
    de: "Aufhängen! Sage die Richtung jedes Pfeils laut und schnell.",
  },
};

const TITLES: Record<string, Record<string, string>> = {
  maze: { en: "Maze", hu: "Labirintus", de: "Labyrinth" },
  tracing: { en: "Tracing", hu: "Vonalvezetés", de: "Schwungübung" },
  pattern_completion: { en: "Patterns", hu: "Sorminták", de: "Muster" },
  mirror_drawing: { en: "Mirror Drawing", hu: "Tükörrajz", de: "Spiegelzeichnen" },
  grid_copy: { en: "Grid Copy", hu: "Rácsmásolás", de: "Gitter kopieren" },
  arrow_board: { en: "Arrow Board", hu: "Nyilas tábla", de: "Pfeiltafel" },
};

function t(table: Record<string, Record<string, string>>, key: string, locale: string): string {
  return table[key]?.[locale] ?? table[key]?.en ?? key;
}

export function composeWorksheet(
  recipe: WorksheetRecipe,
  ctx: Omit<GeneratorContext, "rng">,
  meta: { childName?: string } = {},
): ComposedPage {
  const generator = getGenerator(recipe.generatorId);
  const rng = createRng(`${recipe.generatorId}:v${recipe.generatorVersion}:${recipe.seed}`);
  const fullCtx: GeneratorContext = { ...ctx, rng };
  const params = recipe.params ?? generator.defaultParams(fullCtx);
  const content = generator.generate(fullCtx, params);

  const paper = PAPERS[ctx.render.paper];
  const innerW = paper.w - MARGIN * 2;
  const headerH = 26;
  const contentTop = MARGIN + headerH;
  const scale = Math.min(innerW / content.width, (paper.h - contentTop - MARGIN - 8) / content.height);
  const cx = MARGIN + (innerW - content.width * scale) / 2;

  const page = (body: string, watermark?: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${paper.w}mm" height="${paper.h}mm" viewBox="0 0 ${paper.w} ${paper.h}" font-family="system-ui, -apple-system, sans-serif">
  <rect width="${paper.w}" height="${paper.h}" fill="#fff"/>
  <text x="${MARGIN}" y="${MARGIN + 6}" font-size="6.5" font-weight="600" fill="#111">${esc(t(TITLES, recipe.generatorId, ctx.render.locale))}</text>
  <text x="${paper.w - MARGIN}" y="${MARGIN + 6}" font-size="3.6" fill="#888" text-anchor="end">${esc(meta.childName ?? "")}${meta.childName ? "  ·  " : ""}${esc(dateLabel(ctx.render.locale))}</text>
  <text x="${MARGIN}" y="${MARGIN + 14}" font-size="4.2" fill="#444">${esc(t(INSTRUCTIONS, content.instructionKey, ctx.render.locale))}</text>
  <line x1="${MARGIN}" y1="${MARGIN + 18}" x2="${paper.w - MARGIN}" y2="${MARGIN + 18}" stroke="#e5e5e5" stroke-width="0.3"/>
  ${watermark ?? ""}
  <g transform="translate(${cx.toFixed(2)} ${contentTop.toFixed(2)}) scale(${scale.toFixed(4)})">${body}</g>
  <text x="${paper.w / 2}" y="${paper.h - 6}" font-size="3" fill="#bbb" text-anchor="middle">BrainForge Kids · ${esc(recipe.seed.slice(0, 8))}</text>
</svg>`;

  return {
    svg: page(content.body),
    answerKeySvg: content.answerKey
      ? page(
          content.answerKey,
          `<text x="${paper.w - MARGIN}" y="${MARGIN + 14}" font-size="4" fill="#d33" text-anchor="end">${
            ctx.render.locale === "hu" ? "Megoldókulcs" : ctx.render.locale === "de" ? "Lösungsblatt" : "Answer key"
          }</text>`,
        )
      : undefined,
  };
}

function dateLabel(locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function defaultRenderOptions(locale = "en"): RenderOptions {
  return { paper: "a4", locale, lowInk: false, highContrast: false, motorSupport: false };
}
