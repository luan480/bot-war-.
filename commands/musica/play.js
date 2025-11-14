/* commands/musica/play.js (ATUALIZADO) */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const play = require('play-dl');
const { getQueue, joinChannel, playNextSong } = require('./musicManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Toca uma música do YouTube ou Spotify.')
        .addStringOption(option =>
            option.setName('musica')
                .setDescription('O nome ou link da música (YouTube ou Spotify).')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString('musica');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.editReply('❌ Você precisa de estar num canal de voz para tocar música!');
        }

        const searchResults = await play.search(query, {
            limit: 1,
            source: { youtube: 'video', spotify: 'track' }
        });

        if (searchResults.length === 0) {
            return interaction.editReply('❌ Não encontrei nenhuma música com esse nome.');
        }

        const video = searchResults[0];
        
        const song = {
            title: video.title,
            url: video.url,
            duration: video.durationRaw,
            requestedBy: interaction.member,
        };

        // --- MUDANÇA AQUI: Passa o 'client' ---
        const queue = getQueue(interaction.guild.id, interaction.client);
        // --- FIM DA MUDANÇA ---
        queue.textChannel = interaction.channel; 

        queue.songs.push(song);

        if (!queue.connection) {
            try {
                await joinChannel(queue, voiceChannel);
            } catch (error) {
                console.error(error);
                return interaction.editReply('❌ Falha ao entrar no canal de voz!');
            }
        }

        if (queue.isPlaying) {
            await interaction.editReply(`✅ Adicionado à fila: **${song.title}**`);
        } else {
            await interaction.editReply(`Iniciando a fila com: **${song.title}**`);
            playNextSong(queue);
        }
    },
};