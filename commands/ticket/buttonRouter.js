/* commands/ticket/buttonRouter.js (NOVO FICHEIRO) */

// Importa os handlers específicos de ticket
const ticketOpenHandler = require('./ticketOpenHandler.js');
const ticketCloseHandler = require('./ticketCloseHandler.js');

/**
 * Este é o roteador de botões APENAS para o sistema de TICKET.
 * O 'interactionCreate.js' chama este ficheiro, e este ficheiro
 * decide qual lógica de ticket executar.
 */
module.exports = async (interaction, client) => {
    const { customId } = interaction;

    // Adiciona 'await' e passa o 'client' se os handlers precisarem
    if (customId === 'ticket_abrir_denuncia') {
        await ticketOpenHandler(interaction, client); 
    }
    else if (customId === 'ticket_fechar') {
        await ticketCloseHandler(interaction, client);
    }
    // Se tiveres mais botões de ticket (ex: 'ticket_reabrir'),
    // adiciona o 'else if' aqui.
};