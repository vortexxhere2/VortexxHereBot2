// Veritabanı şeması. Hem SQLite hem MongoDB bu tek tanımdan beslenir.
//   cols     : sütun adı → tip ('TEXT' | 'INTEGER')
//   pk       : bileşik benzersiz anahtar (varsa)
//   auto     : true ise otomatik artan sayısal `id` alanı eklenir
//   defaults : eksik alanların varsayılan değeri
//   indexes  : ek indeksler (sorgu hızı için)
//
// Mevcut tablolar eski sürümle birebir uyumludur; yeni sütunlar açılışta otomatik eklenir.

module.exports = {
  // ---- Çekirdek ----
  settings: {
    cols: { guild_id: 'TEXT', key: 'TEXT', value: 'TEXT' },
    pk: ['guild_id', 'key'],
  },
  levels: {
    cols: { guild_id: 'TEXT', user_id: 'TEXT', xp: 'INTEGER', level: 'INTEGER', messages: 'INTEGER' },
    pk: ['guild_id', 'user_id'],
    defaults: { xp: 0, level: 0, messages: 0 },
    indexes: [['guild_id', 'xp']],
  },
  level_rewards: {
    cols: { guild_id: 'TEXT', level: 'INTEGER', role_id: 'TEXT' },
    pk: ['guild_id', 'level'],
  },
  warns: {
    auto: true,
    cols: { guild_id: 'TEXT', user_id: 'TEXT', mod_id: 'TEXT', reason: 'TEXT', created_at: 'INTEGER' },
    indexes: [['guild_id', 'user_id']],
  },
  tickets: {
    auto: true,
    cols: {
      guild_id: 'TEXT', channel_id: 'TEXT', user_id: 'TEXT', category: 'TEXT',
      status: 'TEXT', claimed_by: 'TEXT', created_at: 'INTEGER',
    },
    defaults: { status: 'open' },
    indexes: [['channel_id']],
  },
  giveaways: {
    auto: true,
    cols: {
      guild_id: 'TEXT', channel_id: 'TEXT', message_id: 'TEXT', prize: 'TEXT',
      winners: 'INTEGER', host_id: 'TEXT', end_at: 'INTEGER', ended: 'INTEGER',
    },
    defaults: { ended: 0 },
    indexes: [['message_id']],
  },
  giveaway_entries: {
    cols: { giveaway_id: 'INTEGER', user_id: 'TEXT' },
    pk: ['giveaway_id', 'user_id'],
  },
  badwords: {
    cols: { guild_id: 'TEXT', word: 'TEXT' },
    pk: ['guild_id', 'word'],
  },
  reminders: {
    auto: true,
    cols: { user_id: 'TEXT', channel_id: 'TEXT', message: 'TEXT', remind_at: 'INTEGER', done: 'INTEGER' },
    defaults: { done: 0 },
    indexes: [['done', 'remind_at']],
  },
  tempbans: {
    cols: { guild_id: 'TEXT', user_id: 'TEXT', unban_at: 'INTEGER' },
    pk: ['guild_id', 'user_id'],
  },
  afk: {
    cols: { guild_id: 'TEXT', user_id: 'TEXT', reason: 'TEXT', since: 'INTEGER' },
    pk: ['guild_id', 'user_id'],
  },
  economy: {
    cols: {
      guild_id: 'TEXT', user_id: 'TEXT', balance: 'INTEGER', last_daily: 'INTEGER',
      last_work: 'INTEGER', last_rob: 'INTEGER',
    },
    pk: ['guild_id', 'user_id'],
    defaults: { balance: 0, last_daily: 0, last_work: 0, last_rob: 0 },
    indexes: [['guild_id', 'balance']],
  },

  // ---- Topluluk özellikleri ----
  birthdays: {
    cols: { guild_id: 'TEXT', user_id: 'TEXT', day: 'INTEGER', month: 'INTEGER', year: 'INTEGER', last_congrats: 'INTEGER' },
    pk: ['guild_id', 'user_id'],
    defaults: { year: 0, last_congrats: 0 },
    indexes: [['day', 'month']],
  },
  tags: {
    cols: { guild_id: 'TEXT', name: 'TEXT', content: 'TEXT', author_id: 'TEXT', uses: 'INTEGER' },
    pk: ['guild_id', 'name'],
    defaults: { uses: 0 },
  },
  autoresponders: {
    cols: { guild_id: 'TEXT', trigger: 'TEXT', response: 'TEXT', mode: 'TEXT' },
    pk: ['guild_id', 'trigger'],
    defaults: { mode: 'contains' },
  },
  starboard: {
    cols: { guild_id: 'TEXT', message_id: 'TEXT', channel_id: 'TEXT', star_message_id: 'TEXT', stars: 'INTEGER' },
    pk: ['guild_id', 'message_id'],
    defaults: { stars: 0 },
  },
  notes: {
    auto: true,
    cols: { guild_id: 'TEXT', user_id: 'TEXT', mod_id: 'TEXT', note: 'TEXT', created_at: 'INTEGER' },
    indexes: [['guild_id', 'user_id']],
  },
  shop: {
    auto: true,
    cols: { guild_id: 'TEXT', name: 'TEXT', price: 'INTEGER', role_id: 'TEXT' },
    indexes: [['guild_id']],
  },
  stickies: {
    cols: { guild_id: 'TEXT', channel_id: 'TEXT', content: 'TEXT', last_message_id: 'TEXT' },
    pk: ['guild_id', 'channel_id'],
  },
  temp_voice: {
    cols: { channel_id: 'TEXT', guild_id: 'TEXT', owner_id: 'TEXT' },
    pk: ['channel_id'],
  },
  suggestions: {
    auto: true,
    cols: {
      guild_id: 'TEXT', channel_id: 'TEXT', message_id: 'TEXT', user_id: 'TEXT',
      content: 'TEXT', status: 'TEXT',
    },
    defaults: { status: 'bekliyor' },
    indexes: [['message_id']],
  },
};
