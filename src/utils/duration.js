// "10m", "2h", "1d12h", "30s" gibi süreleri milisaniyeye çevirir. Geçersizse null döner.
const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

function parseDuration(input) {
  if (!input) return null;
  const str = String(input).toLowerCase().replace(/\s+/g, '');
  const re = /(\d+)([smhdw])/g;
  let total = 0;
  let matched = '';
  let m;
  while ((m = re.exec(str))) {
    total += Number(m[1]) * UNITS[m[2]];
    matched += m[0];
  }
  if (!total || matched !== str) return null;
  return total;
}

function formatDuration(ms) {
  const parts = [];
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (d) parts.push(`${d} gün`);
  if (h) parts.push(`${h} saat`);
  if (m) parts.push(`${m} dk`);
  if (s && !d && !h) parts.push(`${s} sn`);
  return parts.join(' ') || '0 sn';
}

module.exports = { parseDuration, formatDuration };
