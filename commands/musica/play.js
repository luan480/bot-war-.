/* commands/musica/play.js (ATUALIZADO PARA SUPORTAR PLAYLISTS) */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const play = require('play-dl');
const { getQueue, joinChannel, playNextSong } = require('./musicManager.js');
const { logErrorToChannel } = require('../liga/utils/helpers.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Toca uma música ou playlist do YouTube ou Spotify.')
        .addStringOption(option =>
            option.setName('musica')
                .setDescription('O nome, link da música ou link da playlist.')
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

        // --- MUDANÇA AQUI: Lógica de Playlist ---
        try {
            // Pega a fila do servidor (e passa o client para o logger de erros)
            const queue = getQueue(interaction.guild.id, interaction.client);
            queue.textChannel = interaction.channel;

            // 1. Valida o que o usuário enviou (é um vídeo, playlist, ou só texto?)
            const validation = await play.validate(query);

            // 2. SE FOR PLAYLIST (YouTube ou Spotify)
            if (validation === 'yt_playlist' || validation === 'sp_playlist') {
                const playlist = await play.playlist_info(query, { incomplete: true });
                const videos = await playlist.all_videos();

                if (videos.length === 0) {
                    return interaction.editReply('❌ Não consegui carregar nenhuma música dessa playlist.');
                }

                await interaction.editReply(`Carregando ${videos.length} músicas da playlist...`);

                // 3. Entra no canal (se ainda não estiver lá)
                if (!queue.connection) {
                    await joinChannel(queue, voiceChannel);
                }

                // 4. Adiciona todas as músicas da playlist à fila
                for (const video of videos) {
                    const song = {
                        title: video.title,
                        url: video.url,
                        duration: video.durationRaw,
                        requestedBy: interaction.member,
                    };
                    queue.songs.push(song);
                }

                await interaction.followUp(`✅ **${videos.length} músicas** da playlist "${playlist.title}" foram adicionadas à fila!`);
                
                // 5. Começa a tocar (se não estiver a tocar)
                if (!queue.isPlaying) {
                    playNextSong(queue);
                }
                return;
            }

            // 3. SE FOR MÚSICA ÚNICA (Vídeo, Spotify) OU PESQUISA DE TEXTO
            let video;
            if (validation === 'yt_video' || validation === 'sp_track') {
                const searchResults = await play.search(query, { limit: 1 });
                video = searchResults[0];
            } else if (validation === 'search') {
                // Se for só texto, procura o primeiro resultado
                const searchResults = await play.search(query, { 
                    limit: 1, 
                    source: { youtube: 'video' } // Procura só vídeos no YouTube
                });
                if (searchResults.length === 0) {
                    return interaction.editReply('❌ Não encontrei nenhuma música com esse nome.');
                }
                video = searchResults[0];
            } else {
                return interaction.editReply('❌ Link ou tipo de música não suportado.');
            }

            // 4. Prepara o objeto da música
            const song = {
                title: video.title,
                url: video.url,
                duration: video.durationRaw,
                requestedBy: interaction.member,
            };

            // 5. Adiciona a música à fila
            queue.songs.push(song);

            // 6. Entra no canal (se ainda não estiver lá)
            if (!queue.connection) {
                await joinChannel(queue, voiceChannel);
            }

            // 7. Toca a música (se não estiver a tocar) ou avisa
            if (queue.isPlaying) {
                await interaction.editReply(`✅ Adicionado à fila: **${song.title}**`);
            } else {
                await interaction.editReply(`Iniciando a fila com: **${song.title}**`);
                playNextSong(queue); // Começa a tocar
            }

        } catch (err) {
            logErrorToChannel(interaction.client, err, interaction);
            await interaction.editReply('❌ Ocorreu um erro ao processar o seu pedido.');
        }
        // --- FIM DA MUDANÇA ---
    },
};