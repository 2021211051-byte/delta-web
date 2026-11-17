import { test, expect } from '@playwright/test';

async function deploy(page, room, operator = 'vyron', freeze = false) {
  await page.goto('/');
  await page.waitForFunction(() => window.__ready && window.__G?.game, null, { timeout: 60000 });
  if (freeze) await page.evaluate(() => window.__G.renderer.setAnimationLoop(null));
  await page.locator('[data-mode="online"]').click();
  await page.locator(`[data-op="${operator}"]`).click();
  await page.locator('#delta-room').fill(room);
  await page.locator('#delta-deploy').click();
  await page.waitForFunction(() => window.__G?.delta?.self, null, { timeout: 90000 });
  await expect(page.locator('#delta-portal')).toBeHidden();
}

test('Saltline 合并版大厅、真实射击、AWM 与双玩家联机', async ({ page, browser }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__ready && window.__deltaPortal?.assets, null, { timeout: 60000 });
  await expect(page.locator('#delta-portal')).toBeVisible();
  expect(await page.evaluate(() => window.__deltaPortal.assets.assets.size)).toBe(7);
  await page.screenshot({ path: 'test-results/merged-lobby-test.png' });
  const room = `ROOM${Math.floor(Math.random() * 9000 + 1000)}`;
  await deploy(page, room);
  expect(await page.evaluate(() => window.__G.enemies.list.length)).toBe(0);
  expect(await page.evaluate(() => window.__G.level.targets === undefined)).toBe(true);
  expect(await page.evaluate(() => window.__G.ground.rain.visible)).toBe(false);
  await page.locator('#view').click();
  await page.waitForFunction(() => window.__G.input.locked);
  const startPosition = await page.evaluate(() => window.__G.player.pos.toArray());
  await page.keyboard.down('KeyW');
  await page.waitForFunction((start) => Math.hypot(...window.__G.player.pos.toArray().map((value, index) => value - start[index])) > .2, startPosition, { timeout: 15000 });
  await page.keyboard.up('KeyW');
  await page.mouse.down({ button: 'left' });
  await page.waitForFunction(() => window.__G.delta.self.shots > 0);
  await page.mouse.up({ button: 'left' });
  await page.screenshot({ path: 'test-results/merged-m7-test.png' });
  await page.keyboard.press('Digit2');
  await expect.poll(() => page.evaluate(() => window.__G.weapon.name)).toBe('AWM');
  expect(await page.evaluate(() => window.__G.weapon.magSize)).toBe(5);
  await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => window.__G.awmWeapon.ads > .7, null, { timeout: 15000 });
  await expect(page.locator('#delta-scope')).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => window.__G.delta.awmVisual.visible)).toBe(false);
  await page.screenshot({ path: 'test-results/merged-awm-scope-test.png' });
  await page.mouse.up({ button: 'right' });
  await page.mouse.down({ button: 'left' });
  await expect.poll(() => page.evaluate(() => window.__G.weapon.ammo)).toBe(4);
  await page.mouse.up({ button: 'left' });

  expect(errors).toEqual([]);
});
