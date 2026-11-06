const { MessageFlags } = require('discord.js');
const { col } = require('../db');
const embeds = require('../utils/embeds');
const { activeEmbed } = require('../services/giveaway');

module.exports = async (interaction) => {
  const g = await col('giveaways').findOne({ message_id: interaction.message.id });
  if (!g || g.ended)
    return interaction.reply({ embeds: [embeds.error('Bu çekiliş sona erdi.')], flags: MessageFlags.Ephemeral });

  const entries = col('giveaway_entries');
  const entry = { giveaway_id: g.id, user_id: interaction.user.id };
  if (await entries.findOne(entry)) {
    await entries.delete(entry);
    await interaction.reply({ embeds: [embeds.warn('Çekilişten ayrıldın.')], flags: MessageFlags.Ephemeral });
  } else {
    await entries.insert(entry, { ignore: true });
    await interaction.reply({ embeds: [embeds.success('Çekilişe katıldın, bol şans! 🍀')], flags: MessageFlags.Ephemeral });
  }
  const count = await entries.count({ giveaway_id: g.id });
  interaction.message.edit({ embeds: [activeEmbed(g, count)] }).catch(() => {});
};
