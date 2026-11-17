import { test, expect } from '@playwright/test';

async function deploy(page, operator) {
  await page.goto('/');
  await page.waitForFunction(() => window.__ready && window.__deltaPortal?.assets, null, { timeout: 90000 });
  await page.locator(`[data-op="${operator}"]`).click();
  await page.locator('#delta-deploy').click();
  await page.waitForFunction(() => window.__G?.delta?.self, null, { timeout: 90000 });
  await page.locator('#view').click(); await page.waitForFunction(() => window.__G.input.locked);
}

test('C4、手炮与弓箭均显示真实弹道', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await deploy(page, 'vyron'); await page.keyboard.down('KeyV');
  await page.waitForFunction(() => window.__G.delta.trajectoryLine?.geometry.attributes.position?.count >= 8);
  expect(await page.evaluate(() => window.__G.delta.device.userData.model)).toBe('c4');
  await page.screenshot({ path: 'test-results/c4-trajectory.png' });
  const predicted = await page.evaluate(() => window.__G.delta.trajectoryEnd.position.toArray());
  await page.keyboard.up('KeyV');
  expect(await page.evaluate(() => window.__G.delta.trajectory)).toBeFalsy();
  await expect.poll(() => page.evaluate(() => window.__G.delta.latestProjectiles?.length)).toBe(1);
  await page.waitForFunction(() => window.__G.delta.latestProjectiles?.[0]?.stuck);
  const actual = await page.evaluate(() => window.__G.delta.latestProjectiles[0].position);
  expect(Math.hypot(predicted[0] - actual.x, predicted[2] - actual.z)).toBeLessThan(1.2);

  await deploy(page, 'redwolf'); await page.keyboard.press('KeyV');
  await page.waitForFunction(() => window.__G.delta.trajectoryLine?.geometry.attributes.position?.count >= 8);
  await page.screenshot({ path: 'test-results/launcher-trajectory.png' });

  await deploy(page, 'luna'); await page.keyboard.press('KeyX');
  await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => window.__G.delta.bowCharge > .55);
  expect(await page.evaluate(() => window.__G.delta.trajectory)).toBeFalsy();
  await page.mouse.up({ button: 'right' });
  expect(errors).toEqual([]);
});
