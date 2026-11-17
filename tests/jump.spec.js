import { test, expect } from '@playwright/test';

test('跳跃枪械摆动降低且开镜时基本稳定', async ({ page }) => {
  await page.goto('/?show=weapon&wpose=hip&q=medium');
  await page.waitForFunction(() => window.__ready && window.__G?.weapon, null, { timeout: 60000 });
  const result = await page.evaluate(() => {
    const G = window.__G;
    function jump(ads) {
      G.weapon.reset(); G.input.ads = ads; G.player.speed = 0;
      for (let i = 0; i < 35; i++) G.weapon.update(.016);
      const base = G.weapon.root.rotation.x;
      let peak = 0;
      G.player.vel.set(0, 5, 0); G.player.onGround = false;
      for (let i = 0; i < 40; i++) {
        G.weapon.update(.016);
        peak = Math.max(peak, Math.abs(G.weapon.root.rotation.x - base));
      }
      return peak;
    }
    return { hip: jump(false), ads: jump(true) };
  });
  expect(result.hip).toBeGreaterThan(0);
  expect(result.ads).toBeLessThan(result.hip * .35);
});
