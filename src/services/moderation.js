const { EmbedBuilder } = require('discord.js');
const { col } = require('../db');
const { sendLog } = require('../utils/logger');
const { warnEscalation, colors } = require('../config');

// Moderasyon işlemini log kanalına yazar
async function modLog(guild, { action, target, moderator, reason, extra, color = colors.warn }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🛡️ ${action}`)
    .addFields(
      { name: 'Kullanıcı', value: target ? `${target.tag ?? target.user?.tag ?? target} (<@${target.id}>)` : '—', inline: true },
      { name: 'Yetkili', value: moderator ? `<@${moderator.id ?? moderator}>` : 'Otomatik (AutoMod)', inline: true },
      { name: 'Sebep', value: reason || 'Belirtilmedi' },
    )
    .setTimestamp();
  if (extra) embed.addFields({ name: 'Detay', value: extra });
  await sendLog(guild, embed);
}

// İşlemi yapan yetkili hedefe işlem yapabilir mi? Yapamıyorsa hata metni döner.
function canModerate(interaction, member) {
  const { guild } = interaction;
  if (!member) return 'Bu kullanıcı sunucuda bulunamadı.';
  if (member.id === interaction.user.id) return 'Kendine işlem uygulayamazsın.';
  if (member.id === guild.ownerId) return 'Sunucu sahibine işlem uygulayamazsın.';
  if (member.id === interaction.client.user.id) return 'Bana işlem uygulayamazsın 😅';
  if (interaction.user.id !== guild.ownerId && member.roles.highest.position >= interaction.member.roles.highest.position)
    return 'Bu kullanıcının rolü seninkine eşit veya daha yüksek.';
  if (member.roles.highest.position >= guild.members.me.roles.highest.position)
    return 'Bu kullanıcının rolü benim rolümden yüksek. Bot rolünü yukarı taşı.';
  return null;
}

// Uyarı ekle, kademeli ceza uygula. { count, escalation } döner.
async function addWarn(guild, userId, modId, reason) {
  await col('warns').insert({ guild_id: guild.id, user_id: userId, mod_id: modId || 'automod', reason, created_at: Date.now() });
  const count = await col('warns').count({ guild_id: guild.id, user_id: userId });

  let escalation = null;
  const step = warnEscalation.find((s) => s.count === count);
  if (step) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member?.moderatable) {
      await member.timeout(step.timeoutMs, `${count} uyarı — otomatik susturma`).catch(() => {});
      escalation = `${count} uyarıya ulaştığı için **${step.label}** susturuldu.`;
      await modLog(guild, {
        action: 'Otomatik Susturma',
        target: member.user,
        moderator: null,
        reason: `${count} uyarı`,
        extra: `Süre: ${step.label}`,
        color: colors.error,
      });
    }
  }
  return { count, escalation };
}

module.exports = { modLog, canModerate, addWarn };
