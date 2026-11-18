/** The subset fonts must hold every character the game can show (else run `pnpm fonts:subset`). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('[P4] 글꼴 서브셋', () => {
  it('covers every non-emoji character in ko.ts', () => {
    const covered = new Set(JSON.parse(readFileSync('src/assets/fonts/glyphs.json', 'utf8')) as string);
    const text = readFileSync('src/i18n/ko.ts', 'utf8');
    const missing = [...new Set(text)].filter(
      (c) =>
        (c.codePointAt(0) ?? 0) > 0x7e && !/\p{Extended_Pictographic}|\p{Mn}|[️‍]/u.test(c) && !covered.has(c),
    );
    expect(missing, `run "pnpm fonts:subset" — missing: ${missing.join('')}`).toEqual([]);
  });
});
