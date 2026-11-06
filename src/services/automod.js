const { PermissionFlagsBits } = require('discord.js');
const { col, settings } = require('../db');
const { allowedDomains } = require('../config');
const { modLog, addWarn } = require('./moderation');

const INVITE_RE = /(discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i;
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>]+)/gi;
const spamMap = new Map(); // "guild-user" -> [timestamps]

// Anahtarlar: automod_links, automod_invites, automod_badwords, automod_spam, automod_caps, automod_mentions
const FEATURES = {
  links: 'Link engeli (YouTube/GIF linkleri hariç)',
  invites: 'Discord davet linki engeli',
  badwords: 'Küfür / yasaklı kelime filtresi',
  spam: 'Spam koruması',
  caps: 'Aşırı büyük harf engeli',
  mentions: 'Toplu etiket engeli',
};

const on = (guildId, key) => settings.bool(guildId, `automod_${key}`, false);

async function hasBadWord(guildId, content) {
  const words = (await col('badwords').find({ guild_id: guildId })).map((r) => r.word);
  if (!words.length) return false;
  const tokens = content.toLocaleLowerCase('tr').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.some((w) => tokens.some((t) => (w.length >= 4 ? t.includes(w) : t === w)));
}

function hasForbiddenLink(content) {
  const urls = content.match(URL_RE) || [];
  return urls.some((u) => {
    try {
      const host = new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, '').toLowerCase();
      return !allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
      return true;
    }
  });
}

// Mesajı kontrol eder. İhlal varsa mesajı siler ve true döner.
async function check(message) {
  const { guild, member, content } = message;
  if (!guild || !member || message.author.bot) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages) || member.permissions.has(PermissionFlagsBits.Administrator))
    return false;

  let violation = null; // { reason, strike }

  if (on(guild.id, 'invites') && INVITE_RE.test(content)) violation = { reason: 'Davet linki paylaşmak yasak', strike: true };
  else if (on(guild.id, 'links') && hasForbiddenLink(content)) violation = { reason: 'Link paylaşmak yasak', strike: false };
  else if (on(guild.id, 'badwords') && (await hasBadWord(guild.id, content))) violation = { reason: 'Yasaklı kelime kullanımı', strike: true };
  else if (on(guild.id, 'mentions') && message.mentions.users.size + message.mentions.roles.size >= 5)
    violation = { reason: 'Toplu etiket yasak', strike: true };
  else if (on(guild.id, 'caps')) {
    const letters = content.replace(/[^\p{L}]/gu, '');
    if (letters.length >= 12) {
      const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
      if (upper / letters.length > 0.7) violation = { reason: 'Aşırı büyük harf kullanımı', strike: false };
    }
  }

  if (!violation && on(guild.id, 'spam')) {
    const key = `${guild.id}-${message.author.id}`;
    const now = Date.now();
    const list = (spamMap.get(key) || []).filter((t) => now - t < 6000);
    list.push(now);
    spamMap.set(key, list);
    if (list.length >= 6) {
      spamMap.delete(key);
      if (member.moderatable) await member.timeout(5 * 60 * 1000, 'AutoMod: spam').catch(() => {});
      await modLog(guild, { action: 'AutoMod: Spam', target: message.author, moderator: null, reason: '6 saniyede 6+ mesaj', extra: '5 dk susturuldu' });
      const warn = await message.channel.send(`🚫 ${message.author}, spam yaptığın için 5 dakika susturuldun.`).catch(() => null);
      if (warn) setTimeout(() => warn.delete().catch(() => {}), 6000);
      return true;
    }
  }

  if (!violation) return false;

  await message.delete().catch(() => {});
  const notice = await message.channel.send(`🚫 ${message.author}, ${violation.reason}!`).catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => {}), 5000);

  let extra;
  if (violation.strike) {
    const { count, escalation } = await addWarn(guild, message.author.id, null, `AutoMod: ${violation.reason}`);
    extra = `Toplam uyarı: ${count}${escalation ? `\n${escalation}` : ''}`;
  }
  await modLog(guild, {
    action: 'AutoMod',
    target: message.author,
    moderator: null,
    reason: violation.reason,
    extra: [extra, `Kanal: <#${message.channel.id}>`].filter(Boolean).join('\n'),
  });
  return true;
}

module.exports = { check, FEATURES };
