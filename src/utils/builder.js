const { SlashCommandBuilder, InteractionContextType } = require('discord.js');

// Sadece sunucuda kullanılabilen bir slash komut oluşturucu
module.exports = () => new SlashCommandBuilder().setContexts(InteractionContextType.Guild);
