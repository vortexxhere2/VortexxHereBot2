const { guildId } = require('../config');

// Slash komutlarını Discord'a kaydeder. GUILD_ID varsa sunucuya (anında), yoksa global olarak.
async function registerCommands(client) {
  const body = client.commands.map((c) => c.data.toJSON());
  if (guildId) {
    await client.application.commands.set(body, guildId);
    console.log(`✅ ${body.length} komut sunucuya (${guildId}) kaydedildi.`);
  } else {
    await client.application.commands.set(body);
    console.log(`✅ ${body.length} komut global olarak kaydedildi (görünmesi biraz sürebilir).`);
  }
}

module.exports = { registerCommands };
