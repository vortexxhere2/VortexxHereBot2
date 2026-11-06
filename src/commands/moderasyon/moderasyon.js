const { EmbedBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { col } = require('../../db');
const cmd = require('../../utils/builder');
const embeds = require('../../utils/embeds');
const { parseDuration, formatDuration } = require('../../utils/duration');
const { modLog, canModerate, addWarn } = require('../../services/moderation');
const { colors } = require('../../config');

const E = MessageFlags.Ephemeral;
const reasonOpt = (o) => o.setName('sebep').setDescription('Sebep').setMaxLength(300);
const reasonOf = (i) => i.options.getString('sebep') || 'Belirtilmedi';
const dm = (user, text) => user.send(text).catch(() => {}); // DM kapalıysa sessizce geç

module.exports = [
  // ---------------- BAN ----------------
  {
    data: cmd()
      .setName('ban')
      .setDescription('Kullanıcıyı yasaklar (süre vererek geçici de olabilir)')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Banlanacak kullanıcı').setRequired(true))
      .addStringOption(reasonOpt)
      .addStringOption((o) => o.setName('sure').setDescription('Geçici ban süresi (örn: 3d, 12h). Boşsa kalıcı'))
      .addIntegerOption((o) => o.setName('mesajsil').setDescription('Kaç günlük mesajı silinsin (0-7)').setMinValue(0).setMaxValue(7)),
    async execute(i) {
      const user = i.options.getUser('kullanici');
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const err = canModerate(i, member);
        if (err) return i.reply({ embeds: [embeds.error(err)], flags: E });
      } else if (user.id === i.user.id) return i.reply({ embeds: [embeds.error('Kendini banlayamazsın.')], flags: E });

      const sureStr = i.options.getString('sure');
      const ms = sureStr ? parseDuration(sureStr) : null;
      if (sureStr && !ms) return i.reply({ embeds: [embeds.error('Geçersiz süre. Örnek: `3d`, `12h`')], flags: E });
      const reason = reasonOf(i);

      await dm(user, `🔨 **${i.guild.name}** sunucusundan banlandın.\nSebep: ${reason}${ms ? `\nSüre: ${formatDuration(ms)}` : ''}`);
      await i.guild.members.ban(user.id, { reason: `${i.user.tag}: ${reason}`, deleteMessageSeconds: (i.options.getInteger('mesajsil') || 0) * 86400 });
      if (ms) await col('tempbans').update({ guild_id: i.guildId, user_id: user.id }, { set: { unban_at: Date.now() + ms } }, { upsert: true });

      await modLog(i.guild, { action: ms ? 'Geçici Ban' : 'Ban', target: user, moderator: i.user, reason, extra: ms ? `Süre: ${formatDuration(ms)}` : null, color: colors.error });
      await i.reply({ embeds: [embeds.success(`**${user.tag}** banlandı${ms ? ` (${formatDuration(ms)})` : ''}.\nSebep: ${reason}`)] });
    },
  },

  {
    data: cmd()
      .setName('unban')
      .setDescription('Kullanıcının banını kaldırır')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addStringOption((o) => o.setName('kullanici_id').setDescription('Kullanıcı ID').setRequired(true))
      .addStringOption(reasonOpt),
    async execute(i) {
      const id = i.options.getString('kullanici_id').trim();
      const ban = await i.guild.bans.fetch(id).catch(() => null);
      if (!ban) return i.reply({ embeds: [embeds.error('Bu ID ile banlı bir kullanıcı bulunamadı.')], flags: E });
      await i.guild.members.unban(id, `${i.user.tag}: ${reasonOf(i)}`);
      await col('tempbans').delete({ guild_id: i.guildId, user_id: id });
      await modLog(i.guild, { action: 'Unban', target: ban.user, moderator: i.user, reason: reasonOf(i), color: colors.success });
      await i.reply({ embeds: [embeds.success(`**${ban.user.tag}** kullanıcısının banı kaldırıldı.`)] });
    },
  },

  // ---------------- KICK ----------------
  {
    data: cmd()
      .setName('kick')
      .setDescription('Kullanıcıyı sunucudan atar')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true))
      .addStringOption(reasonOpt),
    async execute(i) {
      const member = await i.guild.members.fetch(i.options.getUser('kullanici').id).catch(() => null);
      const err = canModerate(i, member);
      if (err) return i.reply({ embeds: [embeds.error(err)], flags: E });
      const reason = reasonOf(i);
      await dm(member.user, `👢 **${i.guild.name}** sunucusundan atıldın.\nSebep: ${reason}`);
      await member.kick(`${i.user.tag}: ${reason}`);
      await modLog(i.guild, { action: 'Kick', target: member.user, moderator: i.user, reason, color: colors.error });
      await i.reply({ embeds: [embeds.success(`**${member.user.tag}** sunucudan atıldı.\nSebep: ${reason}`)] });
    },
  },

  // ---------------- TIMEOUT ----------------
  {
    data: cmd()
      .setName('sustur')
      .setDescription('Kullanıcıyı belirli süre susturur (timeout)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
      .addStringOption((o) => o.setName('sure').setDescription('Süre (örn: 10m, 2h, 1d) — en fazla 28 gün').setRequired(true))
      .addStringOption(reasonOpt),
    async execute(i) {
      const member = await i.guild.members.fetch(i.options.getUser('kullanici').id).catch(() => null);
      const err = canModerate(i, member);
      if (err) return i.reply({ embeds: [embeds.error(err)], flags: E });
      const ms = parseDuration(i.options.getString('sure'));
      if (!ms || ms > 28 * 86_400_000) return i.reply({ embeds: [embeds.error('Geçersiz süre (en fazla 28 gün). Örnek: `10m`, `2h`')], flags: E });
      const reason = reasonOf(i);
      await member.timeout(ms, `${i.user.tag}: ${reason}`);
      await dm(member.user, `🔇 **${i.guild.name}** sunucusunda ${formatDuration(ms)} susturuldun.\nSebep: ${reason}`);
      await modLog(i.guild, { action: 'Susturma', target: member.user, moderator: i.user, reason, extra: `Süre: ${formatDuration(ms)}` });
      await i.reply({ embeds: [embeds.success(`${member} **${formatDuration(ms)}** susturuldu.\nSebep: ${reason}`)], allowedMentions: { parse: [] } });
    },
  },
  {
    data: cmd()
      .setName('susturkaldir')
      .setDescription('Kullanıcının susturmasını kaldırır')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    async execute(i) {
      const member = await i.guild.members.fetch(i.options.getUser('kullanici').id).catch(() => null);
      if (!member) return i.reply({ embeds: [embeds.error('Kullanıcı bulunamadı.')], flags: E });
      await member.timeout(null, i.user.tag);
      await modLog(i.guild, { action: 'Susturma Kaldırıldı', target: member.user, moderator: i.user, reason: '—', color: colors.success });
      await i.reply({ embeds: [embeds.success(`${member} kullanıcısının susturması kaldırıldı.`)], allowedMentions: { parse: [] } });
    },
  },

  // ---------------- UYARI SİSTEMİ ----------------
  {
    data: cmd()
      .setName('warn')
      .setDescription('Kullanıcıyı uyarır (3 uyarı = 1 saat, 5 uyarı = 24 saat susturma)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setRequired(true).setMaxLength(300)),
    async execute(i) {
      const user = i.options.getUser('kullanici');
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      const err = canModerate(i, member);
      if (err) return i.reply({ embeds: [embeds.error(err)], flags: E });
      const reason = i.options.getString('sebep');
      const { count, escalation } = await addWarn(i.guild, user.id, i.user.id, reason);
      await dm(user, `⚠️ **${i.guild.name}** sunucusunda uyarıldın (${count}. uyarı).\nSebep: ${reason}`);
      await modLog(i.guild, { action: 'Uyarı', target: user, moderator: i.user, reason, extra: `Toplam uyarı: ${count}` });
      await i.reply({ embeds: [embeds.warn(`${user} uyarıldı. (Toplam: **${count}**)\nSebep: ${reason}${escalation ? `\n🔇 ${escalation}` : ''}`)], allowedMentions: { parse: [] } });
    },
  },
  {
    data: cmd()
      .setName('uyarilar')
      .setDescription('Kullanıcının uyarılarını listeler')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    async execute(i) {
      const user = i.options.getUser('kullanici');
      const rows = await col('warns').find({ guild_id: i.guildId, user_id: user.id }, { sort: { id: -1 }, limit: 10 });
      const total = await col('warns').count({ guild_id: i.guildId, user_id: user.id });
      const desc = rows.length
        ? rows.map((w) => `**#${w.id}** • <t:${Math.floor(w.created_at / 1000)}:d> • ${w.mod_id === 'automod' ? 'AutoMod' : `<@${w.mod_id}>`}\n└ ${w.reason}`).join('\n')
        : 'Hiç uyarısı yok ✅';
      await i.reply({ embeds: [new EmbedBuilder().setColor(colors.warn).setTitle(`⚠️ ${user.username} — ${total} uyarı`).setDescription(desc)], allowedMentions: { parse: [] } });
    },
  },
  {
    data: cmd()
      .setName('uyarisil')
      .setDescription('Bir uyarıyı (ID ile) ya da kullanıcının tüm uyarılarını siler')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addIntegerOption((o) => o.setName('id').setDescription('Silinecek uyarı ID\'si'))
      .addUserOption((o) => o.setName('kullanici').setDescription('Bu kullanıcının TÜM uyarılarını sil')),
    async execute(i) {
      const id = i.options.getInteger('id');
      const user = i.options.getUser('kullanici');
      if (!id && !user) return i.reply({ embeds: [embeds.error('Bir `id` ya da `kullanici` seçmelisin.')], flags: E });
      const removed = await col('warns').delete(id ? { id, guild_id: i.guildId } : { user_id: user.id, guild_id: i.guildId });
      await i.reply({ embeds: [removed ? embeds.success(`${removed} uyarı silindi.`) : embeds.error('Silinecek uyarı bulunamadı.')], flags: E });
    },
  },

  // ---------------- KANAL YÖNETİMİ ----------------
  {
    data: cmd()
      .setName('sil')
      .setDescription('Toplu mesaj siler (14 günden eski olanlar silinemez)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption((o) => o.setName('miktar').setDescription('Silinecek mesaj sayısı (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
      .addUserOption((o) => o.setName('kullanici').setDescription('Sadece bu kullanıcının mesajlarını sil')),
    async execute(i) {
      await i.deferReply({ flags: E });
      const amount = i.options.getInteger('miktar');
      const user = i.options.getUser('kullanici');
      let msgs = await i.channel.messages.fetch({ limit: 100 });
      if (user) msgs = msgs.filter((m) => m.author.id === user.id);
      const target = [...msgs.values()].slice(0, amount);
      const deleted = await i.channel.bulkDelete(target, true);
      await modLog(i.guild, { action: 'Mesaj Silme', target: user || i.user, moderator: i.user, reason: `${deleted.size} mesaj silindi`, extra: `Kanal: <#${i.channelId}>`, color: colors.info });
      await i.editReply({ embeds: [embeds.success(`**${deleted.size}** mesaj silindi.`)] });
    },
  },
  {
    data: cmd()
      .setName('kilitle')
      .setDescription('Kanalı herkese yazmaya kapatır')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanal (boşsa bu kanal)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
    async execute(i) {
      const ch = i.options.getChannel('kanal') || i.channel;
      await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false }, { reason: `${i.user.tag} kilitledi` });
      await modLog(i.guild, { action: 'Kanal Kilitlendi', target: i.user, moderator: i.user, reason: `<#${ch.id}>` });
      await i.reply({ embeds: [embeds.success(`${ch} kilitlendi 🔒`)] });
    },
  },
  {
    data: cmd()
      .setName('kilitac')
      .setDescription('Kanalın kilidini açar')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanal (boşsa bu kanal)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
    async execute(i) {
      const ch = i.options.getChannel('kanal') || i.channel;
      await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null }, { reason: `${i.user.tag} kilidi açtı` });
      await i.reply({ embeds: [embeds.success(`${ch} kilidi açıldı 🔓`)] });
    },
  },
  {
    data: cmd()
      .setName('yavaslat')
      .setDescription('Kanalda yavaş mod ayarlar')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addIntegerOption((o) => o.setName('saniye').setDescription('Saniye (0 = kapat, en fazla 21600)').setRequired(true).setMinValue(0).setMaxValue(21600)),
    async execute(i) {
      const s = i.options.getInteger('saniye');
      await i.channel.setRateLimitPerUser(s, `${i.user.tag}`);
      await i.reply({ embeds: [embeds.success(s ? `Yavaş mod: **${s} saniye**` : 'Yavaş mod kapatıldı.')] });
    },
  },

  // ---------------- ROL ----------------
  {
    data: cmd()
      .setName('rol')
      .setDescription('Kullanıcıya rol verir / rolünü alır')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand((s) =>
        s
          .setName('ver')
          .setDescription('Rol verir')
          .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
          .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('al')
          .setDescription('Rolü geri alır')
          .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
          .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true)),
      ),
    async execute(i) {
      const member = await i.guild.members.fetch(i.options.getUser('kullanici').id).catch(() => null);
      const role = i.options.getRole('rol');
      if (!member) return i.reply({ embeds: [embeds.error('Kullanıcı bulunamadı.')], flags: E });
      if (role.managed || role.id === i.guildId || !role.editable)
        return i.reply({ embeds: [embeds.error('Bu rolü yönetemem (bot rolünden yüksek ya da yönetilen rol).')], flags: E });
      if (i.user.id !== i.guild.ownerId && role.position >= i.member.roles.highest.position)
        return i.reply({ embeds: [embeds.error('Kendi en yüksek rolünden yüksek/eşit rolü veremezsin.')], flags: E });
      if (i.options.getSubcommand() === 'ver') await member.roles.add(role, i.user.tag);
      else await member.roles.remove(role, i.user.tag);
      await i.reply({ embeds: [embeds.success(`${member} → ${role} ${i.options.getSubcommand() === 'ver' ? 'verildi' : 'alındı'}.`)], allowedMentions: { parse: [] } });
    },
  },
];
