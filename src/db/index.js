// Veritabanı girişi. MONGODB_URI varsa MongoDB, yoksa SQLite (data/bot.db) kullanılır.
const spec = require('./schema');

let backend = null;

// Sunucu ayarları açılışta belleğe alınır → ayar okumaları anlık (senkron) olur, yazmalar veritabanına işlenir.
const cache = new Map(); // guildId -> Map(key -> value)
const bucket = (g) => {
  if (!cache.has(g)) cache.set(g, new Map());
  return cache.get(g);
};
const logErr = (what) => (e) => console.error(`[db] ${what}:`, e.message);

const settings = {
  get(guildId, key, def = null) {
    const v = bucket(guildId).get(key);
    return v === undefined ? def : v;
  },
  bool(guildId, key, def = false) {
    const v = this.get(guildId, key, null);
    return v === null ? def : v === '1';
  },
  set(guildId, key, value) {
    value = String(value);
    bucket(guildId).set(key, value);
    return backend
      .col('settings')
      .update({ guild_id: guildId, key }, { set: { value } }, { upsert: true })
      .catch(logErr('ayar yazılamadı'));
  },
  del(guildId, key) {
    bucket(guildId).delete(key);
    return backend.col('settings').delete({ guild_id: guildId, key }).catch(logErr('ayar silinemedi'));
  },
  all(guildId) {
    return Object.fromEntries(bucket(guildId));
  },
};

async function init() {
  backend = process.env.MONGODB_URI ? require('./mongo')(spec) : require('./sqlite')(spec);
  await backend.init();
  for (const r of await backend.col('settings').find({})) bucket(r.guild_id).set(r.key, r.value);
  return backend.kind;
}

module.exports = {
  init,
  settings,
  col(name) {
    if (!backend) throw new Error('Veritabanı henüz hazır değil (db.init çağrılmadı).');
    return backend.col(name);
  },
  get kind() {
    return backend?.kind;
  },
  close: () => backend?.close(),
};
