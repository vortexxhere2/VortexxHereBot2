const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const automod = require('../services/automod');
const { colors } = require('../config');

const cut = (s, n = 900) => (s && s.length > n ? `${s.slice(0, n)}…` : s || '*(boş)*');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMsg, newMsg) {
    if (!newMsg.guild || newMsg.partial || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    // Düzenleyerek AutoMod'u atlatmayı engelle
    if (await automod.check(newMsg)) return;
    await sendLog(
      newMsg.guild,
      new EmbedBuilder()
        .setColor(colors.info)
        .setTitle('✏️ Mesaj düzenlendi')
        .setDescription(`[Mesaja git](${newMsg.url})`)
        .addFields(
          { name: 'Yazan', value: `${newMsg.author} (${newMsg.author.tag})`, inline: true },
          { name: 'Kanal', value: `<#${newMsg.channel.id}>`, inline: true },
          { name: 'Önce', value: cut(oldMsg.content) },
          { name: 'Sonra', value: cut(newMsg.content) },
        )
        .setTimestamp(),
    );
  },
};
