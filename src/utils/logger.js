const { settings } = require('../db');

// Sunucunun log kanalına embed gönderir (ayarlıysa).
async function sendLog(guild, embed) {
  try {
    const id = settings.get(guild.id, 'log_channel');
    if (!id) return;
    const ch = guild.channels.cache.get(id) || (await guild.channels.fetch(id).catch(() => null));
    if (ch?.isTextBased()) await ch.send({ embeds: [embed] });
  } catch (e) {
    console.error('[log]', e.message);
  }
}

module.exports = { sendLog };
