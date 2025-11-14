/* commands/adm/autoResponderHandler.js (CORRIGIDO) */

const { Events } = require('discord.js');
const path = require('path');
// --- MUDANÇA AQUI: Importa o logger ---
const { safeReadJson, logErrorToChannel } = require('../liga/utils/helpers.js');
// --- FIM DA MUDANÇA ---

const repliesPath = path.join(__dirname, 'auto_replies.json');

const autoResponderHandler = (client) => {
    
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return;

        // --- MUDANÇA AQUI: Adicionado try...catch e logger ---
        try {
            const content = message.content.toLowerCase().trim();

            // --- MUDANÇA AQUI: Passa '[]' como valor padrão ---
            const replies = await safeReadJson(repliesPath, []);
            // --- FIM DA MUDANÇA ---

            // Procura por uma resposta
            const exactMatch = replies.find(r => r.matchType === 'exact' && content === r.trigger.toLowerCase());
            const partialMatch = !exactMatch ? replies.find(r => r.matchType === 'partial' && content.includes(r.trigger.toLowerCase())) : null;

            const foundReply = exactMatch || partialMatch;

            if (foundReply) {
                // Substitui placeholders (variáveis)
                let response = foundReply.response
                    .replace(/{user}/g, message.author.toString())
                    .replace(/{bot}/g, client.user.toString());

                await message.channel.send(response);
            }
        } catch (err) {
            // Se o auto-responder falhar, envia o erro para o teu canal de logs
            console.error(`Erro no Auto-Responder: ${err.message}`);
            await logErrorToChannel(client, err, message);
        }
        // --- FIM DA MUDANÇA ---
    });
};

module.exports = autoResponderHandler;