const { col } = require('../db');
const { endGiveaway } = require('./giveaway');

// Her 15 saniyede: biten çekilişler, hatırlatıcılar, süreli banların kalkması
async function tick(client) {
  const now = Date.now();

  for (const g of await col('giveaways').find({ ended: 0, end_at: { $lte: now } })) {
    await endGiveaway(client, g).catch((e) => console.error('[çekiliş]', e.message));
  }

  for (const r of await col('reminders').find({ done: 0, remind_at: { $lte: now } })) {
    await col('reminders').update({ id: r.id }, { set: { done: 1 } });
    const text = `⏰ <@${r.user_id}> hatırlatma: **${r.message}**`;
    const ch = await client.channels.fetch(r.channel_id).catch(() => null);
    const sent = ch?.isTextBased()
      ? await ch.send({ content: text, allowedMentions: { users: [r.user_id] } }).catch(() => null)
      : null;
    if (!sent) {
      const u = await client.users.fetch(r.user_id).catch(() => null);
      await u?.send(text).catch(() => {});
    }
  }

  for (const b of await col('tempbans').find({ unban_at: { $lte: now } })) {
    await col('tempbans').delete({ guild_id: b.guild_id, user_id: b.user_id });
    const guild = client.guilds.cache.get(b.guild_id);
    await guild?.members.unban(b.user_id, 'Süreli ban doldu').catch(() => {});
  }
}

function start(client) {
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await tick(client);
    } catch (e) {
      console.error('[scheduler]', e);
    } finally {
      running = false;
    }
  }, 15_000);
}

module.exports = { start };
