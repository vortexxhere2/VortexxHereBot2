const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { settings } = require('../db');
const { welcomeCard } = require('../utils/canvas');
const { sendLog } = require('../utils/logger');
const { welcomeDefault, colors } = require('../config');

const fill = (tpl, member) =>
  tpl
    .replaceAll('{user}', member.toString())
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', member.guild.memberCount);

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const { guild } = member;

    // Otomatik rol
    const roleId = settings.get(guild.id, 'autorole');
    if (roleId && !member.user.bot) {
      const role = guild.roles.cache.get(roleId);
      if (role?.editable) await member.roles.add(role, 'Otorol').catch(() => {});
    }

    // Hoş geldin mesajı + canvas kartı
    const chId = settings.get(guild.id, 'welcome_channel');
    const ch = chId && guild.channels.cache.get(chId);
    if (ch?.isTextBased()) {
      const text = fill(settings.get(guild.id, 'welcome_message', welcomeDefault), member);
      try {
        const img = await welcomeCard({
          username: member.user.username,
          avatarUrl: member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
          serverName: guild.name,
          memberCount: guild.memberCount,
        });
        await ch.send({ content: text, files: [new AttachmentBuilder(img, { name: 'hosgeldin.png' })], allowedMentions: { users: [member.id] } });
      } catch (e) {
        console.error('[hoşgeldin]', e.message);
        await ch.send({ content: text, allowedMentions: { users: [member.id] } }).catch(() => {});
      }
    }

    await sendLog(
      guild,
      new EmbedBuilder()
        .setColor(colors.success)
        .setTitle('📥 Üye katıldı')
        .setDescription(`${member} (${member.user.tag})\nHesap açılış: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
        .setThumbnail(member.displayAvatarURL())
        .setTimestamp(),
    );
  },
};
