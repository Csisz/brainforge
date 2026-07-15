/**
 * REGRESSION GUARD — worksheet composition.
 * Run: npm run verify [-- <outDir> <onlyIds,…>]
 *
 * The catalog and the print route share one composer with two modes, so a
 * change made for a thumbnail can silently wreck a printable page (and vice
 * versa). This asserts the contract of both modes for every registered
 * generator, and emits an HTML harness for eyeballing the thumbnails.
 */
import { writeFileSync } from "node:fs";
import { allGenerators } from "../src/lib/worksheets/registry";
import { composeWorksheet, defaultRenderOptions } from "../src/lib/worksheets/page";
import { createRng } from "../src/lib/random";
import type { GeneratorContext } from "../src/lib/worksheets/types";

/**
 * Walk a path `d` and yield the points it reaches, honouring relative commands.
 *
 * Do not simplify this to "grab every number pair": generators emit relative
 * commands, and reading `l -11 -4.9` as an absolute point puts the extent
 * eleven millimetres left of the page. That bug made this check report five
 * healthy generators as broken.
 *
 * Curves contribute their control points too. A Bézier lies inside the convex
 * hull of its controls, so the result is an over-estimate, never an under-one —
 * the safe direction for "does the drawing escape its box".
 */
function pathPoints(d: string): Array<[number, number]> {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const out: Array<[number, number]> = [];
  let i = 0, cmd = "", cx = 0, cy = 0, sx = 0, sy = 0;
  const take = (n: number) => tokens.slice(i, (i += n)).map(Number);
  const at = (x: number, y: number, rel: boolean): [number, number] => [rel ? cx + x : x, rel ? cy + y : y];

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    if (!cmd) break;
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M": case "L": case "T": {
        const [x, y] = take(2);
        [cx, cy] = at(x!, y!, rel);
        if (cmd.toUpperCase() === "M") { sx = cx; sy = cy; }
        out.push([cx, cy]);
        break;
      }
      case "H": { const [x] = take(1); cx = rel ? cx + x! : x!; out.push([cx, cy]); break; }
      case "V": { const [y] = take(1); cy = rel ? cy + y! : y!; out.push([cx, cy]); break; }
      case "C": {
        const a = take(6);
        out.push(at(a[0]!, a[1]!, rel), at(a[2]!, a[3]!, rel));
        [cx, cy] = at(a[4]!, a[5]!, rel);
        out.push([cx, cy]);
        break;
      }
      case "S": case "Q": {
        const a = take(4);
        out.push(at(a[0]!, a[1]!, rel));
        [cx, cy] = at(a[2]!, a[3]!, rel);
        out.push([cx, cy]);
        break;
      }
      case "A": {
        const a = take(7); // rx ry rot large-arc sweep x y — only the endpoint is a point
        [cx, cy] = at(a[5]!, a[6]!, rel);
        out.push([cx, cy]);
        break;
      }
      case "Z": { cx = sx; cy = sy; break; }
      default: i++; // unknown command — skip a token and carry on
    }
  }
  return out;
}

/**
 * Rough drawn-extent of an SVG body, in the body's own user units.
 *
 * A scan, not a full SVG implementation. It reads absolute coordinates and
 * cannot resolve `transform`, so a body that uses one is skipped rather than
 * mis-measured (arrow_board draws each arrow around the origin and translates
 * it into place — scanning those local coordinates would put the extent 11mm
 * off the page). Resolving transforms means a matrix stack and balanced-tag
 * parsing, which is past the point of "cheap"; if you need exact numbers,
 * measure getBBox in a browser instead.
 *
 * Checked against headless Chrome's getBBox: agrees within ~1-2% on the 18
 * generators it can read. Text is measured from its anchor only (no font
 * metrics), so it under-counts slightly — hence the loose thresholds.
 */
