const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { colors } = require('../config');

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban) {
    await sendLog(
      ban.guild,
      new EmbedBuilder()
        .setColor(colors.success)
        .setTitle('🔓 Ban kaldırıldı')
        .setDescription(`${ban.user.tag} (<@${ban.user.id}>)`)
        .setTimestamp(),
    );
  },
};
