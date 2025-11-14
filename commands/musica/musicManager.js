/* commands/musica/musicManager.js (O CÉREBRO) */

const { 
    createAudioPlayer, 
    createAudioResource, 
    joinVoiceChannel,
    entersState,
    VoiceConnectionStatus,
    AudioPlayerStatus
} = require('@discordjs/voice');
const play = require('play-dl');
const { logErrorToChannel } = require('../liga/utils/helpers.js');

// Este Map vai guardar todas as filas de música (uma por servidor)
// A chave (key) é o ID do servidor (guild.id)
const queues = new Map();

/**
 * Pega a fila de música de um servidor, ou cria uma nova se não existir.
 */
function getQueue(guildId) {
    if (!queues.has(guildId)) {
        // Cria uma nova fila
        const queue = {
            guildId: guildId,
            voiceChannel: null, // Canal de voz
            textChannel: null,  // Canal de texto
            connection: null,   // A conexão de voz
            player: createAudioPlayer(), // O player de áudio
            songs: [],          // A lista de músicas
            isPlaying: false,
        };

        // Configura o player para tocar a próxima música quando a atual acabar
        queue.player.on(AudioPlayerStatus.Idle, () => {
            queue.songs.shift(); // Remove a música que acabou
            playNextSong(queue); // Toca a próxima
        });

        // Configura o player para logar erros
        queue.player.on('error', (error) => {
            logErrorToChannel(null, error, null); // Precisamos do 'client' aqui, mas por agora logamos sem
            queue.isPlaying = false;
            playNextSong(queue); // Tenta a próxima
        });

        queues.set(guildId, queue);
    }
    return queues.get(guildId);
}

/**
 * A função principal que toca a próxima música da fila.
 */
async function playNextSong(queue) {
    if (queue.songs.length === 0) {
        queue.isPlaying = false;
        // Se a fila estiver vazia, agenda para sair do canal em 5 minutos
        setTimeout(() => {
            if (!queue.isPlaying && queue.connection) {
                console.log(`[Music] Fila vazia em ${queue.guildId}, saindo do canal.`);
                queue.connection.destroy();
                queues.delete(queue.guildId);
            }
        }, 300000); // 5 minutos
        return;
    }

    queue.isPlaying = true;
    const song = queue.songs[0];

    try {
        // Puxa a stream do YouTube/Spotify
        const stream = await play.stream(song.url, { discordPlayer: true });
        const resource = createAudioResource(stream.stream, { inputType: stream.type });

        queue.player.play(resource);
        
        await queue.textChannel.send(`Tocando agora: 🎵 **${song.title}** (${song.duration}) - Pedido por ${song.requestedBy}`);

    } catch (error) {
        console.error(`Erro ao tocar ${song.title}: ${error.message}`);
        logErrorToChannel(null, error, null);
        queue.songs.shift(); // Pula a música que deu erro
        playNextSong(queue);
    }
}

/**
 * Junta o bot no canal de voz e prepara a conexão.
 */
async function joinChannel(queue, voiceChannel) {
    queue.voiceChannel = voiceChannel;
    
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            // Se foi desconectado, espera 5s e tenta reconectar
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000),
            ]);
        } catch (error) {
            // Se falhar a reconectar, destrói a fila
            console.warn(`[Music] Falha ao reconectar em ${queue.guildId}, limpando a fila.`);
            connection.destroy();
            queues.delete(queue.guildId);
        }
    });

    connection.subscribe(queue.player); // Liga o player à conexão
    queue.connection = connection;
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    return connection;
}

module.exports = {
    getQueue,
    playNextSong,
    joinChannel,
};