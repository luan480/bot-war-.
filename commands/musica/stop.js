/* commands/musica/stop.js */

const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('./musicManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Para a música e limpa a fila.'),

    async execute(interaction) {
        const queue = getQueue(interaction.guild.id);
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Você precisa de estar num canal de voz!', ephemeral: true });
        }
        if (!queue.connection) {
            return interaction.reply({ content: '❌ O bot não está em nenhum canal de voz!', ephemeral: true });
        }
        if (voiceChannel.id !== queue.voiceChannel.id) {
            return interaction.reply({ content: '❌ Você precisa de estar no mesmo canal de voz que o bot!', ephemeral: true });
        }

        // Limpa a fila
        queue.songs = [];
        // Para o player
        queue.player.stop();
        // Destrói a conexão
        queue.connection.destroy();
        
        // O Map 'queues' no musicManager.js vai ser limpo
        // automaticamente pelo evento 'Disconnected' ou pelo 'setTimeout' de 5 min.

        await interaction.reply('⏹️ Fila limpa e bot desconectado.');
    },
};