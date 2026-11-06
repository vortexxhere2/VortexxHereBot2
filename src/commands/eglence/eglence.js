const { EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const cmd = require('../../utils/builder');
const embeds = require('../../utils/embeds');
const { loveCard } = require('../../utils/canvas');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const EIGHT = [
  'Kesinlikle evet! ✅', 'Bence de öyle.', 'Hiç şüphen olmasın.', 'Büyük ihtimalle evet.', 'İşaretler olumlu görünüyor.',
  'Şu an net söyleyemem, tekrar sor.', 'Daha sonra tekrar dene.', 'Şimdi söylemesem daha iyi 🤐',
  'Hiç sanmıyorum.', 'Cevabım hayır. ❌', 'Kaynaklarım hayır diyor.', 'Çok şüpheli.',
];
const JOKES = [
  'Adamın biri çok yorulmuş, yatağa yatmış… Yatak: "Sonunda biri de beni anladı."',
  'Temel, bilgisayarına şifre koymuş: "Temel123". Fıkra bitti, şifre de bitti. 😅',
  'Bilgisayar neden doktora gitmiş? Çünkü virüs kapmış!',
  'Youtuber neden hiç kaybolmaz? Çünkü hep "abone ol" tabelası var!',
  'Neden YouTuber\'lar iyi ressamdır? Her videoda "kanalıma bakın" diye çizim yaparlar.',
  'Yazılımcıya "Bir çay alır mısın?" demişler. "Hangi sürüm?" demiş.',
  'Matematik kitabı neden üzgün? Çok fazla problemi var.',
  'İnternet gitmiş, sinirlerim de onunla gitmiş. Neyse ki ikisi de geri geldi.',
  'Kedi neden bilgisayar başında oturur? Fareyi yakalamak için!',
  'Patron: "Yarın erken gel!" Çalışan: "Zaten bugün çok geç çıktım, aynı gün sayılır."',
];
const TRUTH = ['En utandığın an neydi?', 'Gizli bir yeteneğin ne?', 'En son kimden hoşlandın?', 'Hiç yalan söylediğin için pişman oldun mu?', 'En komik YouTube anın ne?', 'Telefonundaki en son aramaların kimdi?', 'En büyük korkun nedir?'];
const DARE = ['Sesli kanalda 30 saniye şarkı söyle.', 'Profil fotoğrafını 1 saat komik bir şeyle değiştir.', 'Sohbette bir kişiye iltifat et.', 'Son izlediğin videoyu anlat.', 'Sunucuda 5 dakika sadece emoji ile konuş.', 'İlk aklına gelen espriyi yap.'];

function loveMessage(p) {
  if (p >= 90) return '💞 Mükemmel uyum! Evlilik vakti!';
  if (p >= 70) return '💖 Harika bir çift olursunuz!';
  if (p >= 50) return '💘 Fena değil, biraz çaba ile olur!';
  if (p >= 30) return '💔 Zor ama imkânsız değil...';
  return '🧊 Aranız pek iyi görünmüyor...';
}

module.exports = [
  {
    data: cmd()
      .setName('ask')
      .setDescription('İki kişi arasındaki aşk uyumunu ölçer 💘')
      .addUserOption((o) => o.setName('kisi1').setDescription('Birinci kişi').setRequired(true))
      .addUserOption((o) => o.setName('kisi2').setDescription('İkinci kişi (boş bırakırsan sen)')),
    async execute(i) {
      await i.deferReply();
      const a = i.options.getUser('kisi1');
      const b = i.options.getUser('kisi2') || i.user;
      // Aynı çift her zaman aynı sonucu alsın
      const percent = a.id === b.id ? 100 : Number((BigInt(a.id) + BigInt(b.id)) % 101n);
      const img = await loveCard({
        name1: a.username,
        avatar1: a.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
        name2: b.username,
        avatar2: b.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
        percent,
      });
      await i.editReply({
        content: `**${a.username}** 💘 **${b.username}**\n${a.id === b.id ? '😂 Kendini çok seviyorsun!' : loveMessage(percent)}`,
        files: [new AttachmentBuilder(img, { name: 'ask.png' })],
      });
    },
  },
  {
    data: cmd()
      .setName('sor')
      .setDescription('Sihirli 8 topa soru sor 🎱')
      .addStringOption((o) => o.setName('soru').setDescription('Sorun').setRequired(true)),
    async execute(i) {
      await i.reply({ embeds: [new EmbedBuilder().setColor(embeds.colors.main).addFields({ name: '❓ Soru', value: i.options.getString('soru') }, { name: '🎱 Cevap', value: pick(EIGHT) })] });
    },
  },
  {
    data: cmd().setName('espri').setDescription('Rastgele bir espri yapar 😄'),
    async execute(i) {
      await i.reply({ embeds: [embeds.base('😄 Espri', pick(JOKES))] });
    },
  },
  {
    data: cmd().setName('yazitura').setDescription('Yazı tura atar 🪙'),
    async execute(i) {
      await i.reply(`🪙 Sonuç: **${Math.random() < 0.5 ? 'YAZI' : 'TURA'}**`);
    },
  },
  {
    data: cmd()
      .setName('zar')
      .setDescription('Zar atar 🎲')
      .addIntegerOption((o) => o.setName('yuz').setDescription('Zarın yüz sayısı (varsayılan 6)').setMinValue(2).setMaxValue(1000)),
    async execute(i) {
      const n = i.options.getInteger('yuz') || 6;
      await i.reply(`🎲 **d${n}** zar: **${Math.floor(Math.random() * n) + 1}**`);
    },
  },
  {
    data: cmd()
      .setName('secim')
      .setDescription('Virgülle ayrılmış seçenekler arasından biri seçer')
      .addStringOption((o) => o.setName('secenekler').setDescription('Örn: pizza, hamburger, döner').setRequired(true)),
    async execute(i) {
      const list = i.options.getString('secenekler').split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length < 2) return i.reply({ embeds: [embeds.error('En az 2 seçenek yaz (virgülle ayır).')], flags: MessageFlags.Ephemeral });
      await i.reply(`🤔 Benim seçimim: **${pick(list)}**`);
    },
  },
  {
    data: cmd()
      .setName('tkm')
      .setDescription('Bota karşı taş-kağıt-makas oyna ✊✋✌️')
      .addStringOption((o) =>
        o.setName('hamle').setDescription('Hamlen').setRequired(true).addChoices(
          { name: '✊ Taş', value: 'tas' },
          { name: '✋ Kağıt', value: 'kagit' },
          { name: '✌️ Makas', value: 'makas' },
        ),
      ),
    async execute(i) {
      const names = { tas: '✊ Taş', kagit: '✋ Kağıt', makas: '✌️ Makas' };
      const beats = { tas: 'makas', kagit: 'tas', makas: 'kagit' };
      const me = i.options.getString('hamle');
      const bot = pick(Object.keys(names));
      const result = me === bot ? '🤝 Berabere!' : beats[me] === bot ? '🎉 Sen kazandın!' : '😎 Ben kazandım!';
      await i.reply(`Sen: **${names[me]}** • Ben: **${names[bot]}**\n${result}`);
    },
  },
  {
    data: cmd()
      .setName('iq')
      .setDescription('IQ seviyeni ölçer 🧠 (eğlence amaçlı)')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş bırakırsan sen)')),
    async execute(i) {
      const u = i.options.getUser('kullanici') || i.user;
      const iq = 70 + Number(BigInt(u.id) % 71n);
      await i.reply(`🧠 **${u.username}** kullanıcısının IQ'su: **${iq}**`);
    },
  },
  {
    data: cmd()
      .setName('dc')
      .setDescription('Doğruluk mu cesaret mi? 😈')
      .addStringOption((o) =>
        o.setName('tur').setDescription('Doğruluk ya da cesaret').setRequired(true).addChoices(
          { name: 'Doğruluk', value: 'dogruluk' },
          { name: 'Cesaret', value: 'cesaret' },
        ),
      ),
    async execute(i) {
      const t = i.options.getString('tur');
      await i.reply({ embeds: [embeds.base(t === 'dogruluk' ? '🤫 Doğruluk' : '😈 Cesaret', pick(t === 'dogruluk' ? TRUTH : DARE))] });
    },
  },
];
