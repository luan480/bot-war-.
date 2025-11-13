/* commands/liga/buttons.js (Assinatura atualizada) */

const path = require('path');

// Importa os novos handlers (manipuladores)
const handleRanking = require('./handlers/handleRanking.js');
const handleReverter = require('./handlers/handleReverter.js');
const handleIniciar = require('./handlers/handleIniciar.js');

/**
 * Este é o arquivo principal que gerencia TODOS os botões da LIGA.
 * Ele atua como um "roteador".
 */
// --- [MELHORIA] Invertida a ordem (interaction, client) por consistência ---
module.exports = async (interaction, client) => {
// --- FIM DA MELHORIA ---
    
    // Define os caminhos principais para os arquivos JSON
    const ligaPath = path.join(__dirname);
    const pontuacaoPath = path.join(ligaPath, 'pontuacao.json');
    const partidasPath = path.join(ligaPath, 'partidas.json');

    try {
        // --- Roteador de Botões (da Liga) ---
        
        // (Assume que handleRanking agora usa 'await safeReadJson')
        if (interaction.customId === 'ver_ranking' || interaction.customId === 'ver_todos_competidores') {
            await handleRanking(interaction, pontuacaoPath);
        }
        // (Assume que handleReverter agora usa 'await safeReadJson/safeWriteJson')
        else if (interaction.customId.startsWith('edit_match_')) {
            await handleReverter(interaction, pontuacaoPath, partidasPath);
        }
        // (Assume que handleIniciar agora usa 'await safeReadJson/safeWriteJson')
        else if (interaction.customId === 'iniciar_contabilizacao') {
             // Passa o client e a interaction
            await handleIniciar(interaction, client, pontuacaoPath, partidasPath);
        }
        
    } catch (err) {
        // Um 'catch' geral para qualquer erro que possa acontecer nos handlers
        console.error("Erro fatal no roteador de botões:", err);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ Ocorreu um erro ao processar sua solicitação.', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Ocorreu um erro ao processar sua solicitação.', ephemeral: true });
        }
    }
};