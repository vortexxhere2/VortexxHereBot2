// MongoDB arka ucu (resmi `mongodb` sürücüsü). MONGODB_URI tanımlıysa kullanılır.
const NO_ID = { projection: { _id: 0 } };

function createMongo(spec) {
  let client;
  let db;

  const need = (name) => {
    if (!spec[name]) throw new Error(`Bilinmeyen koleksiyon: ${name}`);
    return spec[name];
  };

  async function nextId(name) {
    const r = await db.collection('_counters').findOneAndUpdate(
      { _id: name },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    const doc = r && Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : r; // sürücü sürümlerine uyum
    return doc.seq;
  }

  function collection(name) {
    const s = need(name);
    const c = () => db.collection(name);
    return {
      async find(filter = {}, { sort, limit, skip } = {}) {
        const opts = { ...NO_ID };
        if (sort) opts.sort = sort;
        if (limit) opts.limit = limit;
        if (skip) opts.skip = skip;
        return c().find(filter, opts).toArray();
      },
      async findOne(filter = {}, { sort } = {}) {
        return (await c().findOne(filter, sort ? { ...NO_ID, sort } : NO_ID)) || null;
      },
      async count(filter = {}) {
        return c().countDocuments(filter);
      },
      // Döner: { inserted: bool, id }
      async insert(doc, { ignore = false } = {}) {
        const d = { ...s.defaults, ...doc };
        if (s.auto) d.id = await nextId(name);
        try {
          await c().insertOne(d);
          return { inserted: true, id: s.auto ? d.id : undefined };
        } catch (e) {
          if (e && e.code === 11000 && ignore) return { inserted: false };
          throw e;
        }
      },
      // update(filter, { set, inc }, { upsert }) → etkilenen kayıt sayısı
      async update(filter, { set = {}, inc = {} } = {}, { upsert = false } = {}) {
        if (!Object.keys(set).length && !Object.keys(inc).length) return 0;
        const update = {};
        if (Object.keys(set).length) update.$set = set;
        if (Object.keys(inc).length) update.$inc = inc;
        if (upsert) {
          // Yeni kayıt oluşursa eksik alanlara varsayılan değer ver
          const taken = new Set([...Object.keys(filter), ...Object.keys(set), ...Object.keys(inc)]);
          const onInsert = {};
          for (const [k, v] of Object.entries(s.defaults || {})) if (!taken.has(k)) onInsert[k] = v;
          if (Object.keys(onInsert).length) update.$setOnInsert = onInsert;
        }
        const run = () => (upsert ? c().updateOne(filter, update, { upsert: true }) : c().updateMany(filter, update));
        let r;
        try {
          r = await run();
        } catch (e) {
          if (upsert && e && e.code === 11000) r = await run(); // aynı anda oluşturma yarışı → bir kez daha dene
          else throw e;
        }
        return (r.matchedCount || 0) + (r.upsertedCount || 0);
      },
      async delete(filter = {}) {
        return (await c().deleteMany(filter)).deletedCount || 0;
      },
    };
  }

  return {
    kind: 'MongoDB',
    async init() {
      const { MongoClient } = require('mongodb');
      client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
      await client.connect();
      db = client.db(process.env.MONGODB_DB || 'ytbot');
      for (const [name, s] of Object.entries(spec)) {
        const c = db.collection(name);
        if (s.pk) await c.createIndex(Object.fromEntries(s.pk.map((k) => [k, 1])), { unique: true });
        if (s.auto) await c.createIndex({ id: 1 }, { unique: true });
        for (const cols of s.indexes || []) await c.createIndex(Object.fromEntries(cols.map((k) => [k, 1])));
      }
    },
    col: collection,
    async close() { await client?.close(); },
  };
}

module.exports = createMongo;
