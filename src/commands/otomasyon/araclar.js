const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const { col } = require('../../db');
const cmd = require('../../utils/builder');
const embeds = require('../../utils/embeds');
const { parseDuration } = require('../../utils/duration');
const { ticketCategories, colors } = require('../../config');
const giveaway = require('../../services/giveaway');

const E = MessageFlags.Ephemeral;
const TEXT = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const DANGEROUS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.MentionEveryone,
];

module.exports = [
  // =============== /duyuru ===============
  {
    data: cmd()
      .setName('duyuru')
      .setDescription('Embed şeklinde manuel duyuru gönderir')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((o) => o.setName('baslik').setDescription('Başlık').setRequired(true).setMaxLength(200))
      .addStringOption((o) => o.setName('mesaj').setDescription('Mesaj (satır atlamak için \\n yaz)').setRequired(true).setMaxLength(3500))
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanal (boşsa bu kanal)').addChannelTypes(...TEXT))
      .addRoleOption((o) => o.setName('rol').setDescription('Etiketlenecek rol'))
      .addStringOption((o) => o.setName('gorsel').setDescription('Görsel linki (https://...)')),
    async execute(i) {
      const ch = i.options.getChannel('kanal') || i.channel;
      const role = i.options.getRole('rol');
      const image = i.options.getString('gorsel');
      const embed = new EmbedBuilder()
        .setColor(colors.main)
        .setTitle(i.options.getString('baslik'))
        .setDescription(i.options.getString('mesaj').replaceAll('\\n', '\n'))
        .setFooter({ text: i.guild.name, iconURL: i.guild.iconURL() })
        .setTimestamp();
      if (image && /^https?:\/\//i.test(image)) embed.setImage(image);
      await ch.send({
        content: role ? (role.id === i.guildId ? '@everyone' : `${role}`) : undefined,
        embeds: [embed],
        allowedMentions: { parse: role ? ['roles', 'everyone'] : [] },
      });
      await i.reply({ embeds: [embeds.success(`Duyuru gönderildi: ${ch}`)], flags: E });
    },
  },

  // =============== /ticketpanel ===============
  {
    data: cmd()
      .setName('ticketpanel')
      .setDescription('Ticket açma panelini gönderir')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addChannelOption((o) => o.setName('kanal').setDescription('Panelin gönderileceği kanal (boşsa bu kanal)').addChannelTypes(...TEXT)),
    async execute(i) {
      const ch = i.options.getChannel('kanal') || i.channel;
      const embed = new EmbedBuilder()
        .setColor(colors.main)
        .setTitle('🎫 Destek Merkezi')
        .setDescription('Bir sorunun, önerin ya da iş birliği teklifin mi var?\nAşağıdaki menüden kategori seçerek **özel bir destek kanalı** aç.\n\n> Lütfen gereksiz ticket açmayın.')
        .setFooter({ text: i.guild.name, iconURL: i.guild.iconURL() });
      const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket:create')
        .setPlaceholder('Bir kategori seç...')
        .addOptions(ticketCategories.map((c) => ({ label: c.label, value: c.value, emoji: c.emoji, description: c.description })));
      await ch.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
      await i.reply({ embeds: [embeds.success(`Ticket paneli gönderildi: ${ch}`)], flags: E });
    },
  },

  // =============== /rolpanel ===============
  {
    data: (() => {
      const b = cmd()
        .setName('rolpanel')
        .setDescription('Butonla rol alınan panel oluşturur')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption((o) => o.setName('baslik').setDescription('Panel başlığı').setRequired(true).setMaxLength(100))
        .addRoleOption((o) => o.setName('rol1').setDescription('1. rol').setRequired(true));
      for (let n = 2; n <= 5; n++) b.addRoleOption((o) => o.setName(`rol${n}`).setDescription(`${n}. rol`));
      b.addStringOption((o) => o.setName('aciklama').setDescription('Panel açıklaması').setMaxLength(500));
      return b;
    })(),
    async execute(i) {
      const roles = [1, 2, 3, 4, 5].map((n) => i.options.getRole(`rol${n}`)).filter(Boolean);
      for (const r of roles) {
        if (r.managed || r.id === i.guildId || !r.editable)
          return i.reply({ embeds: [embeds.error(`${r} rolünü veremem (bot rolünden yüksek ya da yönetilen rol).`)], flags: E });
        if (DANGEROUS.some((p) => r.permissions.has(p)))
          return i.reply({ embeds: [embeds.error(`${r} yetkili bir rol; güvenlik için panele eklenemez.`)], flags: E });
      }
      const embed = new EmbedBuilder()
        .setColor(colors.main)
        .setTitle(i.options.getString('baslik'))
        .setDescription(`${i.options.getString('aciklama') || 'Almak istediğin role tıkla. Tekrar tıklarsan rol geri alınır.'}\n\n${roles.map((r) => `• ${r}`).join('\n')}`);
      const row = new ActionRowBuilder().addComponents(
        roles.map((r) => new ButtonBuilder().setCustomId(`rr:${r.id}`).setLabel(r.name.slice(0, 80)).setStyle(ButtonStyle.Secondary)),
      );
      await i.channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
      await i.reply({ embeds: [embeds.success('Rol paneli gönderildi.')], flags: E });
    },
  },

  // =============== /cekilis ===============
  {
    data: cmd()
      .setName('cekilis')
      .setDescription('Çekiliş yönetimi')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) =>
        s
          .setName('baslat')
          .setDescription('Yeni çekiliş başlatır')
          .addStringOption((o) => o.setName('odul').setDescription('Ödül').setRequired(true).setMaxLength(200))
          .addStringOption((o) => o.setName('sure').setDescription('Süre (örn: 30m, 2h, 1d)').setRequired(true))
          .addIntegerOption((o) => o.setName('kazanan').setDescription('Kazanan sayısı (varsayılan 1)').setMinValue(1).setMaxValue(20)),
      )
      .addSubcommand((s) =>
        s
          .setName('bitir')
          .setDescription('Çekilişi hemen bitirir')
          .addStringOption((o) => o.setName('mesaj_id').setDescription('Çekiliş mesajının ID\'si').setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('yenile')
          .setDescription('Biten çekilişte yeniden kazanan seçer')
          .addStringOption((o) => o.setName('mesaj_id').setDescription('Çekiliş mesajının ID\'si').setRequired(true)),
      ),
    async execute(i, client) {
      const sub = i.options.getSubcommand();

      if (sub === 'baslat') {
        const ms = parseDuration(i.options.getString('sure'));
        if (!ms || ms < 10_000 || ms > 30 * 86_400_000)
          return i.reply({ embeds: [embeds.error('Geçersiz süre (10 sn – 30 gün). Örnek: `30m`, `2h`, `1d`')], flags: E });
        const g = {
          prize: i.options.getString('odul'),
          winners: i.options.getInteger('kazanan') || 1,
          host_id: i.user.id,
          end_at: Date.now() + ms,
        };
        const msg = await i.channel.send({ embeds: [giveaway.activeEmbed(g, 0)], components: [giveaway.button()] });
        await col('giveaways').insert({ guild_id: i.guildId, channel_id: i.channelId, message_id: msg.id, prize: g.prize, winners: g.winners, host_id: g.host_id, end_at: g.end_at });
        return i.reply({ embeds: [embeds.success('Çekiliş başlatıldı!')], flags: E });
      }

      const row = await col('giveaways').findOne({ guild_id: i.guildId, message_id: i.options.getString('mesaj_id').trim() });
      if (!row) return i.reply({ embeds: [embeds.error('Bu mesaj ID\'si ile çekiliş bulunamadı.')], flags: E });

      if (sub === 'bitir') {
        if (row.ended) return i.reply({ embeds: [embeds.error('Bu çekiliş zaten bitmiş. `/cekilis yenile` kullanabilirsin.')], flags: E });
        await i.deferReply({ flags: E });
        await giveaway.endGiveaway(client, row);
        return i.editReply({ embeds: [embeds.success('Çekiliş bitirildi.')] });
      }

      if (!row.ended) return i.reply({ embeds: [embeds.error('Çekiliş henüz bitmedi.')], flags: E });
      await i.deferReply({ flags: E });
      await giveaway.endGiveaway(client, row);
      return i.editReply({ embeds: [embeds.success('Yeni kazanan(lar) seçildi.')] });
    },
  },
];
