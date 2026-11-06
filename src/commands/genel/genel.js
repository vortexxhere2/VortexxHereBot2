const { EmbedBuilder, ChannelType, MessageFlags } = require('discord.js');
const djs = require('discord.js');
const cmd = require('../../utils/builder');
const embeds = require('../../utils/embeds');
const { formatDuration } = require('../../utils/duration');

const CATEGORY_NAMES = {
  genel: '🌐 Genel',
  eglence: '🎮 Eğlence',
  seviye: '📈 Seviye',
  ekonomi: '💰 Ekonomi',
  moderasyon: '🛡️ Moderasyon',
  otomasyon: '⚙️ Otomasyon & Ayarlar',
  ticket: '🎫 Ticket',
};

module.exports = [
  {
    data: cmd().setName('ping').setDescription('Botun gecikmesini gösterir'),
    async execute(i, client) {
      await i.reply('🏓 Ölçülüyor...');
      const sent = await i.fetchReply();
      const rtt = sent.createdTimestamp - i.createdTimestamp;
      await i.editReply(`🏓 Pong! Gecikme: **${rtt}ms** • API: **${Math.round(client.ws.ping)}ms**`);
    },
  },

  {
    data: cmd().setName('yardim').setDescription('Tüm komutları kategorilere göre listeler'),
    async execute(i, client) {
      const groups = {};
      for (const c of client.commands.values()) (groups[c.category] ||= []).push(`\`/${c.data.name}\``);
      const embed = new EmbedBuilder()
        .setColor(embeds.colors.main)
        .setTitle('📖 Komut Listesi')
        .setDescription('Komutların detayını yazarken Discord size açıklamalarını gösterir.\nYetkili komutlarını sadece yetkililer görür.')
        .setThumbnail(client.user.displayAvatarURL());
      for (const [cat, list] of Object.entries(groups))
        embed.addFields({ name: CATEGORY_NAMES[cat] || cat, value: list.join(' ').slice(0, 1024) });
      embed.setFooter({ text: `Toplam ${client.commands.size} komut` });
      await i.reply({ embeds: [embed] });
    },
  },

  {
    data: cmd()
      .setName('avatar')
      .setDescription('Bir kullanıcının avatarını büyük gösterir')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş bırakırsan sen)')),
    async execute(i) {
      const user = i.options.getUser('kullanici') || i.user;
      const url = user.displayAvatarURL({ size: 1024 });
      await i.reply({ embeds: [new EmbedBuilder().setColor(embeds.colors.main).setTitle(`${user.username} — Avatar`).setImage(url).setURL(url)] });
    },
  },

  {
    data: cmd()
      .setName('kullanicibilgi')
      .setDescription('Bir kullanıcı hakkında bilgi verir')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş bırakırsan sen)')),
    async execute(i) {
      const user = i.options.getUser('kullanici') || i.user;
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      const embed = new EmbedBuilder()
        .setColor(member?.displayColor || embeds.colors.main)
        .setTitle(user.tag)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'ID', value: user.id, inline: true },
          { name: 'Hesap açılışı', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        );
      if (member) {
        const roles = member.roles.cache.filter((r) => r.id !== i.guild.id).sort((a, b) => b.position - a.position);
        embed.addFields(
          { name: 'Sunucuya katılma', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
          { name: `Roller (${roles.size})`, value: roles.size ? roles.first(10).join(' ') : 'Yok' },
        );
      }
      await i.reply({ embeds: [embed] });
    },
  },

  {
    data: cmd().setName('sunucubilgi').setDescription('Sunucu hakkında bilgi verir'),
    async execute(i) {
      const g = i.guild;
      await g.members.fetch().catch(() => {});
      const owner = await g.fetchOwner().catch(() => null);
      const ch = g.channels.cache;
      const embed = new EmbedBuilder()
        .setColor(embeds.colors.main)
        .setTitle(g.name)
        .setThumbnail(g.iconURL({ size: 256 }))
        .addFields(
          { name: '👑 Sahip', value: owner ? `${owner}` : '—', inline: true },
          { name: '📅 Kuruluş', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '👥 Üye', value: `${g.memberCount} (🤖 ${g.members.cache.filter((m) => m.user.bot).size} bot)`, inline: true },
          { name: '💬 Kanallar', value: `Yazı: ${ch.filter((c) => c.type === ChannelType.GuildText).size} • Ses: ${ch.filter((c) => c.type === ChannelType.GuildVoice).size}`, inline: true },
          { name: '🎭 Roller', value: `${g.roles.cache.size}`, inline: true },
          { name: '💎 Boost', value: `Seviye ${g.premiumTier} (${g.premiumSubscriptionCount || 0})`, inline: true },
        );
      await i.reply({ embeds: [embed] });
    },
  },

  {
    data: cmd().setName('botbilgi').setDescription('Bot istatistiklerini gösterir'),
    async execute(i, client) {
      const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      const embed = new EmbedBuilder()
        .setColor(embeds.colors.main)
        .setTitle('🤖 Bot Bilgisi')
        .addFields(
          { name: 'Çalışma süresi', value: formatDuration(client.uptime), inline: true },
          { name: 'Sunucu', value: `${client.guilds.cache.size}`, inline: true },
          { name: 'Komut', value: `${client.commands.size}`, inline: true },
          { name: 'Bellek', value: `${mem} MB`, inline: true },
          { name: 'discord.js', value: `v${djs.version}`, inline: true },
          { name: 'Node.js', value: process.version, inline: true },
        );
      await i.reply({ embeds: [embed] });
    },
  },
];
