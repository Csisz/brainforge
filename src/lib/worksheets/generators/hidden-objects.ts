import type { WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, rect } from "../svg";
import { GLYPHS, outline } from "./glyph-set";

/**
 * HIDDEN OBJECTS — find and count target shapes in a tangle of outlines.
 *
 * A scene of large, partially overlapping outline glyphs. A legend lists K
 * target shapes, each with a box for the found count; the child circles and
 * counts every occurrence. Trains attention, visual scanning and figure-
 * ground separation — the outlines deliberately overlap so shapes must be
 * mentally pulled apart. The answer key circles every target in red and
 * fills in the counts. Difficulty scales targets, their frequency and the
 * number of distractor shapes.
 */

export type HiddenObjectsParams = {
  targetTypes: number;
  perTarget: number;
  fillers: number;
};

type Instance = { gi: number; cx: number; cy: number; r: number; rot: number; target: boolean };

export const hiddenObjectsGenerator: WorksheetGenerator<HiddenObjectsParams> = {
  id: "hidden_objects",
  version: 1,
  goals: ["attention", "visual_perception", "pre_reading"],
  ageRange: [4, 10],

  defaultParams(ctx): HiddenObjectsParams {
    return {
      targetTypes: Math.min(4, 2 + Math.floor(ctx.difficulty / 2)),
      perTarget: Math.min(5, 2 + Math.floor(ctx.difficulty / 2) + (ctx.age >= 7 ? 1 : 0)),
      fillers: 6 + ctx.difficulty * 3,
    };
  },

  generate(ctx, params): WorksheetContent {
    const W = 172;
    const legendH = 24;
    const sceneH = 176;
    const H = legendH + sceneH;

    const order = ctx.rng.shuffle(GLYPHS.map((_, i) => i));
    const targetIdx = order.slice(0, params.targetTypes);
    const fillerIdx = order.slice(params.targetTypes);

    // Build the instance list: exact target counts + random distractors.
    const instances: Instance[] = [];
    const place = (gi: number, target: boolean) => {
      const r = ctx.rng.int(9, 14);
      const cx = ctx.rng.int(Math.ceil(r), Math.floor(W - r));
      const cy = legendH + ctx.rng.int(Math.ceil(r), Math.floor(sceneH - r));
      instances.push({ gi, cx, cy, r, rot: ctx.rng.int(-25, 25), target });
    };
    for (const gi of targetIdx) for (let k = 0; k < params.perTarget; k++) place(gi, true);
    for (let k = 0; k < params.fillers; k++) place(ctx.rng.pick(fillerIdx.length ? fillerIdx : targetIdx), false);

    // Draw back-to-front in shuffled order so targets aren't always on top.
    const draw = (inst: Instance) =>
      group(
        { transform: `rotate(${inst.rot} ${inst.cx} ${inst.cy})` },
        GLYPHS[inst.gi]!.draw(inst.cx, inst.cy, inst.r, outline(1.0)),
      );
    const scene = ctx.rng.shuffle(instances).map(draw).join("");

    // Legend: each target glyph with an empty count box.
    const cellW = W / params.targetTypes;
    const legend: string[] = [];
    const answerLegend: string[] = [];
    targetIdx.forEach((gi, i) => {
      const cx = cellW * i + cellW * 0.32;
      const boxX = cellW * i + cellW * 0.52;
      legend.push(GLYPHS[gi]!.draw(cx, 12, 8, outline(1.1)));
      legend.push(rect(boxX, 5, 14, 14, { fill: "none", stroke: "#111", "stroke-width": 0.8, rx: 2 }));
      answerLegend.push(GLYPHS[gi]!.draw(cx, 12, 8, outline(1.1)));
      answerLegend.push(rect(boxX, 5, 14, 14, { fill: "none", stroke: "#d33", "stroke-width": 0.8, rx: 2 }));
      answerLegend.push(
        `<text x="${boxX + 7}" y="${15.5}" font-size="9" font-weight="700" text-anchor="middle" fill="#d33">${params.perTarget}</text>`,
      );
    });
    const divider = `<line x1="0" y1="${legendH}" x2="${W}" y2="${legendH}" stroke="#e5e5e5" stroke-width="0.4"/>`;

    // Answer key: circle every target instance in red.
    const marks = instances
      .filter((i) => i.target)
      .map((i) => circle(i.cx, i.cy, i.r + 2, { fill: "none", stroke: "#d33", "stroke-width": 0.7 }))
      .join("");

    return {
      body: group({}, legend.join("") + divider + scene),
      width: W,
      height: H,
      instructionKey: "worksheet.hidden.instruction",
      answerKey: group({}, answerLegend.join("") + divider + scene + marks),
    };
  },
};
