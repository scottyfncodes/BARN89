import type { InputState } from '../game/types';

const STICK_RADIUS = 56;

/**
 * Touch-first controls:
 *  - Floating joystick: put a thumb down anywhere that isn't a button and drag.
 *  - Whistle and Treat are regular buttons (pointer events, no hover needed).
 * Keyboard and mouse work too, but nothing depends on them.
 */
export class Controls {
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private vec = { x: 0, y: 0 };
  private keys = new Set<string>();
  private whistleQueued = false;
  private treatQueued = false;
  enabled = false;
  /** Called on any first interaction (used to unlock audio). */
  onInteract: () => void = () => {};
  onPause: () => void = () => {};
  /** True once the player has actually steered (for the tutorial hint). */
  moved = false;

  constructor(
    private readonly surface: HTMLElement,
    private readonly stickBase: HTMLElement,
    private readonly stickKnob: HTMLElement,
    whistleBtn: HTMLElement,
    treatBtn: HTMLElement,
  ) {
    surface.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('blur', () => this.reset());

    const press = (fn: () => void) => (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.onInteract();
      if (!this.enabled) return;
      fn();
    };
    whistleBtn.addEventListener('pointerdown', press(() => (this.whistleQueued = true)));
    treatBtn.addEventListener('pointerdown', press(() => (this.treatQueued = true)));

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      this.onInteract();
      if (k === 'escape' || k === 'p') {
        this.onPause();
        return;
      }
      if (!this.enabled) return;
      if (k === ' ' || k === 'q') this.whistleQueued = true;
      else if (k === 'e' || k === 'f') this.treatQueued = true;
      else this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  private down = (e: PointerEvent): void => {
    this.onInteract();
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
    // Small dead zone, then a gentle response curve for fine control near kittens.
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
    this.whistleQueued = false;
    this.treatQueued = false;
    this.stickBase.classList.remove('on');
    this.stickKnob.classList.remove('on');
  }

  /** Read the current input; action presses are consumed once. */
  read(out: InputState): InputState {
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
    out.moveX = x;
    out.moveY = y;
    out.whistle = this.whistleQueued;
    out.treat = this.treatQueued;
    this.whistleQueued = false;
    this.treatQueued = false;
    return out;
  }

  get surfaceElement(): HTMLElement {
    return this.surface;
  }
}
