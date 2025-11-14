/* commands/adm/autoResponderHandler.js (CORRIGIDO PARA O JSON CORRETO) */

const { Events } = require('discord.js');
const path = require('path');
const { safeReadJson, logErrorToChannel } = require('../liga/utils/helpers.js');

const repliesPath = path.join(__dirname, 'auto_replies.json');

// --- FUNÇÕES DE AJUDA ---
function getRandomReply(repliesArray) {
    if (!repliesArray || repliesArray.length === 0) return null;
    return repliesArray[Math.floor(Math.random() * repliesArray.length)];
}
function formatResponse(response, message, client) {
    if (!response) return null;
    return response
        .replace(/{user}/g, message.author.toString())
        .replace(/{bot}/g, client.user.toString());
}
// --- FIM FUNÇÕES DE AJUDA ---

const autoResponderHandler = (client) => {
    
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return;

        try {
            const content = message.content.toLowerCase().trim();
            const botMentioned = message.mentions.has(client.user.id);

            const config = await safeReadJson(repliesPath, {}); 
            if (!config) return;

            let responseArray = null;

            // --- LÓGICA DE DETECÇÃO ---

            // 1. Foi uma Menção? (ex: @Bot ajuda)
            if (botMentioned && config.mentionTriggers) {
                const contentWithoutMention = content.replace(/<@!?\d+>/g, '').trim();
                const foundTrigger = Object.keys(config.mentionTriggers).find(trigger => {
                    return contentWithoutMention.includes(trigger.toLowerCase());
                });
                if (foundTrigger) {
                    responseArray = config.mentionTriggers[foundTrigger];
                }
            }

            // 2. Foi um Trigger Exato? (ex: "bom dia")
            if (!responseArray && config.exactTriggers) {
                const foundTrigger = Object.keys(config.exactTriggers).find(trigger => {
                    return content === trigger.toLowerCase();
                });
                if (foundTrigger) {
                    responseArray = config.exactTriggers[foundTrigger];
                }
            }

            // 3. Foi uma Palavra-Chave? (ex: "coelho" numa frase)
            if (!responseArray && config.keywordTriggers) {
                 const foundTrigger = Object.keys(config.keywordTriggers).find(trigger => {
                    const regex = new RegExp(`\\b${trigger.toLowerCase()}\\b`); 
                    return regex.test(content);
                 });
                if (foundTrigger) {
                    responseArray = config.keywordTriggers[foundTrigger];
                }
            }

            // --- ENVIO DA RESPOSTA ---
            const reply = getRandomReply(responseArray);
            const formattedReply = formatResponse(reply, message, client);

            if (formattedReply) {
                await message.channel.send(formattedReply);
            }

        } catch (err) {
            console.error(`Erro no Auto-Responder: ${err.message}`);
            await logErrorToChannel(client, err, message);
        }
    });
};

module.exports = autoResponderHandler;