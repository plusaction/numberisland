import type { Page, TestInfo } from '@playwright/test';

/** Append `renderer=webgl` for the webgl project. */
export function url(info: TestInfo, path: string): string {
  if (info.project.name !== 'webgl') return path;
  return path + (path.includes('?') ? '&' : '?') + 'renderer=webgl';
}

export async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** True when the world canvas shows real content (many distinct colours, not a flat clear colour). */
export async function nonBlank(page: Page): Promise<boolean> {
  const png = await page.locator('canvas').first().screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 40;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 64, 40);
    const d = ctx.getImageData(0, 0, 64, 40).data;
    const colours = new Set<number>();
    for (let i = 0; i < d.length; i += 4)
      colours.add(
        ((d[i] as number) >> 4) * 256 + ((d[i + 1] as number) >> 4) * 16 + ((d[i + 2] as number) >> 4),
      );
    return colours.size > 40;
  }, png.toString('base64'));
}
