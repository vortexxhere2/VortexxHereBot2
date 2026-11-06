require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');

// Render ve UptimeRobot icin Mini Web Sunucusu
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot aktif ve calisiyor!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web sunucusu ${PORT} portunda dinlemede.`);
});

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN bulunamadi. .env dosyasini kontrol edin.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.commands = new Collection();
client.components = new Collection();

// Komutlari yukle
const commandsDir = path.join(__dirname, 'src', 'commands');
for (const category of fs.readdirSync(commandsDir)) {
  const catPath = path.join(commandsDir, category);
  if (!fs.statSync(catPath).isDirectory()) continue;
  for (const file of fs.readdirSync(catPath).filter((f) => f.endsWith('.js'))) {
    const mod = require(path.join(catPath, file));
    for (const cmd of Array.isArray(mod) ? mod : [mod]) {
      if (!cmd?.data || !cmd?.execute) continue;
      cmd.category = category;
      client.commands.set(cmd.data.name, cmd);
    }
  }
}

// Buton ve menu isleyicileri
client.components.set('ticket', require('./src/components/ticket'));
client.components.set('gw', require('./src/components/giveaway'));
client.components.set('rr', require('./src/components/rolepanel'));

// Olaylari yukle
const eventsDir = path.join(__dirname, 'src', 'events');
for (const file of fs.readdirSync(eventsDir).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(eventsDir, file));
  const handler = (...args) =>
    Promise.resolve(event.execute(...args, client)).catch((e) => console.error(`[${event.name}]`, e));
  if (event.once) client.once(event.name, handler);
  else client.on(event.name, handler);
}

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

console.log(`${client.commands.size} komut yuklendi.`);
(async () => {
  try {
    const kind = await require('./src/db').init();
    console.log(`Veritabani: ${kind}`);
  } catch (e) {
    console.error('Veritabanina baglanilamadi:', e.message);
    if (process.env.MONGODB_URI) console.error('MONGODB_URI dogru mu? Atlas IP erisim listesini kontrol edin.');
    process.exit(1);
  }
  await client.login(process.env.DISCORD_TOKEN);
})();