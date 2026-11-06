const { Events, ActivityType } = require('discord.js');
const { registerCommands } = require('../utils/register');
const youtube = require('../services/youtube');
const scheduler = require('../services/scheduler');
const leveling = require('../services/leveling');
const { ytCheckMinutes, xp } = require('../config');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ ${client.user.tag} olarak giriş yapıldı. ${client.guilds.cache.size} sunucuda.`);
    client.user.setPresence({
      activities: [{ name: '/yardim • YouTube Topluluğu', type: ActivityType.Watching }],
      status: 'online',
    });

    await registerCommands(client).catch((e) => console.error('❌ Komutlar kaydedilemedi:', e.message));

    youtube.start(client, ytCheckMinutes);
    scheduler.start(client);

    // Ses kanalı XP'si (dakikada bir)
    setInterval(async () => {
      for (const guild of client.guilds.cache.values()) {
        for (const state of guild.voiceStates.cache.values()) {
          const m = state.member;
          if (!m || m.user.bot || !state.channelId) continue;
          if (state.selfMute || state.selfDeaf || state.serverMute || state.serverDeaf) continue;
          if (state.channelId === guild.afkChannelId) continue;
          const r = await leveling.addXp(guild.id, m.id, xp.voicePerMinute);
          if (r.newLevel > r.oldLevel) await leveling.handleLevelUp(m, r.newLevel, null);
        }
      }
    }, 60_000);
  },
};
