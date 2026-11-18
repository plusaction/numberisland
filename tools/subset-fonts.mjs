/**
 * Font subsetting (run `pnpm fonts:subset` after changing any Korean text).
 *
 * The game only ever shows the text in `src/i18n/ko.ts` (P4), so the Korean fonts are cut down to exactly
 * those characters plus ASCII and the symbols the UI uses: Jua's full Korean set is 366 KB and Pretendard's
 * 2 MB, while the subsets are a few dozen KB. Runs at build-tool time only — the game never fetches fonts
 * from anywhere (P1). Writes the woff2 files and `glyphs.json` (the covered characters, checked by a test).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'src/assets/fonts');

/** Every non-ASCII character in the source (strings live in ko.ts; a few symbols live in components). */
function sourceChars() {
  const chars = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f))
        for (const c of readFileSync(p, 'utf8')) if (c.codePointAt(0) > 0x7e) chars.add(c);
    }
  };
  walk(join(ROOT, 'src'));
  return chars;
}

const ascii = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i));
// symbols that come from data rather than literals (math signs, arrows, stars, quotes)
const extra = [...'−×÷·…→←↑↓★☆✓✔①②③④⑤⑥⑦⑧⑨⑩‘’“”'];
const keep = [...new Set([...ascii, ...extra, ...sourceChars()])]
  // emoji are drawn by the system emoji font, never by these
  .filter((c) => !/\p{Extended_Pictographic}/u.test(c))
  .sort();
const text = keep.join('');

const jobs = [
  ['jua.woff2', join(ROOT, 'node_modules/@fontsource/jua/files/jua-korean-400-normal.woff2')],
  ['jua-latin.woff2', join(ROOT, 'node_modules/@fontsource/jua/files/jua-latin-400-normal.woff2')],
  [
    'pretendard.woff2',
    join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2'),
  ],
];
for (const [name, src] of jobs) {
  // Pretendard is variable (100–900): pinned to the two weights the UI uses as two static faces would
  // double the files, so one medium-ish instance (600) serves the small print; Jua has one weight anyway
  const axes = name.startsWith('pretendard') ? { variationAxes: { wght: 600 } } : {};
  const out = await subsetFont(readFileSync(src), text, { targetFormat: 'woff2', ...axes });
  writeFileSync(join(OUT, name), out);
  console.log(`${name}: ${Math.round(statSync(src).size / 1024)} KB → ${Math.round(out.length / 1024)} KB`);
}
writeFileSync(join(OUT, 'glyphs.json'), `${JSON.stringify(text)}\n`);
console.log(`${keep.length} characters`);
