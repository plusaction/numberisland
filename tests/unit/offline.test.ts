import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function run(files: Record<string, string>): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'offline-'));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  try {
    execFileSync('node', ['tools/check-offline.mjs', dir], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

describe('[S1] 네트워크 0 검사기', () => {
  it('passes clean bundles and comment-only credits', () => {
    expect(run({ 'a.js': 'const x = 1;\n\t// https://www.shadertoy.com/view/abc\n' })).toBe(true);
  });
  it('fails on fetch to an absolute URL, sockets, beacons, CDN script and CSS url()', () => {
    expect(run({ 'a.js': 'fetch("https://api.example.com/x")' })).toBe(false);
    expect(run({ 'a.js': 'new WebSocket(u)' })).toBe(false);
    expect(run({ 'a.js': 'navigator.sendBeacon(u)' })).toBe(false);
    expect(run({ 'i.html': '<script src="https://cdn.example.com/x.js"></script>' })).toBe(false);
    expect(run({ 'a.css': 'body{background:url(https://example.com/a.png)}' })).toBe(false);
  });
});
