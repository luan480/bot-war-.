/* commands/liga/utils/helpers.js (ATUALIZADO) */

const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder, codeBlock } = require('discord.js');

// --- MUDANÇA AQUI: safeReadJson agora aceita um 'defaultValue' ---
/**
 * Lê um arquivo JSON de forma segura e assíncrona.
 * @param {string} filePath - O caminho para o arquivo JSON.
 * @param {object | Array} [defaultValue] - O valor padrão (ex: {} ou []) para criar o ficheiro se não existir.
 * @returns {Promise<object | Array>} O objeto JSON lido.
 */
const safeReadJson = async (filePath, defaultValue = {}) => {
// --- FIM DA MUDANÇA ---
    try {
        // Tenta ler o arquivo
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data.trim() === '' ? JSON.stringify(defaultValue) : data);
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.log(`[INFO] Arquivo ${filePath} não encontrado, criando um novo.`);
            try {
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                // --- MUDANÇA AQUI: Usa o 'defaultValue' ao criar ---
                await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
                return defaultValue;
                // --- FIM DA MUDANÇA ---
            } catch (writeErr) {
                console.error(`Erro fatal ao tentar criar ${filePath}:`, writeErr);
                return defaultValue;
            }
        }
        console.error(`Erro ao ler ${filePath}, reescrevendo o arquivo.`, e);
        try {
             // --- MUDANÇA AQUI: Usa o 'defaultValue' ao reescrever ---
            await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
        } catch (writeErr) {
            console.error(`Erro fatal ao tentar reescrever ${filePath}:`, writeErr);
        }
        return defaultValue;
    }
};

/**
 * Escreve dados em um arquivo JSON de forma segura e assíncrona.
 * (Função original - sem alteração)
 */
const safeWriteJson = async (filePath, data) => {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Erro fatal ao escrever em ${filePath}:`, e);
    }
};

/**
 * Coloca a primeira letra de uma string em maiúscula.
 * (Função original - sem alteração)
 */
const capitalize = (s) => {
    if (typeof s !== 'string' || s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
};


/**
 * Envia um log de erro detalhado para um canal do Discord.
 * (Função original - sem alteração)
 */
const logErrorToChannel = async (client, error, context = null) => {
    console.error('[ERRO CAPTURADO]', error); 

    // --- MUDANÇA AQUI: Se o client não for passado, tenta pegar do contexto ---
    const logClient = client || context?.client;
    if (!logClient) {
        console.error('[Logger] Não foi possível obter o "client" para enviar o log de erro.');
        return;
    }
    // --- FIM DA MUDANÇA ---

    try {
        const logConfigPath = path.join(__dirname, '../../adm/log_config.json');
        const config = await safeReadJson(logConfigPath); 

        if (!config.botErrorLog) {
            console.error('[Logger] Canal de log de erros (botErrorLog) não configurado no log_config.json.');
            return;
        }

        const channel = await logClient.channels.fetch(config.botErrorLog).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            console.error(`[Logger] Não foi possível encontrar o canal de log ${config.botErrorLog}.`);
            return;
        }
        
        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTimestamp();

        if (context) {
            if (context.isInteraction) {
                let commandName = 'N/A';
                if (context.isCommand()) commandName = `/${context.commandName}`;
                if (context.isButton()) commandName = `Botão: ${context.customId}`;
                if (context.isAutocomplete()) commandName = `Autocomplete: /${context.commandName}`;

                embed
                    .setTitle('❌ Erro de Interação')
                    .addFields(
                        { name: 'Tipo', value: codeBlock(commandName), inline: true },
                        { name: 'Utilizador', value: `${context.user.tag} (${context.user.id})`, inline: true },
                        { name: 'Canal', value: `${context.channel.name} (${context.channel.id})`, inline: true },
                        { name: 'Erro', value: codeBlock(error.message) },
                        { name: 'Stack (Resumido)', value: codeBlock(error.stack.substring(0, 1000)) }
                    );
            } 
            else if (context.author) {
                embed
                    .setTitle('❌ Erro num Handler de Mensagem (Vigia)')
                    .addFields(
                        { name: 'Handler', value: 'Provavelmente `promotionHandler.js` ou `autoResponderHandler.js`', inline: false },
                        { name: 'Utilizador', value: `${context.author.tag} (${context.author.id})`, inline: true },
                        { name: 'Canal', value: `${context.channel.name} (${context.channel.id})`, inline: true },
                        { name: 'Mensagem (Link)', value: `[Clique aqui](${context.url})`, inline: true },
                        { name: 'Erro', value: codeBlock(error.message) },
                        { name: 'Stack (Resumido)', value: codeBlock(error.stack.substring(0, 1000)) }
                    );
            }
        } else {
            embed
                .setTitle('🚨 ERRO CRÍTICO (Uncaught Exception)')
                .setDescription('O bot encontrou um erro fatal que não foi tratado.')
                .addFields(
                    { name: 'Erro', value: codeBlock(error.message) },
                    { name: 'Stack', value: codeBlock(error.stack.substring(0, 3900)) }
                );
        }

        await channel.send({ embeds: [embed] });

    } catch (logErr) {
        console.error('[ERRO NO LOGGER] Não foi possível enviar o log de erro para o Discord:', logErr);
    }
};


module.exports = { 
    safeReadJson, 
    safeWriteJson, 
    capitalize,
    logErrorToChannel
};