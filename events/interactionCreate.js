/* events/interactionCreate.js (Refatorado, Corrigido e com Logger) */
const { Events } = require('discord.js');
const { logErrorToChannel } = require('../commands/liga/utils/helpers.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction, client) { // O 'client' é passado como último argumento
		
		// --- Handler de Comandos (Slash Commands) ---
		if (interaction.isCommand() || interaction.isAutocomplete()) {
			// (O 'isAutocomplete' é para os teus comandos de música)
			const command = client.commands.get(interaction.commandName);
            
			if (!command) {
                console.error(`[AVISO] Comando /${interaction.commandName} não encontrado.`);
                return;
            }

			try {
				if (interaction.isAutocomplete()) {
					// Se for um comando de autocompletar (ex: /play), chama o 'autocomplete'
					if (command.autocomplete) {
						await command.autocomplete(interaction);
					}
				} else {
					// Se for um comando normal, chama o 'execute'
					await command.execute(interaction);
				}
			} catch (err) {
                await logErrorToChannel(client, err, interaction);
				try {
					const errorMessage = `❌ **Erro Crítico!** Ocorreu um problema:\n\n\`\`\`${err.message}\`\`\``;
					if (interaction.replied || interaction.deferred) {
						await interaction.followUp({ content: errorMessage, ephemeral: true });
					} else {
						await interaction.reply({ content: errorMessage, ephemeral: true });
					}
				} catch (catchErr) {
					console.error("[ERRO NO CATCH] Não foi possível responder à interação que falhou:", catchErr.message);
				}
			}
			return; // Importante
		}

		// --- Roteador de Botões Otimizado ---
		if (interaction.isButton()) {
            const { buttonHandlers } = client; 
            
            // --- [A CORREÇÃO CRÍTICA ESTÁ AQUI] ---
            // Esta linha estava em falta, causando o erro 'undefined'
            const { customId } = interaction;
            // --- FIM DA CORREÇÃO ---
            
			try {
                // IDs da LIGA
				if (customId.startsWith('iniciar_') || 
					customId.startsWith('ver_') || 
					customId.startsWith('edit_'))
				{
					await buttonHandlers.liga(interaction, client);
				}
                // IDs da CARREIRA
				else if (customId.startsWith('carreira_') ||
					customId.startsWith('confirmar_') ||
					customId.startsWith('cancelar_')) 
				{
					await buttonHandlers.carreira(interaction, client);
				}
                // IDs de TICKET
				else if (customId.startsWith('ticket_')) 
				{
					await buttonHandlers.ticket(interaction, client);
				}

			} catch (err) {
                await logErrorToChannel(client, err, interaction);
				try {
					if (!interaction.replied && !interaction.deferred) {
						await interaction.reply({ content: '❌ Ocorreu um erro ao usar este botão.', ephemeral: true });
					} else {
						await interaction.followUp({ content: '❌ Ocorreu um erro ao usar este botão.', ephemeral: true });
					}
				} catch (catchErr) {
					console.error("[ERRO NO CATCH] Não foi possível responder ao botão que falhou:", catchErr.message);
				}
			}
            return; // Importante
		}
	},
};