import type { InputState } from '../games/kitten/types';

const STICK_RADIUS = 56;

/**
 * Touch-first controls shared by every scene:
 *  - Floating joystick: put a thumb down anywhere that isn't a button and drag.
 *  - Named buttons (pointer events, no hover) queue a press that the scene consumes once.
 *  - Tap mode (Woodpile): a touch anywhere is a tap instead of a joystick.
 * Keyboard works too (arrows/WASD, Space, E, Esc), but nothing depends on it.
 */
export class Controls {
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private vec = { x: 0, y: 0 };
  private keys = new Set<string>();
  private queued = new Set<string>();
  /** Joystick active. */
  enabled = false;
  /** Touches become taps (no joystick). */
  tapMode = false;
  /** Keyboard → button names for the current scene. */
  keyMap: Record<string, string> = {};
  onInteract: () => void = () => {};
  onPause: () => void = () => {};
  onTap: () => void = () => {};
  /** True once the player has actually steered (for tutorial hints). */
  moved = false;

  constructor(
    surface: HTMLElement,
    private readonly stickBase: HTMLElement,
    private readonly stickKnob: HTMLElement,
  ) {
    surface.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('blur', () => this.reset());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'INPUT') && (e.key === ' ' || e.key === 'Enter')) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      this.onInteract();
      if (k === 'escape' || k === 'p') {
        this.onPause();
        return;
      }
      if (this.tapMode && (k === ' ' || k === 'enter')) {
        this.onTap();
        return;
      }
      const name = this.keyMap[k];
      if (name) this.queued.add(name);
      else if (this.enabled) this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  /** Wire a DOM button to a named press. */
  bindButton(el: HTMLElement, name: string): void {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onInteract();
      this.queued.add(name);
      el.classList.add('pressed');
    });
    const release = () => el.classList.remove('pressed');
    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('pointercancel', release);
    // Keyboard activation (Enter/Space on a focused button).
    el.addEventListener('click', (e) => {
      if ((e as MouseEvent).detail === 0) this.queued.add(name);
    });
  }

  consume(name: string): boolean {
    const had = this.queued.has(name);
    this.queued.delete(name);
    return had;
  }

  private down = (e: PointerEvent): void => {
    this.onInteract();
    if (this.tapMode) {
      e.preventDefault();
      this.onTap();
      return;
    }
    if (!this.enabled || this.stickId !== null) return;
    e.preventDefault();
    this.stickId = e.pointerId;
    this.origin = { x: e.clientX, y: e.clientY };
    this.vec = { x: 0, y: 0 };
    this.stickBase.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    this.stickKnob.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    this.stickBase.classList.add('on');
    this.stickKnob.classList.add('on');
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickId) return;
    e.preventDefault();
    let dx = e.clientX - this.origin.x;
    let dy = e.clientY - this.origin.y;
    const d = Math.hypot(dx, dy);
    if (d > STICK_RADIUS) {
      // Drag the base along so the stick never "runs out".
      const over = d - STICK_RADIUS;
      this.origin.x += (dx / d) * over;
      this.origin.y += (dy / d) * over;
      dx = e.clientX - this.origin.x;
      dy = e.clientY - this.origin.y;
      this.stickBase.style.transform = `translate(${this.origin.x}px, ${this.origin.y}px)`;
    }
    const dd = Math.hypot(dx, dy);
    // Small dead zone, then a gentle response curve for fine control.
    const mag = dd < 6 ? 0 : Math.min(1, (dd - 6) / (STICK_RADIUS - 6));
    const curved = Math.pow(mag, 1.25);
    this.vec = dd > 0 ? { x: (dx / dd) * curved, y: (dy / dd) * curved } : { x: 0, y: 0 };
    if (curved > 0.2) this.moved = true;
    this.stickKnob.style.transform = `translate(${this.origin.x + dx}px, ${this.origin.y + dy}px)`;
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.vec = { x: 0, y: 0 };
    this.stickBase.classList.remove('on');
    this.stickKnob.classList.remove('on');
  };

  reset(): void {
    this.stickId = null;
    this.vec = { x: 0, y: 0 };
    this.keys.clear();
    this.queued.clear();
    this.stickBase.classList.remove('on');
    this.stickKnob.classList.remove('on');
  }

  /** Current stick (or arrow keys) as a vector of length <= 1. */
  stick(): { x: number; y: number } {
    let x = this.vec.x;
    let y = this.vec.y;
    const k = this.keys;
    const kx = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    const ky = (k.has('arrowdown') || k.has('s') ? 1 : 0) - (k.has('arrowup') || k.has('w') ? 1 : 0);
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      x = kx / l;
      y = ky / l;
      this.moved = true;
    }
    return { x, y };
  }

  /** Kitten Cowgirl's input shape: stick plus whistle and treat presses. */
  read(out: InputState): InputState {
    const s = this.stick();
    out.moveX = s.x;
    out.moveY = s.y;
    out.whistle = this.consume('whistle');
    out.treat = this.consume('treat');
    return out;
  }
}
