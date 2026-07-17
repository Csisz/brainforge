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
 * (resvg + pdf-lib in an Edge Function) is deferred to Sprint 4 for batch
 * export; the SVG contract stays identical.
 *
 * Thumbnail mode ({ thumbnail: true }) composes the *same* content with no
 * chrome and no paper: the viewBox is the generator's own content box, so the
 * task fills the frame instead of being a legible-only-at-A4 speck under a
 * header. It is a second composition of one content contract — the reason
 * chrome lives here and not in generators. Sizing is relative (100%/100% +
 * preserveAspectRatio) because the caller owns the frame; the print route's
 * millimetre contract is untouched.
 */

const PAPERS = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
} as const;

const MARGIN = 14; // mm — generous whitespace per PRD §6
const THUMB_PAD = 4; // mm — keeps strokes off the frame edge in thumbnail mode

export type ComposedPage = {
  svg: string;
  answerKeySvg?: string;
  /**
   * Thumbnail mode only: the SVG's viewBox size in mm (content box + padding).
   * The caller sizes its frame from this so the sheet fills it instead of
   * letterboxing into a fixed ratio.
   */
  box?: { width: number; height: number };
};

export type ComposeOptions = {
  /** Chrome-less, paper-less render sized to the content box (catalog cards). */
  thumbnail?: boolean;
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
  "worksheet.dots.instruction": {
    en: "Connect the dots from 1 in order. What do you see?",
    hu: "Kösd össze a pontokat 1-től sorban! Mit látsz?",
    de: "Verbinde die Punkte ab 1 der Reihe nach. Was siehst du?",
  },
  "worksheet.counting.instruction": {
    en: "Count the objects in each row and write the number in the box.",
    hu: "Számold meg a formákat minden sorban, és írd a számot a dobozba!",
    de: "Zähle die Formen in jeder Reihe und schreibe die Zahl in das Kästchen.",
  },
  "worksheet.matching.instruction": {
    en: "Draw a line from each shape to its shadow.",
    hu: "Kösd össze a formákat az árnyékukkal!",
    de: "Verbinde jede Form mit ihrem Schatten.",
  },
  "worksheet.symmetry.instruction": {
    en: "Color the same squares on the other side of the line.",
    hu: "Színezd ki ugyanazokat a négyzeteket a vonal másik oldalán!",
    de: "Male die gleichen Kästchen auf der anderen Seite der Linie aus.",
  },
  "worksheet.search.instruction": {
    en: "Find and circle every shape that matches the one in the box.",
    hu: "Keresd meg és karikázd be az összes olyan formát, mint a dobozban!",
    de: "Finde und umkreise jede Form, die der im Kasten gleicht.",
  },
  "worksheet.dualpath.instruction": {
    en: "One marker per hand! Connect the colors in order on both sides at the same time.",
    hu: "Mindkét kezedbe filcet! Kösd össze a színeket sorban, egyszerre mindkét oldalon.",
    de: "In jede Hand einen Stift! Verbinde die Farben der Reihe nach auf beiden Seiten gleichzeitig.",
  },
  "worksheet.dualfind.instruction": {
    en: "Left hand circles the shape, right hand circles the number — at the same time!",
    hu: "Bal kézzel a formát, jobb kézzel a számot karikázd be — egyszerre!",
    de: "Die linke Hand umkreist die Form, die rechte die Zahl — gleichzeitig!",
  },
  "worksheet.memorycards.instruction": {
    en: "Cut out the cards and find the matching pairs.",
    hu: "Vágd ki a kártyákat, és keresd meg a párokat!",
    de: "Schneide die Karten aus und finde die Paare.",
  },
  "worksheet.logicgrid.instruction": {
    en: "Each shape once in every row and column.",
    hu: "Minden sorba és oszlopba minden forma egyszer kerüljön!",
    de: "Jede Form einmal pro Zeile und Spalte.",
  },
  "worksheet.colorrule.instruction": {
    en: "Color each area using the number key at the top.",
    hu: "Színezd ki a mezőket a fenti számkód szerint!",
    de: "Male jedes Feld nach dem Zahlenschlüssel oben aus.",
  },
  "worksheet.sequencing.instruction": {
    en: "What happens first? Number the pictures in order.",
    hu: "Mi történik előbb? Számozd meg a képeket 1-től sorban!",
    de: "Was zuerst? Nummeriere die Bilder der Reihe nach.",
  },
  "worksheet.cutpaste.instruction": {
    en: "Cut out the pieces below and paste them in the gaps.",
    hu: "Vágd ki az alsó darabokat, és ragaszd a helyükre!",
    de: "Schneide die Teile unten aus und klebe sie in die Lücken.",
  },
  "worksheet.hidden.instruction": {
    en: "Find and circle the shapes from the top. Count each kind.",
    hu: "Keresd meg és karikázd be a fenti formákat! Számold meg őket.",
    de: "Finde und umkreise die Formen von oben. Zähle sie.",
  },
  "worksheet.arrows.instruction": {
    en: "Hang it up! Say each arrow's direction out loud, fast.",
    hu: "Tedd ki a falra! Mondd ki hangosan és gyorsan a nyilak irányát!",
    de: "Aufhängen! Sage die Richtung jedes Pfeils laut und schnell.",
  },
  "worksheet.reward_chart.instruction": {
    en: "Color in or add a sticker to one shape for every finished task or day.",
    hu: "Színezz ki vagy ragassz egy matricát egy formára minden elvégzett feladat vagy nap után!",
    de: "Male eine Form aus oder klebe einen Sticker auf — für jede erledigte Aufgabe oder jeden Tag.",
  },
};

