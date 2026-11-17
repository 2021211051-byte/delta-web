import { test, expect } from '@playwright/test';

test('烟雾覆盖、技能冷却与红狼大招黄条', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__ready && window.__deltaPortal?.assets, null, { timeout: 90000 });
  await page.locator('[data-op="redwolf"]').click(); await page.locator('#delta-deploy').click();
  await page.waitForFunction(() => window.__G?.delta?.self, null, { timeout: 90000 });
  await page.locator('#view').click(); await page.waitForFunction(() => window.__G.input.locked);
  await page.keyboard.press('KeyX');
  await expect(page.locator('#delta-ult')).toBeVisible();
  await expect(page.locator('#delta-ult b')).toContainText('s');
  expect(await page.locator('[data-skill="primary"]').getAttribute('data-cooldown')).toContain('s');
  await page.screenshot({ path: 'test-results/redwolf-ult.png' });
  await page.evaluate(() => {
    const original = window.__G.fx.smoke.bind(window.__G.fx);
    window.__smokeOptions = null;
    window.__G.fx.smoke = (position, options) => { window.__smokeOptions = options; return original(position, options); };
  });
  await page.keyboard.down('KeyG'); await page.keyboard.up('KeyG');
  await page.waitForFunction(() => window.__smokeOptions !== null, null, { timeout: 10000 });
  const options = await page.evaluate(() => window.__smokeOptions);
  expect(options.count).toBeGreaterThanOrEqual(40); expect(options.size).toBeGreaterThanOrEqual(2.5);
  expect(errors).toEqual([]);
});
