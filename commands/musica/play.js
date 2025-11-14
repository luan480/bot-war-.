/* commands/musica/play.js */

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

        // 1. Verifica se o usuário está num canal de voz
        if (!voiceChannel) {
            return interaction.editReply('❌ Você precisa de estar num canal de voz para tocar música!');
        }

        // 2. Procura a música
        const searchResults = await play.search(query, {
            limit: 1,
            source: { youtube: 'video', spotify: 'track' } // Procura vídeos no YT e músicas no Spotify
        });

        if (searchResults.length === 0) {
            return interaction.editReply('❌ Não encontrei nenhuma música com esse nome.');
        }

        const video = searchResults[0];
        
        // 3. Prepara o objeto da música
        const song = {
            title: video.title,
            url: video.url,
            duration: video.durationRaw,
            requestedBy: interaction.member,
        };

        // 4. Pega a fila do servidor
        const queue = getQueue(interaction.guild.id);
        queue.textChannel = interaction.channel; // Define onde as mensagens "Tocando agora" vão aparecer

        // 5. Adiciona a música à fila
        queue.songs.push(song);

        // 6. Entra no canal (se ainda não estiver lá)
        if (!queue.connection) {
            try {
                await joinChannel(queue, voiceChannel);
            } catch (error) {
                console.error(error);
                return interaction.editReply('❌ Falha ao entrar no canal de voz!');
            }
        }

        // 7. Toca a música (se não estiver a tocar) ou avisa que adicionou à fila
        if (queue.isPlaying) {
            await interaction.editReply(`✅ Adicionado à fila: **${song.title}**`);
        } else {
            await interaction.editReply(`Iniciando a fila com: **${song.title}**`);
            playNextSong(queue); // Começa a tocar
        }
    },
};