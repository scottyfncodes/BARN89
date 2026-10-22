export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function show(el: HTMLElement, on: boolean): void {
  el.hidden = !on;
}

export function formatTime(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function starSvg(on: boolean, size = 24): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="${on ? '#f2c53d' : '#e8dcc4'}" stroke="#3b2a20" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

export function starRow(n: number, max = 3, size = 18): string {
  return Array.from({ length: max }, (_, i) => starSvg(i < n, size)).join('');
}

export const ICONS = {
  cat: `<svg viewBox="0 0 24 24"><path d="M4 9 5 3l4.5 4h5L19 3l1 6c1.3 1.4 2 3.2 2 5 0 4.4-4.5 7-10 7S2 18.4 2 14c0-1.8.7-3.6 2-5Z" fill="#f4a25a" stroke="#3b2a20" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8.5" cy="13" r="1.3" fill="#3b2a20"/><circle cx="15.5" cy="13" r="1.3" fill="#3b2a20"/><path d="M11 16h2l-1 1z" fill="#e5737f"/></svg>`,
  grass: `<svg viewBox="0 0 24 24"><path d="M3 21c1-6 2-9 4-12M8 21c0-6 1-11 4-16M13 21c0-5 1-8 3-11M18 21c0-4 1-6 3-8" fill="none" stroke="#4f8a33" stroke-width="2.6" stroke-linecap="round"/><path d="M2 21h20" stroke="#3b2a20" stroke-width="2" stroke-linecap="round"/></svg>`,
  log: `<svg viewBox="0 0 24 24"><rect x="3" y="7" width="16" height="11" rx="3" fill="#9a6b42" stroke="#3b2a20" stroke-width="1.7"/><ellipse cx="18" cy="12.5" rx="3.5" ry="5.5" fill="#e2b77a" stroke="#3b2a20" stroke-width="1.7"/><ellipse cx="18" cy="12.5" rx="1.4" ry="2.4" fill="none" stroke="#b07a44" stroke-width="1.2"/></svg>`,
};

/** Small toast at the top of the screen. */
export class Toast {
  private t = 0;
  constructor(private readonly el: HTMLElement) {}

  show(html: string, seconds = 3.2): void {
    this.el.innerHTML = html;
    this.el.classList.add('show');
    this.t = seconds;
  }

  update(dt: number): void {
    if (this.t <= 0) return;
    this.t -= dt;
    if (this.t <= 0) this.el.classList.remove('show');
  }

  clear(): void {
    this.t = 0;
    this.el.classList.remove('show');
  }
}

/** Coaching bubble in the bottom-left. */
export class Hint {
  private last = '';
  constructor(private readonly el: HTMLElement) {}

  set(html: string | null): void {
    const h = html ?? '';
    if (h === this.last) return;
    this.last = h;
    if (h) this.el.innerHTML = h;
    this.el.classList.toggle('show', !!h);
  }
}
