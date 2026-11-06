const { Events, EmbedBuilder } = require('discord.js');
const { settings } = require('../db');
const { sendLog } = require('../utils/logger');
const { goodbyeDefault, colors } = require('../config');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const { guild } = member;
    const chId = settings.get(guild.id, 'goodbye_channel');
    const ch = chId && guild.channels.cache.get(chId);
    if (ch?.isTextBased()) {
      const text = goodbyeDefault
        .replaceAll('{username}', member.user.username)
        .replaceAll('{server}', guild.name)
        .replaceAll('{count}', guild.memberCount);
      await ch.send(text).catch(() => {});
    }
    await sendLog(
      guild,
      new EmbedBuilder()
        .setColor(colors.error)
        .setTitle('📤 Üye ayrıldı')
        .setDescription(`${member.user.tag} (<@${member.id}>)`)
        .setTimestamp(),
    );
  },
};
