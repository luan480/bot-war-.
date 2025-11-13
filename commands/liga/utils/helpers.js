/* commands/liga/utils/helpers.js (ATUALIZADO) */

const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder, codeBlock } = require('discord.js');

/* ... funções safeReadJson, safeWriteJson, capitalize ... */
/* ... (O código delas que te enviei na última resposta continua igual) ... */
const safeReadJson = async (filePath) => {
    try {
        await fs.access(filePath).catch(async () => {
            await fs.writeFile(filePath, JSON.stringify({}, null, 2));
        });
        
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data.trim() === '' ? '{}' : data);
    } catch (e) {
        console.error(`Erro ao ler ${filePath}:`, e);
        return {};
    }
};
const safeWriteJson = async (filePath, data) => {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
};
const capitalize = (s) => {
    if (typeof s !== 'string' || s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
};
/* ... Fim das funções originais ... */


// --- MUDANÇA AQUI: Logger atualizado para aceitar 'Message' ou 'Interaction' ---

/**
 * Envia um log de erro detalhado para um canal do Discord.
 * @param {import('discord.js').Client} client O cliente do bot.
 * @param {Error} error O objeto do erro que ocorreu.
 * @param {import('discord.js').Interaction | import('discord.js').Message | null} [context] A interação ou mensagem que causou o erro (opcional).
 */
const logErrorToChannel = async (client, error, context = null) => {
    console.error('[ERRO CAPTURADO]', error); // Mantém o log na consola

    try {
        const logConfigPath = path.join(__dirname, '../../adm/log_config.json');
        const config = await safeReadJson(logConfigPath);

        if (!config.botErrorLog) {
            console.error('[Logger] Canal de log de erros (botErrorLog) não configurado no log_config.json.');
            return;
        }

        const channel = await client.channels.fetch(config.botErrorLog).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            console.error(`[Logger] Não foi possível encontrar o canal de log ${config.botErrorLog} ou não é um canal de texto.`);
            return;
        }
        
        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTimestamp();

        if (context) {
            // Verifica se é uma Interação
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
            // Verifica se é uma Mensagem
            else if (context.author) {
                embed
                    .setTitle('❌ Erro num Handler de Mensagem (Vigia)')
                    .addFields(
                        { name: 'Handler', value: 'Provavelmente `promotionHandler.js`', inline: false },
                        { name: 'Utilizador', value: `${context.author.tag} (${context.author.id})`, inline: true },
                        { name: 'Canal', value: `${context.channel.name} (${context.channel.id})`, inline: true },
                        { name: 'Mensagem (Link)', value: `[Clique aqui](${context.url})`, inline: true },
                        { name: 'Erro', value: codeBlock(error.message) },
                        { name: 'Stack (Resumido)', value: codeBlock(error.stack.substring(0, 1000)) }
                    );
            }
        } else {
            // Erro Crítico (Crash)
            embed
                .setTitle('🚨 ERRO CRÍTICO (Uncaught Exception)')
                .setDescription('O bot encontrou um erro fatal que não foi tratado. O processo pode ter sido reiniciado.')
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
// --- FIM DA MUDANÇA ---


module.exports = { 
    safeReadJson, 
    safeWriteJson, 
    capitalize,
    logErrorToChannel
};