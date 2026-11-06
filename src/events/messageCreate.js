const { Events } = require('discord.js');
const { col } = require('../db');
const automod = require('../services/automod');
const leveling = require('../services/leveling');
const { xp } = require('../config');

const cooldowns = new Map(); // "guild-user" -> son XP zamanı

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot || message.system) return;

    // 1) AutoMod
    if (await automod.check(message)) return;

    // 2) AFK: yazan kişi AFK ise modu kapat
    const self = await col('afk').findOne({ guild_id: message.guild.id, user_id: message.author.id });
    if (self) {
      await col('afk').delete({ guild_id: message.guild.id, user_id: message.author.id });
      const m = await message.reply({ content: '👋 Tekrar hoş geldin! AFK modundan çıktın.', allowedMentions: { repliedUser: false } }).catch(() => null);
      if (m) setTimeout(() => m.delete().catch(() => {}), 6000);
    }

    // 3) Etiketlenen kişi AFK ise bildir
    for (const user of [...message.mentions.users.values()].slice(0, 3)) {
      const afk = await col('afk').findOne({ guild_id: message.guild.id, user_id: user.id });
      if (afk)
        await message
          .reply({ content: `💤 **${user.username}** şu an AFK: ${afk.reason} (<t:${Math.floor(afk.since / 1000)}:R>)`, allowedMentions: { repliedUser: false } })
          .catch(() => {});
    }

    // 4) Seviye XP'si
    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    if (now - (cooldowns.get(key) || 0) < xp.cooldownMs) return;
    cooldowns.set(key, now);

    const r = await leveling.addXp(message.guild.id, message.author.id, leveling.randomXp(), { countMessage: true });
    if (r.newLevel > r.oldLevel && message.member) await leveling.handleLevelUp(message.member, r.newLevel, message.channel);
  },
};