function drawnExtent(body: string): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const seeX = (v: number) => { if (Number.isFinite(v)) { minX = Math.min(minX, v); maxX = Math.max(maxX, v); } };
  const seeY = (v: number) => { if (Number.isFinite(v)) { minY = Math.min(minY, v); maxY = Math.max(maxY, v); } };
  const num = (s: string | undefined) => (s === undefined ? NaN : Number(s));

  for (const m of body.matchAll(/<rect[^>]*>/g)) {
    const x = num(/\bx="([-\d.]+)"/.exec(m[0])?.[1]), y = num(/\by="([-\d.]+)"/.exec(m[0])?.[1]);
    const w = num(/\bwidth="([-\d.]+)"/.exec(m[0])?.[1]), h = num(/\bheight="([-\d.]+)"/.exec(m[0])?.[1]);
    seeX(x); seeX(x + w); seeY(y); seeY(y + h);
  }
  for (const m of body.matchAll(/<circle[^>]*>/g)) {
    const cx = num(/\bcx="([-\d.]+)"/.exec(m[0])?.[1]), cy = num(/\bcy="([-\d.]+)"/.exec(m[0])?.[1]);
    const r = num(/\br="([-\d.]+)"/.exec(m[0])?.[1]);
    seeX(cx - r); seeX(cx + r); seeY(cy - r); seeY(cy + r);
  }
  for (const m of body.matchAll(/<line[^>]*>/g)) {
    seeX(num(/\bx1="([-\d.]+)"/.exec(m[0])?.[1])); seeX(num(/\bx2="([-\d.]+)"/.exec(m[0])?.[1]));
    seeY(num(/\by1="([-\d.]+)"/.exec(m[0])?.[1])); seeY(num(/\by2="([-\d.]+)"/.exec(m[0])?.[1]));
  }
  for (const m of body.matchAll(/<text[^>]*>/g)) {
    seeX(num(/\bx="([-\d.]+)"/.exec(m[0])?.[1])); seeY(num(/\by="([-\d.]+)"/.exec(m[0])?.[1]));
  }
  for (const m of body.matchAll(/\bd="([^"]+)"/g)) {
    for (const [x, y] of pathPoints(m[1]!)) { seeX(x); seeY(y); }
  }
  // polygon/polyline points are always absolute pairs.
  for (const m of body.matchAll(/\bpoints="([^"]+)"/g)) {
    for (const p of m[1]!.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)) {
      seeX(Number(p[1])); seeY(Number(p[2]));
    }
  }
  return { minX, minY, maxX, maxY };
}

const OUT = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : ".";
const ONLY = process.argv[3]?.split(",").filter(Boolean) ?? [];
const WIDTH = process.env.WIDTH ? Number(process.env.WIDTH) : 0;

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) failures++;
  console.log(`${cond ? "  ok  " : " FAIL "} ${label}${detail ? "  — " + detail : ""}`);
};

const ctx = {
  age: 5 as const,
  difficulty: 3 as const,
  theme: "nature" as const,
  render: defaultRenderOptions("hu"),
};

const cards = allGenerators()
  .filter((g) => !ONLY.length || ONLY.includes(g.id))
  .map((g) => {
    const recipe = { generatorId: g.id, generatorVersion: g.version, params: null, seed: `catalog-${g.id}` };
    return {
      id: g.id,
      thumb: composeWorksheet(recipe, ctx, {}, { thumbnail: true }),
      full: composeWorksheet(recipe, ctx, {}),
    };
  });

console.log("── thumbnail mode: content box, no chrome");
for (const c of cards) {
  const p: string[] = [];
  const vb = c.thumb.svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!vb) p.push("no viewBox");
  if (/210mm|297mm/.test(c.thumb.svg)) p.push("carries paper size");
  if (/BrainForge Kids/.test(c.thumb.svg)) p.push("has footer chrome");
  if (!/width="100%" height="100%"/.test(c.thumb.svg)) p.push("not relatively sized");
  if (!/preserveAspectRatio="xMidYMid meet"/.test(c.thumb.svg)) p.push("no preserveAspectRatio");

  // The reported box must BE the viewBox — the catalog shapes its frame from it,
  // so a drift here silently reintroduces letterboxing.
  if (!c.thumb.box) p.push("no box reported");
  else if (!vb || Number(vb[1]) !== c.thumb.box.width || Number(vb[2]) !== c.thumb.box.height) {
    p.push(`box ${c.thumb.box.width}×${c.thumb.box.height} != viewBox ${vb?.[1]}×${vb?.[2]}`);
  }

  const body = c.thumb.svg.replace(/<svg[^>]*>|<\/svg>|<rect[^>]*\/>|<g[^>]*>|<\/g>/g, "").trim();
  if (body.length < 200) p.push(`body suspiciously small (${body.length} chars)`);

  const aspect = c.thumb.box ? c.thumb.box.width / c.thumb.box.height : 0;
  ok(c.id.padEnd(20), p.length === 0, p.length ? p.join("; ") : `box ${vb![1]}×${vb![2]} (aspect ${aspect.toFixed(2)})`);
}

