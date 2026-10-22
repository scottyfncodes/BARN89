/** CanvasRenderingContext2D.roundRect arrived in iOS Safari 16; draw it by hand on older devices. */
type Radii = number | DOMPointInit | (number | DOMPointInit)[];

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radii?: Radii) {
    const list = Array.isArray(radii) ? radii : [radii ?? 0];
    const num = list.map((r) => (typeof r === 'number' ? r : (r.x ?? 0)));
    const [tl, tr = tl, br = tl, bl = tr] = num;
    const m = Math.min(Math.abs(w), Math.abs(h)) / 2;
    const c = (r: number) => Math.min(r, m);
    this.moveTo(x + c(tl), y);
    this.arcTo(x + w, y, x + w, y + h, c(tr));
    this.arcTo(x + w, y + h, x, y + h, c(br));
    this.arcTo(x, y + h, x, y, c(bl));
    this.arcTo(x, y, x + w, y, c(tl));
    this.closePath();
  };
}
