const { MessageFlags } = require('discord.js');
const { col } = require('../../db');
const cmd = require('../../utils/builder');
const embeds = require('../../utils/embeds');
const { formatDuration } = require('../../utils/duration');

const get = async (g, u) =>
  (await col('economy').findOne({ guild_id: g, user_id: u })) || { balance: 0, last_daily: 0, last_work: 0, last_rob: 0 };

const DAY = 24 * 60 * 60 * 1000;

module.exports = [
  {
    data: cmd().setName('gunluk').setDescription('Günlük coin ödülünü al 🪙'),
    async execute(i) {
      const row = await get(i.guildId, i.user.id);
      const left = row.last_daily + DAY - Date.now();
      if (left > 0)
        return i.reply({ embeds: [embeds.warn(`Günlük ödülünü zaten aldın. **${formatDuration(left)}** sonra tekrar gel.`)], flags: MessageFlags.Ephemeral });
      const reward = 100 + Math.floor(Math.random() * 151); // 100-250
      await col('economy').update({ guild_id: i.guildId, user_id: i.user.id }, { set: { last_daily: Date.now() }, inc: { balance: reward } }, { upsert: true });
      await i.reply({ embeds: [embeds.success(`**${reward}** 🪙 kazandın! Yeni bakiye: **${row.balance + reward}** 🪙`)] });
    },
  },
  {
    data: cmd()
      .setName('bakiye')
      .setDescription('Coin bakiyeni gösterir')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş bırakırsan sen)')),
    async execute(i) {
      const user = i.options.getUser('kullanici') || i.user;
      await i.reply({ embeds: [embeds.info(`${user} bakiyesi: **${(await get(i.guildId, user.id)).balance}** 🪙`)], allowedMentions: { parse: [] } });
    },
  },
  {
    data: cmd()
      .setName('gonder')
      .setDescription('Başka bir kullanıcıya coin gönderir')
      .addUserOption((o) => o.setName('kullanici').setDescription('Alıcı').setRequired(true))
      .addIntegerOption((o) => o.setName('miktar').setDescription('Miktar').setRequired(true).setMinValue(1)),
    async execute(i) {
      const target = i.options.getUser('kullanici');
      const amount = i.options.getInteger('miktar');
      if (target.bot || target.id === i.user.id)
        return i.reply({ embeds: [embeds.error('Geçersiz alıcı.')], flags: MessageFlags.Ephemeral });
      // Önce bakiye yeterliyse atomik olarak düş (yarış durumunda çift harcama olmaz), sonra alıcıya ekle
      const paid = await col('economy').update({ guild_id: i.guildId, user_id: i.user.id, balance: { $gte: amount } }, { inc: { balance: -amount } });
      if (!paid) {
        const me = await get(i.guildId, i.user.id);
        return i.reply({ embeds: [embeds.error(`Yeterli bakiyen yok. Bakiyen: **${me.balance}** 🪙`)], flags: MessageFlags.Ephemeral });
      }
      await col('economy').update({ guild_id: i.guildId, user_id: target.id }, { inc: { balance: amount } }, { upsert: true });
      await i.reply({ embeds: [embeds.success(`${target} kullanıcısına **${amount}** 🪙 gönderdin.`)], allowedMentions: { users: [target.id] } });
    },
  },
];
