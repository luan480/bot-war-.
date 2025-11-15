/* commands/patentes/carreiraButtonHandler.js (Necessário para o botão funcionar) */

const { EmbedBuilder, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const path = require('path');
// Importa dos helpers globais
const { safeReadJson, safeWriteJson, logErrorToChannel } = require('../liga/utils/helpers.js');
// Importa dos helpers da pasta 'patentes'
const { handlePromotion, generateCareerEmbed } = require('./carreiraHelpers.js');

// Caminhos dos "cérebros"
const carreirasPath = path.join(__dirname, 'carreiras.json');
const progressaoPath = path.join(__dirname, 'progressao.json');

// Função principal que será chamada pelo events/interactionCreate.js
const carreiraButtonHandler = async (interaction, client) => {
    const { customId } = interaction;

    try {
        // --- [LÓGICA PRINCIPAL AQUI] ---
        // Lida com o botão "Ver Meu Status"
        if (customId.startsWith('carreira_status_')) {
            await handleStatusCheck(interaction, client);
        }
        // --- [FIM DA LÓGICA] ---

        // Lógica antiga (que você enviou no arquivo) para aprovar/rejeitar promoções manuais
        else if (customId.startsWith('confirmar_promocao_')) {
            await handleConfirmPromotion(interaction, client);
        }
        else if (customId.startsWith('cancelar_promocao_')) {
            await handleCancelPromotion(interaction);
        }
        
    } catch (err) {
        console.error("Erro no carreiraButtonHandler:", err);
        await logErrorToChannel(client, err, interaction);
        
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ Ocorreu um erro interno ao processar este botão.', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Ocorreu um erro interno ao processar este botão.', ephemeral: true });
        }
    }
};

/**
 * Lida com a verificação de status vinda de um botão
 */
async function handleStatusCheck(interaction, client) {
    // Responde apenas para o usuário que clicou
    await interaction.deferReply({ ephemeral: true }); 

    const userId = interaction.customId.split('_')[2]; 

    // O botão foi clicado por alguém que não é o dono?
    if (interaction.user.id !== userId) {
        return interaction.editReply({ content: '❌ Você só pode ver o status de carreira do membro que foi promovido.' });
    }

    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) {
        return interaction.editReply({ content: '❌ Erro: Não consegui encontrar esse membro no servidor.' });
    }

    const carreirasConfig = await safeReadJson(carreirasPath);
    const progressao = await safeReadJson(progressaoPath);
    const userProgress = progressao[userId];

    if (!userProgress) {
        return interaction.editReply({ 
            content: '❌ Este membro ainda não tem um registro de progresso.'
        });
    }

    const faccaoId = userProgress.factionId;
    const faccao = carreirasConfig.facoes[faccaoId];

    if (!faccao) {
        return interaction.editReply({ content: '❌ Erro: Não consegui encontrar a facção deste membro no `carreiras.json`.' });
    }

    // Chama a função centralizada do helpers
    const embed = generateCareerEmbed(member, userProgress, faccao, interaction.guild);
    
    await interaction.editReply({
        content: `Este é o status de carreira atual de **${member.displayName}**:`,
        embeds: [embed]
    });
}


/* ... Funções de promoção manual (handleConfirmPromotion, handleCancelPromotion) ... */
// O resto do seu arquivo (handleConfirmPromotion, handleCancelPromotion)
// pode continuar aqui exatamente como estava, não precisa mudar.

async function handleConfirmPromotion(interaction, client) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({ 
            content: '❌ Você não tem permissão para confirmar promoções.', 
            ephemeral: true 
        });
    }
    await interaction.deferReply({ ephemeral: true });
    const [, , userId, newRankId] = interaction.customId.split('_');
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) {
        return interaction.editReply({ content: '❌ Erro: Não consegui encontrar o membro original desta promoção.' });
    }
    const carreirasConfig = await safeReadJson(carreirasPath);
    const progressao = await safeReadJson(progressaoPath);
    const userProgress = progressao[userId];
    if (!userProgress) {
        return interaction.editReply({ content: '❌ Este usuário não tem progresso de carreira.' });
    }
    const faccao = carreirasConfig.facoes[userProgress.factionId];
    if (!faccao) {
        return interaction.editReply({ content: '❌ Facção do usuário não encontrada.' });
    }
    const proximoCargo = faccao.caminho.find(r => r.id === newRankId);
    if (!proximoCargo) {
        return interaction.editReply({ content: '❌ Cargo de destino não encontrado na configuração.' });
    }
    const fakeInteraction = {
        guild: interaction.guild,
        client: client,
        editReply: (msg) => interaction.editReply(msg),
        followUp: (msg) => interaction.followUp(msg)
    };
    await handlePromotion(fakeInteraction, member, 'promover', proximoCargo.id);
    const disabledRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('promocao_confirmada').setLabel('Promoção Aprovada').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('status_original').setLabel('Ver Status').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
    await interaction.message.edit({ 
        content: `✅ **Promoção Aprovada** por ${interaction.user.tag}.\nO membro ${member.user.tag} foi promovido para **${proximoCargo.nome}**.`,
        components: [disabledRow]
    });
}
async function handleCancelPromotion(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({ 
            content: '❌ Você não tem permissão para cancelar promoções.', 
            ephemeral: true 
        });
    }
    const [, , userId] = interaction.customId.split('_');
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    const disabledRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('promocao_rejeitada').setLabel('Promoção Rejeitada').setStyle(ButtonStyle.Danger).setDisabled(true),
            new ButtonBuilder().setCustomId('status_original_2').setLabel('Ver Status').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
    await interaction.message.edit({
        content: `❌ **Promoção Rejeitada** por ${interaction.user.tag}.\nO print de ${member ? member.user.tag : 'Usuário Desconhecido'} foi ignorado.`,
        components: [disabledRow]
    });
    await interaction.reply({ content: 'Promoção rejeitada com sucesso.', ephemeral: true });
}


module.exports = carreiraButtonHandler;