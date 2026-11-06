const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { col } = require('../db');
const { colors } = require('../config');

const ts = (ms) => Math.floor(ms / 1000);

function activeEmbed(g, entryCount = 0) {
  return new EmbedBuilder()
    .setColor(colors.main)
    .setTitle(`🎉 ${g.prize}`)
    .setDescription(
      `Katılmak için aşağıdaki butona tıkla!\n\n⏰ Bitiş: <t:${ts(g.end_at)}:R> (<t:${ts(g.end_at)}:f>)\n👑 Düzenleyen: <@${g.host_id}>\n🏆 Kazanan sayısı: **${g.winners}**\n👥 Katılımcı: **${entryCount}**`,
    )
    .setTimestamp(g.end_at);
}

const button = (disabled = false) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('gw:enter')
      .setLabel('Katıl')
      .setEmoji('🎉')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );

async function pickWinners(giveawayId, count) {
  const ids = (await col('giveaway_entries').find({ giveaway_id: giveawayId })).map((r) => r.user_id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}

// Çekilişi bitirir (veya yeniden çeker). Kazanan ID listesi döner.
async function endGiveaway(client, g) {
  await col('giveaways').update({ id: g.id }, { set: { ended: 1 } });
  const winners = await pickWinners(g.id, g.winners);
  const entryCount = await col('giveaway_entries').count({ giveaway_id: g.id });

  const channel = await client.channels.fetch(g.channel_id).catch(() => null);
  if (!channel?.isTextBased()) return winners;
  const mentions = winners.map((id) => `<@${id}>`).join(', ');

  const embed = new EmbedBuilder()
    .setColor(0x747f8d)
    .setTitle(`🎉 ${g.prize}`)
    .setDescription(
      `**Çekiliş sona erdi!**\n\n🏆 Kazanan: ${mentions || 'Katılım olmadığı için kazanan yok 😢'}\n👑 Düzenleyen: <@${g.host_id}>\n👥 Katılımcı: **${entryCount}**`,
    )
    .setTimestamp();
  const msg = await channel.messages.fetch(g.message_id).catch(() => null);
  if (msg) await msg.edit({ embeds: [embed], components: [button(true)] }).catch(() => {});
  if (winners.length)
    await channel
      .send({ content: `🎊 Tebrikler ${mentions}! **${g.prize}** kazandınız!`, allowedMentions: { users: winners } })
      .catch(() => {});
  else await channel.send(`😢 **${g.prize}** çekilişine kimse katılmadı.`).catch(() => {});
  return winners;
}

module.exports = { activeEmbed, button, endGiveaway, pickWinners };