const TITLES: Record<string, Record<string, string>> = {
  maze: { en: "Maze", hu: "Labirintus", de: "Labyrinth" },
  tracing: { en: "Tracing", hu: "Vonalvezetés", de: "Schwungübung" },
  pattern_completion: { en: "Patterns", hu: "Sorminták", de: "Muster" },
  mirror_drawing: { en: "Mirror Drawing", hu: "Tükörrajz", de: "Spiegelzeichnen" },
  grid_copy: { en: "Grid Copy", hu: "Rácsmásolás", de: "Gitter kopieren" },
  arrow_board: { en: "Arrow Board", hu: "Nyilas tábla", de: "Pfeiltafel" },
  connect_the_dots: { en: "Connect the Dots", hu: "Pontösszekötő", de: "Punkte verbinden" },
  counting: { en: "Counting", hu: "Számolás", de: "Zählen" },
  matching: { en: "Matching", hu: "Párosítás", de: "Zuordnen" },
  symmetry_grid: { en: "Symmetry Grid", hu: "Tükrös rács", de: "Symmetrie-Gitter" },
  visual_search: { en: "Shape Hunt", hu: "Formavadászat", de: "Formenjagd" },
  dual_path: { en: "Two-Hand Trails", hu: "Kétkezes útvonal", de: "Beidhändige Spuren" },
  dual_find: { en: "Two-Hand Hunt", hu: "Kétkezes kereső", de: "Beidhändige Suche" },
  memory_cards: { en: "Memory Cards", hu: "Memóriakártyák", de: "Memory-Karten" },
  logic_grid: { en: "Logic Grid", hu: "Logikai rács", de: "Logikgitter" },
  color_by_rule: { en: "Color by Number", hu: "Színezz szám szerint", de: "Malen nach Zahlen" },
  sequencing: { en: "Put in Order", hu: "Sorba rendezés", de: "In die richtige Reihenfolge" },
  cut_and_paste: { en: "Cut & Paste", hu: "Vágd és ragaszd", de: "Ausschneiden & Kleben" },
  hidden_objects: { en: "Hidden Shapes", hu: "Rejtett formák", de: "Versteckte Formen" },
  reward_chart: { en: "Collection Sheet", hu: "Gyűjtőlap", de: "Sammelblatt" },
};

