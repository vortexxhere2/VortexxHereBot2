const { EmbedBuilder, MessageFlags } = require('discord.js');
const { col, settings } = require('../../db');
const cmd = require('../../utils/builder');
const embeds = require('../../utils/embeds');
const { parseDuration, formatDuration } = require('../../utils/duration');

const NUMS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

module.exports = [
  {
    data: (() => {
      const b = cmd()
        .setName('anket')
        .setDescription('Reaksiyonlu anket oluşturur')
        .addStringOption((o) => o.setName('soru').setDescription('Anket sorusu').setRequired(true).setMaxLength(250))
        .addStringOption((o) => o.setName('secenek1').setDescription('1. seçenek').setRequired(true).setMaxLength(100))
        .addStringOption((o) => o.setName('secenek2').setDescription('2. seçenek').setRequired(true).setMaxLength(100));
      for (let n = 3; n <= 5; n++) b.addStringOption((o) => o.setName(`secenek${n}`).setDescription(`${n}. seçenek`).setMaxLength(100));
      return b;
    })(),
    async execute(i) {
      const options = [1, 2, 3, 4, 5].map((n) => i.options.getString(`secenek${n}`)).filter(Boolean);
      const embed = new EmbedBuilder()
        .setColor(embeds.colors.main)
        .setTitle(`📊 ${i.options.getString('soru')}`)
        .setDescription(options.map((o, idx) => `${NUMS[idx]} ${o}`).join('\n\n'))
        .setFooter({ text: `${i.user.username} tarafından`, iconURL: i.user.displayAvatarURL() });
      await i.reply({ embeds: [embed] });
      const msg = await i.fetchReply();
      for (let n = 0; n < options.length; n++) await msg.react(NUMS[n]).catch(() => {});
    },
  },

  {
    data: cmd()
      .setName('oneri')
      .setDescription('Sunucu için öneri gönderir')
      .addStringOption((o) => o.setName('metin').setDescription('Önerin').setRequired(true).setMaxLength(1500)),
    async execute(i) {
      const chId = settings.get(i.guildId, 'suggestion_channel');
      const ch = (chId && i.guild.channels.cache.get(chId)) || i.channel;
      const embed = new EmbedBuilder()
        .setColor(embeds.colors.info)
        .setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })
        .setTitle('💡 Yeni Öneri')
        .setDescription(i.options.getString('metin'))
        .setTimestamp();
      const msg = await ch.send({ embeds: [embed] });
      await msg.react('✅').catch(() => {});
      await msg.react('❌').catch(() => {});
      await i.reply({ embeds: [embeds.success(`Önerin gönderildi: ${ch}`)], flags: MessageFlags.Ephemeral });
    },
  },

  {
    data: cmd()
      .setName('afk')
      .setDescription('AFK moduna geçersin; etiketlenirsen bot haber verir')
      .addStringOption((o) => o.setName('sebep').setDescription('AFK sebebi').setMaxLength(100)),
    async execute(i) {
      const reason = i.options.getString('sebep') || 'Sebep belirtilmedi';
      await col('afk').update({ guild_id: i.guildId, user_id: i.user.id }, { set: { reason, since: Date.now() } }, { upsert: true });
      await i.reply({ embeds: [embeds.success(`AFK moduna geçtin: **${reason}**\nMesaj yazdığında otomatik kapanır.`)], flags: MessageFlags.Ephemeral });
    },
  },

  {
    data: cmd()
      .setName('hatirlat')
      .setDescription('Belirli süre sonra seni hatırlatır')
      .addStringOption((o) => o.setName('sure').setDescription('Örn: 10m, 2h, 1d, 1h30m').setRequired(true))
      .addStringOption((o) => o.setName('mesaj').setDescription('Ne hatırlatılsın?').setRequired(true).setMaxLength(300)),
    async execute(i) {
      const ms = parseDuration(i.options.getString('sure'));
      if (!ms || ms < 10_000 || ms > 30 * 86_400_000)
        return i.reply({ embeds: [embeds.error('Geçersiz süre. Örnek: `10m`, `2h`, `1d` (10 sn – 30 gün arası).')], flags: MessageFlags.Ephemeral });
      await col('reminders').insert({ user_id: i.user.id, channel_id: i.channelId, message: i.options.getString('mesaj'), remind_at: Date.now() + ms });
      await i.reply({ embeds: [embeds.success(`**${formatDuration(ms)}** sonra seni hatırlatacağım. (<t:${Math.floor((Date.now() + ms) / 1000)}:R>)`)] });
    },
  },
];
