const { Events, MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');

async function safeError(interaction, text) {
  const payload = { embeds: [embeds.error(text)], flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
  else await interaction.reply(payload).catch(() => {});
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;
      try {
        await cmd.execute(interaction, client);
      } catch (e) {
        console.error(`[/${interaction.commandName}]`, e);
        await safeError(interaction, 'Komut çalıştırılırken bir hata oluştu.');
      }
      return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const [prefix, ...args] = interaction.customId.split(':');
      const handler = client.components.get(prefix);
      if (!handler) return;
      try {
        await handler(interaction, args, client);
      } catch (e) {
        console.error(`[component ${interaction.customId}]`, e);
        await safeError(interaction, 'Bir hata oluştu.');
      }
    }
  },
};
