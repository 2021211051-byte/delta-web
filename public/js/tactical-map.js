import { SOLIDS } from '../../shared/config.js';

export class TacticalMap {
  constructor(game, network) {
    this.G = game; this.network = network; this.players = []; this.expanded = !1; this.lastDraw = 0;
    this.element = document.createElement('section'); this.element.id = 'delta-map';
    this.element.innerHTML = '<header><strong>港口</strong><span>N ↑</span></header><canvas width="720" height="620" aria-label="港口战术地图"></canvas><footer><kbd>M</kbd><span>展开地图</span><b></b></footer>';
    this.element.querySelector('footer b').textContent = `房间 ${network.room}`;
    document.getElementById('ui').append(this.element);
    document.body.classList.add('map-online');
    this.canvas = this.element.querySelector('canvas'); this.context = this.canvas.getContext('2d');
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyM' && !event.repeat && this.G.game.state !== 'title') {
        event.preventDefault(); this.toggle();
      }
      if (event.code === 'Escape' && this.expanded) {
        event.preventDefault(); event.stopImmediatePropagation(); this.toggle(!1);
      }
    }, !0);
  }

  toggle(force) {
    this.expanded = typeof force === 'boolean' ? force : !this.expanded;
    this.element.classList.toggle('expanded', this.expanded);
    this.element.querySelector('footer span').textContent = this.expanded ? '收起地图' : '展开地图';
    this.lastDraw = 0;
  }

  update(players, now) {
    this.players = players || [];
    if (now - this.lastDraw < 80) return;
    this.lastDraw = now; this.draw();
  }

  draw() {
    const context = this.context; const width = this.canvas.width; const height = this.canvas.height;
    const project = (x, z) => [(x + 40) / 80 * width, (z + 35) / 65 * height];
    const xScale = width / 80; const zScale = height / 65;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101917'; context.fillRect(0, 0, width, height);
    const [waterX] = project(30, 0);
    context.fillStyle = '#15333a'; context.fillRect(waterX, 0, width - waterX, height);
    context.strokeStyle = 'rgba(102,166,172,.18)'; context.lineWidth = 2;
    for (let z = -30; z < 30; z += 5) {
      const [, y] = project(0, z); context.beginPath(); context.moveTo(waterX, y); context.lineTo(width, y + 5); context.stroke();
    }
    context.strokeStyle = 'rgba(157,181,163,.09)'; context.lineWidth = 1;
    for (let x = -40; x <= 40; x += 10) {
      const [px] = project(x, 0); context.beginPath(); context.moveTo(px, 0); context.lineTo(px, height); context.stroke();
      if (this.expanded && x < 40) { context.fillStyle = '#75877d'; context.font = '18px monospace'; context.fillText(String(x + 40), px + 5, 23); }
    }
    for (let z = -30; z <= 30; z += 10) {
      const [, py] = project(0, z); context.beginPath(); context.moveTo(0, py); context.lineTo(width, py); context.stroke();
    }
    const [quayX] = project(30, 0); context.strokeStyle = '#81978a'; context.lineWidth = 4;
    context.beginPath(); context.moveTo(quayX, 0); context.lineTo(quayX, height); context.stroke();
    for (const solid of SOLIDS) {
      if (solid.id === 'range-backstop') continue;
      const [x, y] = project(solid.min[0], solid.min[2]);
      const w = (solid.max[0] - solid.min[0]) * xScale; const h = (solid.max[2] - solid.min[2]) * zScale;
      const building = solid.id.includes('building'); const container = solid.id.includes('container');
      context.fillStyle = building ? '#4f615a' : container ? '#736846' : '#3d4c43';
      context.strokeStyle = building ? '#84988b' : '#7c8978'; context.lineWidth = 2;
      context.fillRect(x, y, w, h); context.strokeRect(x, y, w, h);
      if (container) {
        context.strokeStyle = 'rgba(213,200,145,.25)';
        for (let line = 1; line < 5; line += 1) { context.beginPath(); context.moveTo(x + w * line / 5, y); context.lineTo(x + w * line / 5, y + h); context.stroke(); }
      }
    }
    context.textAlign = 'center'; context.font = '600 24px sans-serif'; context.fillStyle = 'rgba(188,205,190,.5)';
    let label = project(-3, 5); context.fillText('港 口 作 业 区', ...label);
    label = project(35, -2); context.save(); context.translate(...label); context.rotate(Math.PI / 2); context.fillStyle = '#62929a'; context.fillText('水 域', 0, 0); context.restore();
    for (const player of this.players) {
      if (player.dead) continue;
      const own = player.id === this.network.id;
      const position = own ? this.G.player.pos : player.position;
      const yaw = own ? this.G.player.yaw : player.yaw;
      const [x, y] = project(position.x, position.z);
      const angle = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
      if (own) {
        context.fillStyle = 'rgba(216,239,139,.12)'; context.beginPath(); context.moveTo(x, y);
        context.arc(x, y, this.expanded ? 95 : 70, angle - .48, angle + .48); context.closePath(); context.fill();
      }
      context.save(); context.translate(x, y); context.rotate(angle + Math.PI / 2);
      context.beginPath(); context.moveTo(0, -11); context.lineTo(-7, 8); context.lineTo(0, 5); context.lineTo(7, 8); context.closePath();
      context.fillStyle = own ? '#d8ef8b' : '#ef745e'; context.fill();
      context.strokeStyle = own ? '#f4ffe0' : '#491b15'; context.lineWidth = 2; context.stroke(); context.restore();
      if (this.expanded) {
        context.font = '20px sans-serif'; context.textAlign = 'center'; context.fillStyle = own ? '#e9f7ca' : '#f0b2a2';
        context.fillText(own ? '你' : player.name, x, y - 17);
      }
    }
    context.strokeStyle = 'rgba(216,239,139,.35)'; context.lineWidth = 3; context.strokeRect(1.5, 1.5, width - 3, height - 3);
  }
}