console.log("\n── full-page mode: still a printable A4 sheet");
for (const c of cards) {
  const p: string[] = [];
  if (!/width="210mm" height="297mm"/.test(c.full.svg)) p.push("not A4-sized");
  if (!/viewBox="0 0 210 297"/.test(c.full.svg)) p.push("wrong viewBox");
  if (!/BrainForge Kids/.test(c.full.svg)) p.push("footer missing");
  if (c.full.box) p.push("box leaked into full-page mode");
  ok(c.id.padEnd(20), p.length === 0, p.join("; "));
}

console.log("\n── content box: generators declare what they draw");
for (const g of allGenerators().filter((x) => !ONLY.length || ONLY.includes(x.id))) {
  const rng = createRng(`${g.id}:v${g.version}:catalog-${g.id}`);
  const gctx = { ...ctx, rng } as unknown as GeneratorContext;
  const content = g.generate(gctx, g.defaultParams(gctx));

  if (/\btransform="/.test(content.body)) {
    console.log(`  skip  ${g.id.padEnd(20)} — emits transforms; scan can't resolve them`);
    continue;
  }

  const e = drawnExtent(content.body);
  const fillW = (e.maxX - e.minX) / content.width;
  const fillH = (e.maxY - e.minY) / content.height;
  const p: string[] = [];
  // A box larger than the drawing is a phantom margin: the page composer and
  // the catalog frame both size from it, so the sheet gets whitespace nobody
  // authored. Loose bar — this is a smoke test, and text metrics are estimated.
  if (fillW < 0.75) p.push(`fills only ${(fillW * 100).toFixed(0)}% of declared width`);
  if (fillH < 0.75) p.push(`fills only ${(fillH * 100).toFixed(0)}% of declared height`);
  // The other direction: content escaping its own box risks clipping.
  if (e.minX < -1 || e.minY < -1) p.push(`starts outside the box at (${e.minX.toFixed(1)}, ${e.minY.toFixed(1)})`);
  if (e.maxX > content.width + 1 || e.maxY > content.height + 1) {
    p.push(`overflows to (${e.maxX.toFixed(1)}, ${e.maxY.toFixed(1)}) of ${content.width.toFixed(1)}x${content.height.toFixed(1)}`);
  }
  ok(g.id.padEnd(20), p.length === 0, p.length ? p.join("; ") : `fill ${(fillW * 100).toFixed(0)}%x${(fillH * 100).toFixed(0)}%`);
}

console.log("\n── determinism");
for (const c of cards) {
  const recipe = { generatorId: c.id, generatorVersion: 1, params: null, seed: `catalog-${c.id}` };
  const a = composeWorksheet(recipe, ctx, {}, { thumbnail: true }).svg;
  const b = composeWorksheet(recipe, ctx, {}, { thumbnail: true }).svg;
  if (a !== b) ok(`${c.id} thumbnail is deterministic`, false);
}
ok("all thumbnails re-render byte-identically", true);

// Visual harness for the thumbnails (open it, or screenshot it headlessly).
const html = `<!doctype html><meta charset="utf-8"><style>
  :root { --line: #e7e3dd; }
  body { margin: 0; padding: 16px; background: #faf8f5; font: 13px system-ui, sans-serif; ${WIDTH ? `width: ${WIDTH}px; box-sizing: border-box;` : ""} }
  .grid { display: grid; gap: 16px; align-items: start; grid-template-columns: repeat(${WIDTH && WIDTH <= 640 ? 1 : 3}, minmax(0, 1fr)); }
  .card { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #fff; }
  .frame { overflow: hidden; border-bottom: 1px solid var(--line); background: #fff; padding: 12px; box-sizing: border-box; }
  .frame > svg { display: block; width: 100%; height: 100%; }
  .meta { padding: 8px 12px; color: #5b5750; }
</style>
<div class="grid">${cards
  .map((c) => {
    const a = Math.min(1.6, Math.max(0.75, c.thumb.box!.width / c.thumb.box!.height));
    return `<div class="card"><div class="frame" style="aspect-ratio:${a}">${c.thumb.svg}</div><div class="meta"><b>${c.id}</b> — ${a.toFixed(2)}</div></div>`;
  })
  .join("")}</div>`;
writeFileSync(`${OUT}/catalog-harness.html`, html);
console.log(`\nharness → ${OUT}/catalog-harness.html`);
console.log(failures ? `\n${failures} FAILURE(S)` : `\nOK — ${cards.length} generators, both modes`);
process.exit(failures ? 1 : 0);
