import { test, expect } from '@playwright/test';

test('双模式中文主页、独立靶场与原港口联机', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__ready && window.__deltaPortal?.assets, null, { timeout: 60000 });
  await expect(page.locator('[data-mode="single"]')).toBeVisible();
  await expect(page.locator('[data-mode="online"]')).toBeVisible();
  await expect(page.locator('#delta-portal')).toHaveCSS('background-color', 'rgb(8, 14, 13)');
  await page.screenshot({ path: 'test-results/chinese-two-modes.png' });
  await page.locator('#delta-deploy').click();
  await page.waitForFunction(() => window.__G?.delta?.self);
  expect(await page.evaluate(() => window.__G.level.targets.size)).toBe(8);
  expect(await page.evaluate(() => window.__G.game.state)).toBe('playing');

  await page.goto('/?mode=online');
  await page.waitForFunction(() => window.__ready && window.__deltaPortal?.assets, null, { timeout: 60000 });
  await page.locator('[data-mode="online"]').click();
  await page.locator('#delta-room').fill('PORT42');
  await page.locator('#delta-deploy').click();
  await page.waitForFunction(() => window.__G?.delta?.self, null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__G.level.objectives.length)).toBe(0);
  expect(await page.evaluate(() => window.__G.enemies.list.length)).toBe(0);
  expect(await page.evaluate(() => window.__G.ground.rain.visible)).toBe(false);
  expect(await page.evaluate(() => window.__G.level.targets === undefined)).toBe(true);
  await page.screenshot({ path: 'test-results/chinese-port-map.png' });
  await page.locator('#view').click();
  await page.waitForFunction(() => window.__G.input.locked);
  await page.keyboard.press('Escape');
  await expect(page.locator('.m-card[data-s="paused"] .m-h')).toHaveText('已暂停');
  await expect(page.locator('.m-card[data-s="paused"] [data-act="settings"]')).toBeVisible({ timeout: 10000 });
  await page.locator('.m-card[data-s="paused"] [data-act="settings"]').click();
  await expect(page.locator('#l-q')).toHaveText('画面质量');
  await expect(page.locator('[for="s-sens"]')).toHaveText('鼠标灵敏度');
  expect(errors).toEqual([]);
});
