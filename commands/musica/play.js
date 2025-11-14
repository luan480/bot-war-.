/* commands/musica/play.js (ATUALIZADO PARA SUPORTAR PLAYLISTS E ÁLBUNS) */

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
                .setDescription('O nome, link da música ou link da playlist/álbum.')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString('musica');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.editReply('❌ Você precisa de estar num canal de voz para tocar música!');
        }

        try {
            const queue = getQueue(interaction.guild.id, interaction.client);
            queue.textChannel = interaction.channel;

            // --- MUDANÇA AQUI: Lógica de Pesquisa Melhorada ---

            // 1. Valida o que o usuário enviou
            const validation = await play.validate(query);

            let songs = [];
            let replyMessage = '';

            // 2. SE FOR PLAYLIST (YouTube, Spotify) OU ÁLBUM (Spotify)
            if (validation === 'yt_playlist' || validation === 'sp_playlist' || validation === 'sp_album') {
                const playlist = await play.playlist_info(query, { incomplete: true });
                const videos = await playlist.all_videos();

                if (videos.length === 0) {
                    return interaction.editReply('❌ Não consegui carregar nenhuma música dessa playlist/álbum.');
                }

                replyMessage = `✅ **${videos.length} músicas** da ${playlist.type === 'album' ? 'álbum' : 'playlist'} "${playlist.title}" foram adicionadas à fila!`;

                // Converte todos os vídeos da playlist para o nosso formato 'song'
                songs = videos.map(video => ({
                    title: video.title,
                    url: video.url,
                    duration: video.durationRaw,
                    requestedBy: interaction.member,
                }));
            
            } 
            // 3. SE FOR MÚSICA ÚNICA (Link YT, Link Spotify)
            else if (validation === 'yt_video' || validation === 'sp_track') {
                const searchResults = await play.search(query, { limit: 1 });
                if (searchResults.length === 0) {
                    return interaction.editReply('❌ Não encontrei essa música.');
                }
                const video = searchResults[0];

                const song = {
                    title: video.title,
                    url: video.url,
                    duration: video.durationRaw,
                    requestedBy: interaction.member,
                };
                songs.push(song);
                replyMessage = `✅ Adicionado à fila: **${song.title}**`;
            
            } 
            // 4. SE FOR PESQUISA DE TEXTO
            else if (validation === 'search') {
                const searchResults = await play.search(query, { 
                    limit: 1, 
                    source: { youtube: 'video' } // Procura só vídeos no YouTube
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
                songs.push(song);
                replyMessage = `✅ Adicionado à fila: **${song.title}**`;
            } 
            // 5. SE NÃO FOR NADA VÁLIDO
            else {
                return interaction.editReply('❌ Link ou tipo de música não suportado.');
            }
            
            // --- FIM DA MUDANÇA ---

            // 6. Entra no canal (se ainda não estiver lá)
            if (!queue.connection) {
                try {
                    await joinChannel(queue, voiceChannel);
                } catch (error) {
                    queues.delete(interaction.guild.id); // Limpa a fila se falhar
                    await logErrorToChannel(interaction.client, error, interaction);
                    return interaction.editReply('❌ Falha ao entrar no canal de voz! Verifica as minhas permissões.');
                }
            }

            // 7. Adiciona as músicas (uma ou várias) à fila
            queue.songs.push(...songs);

            // 8. Toca a música (se não estiver a tocar) ou só avisa
            if (queue.isPlaying) {
                await interaction.editReply(replyMessage);
            } else {
                await interaction.editReply(replyMessage.replace('Adicionado à fila', 'Iniciando a fila com'));
                playNextSong(queue); // Começa a tocar
            }

        } catch (err) {
            logErrorToChannel(interaction.client, err, interaction);
            await interaction.editReply('❌ Ocorreu um erro ao processar o seu pedido.');
        }
    },
};