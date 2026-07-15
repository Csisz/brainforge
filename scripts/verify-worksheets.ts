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
