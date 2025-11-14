/* commands/adm/autoResponderHandler.js (CORRIGIDO) */

const { Events } = require('discord.js');
const path = require('path');
const { safeReadJson, logErrorToChannel } = require('../liga/utils/helpers.js');

const repliesPath = path.join(__dirname, 'auto_replies.json');

const autoResponderHandler = (client) => {
    
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return;

        try {
            const content = message.content.toLowerCase().trim();

            // --- [CORREÇÃO AQUI] ---
            
            // 1. Lê a configuração inteira (que é um Objeto {})
            const config = await safeReadJson(repliesPath, {}); 

            // 2. Pega a lista de "replies" DE DENTRO do objeto
            // Se config.replies não existir, usa uma lista vazia []
            const repliesArray = config.replies || []; 
            // --- FIM DA CORREÇÃO ---

            // Procura por uma resposta
            const exactMatch = repliesArray.find(r => r.matchType === 'exact' && content === r.trigger.toLowerCase());
            const partialMatch = !exactMatch ? repliesArray.find(r => r.matchType === 'partial' && content.includes(r.trigger.toLowerCase())) : null;

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
    });
};

module.exports = autoResponderHandler;