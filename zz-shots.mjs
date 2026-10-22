import { chromium } from '@playwright/test';

const out = process.argv[2];
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader'],
});
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://127.0.0.1:4180/?renderer=webgl');
await p.waitForTimeout(3000);
await p.getByRole('textbox').fill('테스트');
await p.getByRole('button', { name: /모험/ }).click();
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(1500);
  const btns = p.locator('.card button');
  if ((await btns.count()) === 0) break;
  await btns
    .first()
    .click()
    .catch(() => {});
}
await p.waitForTimeout(5000);
await p.screenshot({ path: `${out}/3-hub.png` });
await b.close();
