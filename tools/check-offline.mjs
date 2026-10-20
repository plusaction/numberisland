#!/usr/bin/env node
// P1: fail the build if the bundle can reach the network.
// Scans every text asset for absolute/protocol-relative URLs and network APIs; requires the CSP meta.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
// Documentation links that appear in library error messages (text only, never requested). Host-anchored.
const ALLOW = [
  /^https?:\/\/www\.w3\.org(\/|$)/,
  /^https?:\/\/(www\.)?threejs\.org(\/|$)/,
  /^https?:\/\/react\.dev(\/|$)/,
  /^https?:\/\/reactjs\.org(\/|$)/,
  /^https?:\/\/(gpuweb\.github\.io|developer\.mozilla\.org|tailwindcss\.com|opensource\.org|mths\.be)(\/|$)/,
  /^https?:\/\/github\.com\/mrdoob\/three\.js\/(issues|pull|wiki)\//, // three.js error-message links
  /^https?:\/\/localhost(:\d+)?(\/|$)/,
];
const NET_APIS = [
  [/\bWebSocket\s*\(/, 'WebSocket'],
  [/\bEventSource\s*\(/, 'EventSource'],
  [/sendBeacon/, 'sendBeacon'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bRTCPeerConnection\b/, 'RTCPeerConnection'],
  [/\bWebTransport\b/, 'WebTransport'],
  [/\bfetch\(\s*["'`](?:https?:|wss?:|\/\/)/, 'fetch(absolute URL)'],
  [/["'`]ht["'`]\s*\+\s*["'`]tps?:/, 'split protocol string'],
  [/\bimport\(\s*["'`](?:https?:|\/\/)/, 'remote dynamic import'],
];
const CSS_REMOTE = [/url\(\s*["']?(?:https?:)?\/\/[^)]+\)/i, /@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i];
const HTML_REMOTE = /<(script|link|img|iframe|source|video|audio)[^>]+(src|href)=["'](?:https?:)?\/\//i;

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
  const ext = extname(file);
  if (!['.js', '.mjs', '.css', '.html', '.json', '.webmanifest', '.svg'].includes(ext)) continue;
  // normalise escaped slashes so "https:\/\/x" cannot hide
  const src = readFileSync(file, 'utf8').replace(/\\\//g, '/');
  for (const m of src.matchAll(/(?:https?|wss?):\/\/[^\s"'`)<>\\]+/g)) {
    const url = m[0];
    if (ALLOW.some((re) => re.test(url))) continue;
    // a link on a line that *starts* with `//` (shader-source credits inside template strings) is text
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const before = src.slice(lineStart, m.index);
    if (/^\s*\/\/[^"'`]*$/.test(before)) {
      commentLinks++;
      continue;
    }
    problems.push(`${file}: external URL ${url}`);
  }
  for (const [re, name] of NET_APIS) if (re.test(src)) problems.push(`${file}: network API ${name}`);
  if (ext === '.css' || ext === '.html')
    for (const re of CSS_REMOTE) if (re.test(src)) problems.push(`${file}: remote CSS url/@import`);
  if (ext === '.html' && HTML_REMOTE.test(src)) problems.push(`${file}: remote <script>/<link>/<img>`);
}
// CSP must ship with the page (runtime defence for anything a static scan misses)
try {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  if (!/Content-Security-Policy/.test(html) || !/connect-src 'self'/.test(html))
    problems.push("index.html: CSP meta with connect-src 'self' missing");
} catch {
  problems.push('index.html missing');
}
if (problems.length) {
  console.error(`[check-offline] FAIL (${problems.length})`);
  for (const p of [...new Set(problems)].slice(0, 50)) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `[check-offline] OK — ${files.length} files, no external network references (${commentLinks} comment-only links ignored).`,
);
