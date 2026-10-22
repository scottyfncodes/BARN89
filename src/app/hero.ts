import { DOGS, DONKEYS, FAMILY } from '../content/cast';
import { COATS } from '../games/kitten/levels';
import { drawDog, drawDonkey } from '../render/animals';
import { drawKittenFigure } from '../render/characters';
import { C } from '../render/palette';
import { drawPerson } from '../render/people';


/** The title card illustration: Barn 89 at golden hour with everyone out front. */
export function drawHero(canvas: HTMLCanvasElement, clock: number, reduced: boolean): void {
  const W = 360;
  const H = 230;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== W * dpr) {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const t = reduced ? 0 : clock;

  // Sky disc and warm sunburst.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(4, 4, W - 8, H - 8, 18);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#9fd2ea');
  sky.addColorStop(0.65, '#fde3b0');
  sky.addColorStop(1, '#f6c98a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, 128);
  ctx.rotate(t * 0.02);
  for (let i = 0; i < 18; i++) {
    ctx.rotate(Math.PI / 9);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-16, -240);
    ctx.lineTo(16, -240);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(242,197,61,0.12)';
    ctx.fill();
  }
  ctx.restore();
  // Rolling hills and the tree line.
  ctx.fillStyle = '#9cc76a';
  ctx.beginPath();
  ctx.moveTo(0, 150);
  for (let x = 0; x <= W; x += 12) ctx.lineTo(x, 146 - Math.sin(x * 0.02) * 8 - Math.sin(x * 0.05) * 3);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  for (let i = 0; i < 9; i++) {
    const x = i * 44 + (i % 2) * 12;
    ctx.beginPath();
    ctx.arc(x, 140, 16 + (i % 3) * 4, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#5f9a42' : '#4f8a3a';
    ctx.fill();
  }

  // Barn 89: red metal barn, grey standing-seam roof, white trim, string lights.
  const bx = W / 2;
  const by = 160;
  const bw = 150;
  const wallTopY = by - 62;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.2;
  // Gable end wall.
  ctx.fillStyle = C.barnRed;
  ctx.beginPath();
  ctx.moveTo(bx - bw / 2, by);
  ctx.lineTo(bx - bw / 2, wallTopY);
  ctx.lineTo(bx, wallTopY - 28);
  ctx.lineTo(bx + bw / 2, wallTopY);
  ctx.lineTo(bx + bw / 2, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(70,15,10,0.3)';
  ctx.lineWidth = 1.1;
  for (let x = bx - bw / 2 + 6; x < bx + bw / 2; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.lineTo(x, wallTopY - 30);
    ctx.stroke();
  }
  ctx.restore();
  // White corner and gable trim.
  ctx.fillStyle = C.white;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.6;
  for (const x of [bx - bw / 2, bx + bw / 2 - 7]) {
    ctx.fillRect(x, wallTopY, 7, by - wallTopY);
    ctx.strokeRect(x, wallTopY, 7, by - wallTopY);
  }
  // Roof edge (grey metal, white fascia).
  ctx.fillStyle = '#8f9bb0';
  ctx.beginPath();
  ctx.moveTo(bx - bw / 2 - 8, wallTopY + 3);
  ctx.lineTo(bx, wallTopY - 33);
  ctx.lineTo(bx + bw / 2 + 8, wallTopY + 3);
  ctx.lineTo(bx + bw / 2 + 8, wallTopY - 3);
  ctx.lineTo(bx, wallTopY - 40);
  ctx.lineTo(bx - bw / 2 - 8, wallTopY - 3);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx - bw / 2 - 5, wallTopY + 1);
  ctx.lineTo(bx, wallTopY - 34);
  ctx.lineTo(bx + bw / 2 + 5, wallTopY + 1);
  ctx.stroke();
  // Big sliding door, open, with the white door panel pushed aside.
  ctx.fillStyle = '#2e1d14';
  ctx.fillRect(bx - 30, by - 50, 60, 50);
  ctx.fillStyle = '#e7c35d';
  ctx.beginPath();
  ctx.moveTo(bx - 26, by);
  ctx.quadraticCurveTo(bx - 8, by - 18, bx + 6, by - 10);
  ctx.quadraticCurveTo(bx + 18, by - 20, bx + 28, by);
  ctx.fill();
  ctx.fillStyle = '#e9ecef';
  ctx.fillRect(bx + 28, by - 50, 24, 50);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.8;
  ctx.strokeRect(bx + 28, by - 50, 24, 50);
  ctx.strokeRect(bx - 30, by - 50, 60, 50);
  ctx.fillStyle = C.white;
  ctx.fillRect(bx - 34, by - 55, 90, 5);
  ctx.strokeRect(bx - 34, by - 55, 90, 5);
  // Name board.
  ctx.fillStyle = C.white;
  ctx.fillRect(bx - 34, by - 84, 68, 20);
  ctx.strokeRect(bx - 34, by - 84, 68, 20);
  ctx.fillStyle = C.barnRed;
  ctx.font = '900 15px Rockwell, "Roboto Slab", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BARN 89', bx, by - 73.5);
  // String lights across the front, a couple of bulbs long gone.
  ctx.strokeStyle = '#4a3b30';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx - bw / 2, wallTopY + 2);
  ctx.quadraticCurveTo(bx, wallTopY + 28, bx + bw / 2, wallTopY + 2);
  ctx.stroke();
  for (let i = 1; i < 12; i++) {
    const f = i / 12;
    const x = bx - bw / 2 + f * bw;
    const y = wallTopY + 2 + 2 * f * (1 - f) * 26;
    const out = i === 4 || i === 9;
    const tw = 0.6 + 0.4 * Math.sin(t * 3 + i);
    ctx.beginPath();
    ctx.arc(x, y + 3, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = out ? '#9a9488' : `rgba(255,236,170,${0.8 + tw * 0.2})`;
    ctx.fill();
  }

  // Donkey peeking from the side, dog and cats up front.
  drawDonkey(ctx, DONKEYS[0], { x: bx + 112, y: by + 6, faceX: -1, walking: false, phase: 0, clock: t, graze: false, bray: !reduced && Math.sin(t * 0.7) > 0.93 });
  ctx.fillStyle = '#86c051';
  ctx.fillRect(0, by + 4, W, H - by);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, by + 4, W, 3);

  // A barn cat napping behind everyone.
  ctx.save();
  ctx.translate(bx + 4, by + 22);
  drawKittenFigure(ctx, { x: 0, y: 0, faceX: 1, coat: COATS.tuxedo, pose: 'lie', phase: 0, speed: 0, alarm: 0, happy: false, clock: t });
  ctx.restore();
  // The family, lined up and waving.
  const row: [keyof typeof FAMILY, number, number][] = [
    ['grandpa', 52, 0],
    ['megan', 104, 1],
    ['jason', 154, 2],
    ['jay', 206, 3],
    ['natalie', 252, 4],
  ];
  for (const [id, x, i] of row) {
    const L = FAMILY[id].look;
    const wave = !reduced && Math.sin(t * 1.3 + i * 1.7) > 0.55;
    ctx.save();
    ctx.translate(x, 214);
    ctx.scale(1.55, 1.55);
    drawPerson(ctx, L, { x: 0, y: 0, faceX: i < 2 ? 1 : i === 2 ? 1 : -1, speed01: 0, walkPhase: 0, clock: t + i, action: wave ? 'wave' : 'none', hold: id === 'megan' ? 'basket' : null });
    ctx.restore();
  }
  drawDog(ctx, DOGS[0], { x: 300, y: 214, faceX: -1, pose: 'sit', phase: 0, clock: t, wag: 0.9 });
  drawDog(ctx, DOGS[1], { x: 22, y: 216, faceX: 1, pose: 'lie', phase: 0, clock: t + 2, wag: 0.4 });
  ctx.save();
  ctx.translate(334, 214);
  ctx.scale(1.25, 1.25);
  drawKittenFigure(ctx, { x: 0, y: 0, faceX: -1, coat: COATS.orangeTabby, pose: 'sit', phase: 0, speed: 0, alarm: 0, happy: true, clock: t });
  ctx.restore();
  ctx.restore();
  // Frame.
  ctx.beginPath();
  ctx.roundRect(4, 4, W - 8, H - 8, 18);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.stroke();
}
