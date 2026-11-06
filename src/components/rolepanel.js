const { MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');

// customId: rr:<roleId>  → rolü ver / geri al
module.exports = async (interaction, args) => {
  const role = interaction.guild.roles.cache.get(args[0]);
  if (!role || !role.editable)
    return interaction.reply({
      embeds: [embeds.error('Bu rolü veremiyorum (rol silinmiş ya da benim rolümden yüksek).')],
      flags: MessageFlags.Ephemeral,
    });
  const has = interaction.member.roles.cache.has(role.id);
  if (has) await interaction.member.roles.remove(role, 'Rol paneli');
  else await interaction.member.roles.add(role, 'Rol paneli');
  return interaction.reply({
    embeds: [embeds.success(has ? `${role} rolü alındı.` : `${role} rolü verildi.`)],
    flags: MessageFlags.Ephemeral,
  });
};
