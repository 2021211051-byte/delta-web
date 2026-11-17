import * as THREE from 'three';

function smokeTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  const gradient = c.createRadialGradient(64, 64, 3, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(205,211,196,.82)'); gradient.addColorStop(.35, 'rgba(151,160,146,.55)'); gradient.addColorStop(1, 'rgba(95,105,96,0)');
  c.fillStyle = gradient; c.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export class Effects {
  constructor(scene, materials, audio) {
    this.scene = scene; this.materials = materials; this.audio = audio;
    this.projectiles = new Map(); this.effects = []; this.smokes = [];
    this.smokeMap = smokeTexture();
  }

  projectileMesh(projectile) {
    const group = new THREE.Group();
    if (['recon', 'shock'].includes(projectile.kind)) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .65, 8), this.materials.gunEdge);
      shaft.rotation.x = Math.PI / 2; group.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.035, .13, 8), projectile.kind === 'shock' ? this.materials.lunaAccent : this.materials.light);
      tip.rotation.x = -Math.PI / 2; tip.position.z = -.37; group.add(tip);
      for (const x of [-.06, .06]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(.07, .008, .12), this.materials.polymer); fin.position.set(x, 0, .26); group.add(fin);
      }
    } else {
      const material = projectile.kind === 'smoke' ? this.materials.lunaAccent : projectile.kind === 'magnetic' ? this.materials.redAccent : this.materials.gun;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.055, .06, .16, 12), material); body.rotation.x = Math.PI / 2; group.add(body);
      const band = new THREE.Mesh(new THREE.TorusGeometry(.061, .012, 6, 16), this.materials.gunEdge); group.add(band);
    }
    group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
    this.scene.add(group);
    return group;
  }

  syncProjectiles(list) {
    const active = new Set();
    for (const data of list) {
      active.add(data.id);
      if (!this.projectiles.has(data.id)) this.projectiles.set(data.id, this.projectileMesh(data));
      const object = this.projectiles.get(data.id);
      object.position.set(data.position.x, data.position.y, data.position.z);
      if (Math.hypot(data.velocity.x, data.velocity.y, data.velocity.z) > .1) {
        const direction = new THREE.Vector3(data.velocity.x, data.velocity.y, data.velocity.z).normalize();
        object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
      }
      object.visible = true;
    }
    for (const [id, object] of this.projectiles) {
      if (!active.has(id)) { this.scene.remove(object); this.projectiles.delete(id); }
    }
  }

  tracer(origin, direction, distance = 75, color = 0xffe0a1) {
    const start = new THREE.Vector3(origin.x, origin.y, origin.z);
    const end = start.clone().add(new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(Math.min(distance, 75)));
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .65, blending: THREE.AdditiveBlending }));
    this.scene.add(line); this.effects.push({ object: line, life: .065, maxLife: .065, kind: 'fade' });
  }

  impact(position, target = false) {
    const count = target ? 12 : 5;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3); const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x; positions[i * 3 + 1] = position.y; positions[i * 3 + 2] = position.z;
      velocities.push(new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 3, (Math.random() - .5) * 3));
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: target ? 0xffce77 : 0xc9c2a8, size: .035, transparent: true }));
    this.scene.add(points); this.effects.push({ object: points, life: .55, maxLife: .55, velocities, kind: 'particles' });
  }

  explosion(position, radius = 5) {
    const point = new THREE.Vector3(position.x, position.y, position.z);
    const light = new THREE.PointLight(0xff7a28, 70, radius * 4, 2); light.position.copy(point).y += .4; this.scene.add(light);
    this.effects.push({ object: light, life: .18, maxLife: .18, kind: 'light' });
    const fire = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff9b3e, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false }));
    fire.position.copy(point); fire.scale.setScalar(.25); this.scene.add(fire);
    this.effects.push({ object: fire, life: .28, maxLife: .28, kind: 'explosion', radius });
    this.impact(position, true);
  }

  smoke(position, duration = 12000) {
    const group = new THREE.Group(); group.position.set(position.x, position.y, position.z); this.scene.add(group);
    const particles = [];
    for (let i = 0; i < 38; i++) {
      const material = new THREE.SpriteMaterial({ map: this.smokeMap, transparent: true, opacity: 0, depthWrite: false, color: 0xbec5b8 });
      const sprite = new THREE.Sprite(material);
      const angle = Math.random() * Math.PI * 2; const radius = Math.sqrt(Math.random()) * 2.8;
      sprite.position.set(Math.cos(angle) * radius, .5 + Math.random() * 2.4, Math.sin(angle) * radius);
      const scale = 2.5 + Math.random() * 2; sprite.scale.set(scale, scale, scale); group.add(sprite);
      particles.push({ sprite, drift: (Math.random() - .5) * .12, base: sprite.position.clone() });
    }
    this.smokes.push({ group, particles, life: duration / 1000, maxLife: duration / 1000 });
  }

  scan(position, radius) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0x66d9ec, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(position.x, Math.max(.05, position.y), position.z); ring.scale.setScalar(.1); this.scene.add(ring);
    this.effects.push({ object: ring, life: .9, maxLife: .9, kind: 'scan', radius });
  }

  update(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]; effect.life -= dt;
      const progress = 1 - effect.life / effect.maxLife;
      if (effect.kind === 'fade') effect.object.material.opacity = 1 - progress;
      if (effect.kind === 'light') effect.object.intensity = 70 * (1 - progress);
      if (effect.kind === 'explosion') { effect.object.scale.setScalar(.25 + progress * effect.radius * .42); effect.object.material.opacity = (1 - progress) * .7; }
      if (effect.kind === 'scan') { effect.object.scale.setScalar(progress * effect.radius); effect.object.material.opacity = (1 - progress) * .7; }
      if (effect.kind === 'particles') {
        const positions = effect.object.geometry.attributes.position;
        effect.velocities.forEach((velocity, index) => {
          velocity.y -= 7 * dt;
          positions.array[index * 3] += velocity.x * dt;
          positions.array[index * 3 + 1] += velocity.y * dt;
          positions.array[index * 3 + 2] += velocity.z * dt;
        });
        positions.needsUpdate = true; effect.object.material.opacity = 1 - progress;
      }
      if (effect.life <= 0) { this.scene.remove(effect.object); this.effects.splice(i, 1); }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const smoke = this.smokes[i]; smoke.life -= dt;
      const age = smoke.maxLife - smoke.life;
      const opacity = Math.min(1, age * 1.5) * Math.min(1, smoke.life / 2) * .56;
      smoke.particles.forEach(({ sprite, drift, base }) => {
        sprite.material.opacity = opacity;
        sprite.position.x = base.x + age * drift;
        sprite.position.y = base.y + Math.sin(age * .35 + base.x) * .1;
      });
      if (smoke.life <= 0) { this.scene.remove(smoke.group); this.smokes.splice(i, 1); }
    }
  }
}
