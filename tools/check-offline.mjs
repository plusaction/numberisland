#!/usr/bin/env node
// P1: fail the build if the bundle can reach the network (external URLs, fetch/XHR/WebSocket/EventSource/sendBeacon).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
// Namespace/identifier URLs that never trigger a request.
const ALLOW = [
  /^https?:\/\/www\.w3\.org\//,
  /^https?:\/\/(www\.)?threejs\.org\//, // license comments / error message links (text only)
  /^https?:\/\/react\.dev\//, // React error decoder links in messages (text only)
  /^https?:\/\/reactjs\.org\//,
  /^https?:\/\/(github\.com|gpuweb\.github\.io|developer\.mozilla\.org|tailwindcss\.com|opensource\.org|mths\.be)(\/|$)/, // comment/message links
  /^https?:\/\/localhost/,
];
const NET_APIS = [
  /\bnew\s+WebSocket\b/,
  /\bnew\s+EventSource\b/,
  /\bnavigator\.sendBeacon\b/,
  /\bnew\s+XMLHttpRequest\b/,
];
// fetch is only permitted for same-origin relative assets (e.g. WASM/fonts) — any fetch with an absolute URL fails below.
const FETCH_ABS = /\bfetch\(\s*["'`]https?:/;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error(`[check-offline] ${DIST}/ not found — run the build first.`);
  process.exit(1);
}
const problems = [];
let commentLinks = 0;
for (const file of files) {
  if (!['.js', '.mjs', '.css', '.html', '.json', '.webmanifest', '.svg'].includes(extname(file))) continue;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    const url = m[0];
    if (ALLOW.some((re) => re.test(url))) continue;
    // A link inside a `// comment` line (e.g. shader source credits) is text, never a request.
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const before = src.slice(lineStart, m.index);
    if (/^\s*\/\/|\/\*|^\s*\*/.test(before)) {
      commentLinks++;
      continue;
    }
    problems.push(`${file}: external URL ${url}`);
  }
  for (const re of NET_APIS) if (re.test(src)) problems.push(`${file}: network API ${re}`);
  if (FETCH_ABS.test(src)) problems.push(`${file}: fetch() with absolute URL`);
  if (extname(file) === '.html' && /<(script|link)[^>]+(src|href)=["']https?:/i.test(src)) {
    problems.push(`${file}: external <script>/<link>`);
  }
}
if (problems.length) {
  console.error(`[check-offline] FAIL (${problems.length})`);
  for (const p of [...new Set(problems)].slice(0, 50)) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `[check-offline] OK — ${files.length} files, no external network references (${commentLinks} comment-only links ignored).`,
);
