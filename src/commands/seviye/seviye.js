const { AttachmentBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { col } = require('../../db');
const cmd = require('../../utils/builder');
const embeds = require('../../utils/embeds');
const leveling = require('../../services/leveling');
const { rankCard } = require('../../utils/canvas');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = [
  {
    data: cmd()
      .setName('rank')
      .setDescription('Seviye kartını gösterir')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş bırakırsan sen)')),
    async execute(i) {
      await i.deferReply();
      const user = i.options.getUser('kullanici') || i.user;
      if (user.bot) return i.editReply({ embeds: [embeds.error('Botların seviyesi olmaz 🤖')] });
      const row = await leveling.getUser(i.guildId, user.id);
      const p = leveling.progress(row.xp);
      const img = await rankCard({
        username: user.username,
        avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
        level: p.level,
        current: p.current,
        needed: p.needed,
        xp: row.xp,
        rank: await leveling.getRank(i.guildId, user.id),
        messages: row.messages,
      });
      await i.editReply({ files: [new AttachmentBuilder(img, { name: 'rank.png' })] });
    },
  },

  {
    data: cmd()
      .setName('siralama')
      .setDescription('Sunucunun seviye sıralamasını gösterir')
      .addIntegerOption((o) => o.setName('sayfa').setDescription('Sayfa numarası').setMinValue(1)),
    async execute(i) {
      const page = i.options.getInteger('sayfa') || 1;
      const rows = await leveling.top(i.guildId, 10, (page - 1) * 10);
      if (!rows.length) return i.reply({ embeds: [embeds.info('Bu sayfada kimse yok.')], flags: MessageFlags.Ephemeral });
      const lines = rows.map((r, idx) => {
        const pos = (page - 1) * 10 + idx;
        return `${MEDALS[pos] || `**${pos + 1}.**`} <@${r.user_id}> — Seviye **${r.level}** • ${r.xp.toLocaleString('tr-TR')} XP`;
      });
      await i.reply({
        embeds: [new EmbedBuilder().setColor(embeds.colors.main).setTitle(`🏆 ${i.guild.name} — Sıralama`).setDescription(lines.join('\n')).setFooter({ text: `Sayfa ${page}` })],
        allowedMentions: { parse: [] },
      });
    },
  },

  {
    data: cmd()
      .setName('seviyeodul')
      .setDescription('Seviye rol ödüllerini yönetir')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand((s) =>
        s
          .setName('ekle')
          .setDescription('Bir seviyeye rol ödülü ekler')
          .addIntegerOption((o) => o.setName('seviye').setDescription('Seviye').setRequired(true).setMinValue(1).setMaxValue(500))
          .addRoleOption((o) => o.setName('rol').setDescription('Verilecek rol').setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('sil')
          .setDescription('Seviye ödülünü siler')
          .addIntegerOption((o) => o.setName('seviye').setDescription('Seviye').setRequired(true)),
      )
      .addSubcommand((s) => s.setName('liste').setDescription('Tüm ödülleri listeler')),
    async execute(i) {
      const sub = i.options.getSubcommand();
      if (sub === 'ekle') {
        const level = i.options.getInteger('seviye');
        const role = i.options.getRole('rol');
        if (role.managed || role.id === i.guildId || role.position >= i.guild.members.me.roles.highest.position)
          return i.reply({ embeds: [embeds.error('Bu rolü veremem (bot rolünden yüksek / yönetilen rol).')], flags: MessageFlags.Ephemeral });
        await col('level_rewards').update({ guild_id: i.guildId, level }, { set: { role_id: role.id } }, { upsert: true });
        return i.reply({ embeds: [embeds.success(`Seviye **${level}** ödülü: ${role}`)] });
      }
      if (sub === 'sil') {
        const removed = await col('level_rewards').delete({ guild_id: i.guildId, level: i.options.getInteger('seviye') });
        return i.reply({ embeds: [removed ? embeds.success('Ödül silindi.') : embeds.error('Bu seviyede ödül yok.')], flags: MessageFlags.Ephemeral });
      }
      const rows = await col('level_rewards').find({ guild_id: i.guildId }, { sort: { level: 1 } });
      await i.reply({
        embeds: [embeds.info(rows.length ? rows.map((r) => `**Seviye ${r.level}** → <@&${r.role_id}>`).join('\n') : 'Henüz ödül yok. `/seviyeodul ekle` ile ekle.', '🎁 Seviye Ödülleri')],
        allowedMentions: { parse: [] },
      });
    },
  },

  {
    data: cmd()
      .setName('xp')
      .setDescription('Kullanıcıların XP / seviyesini düzenler')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) =>
        s
          .setName('ver')
          .setDescription('XP ekler')
          .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
          .addIntegerOption((o) => o.setName('miktar').setDescription('XP miktarı').setRequired(true).setMinValue(1).setMaxValue(1_000_000)),
      )
      .addSubcommand((s) =>
        s
          .setName('al')
          .setDescription('XP çıkarır')
          .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
          .addIntegerOption((o) => o.setName('miktar').setDescription('XP miktarı').setRequired(true).setMinValue(1).setMaxValue(1_000_000)),
      )
      .addSubcommand((s) =>
        s
          .setName('seviye')
          .setDescription('Kullanıcının seviyesini ayarlar')
          .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
          .addIntegerOption((o) => o.setName('seviye').setDescription('Yeni seviye').setRequired(true).setMinValue(0).setMaxValue(500)),
      )
      .addSubcommand((s) =>
        s
          .setName('sifirla')
          .setDescription('Kullanıcının XP\'sini sıfırlar')
          .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
      ),
    async execute(i) {
      const sub = i.options.getSubcommand();
      const user = i.options.getUser('kullanici');
      if (user.bot) return i.reply({ embeds: [embeds.error('Botlara XP verilemez.')], flags: MessageFlags.Ephemeral });

      let r;
      if (sub === 'ver') r = await leveling.addXp(i.guildId, user.id, i.options.getInteger('miktar'));
      else if (sub === 'al') r = await leveling.addXp(i.guildId, user.id, -i.options.getInteger('miktar'));
      else if (sub === 'seviye') r = await leveling.setXp(i.guildId, user.id, leveling.xpForLevel(i.options.getInteger('seviye')));
      else r = await leveling.setXp(i.guildId, user.id, 0);

      const member = await i.guild.members.fetch(user.id).catch(() => null);
      if (member && r.newLevel > r.oldLevel) await leveling.giveRewards(member, r.newLevel);
      await i.reply({ embeds: [embeds.success(`${user} → **Seviye ${r.newLevel}** (${r.xp.toLocaleString('tr-TR')} XP)`)], allowedMentions: { parse: [] } });
    },
  },
];
