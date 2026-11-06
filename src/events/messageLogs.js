// Not: Her dosya tek olay dışa aktarır; bu dosya silinen mesaj logunu yönetir.
const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { colors } = require('../config');

const cut = (s, n = 1000) => (s && s.length > n ? `${s.slice(0, n)}…` : s || '*(boş)*');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild || message.partial || message.author?.bot) return;
    await sendLog(
      message.guild,
      new EmbedBuilder()
        .setColor(colors.error)
        .setTitle('🗑️ Mesaj silindi')
        .addFields(
          { name: 'Yazan', value: `${message.author} (${message.author.tag})`, inline: true },
          { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
          { name: 'İçerik', value: cut(message.content) },
        )
        .setTimestamp(),
    );
  },
};
