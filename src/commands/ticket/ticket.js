const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const cmd = require('../../utils/builder');
const embeds = require('../../utils/embeds');
const { closeTicket, getTicketByChannel, isStaff } = require('../../services/tickets');

const E = MessageFlags.Ephemeral;
const ALLOW = {
  ViewChannel: true,
  SendMessages: true,
  ReadMessageHistory: true,
  AttachFiles: true,
  EmbedLinks: true,
};

module.exports = [
  {
    data: cmd()
      .setName('ticket')
      .setDescription('Ticket kanalı içinde kullanılan yetkili komutları')
      .addSubcommand((s) =>
        s
          .setName('ekle')
          .setDescription('Ticket\'a bir kullanıcı ekler')
          .addUserOption((o) => o.setName('kullanici').setDescription('Eklenecek kullanıcı').setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('cikar')
          .setDescription('Ticket\'tan bir kullanıcıyı çıkarır')
          .addUserOption((o) => o.setName('kullanici').setDescription('Çıkarılacak kullanıcı').setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('kapat')
          .setDescription('Ticket\'ı kapatır ve kaydını gönderir')
          .addStringOption((o) => o.setName('sebep').setDescription('Kapatma sebebi').setMaxLength(300)),
      ),
    async execute(i) {
      const ticket = await getTicketByChannel(i.channelId);
      if (!ticket) return i.reply({ embeds: [embeds.error('Bu komut sadece açık bir ticket kanalında kullanılabilir.')], flags: E });
      if (!isStaff(i.member)) return i.reply({ embeds: [embeds.error('Bu komutu sadece ticket yetkilileri kullanabilir.')], flags: E });

      const sub = i.options.getSubcommand();
      if (sub === 'kapat') {
        await i.reply({ embeds: [embeds.info('🔒 Ticket kapatılıyor, kayıt gönderiliyor...')] });
        return closeTicket(i.channel, i.user, i.options.getString('sebep') || 'Belirtilmedi');
      }

      const user = i.options.getUser('kullanici');
      if (sub === 'ekle') {
        await i.channel.permissionOverwrites.edit(user.id, ALLOW);
        return i.reply({ embeds: [embeds.success(`${user} ticket'a eklendi.`)], allowedMentions: { users: [user.id] } });
      }
      if (user.id === ticket.user_id) return i.reply({ embeds: [embeds.error('Ticket sahibini çıkaramazsın.')], flags: E });
      await i.channel.permissionOverwrites.delete(user.id);
      return i.reply({ embeds: [embeds.success(`${user} ticket'tan çıkarıldı.`)], allowedMentions: { parse: [] } });
    },
  },
];
