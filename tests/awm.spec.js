import { test, expect } from '@playwright/test';

test('AWM 新模型、拉栓与连续换弹动画', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__ready && window.__deltaPortal?.assets, null, { timeout: 90000 });
  await page.locator('#delta-deploy').click();
  await page.waitForFunction(() => window.__G?.delta?.self, null, { timeout: 90000 });
  await page.locator('#view').click(); await page.waitForFunction(() => window.__G.input.locked);
  await page.keyboard.press('Digit2');
  await page.waitForFunction(() => window.__G.weapon.name === 'AWM');
  const info = await page.evaluate(() => {
    const model = window.__G.delta.awmVisual;
    return { triangles: model.userData.triangles, actions: Object.keys(model.userData.actions), bolt: model.userData.bolt.position.toArray() };
  });
  expect(info.triangles).toBeGreaterThan(20000);
  expect(info.actions).toEqual(expect.arrayContaining(['Reload', 'Bolt']));
  await page.screenshot({ path: 'test-results/awm-refined-model.png' });
  await page.mouse.down({ button: 'left' });
  await page.waitForFunction(() => window.__G.weapon.ammo === 4);
  await page.mouse.up({ button: 'left' });
  await page.waitForFunction(() => window.__G.delta.awmVisual.userData.actions.Bolt.isRunning());
  await page.waitForFunction(() => {
    const bolt = window.__G.delta.awmVisual.userData.bolt;
    return Math.abs(bolt.position.z + .21) > .02 || Math.abs(bolt.rotation.y) > .1;
  });
  await page.screenshot({ path: 'test-results/awm-bolt-animation.png' });
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => window.__G.weapon.state === 'reloading');
  await page.waitForFunction(() => window.__G.delta.awmVisual.userData.actions.Reload.isRunning());
  await page.waitForFunction(() => Math.abs(window.__G.delta.awmVisual.userData.magazine.position.y) > .03);
  await page.screenshot({ path: 'test-results/awm-reload-animation.png' });
  expect(errors).toEqual([]);
});
