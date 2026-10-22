/**
 * Tiny synthesised sound kit (Web Audio). No audio files, no network.
 * iOS requires the context to be resumed from a user gesture, see `unlock`.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  muted = false;

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, glideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, when = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  whistle(): void {
    this.tone(1400, 0.16, 'sine', 0.22, 0, 2100);
    this.tone(1900, 0.22, 'sine', 0.2, 0.17, 1500);
  }

  meow(pitch = 1): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(620 * pitch, t);
    o.frequency.linearRampToValueAtTime(900 * pitch, t + 0.12);
    o.frequency.linearRampToValueAtTime(520 * pitch, t + 0.32);
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1100, t);
    f.frequency.linearRampToValueAtTime(1800, t + 0.12);
    f.frequency.linearRampToValueAtTime(900, t + 0.32);
    f.Q.value = 4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.4);
  }

  startle(): void {
    this.meow(1.35);
  }

  penned(): void {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.16, i * 0.07));
  }

  treat(): void {
    this.tone(520, 0.08, 'square', 0.05, 0, 760);
    this.noise(0.08, 0.15, 2000, 0.4);
  }

  crunch(): void {
    this.noise(0.06, 0.2, 2600);
    this.noise(0.06, 0.2, 2200, 0.1);
  }

  collect(): void {
    this.tone(1046, 0.12, 'triangle', 0.15);
    this.tone(1568, 0.25, 'triangle', 0.15, 0.08);
  }

  discover(): void {
    this.tone(660, 0.12, 'sine', 0.12);
    this.tone(880, 0.18, 'sine', 0.12, 0.1);
  }

  chuff(): void {
    this.noise(0.09, 0.35, 380);
    this.noise(0.09, 0.3, 340, 0.13);
  }

  denied(): void {
    this.tone(220, 0.15, 'square', 0.05, 0, 160);
  }

  bark(): void {
    this.tone(420, 0.09, 'sawtooth', 0.07, 0, 300);
    this.noise(0.07, 0.25, 900);
    this.tone(460, 0.09, 'sawtooth', 0.06, 0.16, 320);
    this.noise(0.07, 0.2, 900, 0.16);
  }

  /** A tiny dog's yip: high, short, a bit indignant. */
  yip(): void {
    this.tone(1250, 0.06, 'square', 0.035, 0, 980);
    this.noise(0.04, 0.12, 2600);
  }

  /** Hee-haw: a rising inhale squeal, then a low honk, twice. */
  bray(): void {
    for (let i = 0; i < 2; i++) {
      const t = i * 0.62;
      this.tone(900, 0.22, 'sawtooth', 0.05, t, 1300);
      this.tone(260, 0.3, 'sawtooth', 0.07, t + 0.24, 200);
    }
  }

  chop(quality: number): void {
    // Wood "thock": low body plus a crack whose brightness tracks how clean the swing was.
    this.tone(150, 0.12, 'triangle', 0.25, 0, 90);
    this.noise(0.09, 0.4, 900 + quality * 1600);
  }

  split(): void {
    this.noise(0.18, 0.35, 1800);
    this.tone(330, 0.1, 'triangle', 0.12, 0.02, 180);
  }

  thud(): void {
    this.tone(110, 0.16, 'sine', 0.3, 0, 70);
    this.noise(0.08, 0.2, 400);
  }

  stack(snug: boolean): void {
    this.tone(snug ? 520 : 380, 0.07, 'square', 0.05);
    this.noise(0.06, 0.25, snug ? 1500 : 700);
  }

  clunk(): void {
    this.tone(140, 0.18, 'square', 0.08, 0, 90);
    this.noise(0.1, 0.3, 500);
  }

  oops(): void {
    this.tone(330, 0.14, 'triangle', 0.1, 0, 250);
    this.tone(250, 0.2, 'triangle', 0.1, 0.12, 190);
  }

  tick(): void {
    this.tone(1200, 0.03, 'square', 0.03);
  }

  private engine: { o: OscillatorNode; o2: OscillatorNode; g: GainNode; f: BiquadFilterNode } | null = null;

  /** Continuous mower engine; throttle 0..1 (negative stops it). */
  setEngine(throttle: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    if (throttle < 0) {
      if (this.engine) {
        const e = this.engine;
        e.g.gain.setTargetAtTime(0.0001, t, 0.08);
        e.o.stop(t + 0.4);
        e.o2.stop(t + 0.4);
        this.engine = null;
      }
      return;
    }
    if (!this.engine) {
      const o = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const f = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o2.type = 'square';
      f.type = 'lowpass';
      f.frequency.value = 500;
      g.gain.value = 0.0001;
      o.connect(f);
      o2.connect(f);
      f.connect(g);
      g.connect(this.master);
      o.start();
      o2.start();
      this.engine = { o, o2, g, f };
    }
    const e = this.engine;
    e.o.frequency.setTargetAtTime(48 + throttle * 34, t, 0.1);
    e.o2.frequency.setTargetAtTime(24 + throttle * 17, t, 0.1);
    e.f.frequency.setTargetAtTime(380 + throttle * 500, t, 0.1);
    e.g.gain.setTargetAtTime(0.035 + throttle * 0.035, t, 0.1);
  }

  click(): void {
    this.tone(880, 0.05, 'triangle', 0.08);
  }

  victory(): void {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((f, i) => this.tone(f, i === notes.length - 1 ? 0.6 : 0.16, 'triangle', 0.18, i * 0.13));
    notes.forEach((f, i) => this.tone(f / 2, 0.16, 'square', 0.04, i * 0.13));
  }

  /** A gentle, loping banjo-ish loop: plucked triangle notes over a I–IV–V–I bass. */
  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
        this.scheduleStep(this.musicStep, this.nextNoteTime);
        this.musicStep = (this.musicStep + 1) % 64;
        this.nextNoteTime += 0.2;
      }
    };
    this.musicTimer = window.setInterval(tick, 90);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleStep(step: number, t: number): void {
    if (!this.ctx || !this.musicGain) return;
    const chords = [
      [196, 247, 294, 392],
      [262, 330, 392, 523],
      [294, 370, 440, 587],
      [196, 247, 294, 392],
    ];
    const bar = Math.floor(step / 16);
    const chord = chords[bar % 4];
    const s = step % 16;
    const pluck = (freq: number, vol: number, dur: number) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.musicGain!);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    // Boom-chick bass.
    if (s % 4 === 0) pluck(chord[0] / 2, 0.5, 0.35);
    if (s % 4 === 2) pluck(chord[2] / 2, 0.3, 0.2);
    // Roll pattern on top.
    const pattern = [0, 2, 3, 1, 2, 3, 0, 3];
    if (s % 2 === 0) pluck(chord[pattern[(s / 2) % 8]] * 2, 0.22, 0.25);
    else if (s === 7 || s === 15) pluck(chord[3] * 2, 0.16, 0.18);
  }
}
