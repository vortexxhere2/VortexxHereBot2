const fs = require('fs');
const path = require('path');

const OPS = { $lt: '<', $lte: '<=', $gt: '>', $gte: '>=', $ne: '!=' };

function createSqlite(spec) {
  let db;

  const colsOf = (name) => {
    const s = spec[name];
    if (!s) throw new Error(`Bilinmeyen koleksiyon: ${name}`);
    return s.auto ? { id: 'INTEGER', ...s.cols } : s.cols;
  };
  const checkCol = (table, c) => {
    if (!(c in colsOf(table))) throw new Error(`${table}.${c} sütunu yok`);
    return c;
  };
  const clean = (v) => (v === undefined ? null : v);

  function where(table, filter = {}) {
    const parts = [];
    const args = [];
    for (const [k, v] of Object.entries(filter)) {
      checkCol(table, k);
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        for (const [op, val] of Object.entries(v)) {
          if (op === '$in') {
            if (!val.length) { parts.push('0'); continue; }
            parts.push(`${k} IN (${val.map(() => '?').join(',')})`);
            args.push(...val);
          } else if (OPS[op]) {
            parts.push(`${k} ${OPS[op]} ?`);
            args.push(clean(val));
          } else throw new Error(`Desteklenmeyen operatör: ${op}`);
        }
      } else if (v === null) parts.push(`${k} IS NULL`);
      else { parts.push(`${k} = ?`); args.push(v); }
    }
    return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', args };
  }

  function createTables() {
    for (const [name, s] of Object.entries(spec)) {
      const defs = [];
      if (s.auto) defs.push('id INTEGER PRIMARY KEY AUTOINCREMENT');
      for (const [c, type] of Object.entries(s.cols)) {
        const d = s.defaults && c in s.defaults ? ` DEFAULT ${typeof s.defaults[c] === 'number' ? s.defaults[c] : `'${s.defaults[c]}'`}` : '';
        defs.push(`${c} ${type}${d}`);
      }
      if (s.pk) defs.push(`PRIMARY KEY (${s.pk.join(', ')})`);
      db.exec(`CREATE TABLE IF NOT EXISTS ${name} (${defs.join(', ')})`);

      // Eski veritabanlarında eksik sütun varsa ekle
      const existing = new Set(db.prepare(`PRAGMA table_info(${name})`).all().map((r) => r.name));
      for (const [c, type] of Object.entries(s.cols)) {
        if (existing.has(c)) continue;
        const dv = s.defaults && c in s.defaults ? ` DEFAULT ${typeof s.defaults[c] === 'number' ? s.defaults[c] : `'${s.defaults[c]}'`}` : '';
        db.exec(`ALTER TABLE ${name} ADD COLUMN ${c} ${type}${dv}`);
      }
      (s.indexes || []).forEach((cols, n) =>
        db.exec(`CREATE INDEX IF NOT EXISTS idx_${name}_${n} ON ${name} (${cols.join(', ')})`),
      );
    }
  }

  function collection(table) {
    colsOf(table);
    return {
      async find(filter, { sort, limit, skip } = {}) {
        const w = where(table, filter);
        let sql = `SELECT * FROM ${table} ${w.sql}`;
        if (sort) {
          sql += ' ORDER BY ' + Object.entries(sort).map(([c, d]) => `${checkCol(table, c)} ${d < 0 ? 'DESC' : 'ASC'}`).join(', ');
        }
        const args = [...w.args];
        if (limit || skip) { sql += ' LIMIT ? OFFSET ?'; args.push(limit || -1, skip || 0); }
        return db.prepare(sql).all(...args).map((r) => ({ ...r }));
      },
      async findOne(filter, opts = {}) {
        const rows = await this.find(filter, { ...opts, limit: 1 });
        return rows[0] || null;
      },
      async count(filter) {
        const w = where(table, filter);
        return Number(db.prepare(`SELECT COUNT(*) AS c FROM ${table} ${w.sql}`).get(...w.args).c);
      },
      // Döner: { inserted: bool, id }
      async insert(doc, { ignore = false } = {}) {
        const keys = Object.keys(doc).map((k) => checkCol(table, k));
        const sql = `INSERT ${ignore ? 'OR IGNORE ' : ''}INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
        const r = db.prepare(sql).run(...keys.map((k) => clean(doc[k])));
        return { inserted: Number(r.changes) > 0, id: spec[table].auto ? Number(r.lastInsertRowid) : undefined };
      },
      // update(filter, { set, inc }, { upsert }) → etkilenen kayıt sayısı
      async update(filter, { set = {}, inc = {} } = {}, { upsert = false } = {}) {
        const sets = [];
        const sargs = [];
        for (const [k, v] of Object.entries(set)) { sets.push(`${checkCol(table, k)} = ?`); sargs.push(clean(v)); }
        for (const [k, v] of Object.entries(inc)) { sets.push(`${checkCol(table, k)} = COALESCE(${k}, 0) + ?`); sargs.push(v); }
        if (!sets.length) return 0;
        const w = where(table, filter);
        const r = db.prepare(`UPDATE ${table} SET ${sets.join(', ')} ${w.sql}`).run(...sargs, ...w.args);
        if (Number(r.changes) > 0 || !upsert) return Number(r.changes);
        const base = {};
        for (const [k, v] of Object.entries(filter)) if (v === null || typeof v !== 'object') base[k] = v;
        const doc = { ...base, ...set };
        for (const [k, v] of Object.entries(inc)) doc[k] = (spec[table].defaults?.[k] ?? 0) + v;
        await this.insert(doc);
        return 1;
      },
      async delete(filter) {
        const w = where(table, filter);
        return Number(db.prepare(`DELETE FROM ${table} ${w.sql}`).run(...w.args).changes);
      },
    };
  }

  return {
    kind: 'SQLite',
    async init() {
      const Database = require('better-sqlite3');
      const dir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
      fs.mkdirSync(dir, { recursive: true });
      db = new Database(path.join(dir, 'bot.db'));
      db.pragma('journal_mode = WAL');
      createTables();
    },
    col: collection,
    async close() { db?.close?.(); },
  };
}

module.exports = createSqlite;
