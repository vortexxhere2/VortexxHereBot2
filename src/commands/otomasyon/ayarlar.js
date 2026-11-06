const { ChannelType, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { col, settings } = require('../../db');
const cmd = require('../../utils/builder');
const embeds = require('../../utils/embeds');
const youtube = require('../../services/youtube');
const { FEATURES } = require('../../services/automod');
const { welcomeDefault } = require('../../config');

const E = MessageFlags.Ephemeral;
const TEXT = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const chOpt = (name, desc, required = true) => (o) => o.setName(name).setDescription(desc).setRequired(required).addChannelTypes(...TEXT);

// "kapat" komutunun kaldırabildiği ayarlar
const CLEARABLE = {
  duyuru: ['announce_channel', 'announce_ping'],
  youtube: ['yt_channel_id', 'yt_last_video', 'yt_last_published'],
  hosgeldin: ['welcome_channel', 'welcome_message'],
  gorusuruz: ['goodbye_channel'],
  log: ['log_channel'],
  seviyekanal: ['level_channel'],
  otorol: ['autorole'],
  oneri: ['suggestion_channel'],
  ticketlog: ['ticket_log'],
};

const automodChoices = [...Object.entries(FEATURES).map(([value, name]) => ({ name, value })), { name: '🔥 Hepsi', value: 'hepsi' }];

module.exports = [
  // =============== /ayarla ===============
  {
    data: cmd()
      .setName('ayarla')
      .setDescription('Botun tüm sunucu ayarlarını yapar')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) =>
        s
          .setName('duyuru')
          .setDescription('Yeni video duyurusunun atılacağı kanal ve ping rolü')
          .addChannelOption(chOpt('kanal', 'Duyuru kanalı'))
          .addRoleOption((o) => o.setName('rol').setDescription('Etiketlenecek rol (@everyone seçebilirsin)')),
      )
      .addSubcommand((s) =>
        s
          .setName('youtube')
          .setDescription('Takip edilecek YouTube kanalı')
          .addStringOption((o) => o.setName('kanal').setDescription('Kanal linki, @kullaniciadi veya UC... ID').setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('hosgeldin')
          .setDescription('Hoş geldin kartı kanalı')
          .addChannelOption(chOpt('kanal', 'Kanal'))
          .addStringOption((o) => o.setName('mesaj').setDescription('Özel mesaj: {user} {username} {server} {count}').setMaxLength(500)),
      )
      .addSubcommand((s) => s.setName('gorusuruz').setDescription('Ayrılan üye mesajı kanalı').addChannelOption(chOpt('kanal', 'Kanal')))
      .addSubcommand((s) => s.setName('log').setDescription('Log kanalı (moderasyon, mesaj, giriş/çıkış)').addChannelOption(chOpt('kanal', 'Kanal')))
      .addSubcommand((s) => s.setName('seviyekanal').setDescription('Seviye atlama mesajı kanalı').addChannelOption(chOpt('kanal', 'Kanal')))
      .addSubcommand((s) => s.setName('oneri').setDescription('Öneri kanalı').addChannelOption(chOpt('kanal', 'Kanal')))
      .addSubcommand((s) =>
        s.setName('otorol').setDescription('Yeni üyelere verilecek rol').addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('ticket')
          .setDescription('Ticket sistemi ayarları')
          .addRoleOption((o) => o.setName('yetkili').setDescription('Ticketlara bakacak yetkili rolü').setRequired(true))
          .addChannelOption((o) => o.setName('kategori').setDescription('Ticket kanallarının açılacağı kategori').addChannelTypes(ChannelType.GuildCategory))
          .addChannelOption(chOpt('log', 'Ticket kayıtlarının gönderileceği kanal', false)),
      )
      .addSubcommand((s) =>
        s
          .setName('kapat')
          .setDescription('Bir özelliği kapatır / ayarını siler')
          .addStringOption((o) =>
            o.setName('ozellik').setDescription('Özellik').setRequired(true).addChoices(...Object.keys(CLEARABLE).map((k) => ({ name: k, value: k }))),
          ),
      )
      .addSubcommand((s) => s.setName('goster').setDescription('Mevcut ayarları gösterir')),

    async execute(i) {
      const sub = i.options.getSubcommand();
      const g = i.guildId;

      if (sub === 'duyuru') {
        const ch = i.options.getChannel('kanal');
        const role = i.options.getRole('rol');
        settings.set(g, 'announce_channel', ch.id);
        if (role) settings.set(g, 'announce_ping', role.id === g ? '@everyone' : `<@&${role.id}>`);
        else settings.del(g, 'announce_ping');
        const warn = settings.get(g, 'yt_channel_id') ? '' : '\n⚠️ Şimdi `/ayarla youtube` ile YouTube kanalını da bağla.';
        return i.reply({ embeds: [embeds.success(`Duyuru kanalı: ${ch}${role ? `\nPing: ${role.id === g ? '@everyone' : role}` : ''}${warn}`)] });
      }

      if (sub === 'youtube') {
        await i.deferReply();
        const id = await youtube.resolveChannelId(i.options.getString('kanal'));
        if (!id) return i.editReply({ embeds: [embeds.error('Kanal bulunamadı. Kanal linkini, `@kullaniciadi` ya da `UC...` ID\'sini yaz.')] });
        let feed;
        try {
          feed = await youtube.fetchFeed(id);
        } catch {
          return i.editReply({ embeds: [embeds.error('Bu kanalın video akışı okunamadı. ID\'yi kontrol et.')] });
        }
        settings.set(g, 'yt_channel_id', id);
        // Eski videoları duyurmamak için son videoyu işaretle
        const newest = feed.videos.reduce((a, b) => (!a || b.published > a.published ? b : a), null);
        if (newest) {
          settings.set(g, 'yt_last_video', newest.id);
          settings.set(g, 'yt_last_published', newest.published);
        } else {
          // Kanalda henüz video yok: ilk yüklenecek video duyurulabilsin
          settings.set(g, 'yt_last_video', 'none');
          settings.set(g, 'yt_last_published', Date.now());
        }
        const warn = settings.get(g, 'announce_channel') ? '' : '\n⚠️ Duyuru kanalı yok! `/ayarla duyuru` ile ayarla.';
        return i.editReply({
          embeds: [embeds.success(`**${feed.channelTitle}** takip ediliyor.\nSon video: ${newest ? `[${newest.title}](${newest.link})` : '—'}\nBundan sonra yüklenen videolar otomatik duyurulacak.${warn}`)],
        });
      }

      if (sub === 'hosgeldin') {
        const ch = i.options.getChannel('kanal');
        settings.set(g, 'welcome_channel', ch.id);
        const msg = i.options.getString('mesaj');
        if (msg) settings.set(g, 'welcome_message', msg);
        return i.reply({ embeds: [embeds.success(`Hoş geldin kanalı: ${ch}`)] });
      }

      const simple = { gorusuruz: 'goodbye_channel', log: 'log_channel', seviyekanal: 'level_channel', oneri: 'suggestion_channel' };
      if (simple[sub]) {
        const ch = i.options.getChannel('kanal');
        settings.set(g, simple[sub], ch.id);
        return i.reply({ embeds: [embeds.success(`Ayarlandı: ${ch}`)] });
      }

      if (sub === 'otorol') {
        const role = i.options.getRole('rol');
        if (role.managed || !role.editable) return i.reply({ embeds: [embeds.error('Bu rolü veremem. Bot rolünü bu rolün üstüne taşı.')], flags: E });
        settings.set(g, 'autorole', role.id);
        return i.reply({ embeds: [embeds.success(`Yeni üyelere otomatik verilecek rol: ${role}`)] });
      }

      if (sub === 'ticket') {
        const role = i.options.getRole('yetkili');
        const cat = i.options.getChannel('kategori');
        const log = i.options.getChannel('log');
        settings.set(g, 'ticket_staff_role', role.id);
        if (cat) settings.set(g, 'ticket_category', cat.id);
        if (log) settings.set(g, 'ticket_log', log.id);
        return i.reply({ embeds: [embeds.success(`Ticket yetkili rolü: ${role}${cat ? `\nKategori: **${cat.name}**` : ''}${log ? `\nKayıt kanalı: ${log}` : ''}\nŞimdi \`/ticketpanel\` ile paneli gönder.`)] });
      }

      if (sub === 'kapat') {
        const key = i.options.getString('ozellik');
        for (const k of CLEARABLE[key]) settings.del(g, k);
        return i.reply({ embeds: [embeds.success(`**${key}** ayarı kaldırıldı.`)] });
      }

      // goster
      const s = settings.all(g);
      const ch = (k) => (s[k] ? `<#${s[k]}>` : '❌');
      const embed = new EmbedBuilder()
        .setColor(embeds.colors.main)
        .setTitle('⚙️ Sunucu Ayarları')
        .addFields(
          { name: '📺 YouTube kanalı', value: s.yt_channel_id ? `[${s.yt_channel_id}](https://www.youtube.com/channel/${s.yt_channel_id})` : '❌', inline: true },
          { name: '📢 Duyuru kanalı', value: `${ch('announce_channel')}${s.announce_ping ? ` • ${s.announce_ping}` : ''}`, inline: true },
          { name: '👋 Hoş geldin', value: ch('welcome_channel'), inline: true },
          { name: '🚪 Görüşürüz', value: ch('goodbye_channel'), inline: true },
          { name: '📜 Log', value: ch('log_channel'), inline: true },
          { name: '📈 Seviye kanalı', value: s.level_channel ? ch('level_channel') : 'Mesajın yazıldığı kanal', inline: true },
          { name: '💡 Öneri', value: s.suggestion_channel ? ch('suggestion_channel') : 'Komutun kullanıldığı kanal', inline: true },
          { name: '🎭 Otorol', value: s.autorole ? `<@&${s.autorole}>` : '❌', inline: true },
          { name: '🎫 Ticket yetkili', value: s.ticket_staff_role ? `<@&${s.ticket_staff_role}>` : '❌', inline: true },
          { name: '🛡️ AutoMod', value: Object.keys(FEATURES).map((k) => `${s[`automod_${k}`] === '1' ? '🟢' : '🔴'} ${k}`).join(' • ') },
        );
      return i.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    },
  },

  // =============== /automod ===============
  {
    data: cmd()
      .setName('automod')
      .setDescription('Otomatik moderasyon ayarları')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('durum').setDescription('AutoMod özelliklerinin durumunu gösterir'))
      .addSubcommand((s) =>
        s
          .setName('ac')
          .setDescription('Bir AutoMod özelliğini açar')
          .addStringOption((o) => o.setName('ozellik').setDescription('Özellik').setRequired(true).addChoices(...automodChoices)),
      )
      .addSubcommand((s) =>
        s
          .setName('kapat')
          .setDescription('Bir AutoMod özelliğini kapatır')
          .addStringOption((o) => o.setName('ozellik').setDescription('Özellik').setRequired(true).addChoices(...automodChoices)),
      )
      .addSubcommandGroup((gr) =>
        gr
          .setName('kelime')
          .setDescription('Yasaklı kelime listesi')
          .addSubcommand((s) =>
            s.setName('ekle').setDescription('Yasaklı kelime ekler').addStringOption((o) => o.setName('kelime').setDescription('Kelime').setRequired(true).setMaxLength(50)),
          )
          .addSubcommand((s) =>
            s.setName('sil').setDescription('Yasaklı kelimeyi siler').addStringOption((o) => o.setName('kelime').setDescription('Kelime').setRequired(true)),
          )
          .addSubcommand((s) => s.setName('liste').setDescription('Yasaklı kelimeleri listeler (sadece sana görünür)')),
      ),
    async execute(i) {
      const g = i.guildId;
      const group = i.options.getSubcommandGroup(false);
      const sub = i.options.getSubcommand();

      if (group === 'kelime') {
        const word = i.options.getString('kelime')?.toLocaleLowerCase('tr').trim();
        if (sub === 'ekle') {
          await col('badwords').insert({ guild_id: g, word }, { ignore: true });
          return i.reply({ embeds: [embeds.success('Kelime eklendi. (Filtre açık değilse `/automod ac ozellik:Küfür` ile aç.)')], flags: E });
        }
        if (sub === 'sil') {
          const removed = await col('badwords').delete({ guild_id: g, word });
          return i.reply({ embeds: [removed ? embeds.success('Kelime silindi.') : embeds.error('Bu kelime listede yok.')], flags: E });
        }
        const words = (await col('badwords').find({ guild_id: g }, { sort: { word: 1 } })).map((r) => r.word);
        return i.reply({ embeds: [embeds.info(words.length ? words.join(', ').slice(0, 3900) : 'Liste boş.', '🚫 Yasaklı kelimeler')], flags: E });
      }

      if (sub === 'durum') {
        const lines = Object.entries(FEATURES).map(([k, d]) => `${settings.bool(g, `automod_${k}`) ? '🟢' : '🔴'} **${k}** — ${d}`);
        return i.reply({ embeds: [embeds.info(lines.join('\n'), '🛡️ AutoMod Durumu')] });
      }

      const key = i.options.getString('ozellik');
      const keys = key === 'hepsi' ? Object.keys(FEATURES) : [key];
      for (const k of keys) settings.set(g, `automod_${k}`, sub === 'ac' ? '1' : '0');
      return i.reply({ embeds: [embeds.success(`${key === 'hepsi' ? 'Tüm özellikler' : `**${key}**`} ${sub === 'ac' ? 'açıldı 🟢' : 'kapatıldı 🔴'}`)] });
    },
  },

  // =============== /youtube ===============
  {
    data: cmd()
      .setName('youtube')
      .setDescription('YouTube takip araçları')
      .addSubcommand((s) => s.setName('son').setDescription('Takip edilen kanalın son videosunu gösterir'))
      .addSubcommand((s) => s.setName('test').setDescription('(Yetkili) Son videoyu duyuru kanalına test olarak atar'))
      .addSubcommand((s) => s.setName('kontrol').setDescription('(Yetkili) Yeni video var mı hemen kontrol eder')),
    async execute(i) {
      const sub = i.options.getSubcommand();
      const channelId = settings.get(i.guildId, 'yt_channel_id');
      if (!channelId) return i.reply({ embeds: [embeds.error('YouTube kanalı ayarlı değil. Yetkililer `/ayarla youtube` kullanmalı.')], flags: E });

      if (sub !== 'son' && !i.memberPermissions.has(PermissionFlagsBits.ManageGuild))
        return i.reply({ embeds: [embeds.error('Bu alt komut için **Sunucuyu Yönet** yetkisi gerekir.')], flags: E });

      await i.deferReply({ flags: sub === 'son' ? undefined : E });
      const feed = await youtube.fetchFeed(channelId).catch(() => null);
      if (!feed?.videos.length) return i.editReply({ embeds: [embeds.error('Video akışı okunamadı.')] });
      const latest = feed.videos.reduce((a, b) => (b.published > a.published ? b : a));

      if (sub === 'son') return i.editReply(youtube.buildAnnouncement(latest, feed.channelTitle, ''));

      if (sub === 'test') {
        const ok = await youtube.announce(i.guild, latest, feed.channelTitle).catch(() => false);
        return i.editReply({ embeds: [ok ? embeds.success('Test duyurusu gönderildi.') : embeds.error('Duyuru kanalı ayarlı değil ya da yazma yetkim yok.')] });
      }

      await youtube.checkGuild(i.guild);
      return i.editReply({ embeds: [embeds.success('Kontrol tamamlandı. Yeni video varsa duyuruldu.')] });
    },
  },
];
