/* commands/musica/musicManager.js (LOGGER CORRIGIDO) */

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

const queues = new Map();

/**
 * Pega a fila de música de um servidor, ou cria uma nova se não existir.
 * // --- MUDANÇA AQUI: Passa o 'client' para o manager ---
 */
function getQueue(guildId, client) {
    if (!queues.has(guildId)) {
        const queue = {
            client: client, // <-- Armazena o client
            guildId: guildId,
            voiceChannel: null,
            textChannel: null,
            connection: null,
            player: createAudioPlayer(),
            songs: [],
            isPlaying: false,
        };

        // Configura o player para tocar a próxima música
        queue.player.on(AudioPlayerStatus.Idle, () => {
            queue.songs.shift(); 
            playNextSong(queue); 
        });

        // Configura o player para logar erros
        queue.player.on('error', (error) => {
            // --- MUDANÇA AQUI: Passa o 'client' da fila para o logger ---
            logErrorToChannel(queue.client, error, null); 
            // --- FIM DA MUDANÇA ---
            queue.isPlaying = false;
            playNextSong(queue);
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
        setTimeout(() => {
            if (!queue.isPlaying && queue.connection) {
                console.log(`[Music] Fila vazia em ${queue.guildId}, saindo do canal.`);
                queue.connection.destroy();
                queues.delete(queue.guildId);
            }
        }, 300000);
        return;
    }

    queue.isPlaying = true;
    const song = queue.songs[0];

    try {
        const stream = await play.stream(song.url, { discordPlayer: true });
        const resource = createAudioResource(stream.stream, { inputType: stream.type });

        queue.player.play(resource);
        
        await queue.textChannel.send(`Tocando agora: 🎵 **${song.title}** (${song.duration}) - Pedido por ${song.requestedBy}`);

    } catch (error) {
        console.error(`Erro ao tocar ${song.title}: ${error.message}`);
        // --- MUDANÇA AQUI: Passa o 'client' da fila para o logger ---
        logErrorToChannel(queue.client, error, null);
        // --- FIM DA MUDANÇA ---
        queue.songs.shift(); 
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
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000),
            ]);
        } catch (error) {
            console.warn(`[Music] Falha ao reconectar em ${queue.guildId}, limpando a fila.`);
            connection.destroy();
            queues.delete(queue.guildId);
        }
    });

    connection.subscribe(queue.player);
    queue.connection = connection;
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    return connection;
}

module.exports = {
    getQueue,
    playNextSong,
    joinChannel,
};