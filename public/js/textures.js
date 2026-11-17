import * as THREE from 'three';

function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, painter, repeat = [1, 1]) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  painter(context, size, randomGenerator(size * 971));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  return texture;
}

function grain(context, size, random, strength = 22, alpha = 0.22) {
  const image = context.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = (random() - 0.5) * strength;
    image.data[i] += value;
    image.data[i + 1] += value;
    image.data[i + 2] += value;
    image.data[i + 3] = Math.max(image.data[i + 3], alpha * 255);
  }
  context.putImageData(image, 0, 0);
}

function scratches(context, size, random, count, color) {
  context.strokeStyle = color;
  context.lineWidth = 0.55;
  for (let i = 0; i < count; i += 1) {
    const x = random() * size;
    const y = random() * size;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (random() - 0.5) * 34, y + random() * 4);
    context.stroke();
  }
}

export function makeTextures() {
  const concrete = canvasTexture(512, (c, s, r) => {
    c.fillStyle = '#77796f'; c.fillRect(0, 0, s, s); grain(c, s, r, 48);
    for (let i = 0; i < 190; i++) {
      const x = r() * s; const y = r() * s; const radius = r() * 5 + 0.5;
      c.fillStyle = `rgba(32,35,31,${r() * 0.18})`; c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = 'rgba(30,34,30,.2)'; c.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      let x = r() * s; let y = r() * s; c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 7; j++) { x += (r() - .5) * 30; y += r() * 20; c.lineTo(x, y); } c.stroke();
    }
  }, [8, 8]);

  const asphalt = canvasTexture(512, (c, s, r) => {
    c.fillStyle = '#3b3f3b'; c.fillRect(0, 0, s, s); grain(c, s, r, 55);
    for (let i = 0; i < 900; i++) {
      const shade = Math.floor(65 + r() * 70); c.fillStyle = `rgba(${shade},${shade},${shade - 3},.35)`;
      c.fillRect(r() * s, r() * s, r() * 2 + .4, r() * 2 + .4);
    }
    c.strokeStyle = 'rgba(15,18,16,.3)';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(r() * s, 0); c.bezierCurveTo(r() * s, s * .3, r() * s, s * .7, r() * s, s); c.stroke(); }
  }, [14, 14]);

  const metal = canvasTexture(256, (c, s, r) => {
    const gradient = c.createLinearGradient(0, 0, s, 0);
    gradient.addColorStop(0, '#313a35'); gradient.addColorStop(.5, '#59615b'); gradient.addColorStop(1, '#303934');
    c.fillStyle = gradient; c.fillRect(0, 0, s, s); grain(c, s, r, 25); scratches(c, s, r, 160, 'rgba(210,218,204,.13)');
    c.strokeStyle = 'rgba(9,12,10,.32)'; c.lineWidth = 2;
    for (let y = 0; y < s; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(s, y); c.stroke(); }
    for (let y = 8; y < s; y += 64) for (let x = 8; x < s; x += 32) {
      c.fillStyle = '#171c19'; c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill();
      c.fillStyle = '#9ca39a'; c.beginPath(); c.arc(x - .5, y - .7, .65, 0, 7); c.fill();
    }
  }, [2, 2]);

  const gunmetal = canvasTexture(256, (c, s, r) => {
    c.fillStyle = '#252a27'; c.fillRect(0, 0, s, s); grain(c, s, r, 19); scratches(c, s, r, 240, 'rgba(176,186,174,.18)');
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(5,8,6,${r() * .25})`; c.fillRect(r() * s, r() * s, r() * 35, r() * 3); }
  });

  const camo = canvasTexture(256, (c, s, r) => {
    c.fillStyle = '#4b5140'; c.fillRect(0, 0, s, s);
    const colors = ['#262e28', '#697054', '#343d31', '#7a785d'];
    for (let i = 0; i < 85; i++) {
      c.fillStyle = colors[i % colors.length]; c.beginPath();
      const x = r() * s; const y = r() * s; const radius = 8 + r() * 24;
      for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2; const d = radius * (.65 + r() * .55); const px = x + Math.cos(a) * d; const py = y + Math.sin(a) * d; if (!j) c.moveTo(px, py); else c.lineTo(px, py); }
      c.closePath(); c.fill();
    }
    grain(c, s, r, 23, .1);
    c.strokeStyle = 'rgba(230,230,200,.07)'; c.lineWidth = .5;
    for (let i = 0; i < s; i += 3) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, s); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(s, i); c.stroke(); }
  }, [2, 3]);

  const fabric = canvasTexture(256, (c, s, r) => {
    c.fillStyle = '#31392f'; c.fillRect(0, 0, s, s); grain(c, s, r, 20);
    c.strokeStyle = 'rgba(196,206,178,.12)'; c.lineWidth = .45;
    for (let i = 0; i < s; i += 2) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, s); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(s, i); c.stroke(); }
  }, [3, 3]);

  const awm = canvasTexture(256, (c, s, r) => {
    c.fillStyle = '#394b35'; c.fillRect(0, 0, s, s); grain(c, s, r, 18); scratches(c, s, r, 100, 'rgba(159,175,129,.14)');
    c.fillStyle = 'rgba(16,25,16,.12)'; for (let i = 0; i < 30; i++) c.fillRect(r() * s, r() * s, r() * 50, r() * 12);
  });

  const wood = canvasTexture(256, (c, s, r) => {
    c.fillStyle = '#706044'; c.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      c.strokeStyle = `rgba(35,28,18,${.08 + r() * .18})`; c.beginPath(); c.moveTo(0, y);
      for (let x = 0; x < s; x += 12) c.lineTo(x, y + Math.sin(x * .05 + y) * 1.8); c.stroke();
    }
    grain(c, s, r, 20); scratches(c, s, r, 70, 'rgba(25,18,10,.22)');
  }, [2, 2]);

  const rubber = canvasTexture(128, (c, s, r) => {
    c.fillStyle = '#1c211e'; c.fillRect(0, 0, s, s); grain(c, s, r, 14);
    c.strokeStyle = 'rgba(130,140,128,.16)'; for (let i = -s; i < s * 2; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + s, s); c.stroke(); }
  }, [2, 2]);

  return { concrete, asphalt, metal, gunmetal, camo, fabric, awm, wood, rubber };
}

export function labelTexture(text, options = {}) {
  const width = options.width || 512;
  const height = options.height || 256;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const c = canvas.getContext('2d');
  c.fillStyle = options.background || '#e5e0cf'; c.fillRect(0, 0, width, height);
  if (options.border !== false) { c.strokeStyle = options.color || '#242a25'; c.lineWidth = 8; c.strokeRect(8, 8, width - 16, height - 16); }
  c.fillStyle = options.color || '#242a25'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `${options.weight || 800} ${options.fontSize || Math.floor(height * .3)}px Arial, sans-serif`;
  const lines = String(text).split('\n');
  lines.forEach((line, index) => c.fillText(line, width / 2, height / 2 + (index - (lines.length - 1) / 2) * height * .3));
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

export function targetTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');
  c.fillStyle = '#ddd8c6'; c.fillRect(0, 0, 512, 512);
  for (let radius = 230, i = 0; radius > 20; radius -= 38, i++) {
    c.fillStyle = i % 2 ? '#d9d5c4' : '#303630'; c.beginPath(); c.arc(256, 256, radius, 0, 7); c.fill();
  }
  c.fillStyle = '#b13d2d'; c.beginPath(); c.arc(256, 256, 25, 0, 7); c.fill();
  c.strokeStyle = 'rgba(30,30,25,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 256); c.lineTo(512, 256); c.moveTo(256, 0); c.lineTo(256, 512); c.stroke();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

export function standardMaterial(map, options = {}) {
  return new THREE.MeshStandardMaterial({
    map, color: options.color || 0xffffff, roughness: options.roughness ?? .78,
    metalness: options.metalness ?? 0, bumpMap: options.bump === false ? null : map,
    bumpScale: options.bumpScale ?? .018, side: options.side || THREE.FrontSide,
  });
}
