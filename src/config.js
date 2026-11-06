module.exports = {
  guildId: process.env.GUILD_ID || null,
  ytCheckMinutes: Number(process.env.YT_CHECK_MINUTES) || 5,

  colors: {
    main: 0xff0033, // YouTube kırmızısı
    success: 0x2ecc71,
    error: 0xe74c3c,
    warn: 0xf1c40f,
    info: 0x3498db,
  },

  xp: {
    min: 15,
    max: 25,
    cooldownMs: 60_000,
    voicePerMinute: 10,
  },

  // Ticket kategorileri (select menüde görünür)
  ticketCategories: [
    { value: 'destek', label: 'Genel Destek', emoji: '🛠️', description: 'Sorun ya da sorularınız için' },
    { value: 'isbirligi', label: 'İş Birliği / Reklam', emoji: '🤝', description: 'Sponsorluk ve iş birliği teklifleri' },
    { value: 'sikayet', label: 'Şikayet / Bildirim', emoji: '🚨', description: 'Kullanıcı ya da içerik bildirimi' },
    { value: 'diger', label: 'Diğer', emoji: '📩', description: 'Başka bir konu' },
  ],

  // Link engeli açıkken izin verilen alan adları
  allowedDomains: ['youtube.com', 'youtu.be', 'tenor.com', 'giphy.com', 'discord.com', 'imgur.com'],

  // Otomatik uyarı kademeleri
  warnEscalation: [
    { count: 3, timeoutMs: 60 * 60 * 1000, label: '1 saat' },
    { count: 5, timeoutMs: 24 * 60 * 60 * 1000, label: '24 saat' },
  ],

  welcomeDefault: 'Hoş geldin {user}! **{server}** ailesine katıldın 🎉 Seninle birlikte {count} kişiyiz.',
  goodbyeDefault: '**{username}** aramızdan ayrıldı. 👋',
};
