const { col, settings } = require('../db');
const { xp: xpCfg } = require('../config');

// Bir seviyeden sonrakine geçmek için gereken XP
const needed = (lvl) => 5 * lvl * lvl + 50 * lvl + 100;

// Toplam XP'den seviye ve ilerleme hesapla
function progress(totalXp) {
  let level = 0;
  let rem = Math.max(0, totalXp);
  while (rem >= needed(level)) {
    rem -= needed(level);
    level++;
  }
  return { level, current: rem, needed: needed(level) };
}

// Belirli bir seviyeye ulaşmak için gereken toplam XP
function xpForLevel(level) {
  let total = 0;
  for (let i = 0; i < level; i++) total += needed(i);
  return total;
}

const randomXp = () => Math.floor(Math.random() * (xpCfg.max - xpCfg.min + 1)) + xpCfg.min;

async function getUser(guildId, userId) {
  return (
    (await col('levels').findOne({ guild_id: guildId, user_id: userId })) || {
      guild_id: guildId,
      user_id: userId,
      xp: 0,
      level: 0,
      messages: 0,
    }
  );
}

// XP ekle (negatif olabilir). { oldLevel, newLevel, xp } döner.
async function addXp(guildId, userId, amount, { countMessage = false } = {}) {
  const row = await getUser(guildId, userId);
  const newXp = Math.max(0, row.xp + amount);
  const newLevel = progress(newXp).level;
  const messages = row.messages + (countMessage ? 1 : 0);
  await col('levels').update({ guild_id: guildId, user_id: userId }, { set: { xp: newXp, level: newLevel, messages } }, { upsert: true });
  return { oldLevel: row.level, newLevel, xp: newXp };
}

async function setXp(guildId, userId, xp) {
  const row = await getUser(guildId, userId);
  return addXp(guildId, userId, xp - row.xp);
}

async function getRank(guildId, userId) {
  const row = await getUser(guildId, userId);
  return (await col('levels').count({ guild_id: guildId, xp: { $gt: row.xp } })) + 1;
}

function top(guildId, limit = 10, offset = 0) {
  return col('levels').find({ guild_id: guildId }, { sort: { xp: -1 }, limit, skip: offset });
}

// Ulaşılan seviyeye kadar olan tüm ödül rollerini ver
async function giveRewards(member, level) {
  const rewards = await col('level_rewards').find({ guild_id: member.guild.id, level: { $lte: level } });
  const given = [];
  for (const { role_id } of rewards) {
    const role = member.guild.roles.cache.get(role_id);
    if (role && !member.roles.cache.has(role_id) && role.editable) {
      await member.roles.add(role, 'Seviye ödülü').catch(() => {});
      given.push(role);
    }
  }
  return given;
}

// Seviye atlandığında duyuru + ödül
async function handleLevelUp(member, newLevel, fallbackChannel) {
  const rewards = await giveRewards(member, newLevel);
  const chId = settings.get(member.guild.id, 'level_channel');
  const ch = (chId && member.guild.channels.cache.get(chId)) || fallbackChannel;
  if (!ch?.isTextBased()) return;
  let text = `🎉 Tebrikler ${member}! **Seviye ${newLevel}** oldun!`;
  if (rewards.length) text += `\n🎁 Yeni rol ödülü: ${rewards.map((r) => r.toString()).join(', ')}`;
  await ch.send({ content: text, allowedMentions: { users: [member.id] } }).catch(() => {});
}

module.exports = { needed, progress, xpForLevel, randomXp, getUser, addXp, setXp, getRank, top, giveRewards, handleLevelUp };
