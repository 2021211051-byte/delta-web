import { test, expect } from '@playwright/test';

test('打空弹匣后换弹同步服务器并可继续命中靶子', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__ready && window.__deltaPortal?.assets, null, { timeout: 90000 });
  await page.locator('#delta-deploy').click();
  await page.waitForFunction(() => window.__G?.delta?.self, null, { timeout: 90000 });
  await page.locator('#view').click();
  await page.waitForFunction(() => window.__G.input.locked);
  await page.evaluate(async () => {
    const network = window.__G.delta.network;
    for (let shot = 0; shot < 30; shot += 1) {
      network.send({ type: 'shot', origin: { x: 0, y: 1.64, z: 26 }, direction: { x: 0, y: -.013570755, z: -.99990794 } });
      await new Promise((resolve) => setTimeout(resolve, 110));
    }
  });
  await page.waitForFunction(() => window.__G.delta.self.loadout.m7.ammo === 0);
  const hits = await page.evaluate(() => window.__G.delta.self.hits);
  expect(hits).toBeGreaterThan(0);
  await page.evaluate(() => { window.__G.weapon.ammo = 0; });
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => window.__G.weapon.state === 'reloading');
  await page.waitForFunction(() => window.__G.delta.self.loadout.m7.reloading);
  await page.waitForFunction(() => window.__G.delta.self.loadout.m7.ammo === 30, null, { timeout: 15000 });
  await page.waitForFunction(() => !window.__G.delta.self.loadout.m7.reloading);
  await page.waitForFunction(() => {
    const G = window.__G;
    return G.weapon.ammo === 30 && G.delta.self.hits >= 4;
  });
  await page.waitForTimeout(3500);
  await page.mouse.down({ button: 'left' });
  await page.waitForFunction(() => window.__G.weapon.ammo === 29);
  await page.mouse.up({ button: 'left' });
  await page.waitForFunction((before) => window.__G.delta.self.hits > before, hits, { timeout: 15000 });
  expect(await page.evaluate(() => window.__G.weapon.ammo)).toBeLessThan(30);
  expect(errors).toEqual([]);
});
