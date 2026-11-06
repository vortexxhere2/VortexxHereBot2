const Parser = require('rss-parser');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { settings } = require('../db');
const { colors } = require('../config');

const parser = new Parser({
  timeout: 15000,
  customFields: { item: [['yt:videoId', 'videoId']] },
});
const feedUrl = (id) => `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;

// Kanal ID (UC...), kanal linki veya @handle kabul eder → UC... ID döner (bulunamazsa null)
async function resolveChannelId(input) {
  const text = String(input).trim();
  const direct = text.match(/UC[\w-]{22}/);
  if (direct) return direct[0];

  let url = text;
  if (/^@/.test(text)) url = `https://www.youtube.com/${text}`;
  else if (!/^https?:\/\//i.test(text)) url = `https://www.youtube.com/@${text}`;

  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const m =
      html.match(/"channelId":"(UC[\w-]{22})"/) ||
      html.match(/<meta itemprop="identifier" content="(UC[\w-]{22})"/) ||
      html.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// RSS'den kanal başlığı ve videoları (yeniden eskiye) getir
async function fetchFeed(channelId) {
  const res = await fetch(feedUrl(channelId));
  if (!res.ok) throw new Error(`YouTube akışı okunamadı (HTTP ${res.status})`);
  const feed = await parser.parseString(await res.text());
  const videos = (feed.items || []).map((i) => ({
    id: i.videoId || (i.id || '').replace('yt:video:', ''),
    title: i.title,
    link: i.link,
    author: i.author || feed.title,
    published: new Date(i.pubDate || i.isoDate || Date.now()).getTime(),
  }));
  return { channelTitle: feed.title, videos };
}

function buildAnnouncement(video, channelTitle, pingText) {
  const embed = new EmbedBuilder()
    .setColor(colors.main)
    .setAuthor({ name: channelTitle || video.author || 'YouTube' })
    .setTitle(video.title)
    .setURL(video.link)
    .setDescription('📺 **Yeni video yayında!** İzlemeyi, beğenmeyi ve yorum yapmayı unutma 💬')
    .setImage(`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`)
    .setTimestamp(video.published);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Videoyu İzle').setStyle(ButtonStyle.Link).setURL(video.link).setEmoji('▶️'),
  );
  const content = `${pingText ? pingText + ' ' : ''}🔔 **${channelTitle || video.author}** yeni bir video yükledi!`;
  return { content, embeds: [embed], components: [row], allowedMentions: { parse: ['roles', 'everyone'] } };
}

async function announce(guild, video, channelTitle) {
  const chId = settings.get(guild.id, 'announce_channel');
  const channel = chId && (guild.channels.cache.get(chId) || (await guild.channels.fetch(chId).catch(() => null)));
  if (!channel?.isTextBased()) return false;
  const ping = settings.get(guild.id, 'announce_ping', '');
  await channel.send(buildAnnouncement(video, channelTitle, ping));
  return true;
}

// Tek sunucuyu kontrol et
async function checkGuild(guild) {
  const channelId = settings.get(guild.id, 'yt_channel_id');
  if (!channelId || !settings.get(guild.id, 'announce_channel')) return;

  const { channelTitle, videos } = await fetchFeed(channelId);
  if (!videos.length) return;

  const lastPublished = Number(settings.get(guild.id, 'yt_last_published', 0));
  const lastId = settings.get(guild.id, 'yt_last_video');
  const newest = videos.reduce((a, b) => (b.published > a.published ? b : a));

  // İlk kurulum: eski videoları duyurma, sadece işaretle
  if (!lastId) {
    settings.set(guild.id, 'yt_last_video', newest.id);
    settings.set(guild.id, 'yt_last_published', newest.published);
    return;
  }

  const fresh = videos
    .filter((v) => v.published > lastPublished && v.id !== lastId)
    .sort((a, b) => a.published - b.published)
    .slice(-3); // en fazla 3 video (spam'i önlemek için)

  for (const v of fresh) {
    // Duyuru kanalına yazılamadıysa ilerletme: kanal düzelince bir sonraki kontrolde tekrar denenir
    if (!(await announce(guild, v, channelTitle))) break;
    settings.set(guild.id, 'yt_last_video', v.id);
    settings.set(guild.id, 'yt_last_published', v.published);
  }
}

async function checkAll(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      await checkGuild(guild);
    } catch (e) {
      console.error(`[youtube] ${guild.name}:`, e.message);
    }
  }
}

function start(client, minutes) {
  setTimeout(() => checkAll(client), 10_000);
  setInterval(() => checkAll(client), minutes * 60_000);
  console.log(`📺 YouTube kontrolü her ${minutes} dakikada bir yapılacak.`);
}

module.exports = { resolveChannelId, fetchFeed, announce, checkGuild, start, buildAnnouncement };
