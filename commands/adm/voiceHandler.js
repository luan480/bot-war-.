/* commands/adm/voiceHandler.js (VERSÃO FINAL 24/7 COM RÁDIO) */

const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus
} = require('@discordjs/voice');
const path = require('path');
const { safeReadJson, logErrorToChannel } = require('../liga/utils/helpers.js');
const play = require('play-dl'); // <-- A NOVA BIBLIOTECA

const serverDataPath = path.join(__dirname, 'server_data.json');

// --- Podes mudar este link para qualquer rádio 24/7 do YouTube ---
const RADIO_URL = 'https://www.youtube.com/watch?v=5qap5aO4i9A'; // (Ex: Lofi Girl)

// Criamos um player de áudio global para este handler
const player = createAudioPlayer();

/**
 * Tenta conectar o bot ao canal de voz e tocar a rádio 24/7.
 * @param {import('discord.js').Client} client 
 */
async function connectToChannel(client) {
    const serverData = await safeReadJson(serverDataPath);
    const channelId = serverData.afkVoiceChannel;

    if (!channelId) {
        console.log('[VoiceHandler] Canal de voz AFK não definido. Bot não irá conectar.');
        return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel || !channel.isVoiceBased()) {
        console.warn(`[VoiceHandler] Não foi possível encontrar o canal de voz com ID ${channelId}.`);
        return;
    }

    try {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true, // O bot fica "surdo" para economizar recursos
        });

        // Espera o bot conectar de facto
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        console.log(`[VoiceHandler] Conectado com sucesso ao canal: ${channel.name}`);

        // Diz à conexão de voz para "ouvir" o nosso player
        connection.subscribe(player);

        // Inicia a música
        await playRadio(client);

        // --- Lógica de Reconexão e Erros ---

        // Se o player ficar inativo (música parar), reinicia a stream
        player.on(AudioPlayerStatus.Idle, () => {
            console.log('[VoiceHandler] Stream terminou ou falhou. A reiniciar rádio 24/7...');
            playRadio(client).catch(err => logErrorToChannel(client, err, null));
        });

        // Se o player der um erro
        player.on('error', (error) => {
            console.error(`[VoiceHandler] Erro no player de áudio: ${error.message}`);
            logErrorToChannel(client, error, null);
            // Tenta reiniciar a rádio
            playRadio(client).catch(err => logErrorToChannel(client, err, null));
        });

        // Se o bot for desconectado
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            console.warn(`[VoiceHandler] Desconectado do canal ${channel.name}. Tentando reconectar...`);
            try {
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                const newConnection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: true,
                });
                
                await entersState(newConnection, VoiceConnectionStatus.Ready, 30_000);
                newConnection.subscribe(player); // Reconecta o player
                console.log(`[VoiceHandler] Reconectado com sucesso a ${channel.name}`);
                
                // Garante que a música volta a tocar
                if (player.state.status === AudioPlayerStatus.Idle) {
                    await playRadio(client);
                }

            } catch (error) {
                console.error('[VoiceHandler] Falha ao reconectar:', error);
                logErrorToChannel(client, error, null);
            }
        });

    } catch (error) {
        console.error(`[VoiceHandler] Falha ao entrar no canal ${channel.name}:`, error);
        logErrorToChannel(client, error, null);
    }
}

/**
 * Puxa a stream do YouTube e toca no player.
 */
async function playRadio(client) {
    try {
        // Valida a URL (útil se um dia quiseres usar /definir-radio)
        if (!play.yt_validate(RADIO_URL) || RADIO_URL.includes('list=')) {
            console.error('[VoiceHandler] URL de rádio inválida. Precisa ser um vídeo do YouTube, não uma playlist.');
            return;
        }

        // Puxa as informações da stream
        const stream = await play.stream(RADIO_URL, {
            discordPlayer: true // Otimiza a stream para o Discord
        });

        // Cria o recurso de áudio
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type
        });

        // Toca no player
        player.play(resource);
        console.log('[VoiceHandler] Tocando Rádio 24/7.');

    } catch (error) {
        console.error(`[VoiceHandler] Erro ao carregar a stream da rádio: ${error.message}`);
        logErrorToChannel(client, error, null);
    }
}

module.exports = { connectToChannel };