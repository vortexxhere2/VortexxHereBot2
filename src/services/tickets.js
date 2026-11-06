const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { col, settings } = require('../db');
const { colors, ticketCategories } = require('../config');

const USER_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];

function isStaff(member) {
  const roleId = settings.get(member.guild.id, 'ticket_staff_role');
  return (
    (roleId && member.roles.cache.has(roleId)) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

function getTicketByChannel(channelId) {
  return col('tickets').findOne({ channel_id: channelId, status: 'open' });
}

// Ticket kanalı oluşturur. { ok, message, channel } döner.
async function createTicket(guild, user, categoryValue) {
  const staffRoleId = settings.get(guild.id, 'ticket_staff_role');
  if (!staffRoleId) return { ok: false, message: 'Ticket sistemi henüz ayarlanmamış. Yetkililere `/ayarla ticket` komutunu kullanmalarını söyle.' };

  const existing = await col('tickets').findOne({ guild_id: guild.id, user_id: user.id, status: 'open' });
  if (existing && guild.channels.cache.has(existing.channel_id))
    return { ok: false, message: `Zaten açık bir ticketın var: <#${existing.channel_id}>` };
  if (existing) await col('tickets').update({ id: existing.id }, { set: { status: 'closed' } }); // kanal silinmiş, kaydı kapat

  const cat = ticketCategories.find((c) => c.value === categoryValue) || ticketCategories[0];
  const parentId = settings.get(guild.id, 'ticket_category');
  const { id } = await col('tickets').insert({ guild_id: guild.id, user_id: user.id, category: cat.value, created_at: Date.now() });

  const channel = await guild.channels
    .create({
      name: `ticket-${String(id).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: parentId && guild.channels.cache.has(parentId) ? parentId : undefined,
      topic: `Ticket #${id} • ${cat.label} • Açan: ${user.tag} (${user.id})`,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: USER_PERMS },
        { id: staffRoleId, allow: [...USER_PERMS, PermissionFlagsBits.ManageMessages] },
        { id: guild.members.me.id, allow: [...USER_PERMS, PermissionFlagsBits.ManageChannels] },
      ],
    })
    .catch((e) => {
      console.error('[ticket] kanal oluşturulamadı', e.message);
      return null;
    });

  if (!channel) {
    await col('tickets').update({ id }, { set: { status: 'failed' } });
    return { ok: false, message: 'Ticket kanalı oluşturulamadı. Botun **Kanalları Yönet** yetkisi olduğundan emin ol.' };
  }
  await col('tickets').update({ id }, { set: { channel_id: channel.id } });

  const embed = new EmbedBuilder()
    .setColor(colors.main)
    .setTitle(`🎫 Ticket #${String(id).padStart(4, '0')} — ${cat.label}`)
    .setDescription(
      `Merhaba ${user}! Yetkililer en kısa sürede seninle ilgilenecek.\nLütfen sorununu **detaylı** şekilde yaz.`,
    )
    .addFields(
      { name: 'Açan', value: `${user}`, inline: true },
      { name: 'Kategori', value: `${cat.emoji} ${cat.label}`, inline: true },
    )
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:claim').setLabel('Üstlen').setEmoji('🙋').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Kapat').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  );
  await channel.send({
    content: `${user} | <@&${staffRoleId}>`,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [user.id], roles: [staffRoleId] },
  });
  return { ok: true, channel };
}

async function buildTranscript(channel) {
  const all = [];
  let before;
  for (let i = 0; i < 10; i++) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || !batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
  }
  all.reverse();
  return all
    .map((m) => {
      const time = new Date(m.createdTimestamp).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
      const files = m.attachments.size ? ` [Ek: ${[...m.attachments.values()].map((a) => a.url).join(' ')}]` : '';
      const emb = m.embeds.length ? ' [embed]' : '';
      return `[${time}] ${m.author.tag}: ${m.content}${files}${emb}`;
    })
    .join('\n');
}

// Ticket'ı kapatır: transcript'i log kanalına ve açan kişiye gönderir, kanalı siler.
async function closeTicket(channel, closer, reason = 'Belirtilmedi') {
  const ticket = await getTicketByChannel(channel.id);
  if (!ticket) return false;
  await col('tickets').update({ id: ticket.id }, { set: { status: 'closed' } });

  const text = await buildTranscript(channel);
  const file = () => new AttachmentBuilder(Buffer.from(text || '(mesaj yok)', 'utf8'), { name: `ticket-${ticket.id}.txt` });
  const embed = new EmbedBuilder()
    .setColor(colors.warn)
    .setTitle(`🔒 Ticket #${String(ticket.id).padStart(4, '0')} kapatıldı`)
    .addFields(
      { name: 'Açan', value: `<@${ticket.user_id}>`, inline: true },
      { name: 'Kapatan', value: `${closer}`, inline: true },
      { name: 'Üstlenen', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : '—', inline: true },
      { name: 'Sebep', value: reason },
    )
    .setTimestamp();

  const logId = settings.get(channel.guild.id, 'ticket_log') || settings.get(channel.guild.id, 'log_channel');
  const logCh = logId && channel.guild.channels.cache.get(logId);
  if (logCh?.isTextBased()) await logCh.send({ embeds: [embed], files: [file()] }).catch(() => {});

  const user = await channel.client.users.fetch(ticket.user_id).catch(() => null);
  if (user) await user.send({ embeds: [embed], files: [file()] }).catch(() => {}); // DM kapalıysa sessizce geç

  setTimeout(() => channel.delete('Ticket kapatıldı').catch(() => {}), 4000);
  return true;
}

module.exports = { createTicket, closeTicket, getTicketByChannel, isStaff };
