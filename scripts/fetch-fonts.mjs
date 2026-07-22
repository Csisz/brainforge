/**
 * One-shot: download the exact Google Fonts woff2 files (latin subset) that
 * next/font/google used to fetch at build time, so the build is network-free
 * (Stability B4). Families/weights mirror the old next/font/google config:
 *   Nunito 700/800, Inter 400/500/600, IBM Plex Mono 500.
 *
 * Run once: `node scripts/fetch-fonts.mjs`. The woff2 files it writes to
 * src/app/fonts/ are committed; this script is kept only for provenance.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "fonts");
// A modern browser UA makes the CSS2 API return woff2 (not ttf).
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const FAMILIES = [
  { css: "Nunito:wght@700;800", slug: "nunito" },
  { css: "Inter:wght@400;500;600", slug: "inter" },
  { css: "IBM+Plex+Mono:wght@500", slug: "ibm-plex-mono" },
];

/** Pull the `/* latin *\/` @font-face blocks (weight + woff2 url) out of the CSS. */
function latinFaces(css) {
  const out = [];
  const re = /\/\*\s*latin\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const block = m[1];
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
    const url = /src:\s*url\((https:\/\/[^)]+\.woff2)\)/.exec(block)?.[1];
    if (weight && url) out.push({ weight, url });
  }
  return out;
}

await mkdir(OUT, { recursive: true });
for (const fam of FAMILIES) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${fam.css}&display=swap`;
  const css = await (await fetch(cssUrl, { headers: { "User-Agent": UA } })).text();
  const faces = latinFaces(css);
  if (faces.length === 0) throw new Error(`no latin faces parsed for ${fam.slug}`);

  // Google serves these families as a single VARIABLE woff2 (the same url for
  // every requested weight), so dedupe by url: one file per family, covering the
  // whole weight range. A non-variable family would fall back to per-weight files.
  const urls = [...new Set(faces.map((f) => f.url))];
  for (const url of urls) {
    const weights = faces.filter((f) => f.url === url).map((f) => Number(f.weight));
    const suffix = urls.length === 1 ? "" : `-${weights[0]}`;
    const name = `${fam.slug}${suffix}.woff2`;
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    await writeFile(join(OUT, name), bytes);
    const range = weights.length > 1 ? `${Math.min(...weights)}..${Math.max(...weights)}` : `${weights[0]}`;
    console.log(`  ${name}  (${bytes.length} bytes, weight ${range})`);
  }
}
console.log("done");
