/* events/interactionCreate.js (Refatorado, Corrigido e com Logger) */
const { Events } = require('discord.js');
// --- MUDANÇA AQUI: Importa o novo Logger ---
const { logErrorToChannel } = require('../commands/liga/utils/helpers.js');
// --- FIM DA MUDANÇA ---

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction, client) { // O 'client' é passado como último argumento
		
		// --- Handler de Comandos (Slash Commands) ---
		if (interaction.isCommand()) {
			const command = client.commands.get(interaction.commandName);
            
			if (!command) {
                console.error(`[AVISO] Comando /${interaction.commandName} não encontrado.`);
                return;
            }

			try {
				await command.execute(interaction);
			} catch (err) {
                // --- MUDANÇA AQUI ---
				// Em vez de só logar na consola, envia para o canal
                await logErrorToChannel(client, err, interaction);
                // --- FIM DA MUDANÇA ---
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
            const { customId } = interaction;
            
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
                // --- MUDANÇA AQUI ---
				// Em vez de só logar na consola, envia para o canal
                await logErrorToChannel(client, err, interaction);
                // --- FIM DA MUDANÇA ---
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