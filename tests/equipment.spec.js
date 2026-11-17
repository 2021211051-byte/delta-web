import { test, expect } from '@playwright/test';

async function deploy(page, operator, room) {
  await page.goto('/');
  await page.waitForFunction(() => window.__ready && window.__G?.game, null, { timeout: 60000 });
  await page.locator(`[data-op="${operator}"]`).click();
  await page.locator('#delta-deploy').click();
  await page.waitForFunction(() => window.__G?.delta?.self, null, { timeout: 30000 });
  await page.locator('#view').click();
  await page.waitForFunction(() => window.__G.input.locked);
}

test('三名干员手持技能、Saltline 换弹与 AWM 拉栓', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await deploy(page, 'vyron', 'HOLD42');
  await page.mouse.down({ button: 'left' });
  await page.waitForFunction(() => window.__G.delta.self.shots > 0);
  await page.mouse.up({ button: 'left' });
  await page.keyboard.press('KeyR');
  await expect.poll(() => page.evaluate(() => window.__G.weapon.state)).toBe('reloading');
  await page.waitForTimeout(2400);
  await page.keyboard.down('KeyV'); await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__G.delta.equipment)).toBe('magnetic');
  expect(await page.evaluate(() => window.__G.delta.latestProjectiles?.length || 0)).toBe(0);
  await page.keyboard.up('KeyV');
  await expect.poll(() => page.evaluate(() => window.__G.delta.latestProjectiles?.length)).toBe(1);

  await deploy(page, 'luna', 'BOW42');
  await page.keyboard.press('KeyX');
  expect(await page.evaluate(() => window.__G.delta.equipment)).toBe('bow');
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(650);
  expect(await page.evaluate(() => window.__G.delta.bowDrawing)).toBe(true);
  await page.screenshot({ path: 'test-results/merged-bow-test.png' });
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => page.evaluate(() => window.__G.delta.latestProjectiles?.length)).toBe(1);

  await deploy(page, 'redwolf', 'FIRE42');
  await page.keyboard.press('KeyV');
  expect(await page.evaluate(() => window.__G.delta.equipment)).toBe('launcher');
  await page.mouse.click(640, 360, { button: 'left' });
  await expect.poll(() => page.evaluate(() => window.__G.delta.latestProjectiles?.length)).toBe(3);
  expect(errors).toEqual([]);
});