function t(table: Record<string, Record<string, string>>, key: string, locale: string): string {
  return table[key]?.[locale] ?? table[key]?.en ?? key;
}

export function composeWorksheet(
  recipe: WorksheetRecipe,
  ctx: Omit<GeneratorContext, "rng">,
  meta: { childName?: string; date?: Date } = {},
  opts: ComposeOptions = {},
): ComposedPage {
  const generator = getGenerator(recipe.generatorId);
  const rng = createRng(`${recipe.generatorId}:v${recipe.generatorVersion}:${recipe.seed}`);
  const fullCtx: GeneratorContext = { ...ctx, rng };
  const params = recipe.params ?? generator.defaultParams(fullCtx);
  const content = generator.generate(fullCtx, params);

  if (opts.thumbnail) {
    const vbW = content.width + THUMB_PAD * 2;
    const vbH = content.height + THUMB_PAD * 2;
    // No width/height in mm: the frame decides the size, the viewBox the crop.
    const thumb = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" font-family="system-ui, -apple-system, sans-serif">
  <rect width="${vbW}" height="${vbH}" fill="#fff"/>
  <g transform="translate(${THUMB_PAD} ${THUMB_PAD})">${body}</g>
</svg>`;
    return {
      svg: thumb(content.body),
      answerKeySvg: content.answerKey ? thumb(content.answerKey) : undefined,
      box: { width: vbW, height: vbH },
    };
  }

  const paper = PAPERS[ctx.render.paper];
  const innerW = paper.w - MARGIN * 2;
  const headerH = 26;
  const contentTop = MARGIN + headerH;
  const scale = Math.min(innerW / content.width, (paper.h - contentTop - MARGIN - 8) / content.height);
  const cx = MARGIN + (innerW - content.width * scale) / 2;

  const page = (body: string, watermark?: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${paper.w}mm" height="${paper.h}mm" viewBox="0 0 ${paper.w} ${paper.h}" font-family="system-ui, -apple-system, sans-serif">
  <rect width="${paper.w}" height="${paper.h}" fill="#fff"/>
  <text x="${MARGIN}" y="${MARGIN + 6}" font-size="6.5" font-weight="600" fill="#111">${esc(t(TITLES, recipe.generatorId, ctx.render.locale))}</text>
  <text x="${paper.w - MARGIN}" y="${MARGIN + 6}" font-size="3.6" fill="#888" text-anchor="end">${esc(meta.childName ?? "")}${meta.childName ? "  ·  " : ""}${esc(dateLabel(ctx.render.locale, meta.date))}</text>
  <text x="${MARGIN}" y="${MARGIN + 14}" font-size="4.2" fill="#444">${esc(t(INSTRUCTIONS, content.instructionKey, ctx.render.locale))}</text>
  <line x1="${MARGIN}" y1="${MARGIN + 18}" x2="${paper.w - MARGIN}" y2="${MARGIN + 18}" stroke="#e5e5e5" stroke-width="0.3"/>
  ${watermark ?? ""}
  <g transform="translate(${cx.toFixed(2)} ${contentTop.toFixed(2)}) scale(${scale.toFixed(4)})">${body}</g>
  <text x="${paper.w / 2}" y="${paper.h - 6}" font-size="3" fill="#bbb" text-anchor="middle">Kalmo Kids · ${esc(recipe.seed.slice(0, 8))}</text>
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

/**
 * Printed date. Defaults to today; `meta.date` pins it so a caller that needs
 * a reproducible sheet (the demo golden files) is not at the mercy of the
 * calendar — the only non-deterministic input in an otherwise seeded pipeline.
 */
function dateLabel(locale: string, date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function defaultRenderOptions(locale = "en"): RenderOptions {
  return { paper: "a4", locale, lowInk: false, highContrast: false, motorSupport: false };
}
