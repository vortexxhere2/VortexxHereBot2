const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Özel font istersen assets/fonts/font.ttf olarak koy (Türkçe karakter destekleyen bir font).
let FAMILY = '"Segoe UI", Arial, "DejaVu Sans", "Noto Sans", sans-serif';
const fontPath = path.join(__dirname, '..', '..', 'assets', 'fonts', 'font.ttf');
if (fs.existsSync(fontPath)) {
  GlobalFonts.registerFromPath(fontPath, 'BotFont');
  FAMILY = `BotFont, ${FAMILY}`;
}
const font = (size, weight = 'bold') => `${weight} ${size}px ${FAMILY}`;

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

async function fetchImage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

function drawAvatar(ctx, img, cx, cy, r, ringColor = '#ff0033', ringWidth = 6) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + ringWidth, 0, Math.PI * 2);
  ctx.fillStyle = ringColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  else {
    ctx.fillStyle = '#4f545c';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

function fitText(ctx, text, maxWidth, startSize, weight = 'bold') {
  let size = startSize;
  ctx.font = font(size, weight);
  while (ctx.measureText(text).width > maxWidth && size > 12) {
    size -= 2;
    ctx.font = font(size, weight);
  }
  return text;
}

function background(ctx, w, h, c1 = '#14141f', c2 = '#2a0a12') {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // dekoratif daireler
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ff0033';
  ctx.beginPath();
  ctx.arc(w - 60, 40, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, h - 20, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`);

// ---------------- RANK KARTI ----------------
async function rankCard({ username, avatarUrl, level, current, needed, xp, rank, messages }) {
  const W = 934;
  const H = 282;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  background(ctx, W, H);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, 20, 20, W - 40, H - 40, 24);
  ctx.fill();

  drawAvatar(ctx, await fetchImage(avatarUrl), 130, H / 2, 80);

  ctx.textBaseline = 'alphabetic';

  // Üst satır (sağdan sola): SEVİYE n   SIRA #n — ölçülerek hizalanır, hiçbir şeyle çakışmaz
  let sx = 890;
  const stat = (label, value) => {
    ctx.textAlign = 'right';
    ctx.font = font(44);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(value, sx, 78);
    const vw = ctx.measureText(value).width;
    ctx.font = font(22);
    ctx.fillStyle = '#ff4d6d';
    ctx.fillText(label, sx - vw - 10, 78);
    sx -= vw + 10 + ctx.measureText(label).width + 34;
  };
  stat('SEVİYE', `${level}`);
  stat('SIRA', `#${rank}`);

  // Kullanıcı adı + alt bilgi
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  fitText(ctx, username, 630, 38);
  ctx.fillText(username, 250, 128);
  ctx.fillStyle = '#b9bbbe';
  ctx.font = font(21, 'normal');
  ctx.fillText(`${messages.toLocaleString('tr-TR')} mesaj  •  ${xp.toLocaleString('tr-TR')} toplam XP`, 250, 160);

  // XP çubuğu
  const barX = 250;
  const barY = 180;
  const barW = 630;
  const barH = 36;
  ctx.fillStyle = '#3a3b42';
  roundRect(ctx, barX, barY, barW, barH, 20);
  ctx.fill();
  const pct = Math.max(0, Math.min(1, current / needed));
  if (pct > 0) {
    const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    g.addColorStop(0, '#ff0033');
    g.addColorStop(1, '#ff7a45');
    ctx.fillStyle = g;
    roundRect(ctx, barX, barY, Math.max(barH, barW * pct), barH, 20);
    ctx.fill();
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(22);
  ctx.fillText(`${compact(current)} / ${compact(needed)} XP`, barX + barW, barY + barH + 32);

  return canvas.toBuffer('image/png');
}

// ---------------- HOŞ GELDİN KARTI ----------------
async function welcomeCard({ username, avatarUrl, serverName, memberCount, title = 'HOŞ GELDİN' }) {
  const W = 1024;
  const H = 400;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  background(ctx, W, H);

  ctx.strokeStyle = 'rgba(255,0,51,0.6)';
  ctx.lineWidth = 4;
  roundRect(ctx, 16, 16, W - 32, H - 32, 28);
  ctx.stroke();

  drawAvatar(ctx, await fetchImage(avatarUrl), W / 2, 125, 80, '#ff0033', 7);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4d6d';
  ctx.font = font(34);
  ctx.fillText(title, W / 2, 250);

  ctx.fillStyle = '#ffffff';
  fitText(ctx, username, W - 140, 50);
  ctx.fillText(username, W / 2, 305);

  ctx.fillStyle = '#b9bbbe';
  fitText(ctx, `${serverName} sunucusunun ${memberCount}. üyesisin!`, W - 140, 26, 'normal');
  ctx.fillText(`${serverName} sunucusunun ${memberCount}. üyesisin!`, W / 2, 350);

  return canvas.toBuffer('image/png');
}

// ---------------- AŞK KARTI ----------------
function heart(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  const s = size / 30;
  ctx.moveTo(0, 12 * s);
  ctx.bezierCurveTo(-30 * s, -8 * s, -16 * s, -30 * s, 0, -12 * s);
  ctx.bezierCurveTo(16 * s, -30 * s, 30 * s, -8 * s, 0, 12 * s);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

async function loveCard({ name1, avatar1, name2, avatar2, percent }) {
  const W = 900;
  const H = 360;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  background(ctx, W, H, '#24081a', '#4a0d2a');

  drawAvatar(ctx, await fetchImage(avatar1), 150, 130, 80, '#ff4d6d');
  drawAvatar(ctx, await fetchImage(avatar2), W - 150, 130, 80, '#ff4d6d');

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  fitText(ctx, name1, 250, 28);
  ctx.fillText(name1, 150, 250);
  fitText(ctx, name2, 250, 28);
  ctx.fillText(name2, W - 150, 250);

  heart(ctx, W / 2, 120, 90, '#ff2d55');
  ctx.fillStyle = '#ffffff';
  ctx.font = font(40);
  ctx.fillText(`%${percent}`, W / 2, 190);

  const barX = 120;
  const barW = W - 240;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, barX, 285, barW, 28, 14);
  ctx.fill();
  if (percent > 0) {
    const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    g.addColorStop(0, '#ff6b9d');
    g.addColorStop(1, '#ff0033');
    ctx.fillStyle = g;
    roundRect(ctx, barX, 285, Math.max(28, (barW * percent) / 100), 28, 14);
    ctx.fill();
  }
  return canvas.toBuffer('image/png');
}

module.exports = { rankCard, welcomeCard, loveCard };
