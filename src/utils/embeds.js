const { EmbedBuilder } = require('discord.js');
const { colors } = require('../config');

const make = (color, description, title) => {
  const e = new EmbedBuilder().setColor(color).setDescription(description);
  if (title) e.setTitle(title);
  return e;
};

module.exports = {
  colors,
  base: (title, description) => make(colors.main, description, title),
  success: (d, t) => make(colors.success, `✅ ${d}`, t),
  error: (d, t) => make(colors.error, `❌ ${d}`, t),
  warn: (d, t) => make(colors.warn, `⚠️ ${d}`, t),
  info: (d, t) => make(colors.info, d, t),
};
