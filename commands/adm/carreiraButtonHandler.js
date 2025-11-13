/* commands/adm/carreiraButtonHandler.js (SIMPLIFICADO) */

const { EmbedBuilder, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
// --- MUDANÇA AQUI: Importa a nova função ---
const { handlePromotion, generateCareerEmbed } = require('./carreiraHelpers.js');
// --- FIM DA MUDANÇA ---

const carreirasPath = path.join(__dirname, 'carreiras.json');
const progressaoPath = path.join(__dirname, 'progressao.json');

module.exports = async (interaction, client) => {
    
    try {
        if (interaction.customId.startsWith('carreira_status_')) {
            await handleStatusCheck(interaction);
        }
        else if (interaction.customId.startsWith('confirmar_promocao_')) {
            await handleConfirmPromotion(interaction, client);
        }
        else if (interaction.customId.startsWith('cancelar_promocao_')) {
            await handleCancelPromotion(interaction);
        }
        
    } catch (err) {
        console.error("Erro no carreiraButtonHandler:", err);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ Ocorreu um erro interno ao processar este botão.', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Ocorreu um erro interno ao processar este botão.', ephemeral: true });
        }
    }
};

/* ... as funções handleConfirmPromotion e handleCancelPromotion ... */
/* ... (O código delas que te enviei na última resposta continua igual) ... */
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
    const faccao = carreirasConfig.faccoes[userProgress.factionId];
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
/* ... Fim das funções de promoção ... */


/**
 * Lida com a verificação de status (agora usando a função centralizada)
 */
async function handleStatusCheck(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.customId.split('_')[2]; 

    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) {
        return interaction.editReply({ content: '❌ Erro: Não consegui encontrar o membro original.' });
    }

    const carreirasConfig = await safeReadJson(carreirasPath);
    const progressao = await safeReadJson(progressaoPath);
    const userProgress = progressao[userId];

    if (!userProgress) {
        return interaction.editReply({ 
            content: '❌ Este usuário ainda não tem um registro de progresso.'
        });
    }

    const faccaoId = userProgress.factionId;
    const faccao = carreirasConfig.faccoes[faccaoId];

    if (!faccao) {
        return interaction.editReply({ content: '❌ Erro: Não consegui encontrar a facção deste usuário.' });
    }

    // --- MUDANÇA AQUI: Lógica do Embed removida ---
    // Agora apenas chamamos a função centralizada
    const embed = generateCareerEmbed(member, userProgress, faccao, interaction.guild);
    // --- FIM DA MUDANÇA ---
    
    await interaction.editReply({
        content: `Este é o status atual de **${member.displayName}**:`,
        embeds: [embed]
    });
}