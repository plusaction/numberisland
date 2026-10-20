/**
 * `pnpm images:ingest`: validate user-provided images in assets/inbox/ (QUALITY96 §4.2) and register them.
 * Checks: file name listed in IMAGE_REQUESTS, PNG/WebP signature, size budget, alpha for transparent items.
 * Valid files are copied to public/img/ and appended to docs/ASSETS.md with a SHA-256 hash.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const INBOX = 'assets/inbox';
const OUT = 'public/img';
const requests = readFileSync('docs/IMAGE_REQUESTS.md', 'utf8');
const BUDGET: Record<string, number> = { '512×512': 40_000, '1024×1024': 120_000, '2048×1024': 300_000 };

function kind(buf: Buffer): 'png' | 'webp' | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

function hasAlpha(buf: Buffer, k: 'png' | 'webp'): boolean {
  if (k === 'png') return [4, 6].includes(buf[25] ?? 0) || buf.includes(Buffer.from('tRNS'));
  return (
    buf.includes(Buffer.from('ALPH')) ||
    (buf.subarray(12, 16).toString() === 'VP8X' && ((buf[20] ?? 0) & 0x10) !== 0)
  );
}

mkdirSync(OUT, { recursive: true });
let ok = 0;
const problems: string[] = [];
for (const f of existsSync(INBOX) ? readdirSync(INBOX) : []) {
  if (f.startsWith('.')) continue;
  const row = requests.split('\n').find((l) => l.includes(`\`${f}\``));
  if (!row) {
    problems.push(`${f}: not in IMAGE_REQUESTS.md`);
    continue;
  }
  const cells = row.split('|').map((c) => c.trim());
  const size = cells[4] ?? '';
  const transparent = cells[5] === '투명';
  const buf = readFileSync(join(INBOX, f));
  const k = kind(buf);
  if (!k) {
    problems.push(`${f}: not PNG/WebP`);
    continue;
  }
  if (transparent && !hasAlpha(buf, k)) problems.push(`${f}: needs a transparent background`);
  const budget = BUDGET[size] ?? 300_000;
  if (buf.byteLength > budget * 4)
    problems.push(`${f}: ${buf.byteLength} bytes is far above the ${budget} budget (optimise first)`);
  if (problems.some((p) => p.startsWith(f))) continue;
  copyFileSync(join(INBOX, f), join(OUT, f));
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16);
  appendFileSync(
    'docs/ASSETS.md',
    `| public/img/${f} | 이미지 | 사용자 제공 | 사용자 확인 필요 | ${new Date().toISOString().slice(0, 10)} | ${hash} |\n`,
  );
  ok++;
}
console.log(`ingested ${ok} image(s)`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
