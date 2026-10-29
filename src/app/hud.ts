import { $, show } from './dom';

export interface HudSetup {
  icon: string;
  required: string;
  label: string;
  pips?: number;
  /** Show a progress bar with a target tick at this fraction. */
  barTarget?: number;
}

/** The minigame HUD: objective pill with pips or a progress bar, time and score. */
export class Hud {
  readonly root = $('hud');
  private count = $('count');
  private required = $('required');
  private label = $('obj-label');
  private ico = $('obj-ico');
  private pips = $('pips');
  private bar = $('bar');
  private barFill = $('bar-fill');
  private barTarget = $('bar-target');
  private time = $('time');
  private score = $('score');
  private objective = document.querySelector('#hud .objective') as HTMLElement;
  private cache: Record<string, string> = {};

  configure(s: HudSetup): void {
    this.cache = {};
    this.ico.innerHTML = s.icon;
    this.required.textContent = s.required;
    this.label.textContent = s.label;
    show(this.pips, !!s.pips);
    this.pips.innerHTML = s.pips ? Array.from({ length: s.pips }, () => '<i></i>').join('') : '';
    show(this.bar, s.barTarget !== undefined);
    if (s.barTarget !== undefined) this.barTarget.style.left = `${s.barTarget * 100}%`;
  }

  private set(key: string, el: HTMLElement, v: string): boolean {
    if (this.cache[key] === v) return false;
    this.cache[key] = v;
    el.textContent = v;
    return true;
  }

  setLabel(v: string): void {
    this.set('label', this.label, v);
  }

  setCount(v: string): void {
    this.set('count', this.count, v);
  }

  setPips(n: number): void {
    if (this.cache.pips === String(n)) return;
    this.cache.pips = String(n);
    this.pips.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < n));
  }

  setBar(f: number): void {
    const v = `${Math.round(Math.min(1, f) * 1000) / 10}%`;
    if (this.cache.bar === v) return;
    this.cache.bar = v;
    this.barFill.style.width = v;
  }

  setTime(v: string): void {
    this.set('time', this.time, v);
  }

  setScore(v: string): void {
    this.set('score', this.score, v);
  }

  bump(): void {
    this.objective.classList.remove('bump');
    void this.objective.offsetWidth;
    this.objective.classList.add('bump');
  }
}
