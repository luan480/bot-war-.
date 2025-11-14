/* commands/adm/autoResponderHandler.js (CÓDIGO CORRETO) */

const { Events } = require('discord.js');
const path = require('path');
const { safeReadJson, logErrorToChannel } = require('../liga/utils/helpers.js');

const repliesPath = path.join(__dirname, 'auto_replies.json');

// --- FUNÇÕES DE AJUDA ---

// Pega uma resposta aleatória de uma lista
function getRandomReply(repliesArray) {
    if (!repliesArray || repliesArray.length === 0) return null;
    return repliesArray[Math.floor(Math.random() * repliesArray.length)];
}

// Formata a resposta (substitui placeholders)
function formatResponse(response, message, client) {
    if (!response) return null;
    return response
        .replace(/{user}/g, message.author.toString())
        .replace(/{bot}/g, client.user.toString());
}

// --- O VIGIA PRINCIPAL ---

const autoResponderHandler = (client) => {
    
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return;

        try {
            const content = message.content.toLowerCase().trim();
            const botMentioned = message.mentions.has(client.user.id);

            // Lê o ficheiro JSON inteiro
            const config = await safeReadJson(repliesPath, {}); 
            if (!config) return;

            let responseArray = null;

            // --- LÓGICA DE DETECÇÃO ---

            // 1. Foi uma Menção?
            if (botMentioned && config.mentionTriggers) {
                // Remove a menção do bot da mensagem para analisar o resto
                const contentWithoutMention = content.replace(/<@!?\d+>/g, '').trim();
                
                // Procura por um trigger de menção (ex: "coelho", "bot", "admin")
                const foundTrigger = Object.keys(config.mentionTriggers).find(trigger => {
                    return contentWithoutMention.includes(trigger.toLowerCase());
                });

                if (foundTrigger) {
                    responseArray = config.mentionTriggers[foundTrigger];
                }
            }

            // 2. Foi um Trigger Exato? (Só se não encontrou menção)
            if (!responseArray && config.exactTriggers) {
                const foundTrigger = Object.keys(config.exactTriggers).find(trigger => {
                    return content === trigger.toLowerCase();
                });

                if (foundTrigger) {
                    responseArray = config.exactTriggers[foundTrigger];
                }
            }

            // 3. Foi uma Palavra-Chave? (Só se não encontrou menção nem exato)
            if (!responseArray && config.keywordTriggers) {
                 const foundTrigger = Object.keys(config.keywordTriggers).find(trigger => {
                    // Verifica se a palavra inteira está na mensagem (evita "ola" em "controlar")
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
            // Se o auto-responder falhar, envia o erro para o teu canal de logs
            console.error(`Erro no Auto-Responder: ${err.message}`);
            await logErrorToChannel(client, err, message);
        }
    });
};

module.exports = autoResponderHandler;