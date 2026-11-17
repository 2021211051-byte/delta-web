export class TacticalAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.volume = .65;
    this.noise = null;
    this.lastStep = 0;
  }

  init() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.context.destination);
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
  }

  setVolume(value) {
    this.volume = Number(value);
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .02);
  }

  tone(frequency, duration, gain = .1, type = 'sine', slide = 0, delay = 0) {
    if (!this.context) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
    envelope.gain.setValueAtTime(gain, now); envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(envelope); envelope.connect(this.master); oscillator.start(now); oscillator.stop(now + duration);
  }

  burst(duration, gain, lowpass = 1200, delay = 0) {
    if (!this.context || !this.noise) return;
    const now = this.context.currentTime + delay;
    const source = this.context.createBufferSource(); source.buffer = this.noise;
    const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = lowpass;
    const envelope = this.context.createGain(); envelope.gain.setValueAtTime(gain, now); envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.master); source.start(now); source.stop(now + duration);
  }

  gun(id, distant = false) {
    this.init();
    const scale = distant ? .28 : 1;
    if (id === 'm7') {
      this.burst(.13, .32 * scale, 1800); this.burst(.055, .19 * scale, 6000);
      this.tone(115, .12, .19 * scale, 'sawtooth', -70); this.tone(1100, .025, .05 * scale, 'square', -500);
    } else {
      this.burst(.35, .48 * scale, 1300); this.burst(.09, .3 * scale, 7000);
      this.tone(78, .35, .28 * scale, 'sawtooth', -42); this.tone(1800, .035, .07 * scale, 'square', -1100);
      this.burst(.4, .09 * scale, 700, .12);
    }
  }

  hit(kill = false) {
    this.tone(kill ? 720 : 940, .055, .07, 'sine', kill ? 180 : 80);
    if (kill) this.tone(1050, .09, .06, 'sine', 200, .07);
  }

  empty() { this.init(); this.tone(1350, .025, .045, 'square', -250); }
  reload() { this.init(); this.burst(.04, .07, 4200); this.tone(540, .04, .035, 'square', -130, .12); this.burst(.035, .06, 3500, .75); }
  step(sprint = false) {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (now - this.lastStep < (sprint ? .27 : .39)) return;
    this.lastStep = now; this.burst(.075, .045, 430); this.tone(85, .055, .018, 'sine', -35);
  }
  jump() { this.burst(.08, .035, 500); }
  dash() { this.init(); this.burst(.5, .13, 1500); this.tone(170, .35, .07, 'sawtooth', 480); }
  scan() { this.init(); this.tone(1250, .22, .04, 'sine', -600); this.tone(630, .25, .025, 'sine', 300); }
  shock() { this.init(); this.burst(.12, .055, 7200); this.tone(1700 + Math.random() * 600, .08, .025, 'sawtooth', -1200); }
  exo() { this.init(); this.tone(90, .5, .12, 'sawtooth', 170); this.tone(330, .35, .045, 'square', 220, .08); }
  explosion(distance = 0) {
    this.init(); const gain = Math.max(.04, .48 - distance * .012);
    this.burst(.75, gain, 750); this.burst(.16, gain * .7, 4200); this.tone(52, .65, gain * .65, 'sawtooth', -25);
  }
}
