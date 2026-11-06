const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { col } = require('../db');
const embeds = require('../utils/embeds');
const { createTicket, closeTicket, getTicketByChannel, isStaff } = require('../services/tickets');

const E = MessageFlags.Ephemeral;

module.exports = async (interaction, args) => {
  const action = args[0];

  // ---- Panelden yeni ticket ----
  if (action === 'create') {
    await interaction.deferReply({ flags: E });
    const res = await createTicket(interaction.guild, interaction.user, interaction.values[0]);
    // Seçim menüsünü sıfırla (aynı seçeneği tekrar seçebilsinler)
    interaction.message.edit({ components: interaction.message.components }).catch(() => {});
    if (!res.ok) return interaction.editReply({ embeds: [embeds.error(res.message)] });
    return interaction.editReply({ embeds: [embeds.success(`Ticketın oluşturuldu: ${res.channel}`)] });
  }

  const ticket = await getTicketByChannel(interaction.channelId);
  if (!ticket) return interaction.reply({ embeds: [embeds.error('Bu kanal açık bir ticket değil.')], flags: E });

  const staff = isStaff(interaction.member);
  const owner = ticket.user_id === interaction.user.id;

  if (action === 'claim') {
    if (!staff) return interaction.reply({ embeds: [embeds.error('Sadece yetkililer ticket üstlenebilir.')], flags: E });
    if (ticket.claimed_by) return interaction.reply({ embeds: [embeds.warn(`Bu ticket zaten <@${ticket.claimed_by}> tarafından üstlenilmiş.`)], flags: E });
    await col('tickets').update({ id: ticket.id }, { set: { claimed_by: interaction.user.id } });
    return interaction.reply({ embeds: [embeds.success(`${interaction.user} bu ticketı üstlendi.`)] });
  }

  if (action === 'close') {
    if (!staff && !owner) return interaction.reply({ embeds: [embeds.error('Bu ticketı kapatma yetkin yok.')], flags: E });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:confirm').setLabel('Evet, kapat').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket:cancel').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary),
    );
    return interaction.reply({ embeds: [embeds.warn('Ticketı kapatmak istediğine emin misin?')], components: [row] });
  }

  if (action === 'confirm') {
    if (!staff && !owner) return interaction.reply({ embeds: [embeds.error('Bu ticketı kapatma yetkin yok.')], flags: E });
    await interaction.update({ embeds: [embeds.info('🔒 Ticket birkaç saniye içinde kapatılacak, kayıt gönderiliyor...')], components: [] });
    return closeTicket(interaction.channel, interaction.user, 'Buton ile kapatıldı');
  }

  if (action === 'cancel') {
    return interaction.message.delete().catch(() => interaction.update({ components: [] }));
  }
};
