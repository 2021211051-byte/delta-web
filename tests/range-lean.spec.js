import { test, expect } from '@playwright/test';

test('室内靶场、整组移动靶、探头、斜向疾跑与 AWM 手部显隐', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__ready && window.__deltaPortal?.assets, null, { timeout: 90000 });
  await page.locator('#delta-deploy').click();
  await page.waitForFunction(() => window.__G?.delta?.self, null, { timeout: 90000 });
  await page.locator('#view').click();
  await page.waitForFunction(() => window.__G.input.locked);

  const target = await page.evaluate(() => {
    const model = window.__G.level.targets.get('t5');
    const stand = model.group.getObjectByName('target-stand');
    const base = model.group.getObjectByName('target-base');
    model.group.position.x += 1.25;
    model.group.updateMatrixWorld(true);
    return {
      standParent: stand.parent === model.group,
      baseParent: base.parent === model.group,
      standX: stand.getWorldPosition(model.group.position.clone()).x,
      groupX: model.group.position.x,
      backstopZ: window.__G.level.root.getObjectByName('backstop').position.z,
      lights: window.__G.level.root.children.filter((child) => child.isPointLight).length,
    };
  });
  expect(target.standParent).toBe(true);
  expect(target.baseParent).toBe(true);
  expect(target.standX).toBeCloseTo(target.groupX);
  expect(target.backstopZ).toBe(-32);
  expect(target.lights).toBeGreaterThanOrEqual(3);

  for (const strafe of ['KeyA', 'KeyD']) {
    await page.evaluate(() => {
      const G = window.__G;
      G.player.reset({ pos: G.player.pos.clone().set(0, 0, 26), yaw: 0 });
    });
    await page.keyboard.down('KeyW');
    await page.keyboard.down(strafe);
    await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(() => window.__G.player.sprinting && window.__G.player.speed > 4.5, null, { timeout: 15000 });
    expect(await page.evaluate(() => window.__G.player.sprinting)).toBe(true);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up(strafe);
    await page.keyboard.up('KeyW');
  }

  expect(await page.evaluate(() => window.__G.physics.bounds.max.z)).toBe(39);
  await page.evaluate(() => {
    const G = window.__G;
    G.player.reset({ pos: G.player.pos.clone().set(18, 0, 27), yaw: 0 });
  });
  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => window.__G.player.pos.z > 31.5, null, { timeout: 15000 });
  await page.keyboard.up('KeyS');

  await page.evaluate(() => {
    const G = window.__G;
    G.player.reset({ pos: G.player.pos.clone().set(0, 0, 26), yaw: 0 });
  });
  const centerX = await page.evaluate(() => window.__G.camera.position.x);
  await page.keyboard.down('KeyQ');
  await page.waitForFunction(() => window.__G.player.lean < -.9, null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__G.camera.position.x)).toBeLessThan(centerX - .3);
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(() => window.__G.player.speed > 2, null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__G.player.sprinting)).toBe(false);
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW'); await page.keyboard.up('KeyQ');
  await page.waitForFunction(() => Math.abs(window.__G.player.lean) < .05, null, { timeout: 15000 });
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__G.player.lean > .9, null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__G.camera.position.x)).toBeGreaterThan(centerX + .3);
  expect(await page.evaluate(() => window.__G.camera.rotation.z)).toBeLessThan(-.1);
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => Math.abs(window.__G.player.lean) < .05, null, { timeout: 15000 });

  await page.evaluate(() => window.__G.delta.setLeanMode('toggle'));
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__G.player.lean < -.9, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__G.player.lean)).toBeLessThan(-.9);
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => Math.abs(window.__G.player.lean) < .05, null, { timeout: 15000 });
  await page.evaluate(() => window.__G.delta.setLeanMode('hold'));

  await page.keyboard.press('Digit2');
  await page.waitForFunction(() => window.__G.weapon.name === 'AWM');
  const handVisible = () => page.evaluate(() => ['SaltlineGripHand', 'SaltlineSupportHand'].every((name) => window.__G.awmWeapon.root.getObjectByName(name).visible));
  expect(await handVisible()).toBe(true);
  await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => window.__G.awmWeapon.ads > .8);
  await page.waitForFunction(() => ['SaltlineGripHand', 'SaltlineSupportHand'].every((name) => !window.__G.awmWeapon.root.getObjectByName(name).visible));
  expect(await page.evaluate(() => window.__G.delta.awmVisual.visible)).toBe(false);
  await page.screenshot({ path: 'test-results/range-awm-clear-scope.png' });
  await page.mouse.up({ button: 'right' });
  await page.waitForFunction(() => window.__G.awmWeapon.ads < .1);
  expect(await handVisible()).toBe(true);
  await page.evaluate(() => {
    const G = window.__G;
    G.events.on('weapon:fire', (event) => {
      window.__lastFire = {
        origin: event.origin.toArray(), muzzle: event.muzzle.toArray(), direction: event.dir.toArray(),
        camera: G.camera.position.toArray(), forward: G.camera.getWorldDirection(event.dir.clone()).toArray(),
      };
    });
    const tracer = G.fx.tracer.bind(G.fx);
    G.fx.tracer = (start, end, options) => { window.__tracerOptions = options; return tracer(start, end, options); };
  });
  await page.mouse.down({ button: 'left' });
  await page.waitForFunction(() => window.__lastFire, null, { timeout: 15000 });
  await page.mouse.up({ button: 'left' });
  const ballistic = await page.evaluate(() => {
    const G = window.__G; const shot = window.__lastFire;
    const origin = G.camera.position.clone().fromArray(shot.origin);
    const direction = origin.clone().fromArray(shot.direction);
    const aim = G.camera.position.clone().fromArray(shot.camera).addScaledVector(origin.clone().fromArray(shot.forward), 300);
    const along = aim.clone().sub(origin).dot(direction);
    return {
      muzzleDistance: origin.distanceTo(G.camera.position.clone().fromArray(shot.muzzle)),
      aimError: origin.addScaledVector(direction, along).distanceTo(aim),
      tracer: window.__tracerOptions,
    };
  });
  expect(ballistic.muzzleDistance).toBeGreaterThan(.25);
  expect(ballistic.aimError, JSON.stringify(ballistic)).toBeLessThan(1);
  expect(ballistic.tracer.width).toBe(.009);
  expect(ballistic.tracer.trail).toBe(false);
  await page.screenshot({ path: 'test-results/range-awm-grip.png' });
  expect(errors).toEqual([]);
});
