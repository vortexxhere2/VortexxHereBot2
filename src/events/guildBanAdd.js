const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { colors } = require('../config');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    await sendLog(
      ban.guild,
      new EmbedBuilder()
        .setColor(colors.error)
        .setTitle('🔨 Üye banlandı')
        .setDescription(`${ban.user.tag} (<@${ban.user.id}>)\nSebep: ${ban.reason || 'Belirtilmedi'}`)
        .setTimestamp(),
    );
  },
};
