/* commands/musica/skip.js */

const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('./musicManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Pula a música que está a tocar.'),

    async execute(interaction) {
        const queue = getQueue(interaction.guild.id);
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Você precisa de estar num canal de voz!', ephemeral: true });
        }
        if (!queue.isPlaying || queue.songs.length === 0) {
            return interaction.reply({ content: '❌ Não há nenhuma música a tocar para pular!', ephemeral: true });
        }
        if (voiceChannel.id !== queue.voiceChannel.id) {
            return interaction.reply({ content: '❌ Você precisa de estar no mesmo canal de voz que o bot!', ephemeral: true });
        }

        // Para o player. O evento 'Idle' no musicManager.js vai tratar de
        // tocar a próxima música automaticamente.
        queue.player.stop();
        
        await interaction.reply('⏭️ Música pulada!');
    },
};