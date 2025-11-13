/* commands/adm/carreira.js (COMPLETO E CORRIGIDO) */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson, capitalize, logErrorToChannel } = require('../liga/utils/helpers.js');
const { handlePromotion, generateCareerEmbed } = require('./carreiraHelpers.js');

const carreirasPath = path.join(__dirname, 'carreiras.json');
const progressaoPath = path.join(__dirname, 'progressao.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carreira')
        .setDescription('Gerencia o sistema de carreiras e patentes.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Mostra o status da carreira de um membro.')
                .addUserOption(opt => opt.setName('membro').setDescription('O membro para verificar.').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('promover')
                .setDescription('Promove um membro para o próximo cargo na sua facção.')
                .addUserOption(opt => opt.setName('membro').setDescription('O membro a promover.').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('rebaixar')
                .setDescription('Rebaixa um membro para o cargo anterior na sua facção.')
                .addUserOption(opt => opt.setName('membro').setDescription('O membro a rebaixar.').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('setcargo')
                .setDescription('Define manualmente um cargo de carreira para um membro.')
                .addUserOption(opt => opt.setName('membro').setDescription('O membro.').setRequired(true))
                .addStringOption(opt => opt.setName('cargo_id').setDescription('O ID do cargo (definido no carreiras.json).').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('setfaccao')
                .setDescription('Define a facção de um membro.')
                .addUserOption(opt => opt.setName('membro').setDescription('O membro.').setRequired(true))
                .addStringOption(opt => opt.setName('faccao_id').setDescription('O ID da facção (definido no carreiras.json).').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('addwins')
                .setDescription('Adiciona vitórias ao progresso de um membro.')
                .addUserOption(opt => opt.setName('membro').setDescription('O membro.').setRequired(true))
                .addIntegerOption(opt => opt.setName('quantidade').setDescription('Número de vitórias a adicionar.').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('removewins')
                .setDescription('Remove vitórias do progresso de um membro.')
                .addUserOption(opt => opt.setName('membro').setDescription('O membro.').setRequired(true))
                .addIntegerOption(opt => opt.setName('quantidade').setDescription('Número de vitórias a remover.').setRequired(true))
        ),

    async execute(interaction) {
        // --- MUDANÇA AQUI: Adicionado try...catch global ---
        try {
            const sub = interaction.options.getSubcommand();
            const member = interaction.options.getMember('membro');
            
            await interaction.deferReply({ ephemeral: true });

            const progressao = await safeReadJson(progressaoPath);
            const carreirasConfig = await safeReadJson(carreirasPath);

            // --- SUB-COMANDO STATUS ---
            if (sub === 'status') {
                const userProgress = progressao[member.id];
                if (!userProgress || !userProgress.factionId) {
                    return interaction.editReply({ content: '❌ Este usuário ainda não tem uma facção ou registro de progresso.' });
                }

                const faccao = carreirasConfig.faccoes[userProgress.factionId];
                if (!faccao) {
                    return interaction.editReply({ content: '❌ Erro: Não consegui encontrar a facção deste usuário.' });
                }

                const embed = generateCareerEmbed(member, userProgress, faccao, interaction.guild);
                
                return interaction.editReply({
                    content: `Este é o status atual de **${member.displayName}**:`,
                    embeds: [embed]
                });
            }
            
            // --- Lógica de ADM (outros subcomandos) ---
            
            // Garante que o membro existe no progresso.json
            if (!progressao[member.id]) {
                progressao[member.id] = {
                    factionId: null,
                    currentRankId: null,
                    totalWins: 0
                };
            }

            if (sub === 'setfaccao') {
                const faccaoId = interaction.options.getString('faccao_id');
                // --- MUDANÇA AQUI: Verifica se a facção existe no OBJETO ---
                const faccao = carreirasConfig.faccoes[faccaoId];
                // --- FIM DA MUDANÇA ---

                if (!faccao) {
                    return interaction.editReply({ content: '❌ Esse ID de facção não existe no `carreiras.json`.' });
                }

                progressao[member.id].factionId = faccaoId;
                await safeWriteJson(progressaoPath, progressao);
                
                return interaction.editReply({ content: `✅ Facção de ${member.displayName} definida para **${faccao.nome}**.` });
            }

            // Os comandos abaixo precisam que o usuário já tenha uma facção
            const userProgress = progressao[member.id];
            if (!userProgress.factionId) {
                return interaction.editReply({ content: `❌ Este membro não está em nenhuma facção. Use \`/carreira setfaccao\` primeiro.` });
            }
            // --- MUDANÇA AQUI: Lê a facção do OBJETO ---
            const faccao = carreirasConfig.faccoes[userProgress.factionId];
            if (!faccao) {
                return interaction.editReply({ content: `❌ Erro: A facção ID (${userProgress.factionId}) deste usuário não foi encontrada.` });
            }
            // --- FIM DA MUDANÇA ---


            if (sub === 'promover') {
                const rankAtualIndex = userProgress.currentRankId 
                    ? faccao.caminho.findIndex(r => r.id === userProgress.currentRankId) 
                    : -1;
                
                if (rankAtualIndex >= faccao.caminho.length - 1) {
                    return interaction.editReply({ content: '❌ Membro já está na patente máxima!' });
                }
                
                const proximoCargo = faccao.caminho[rankAtualIndex + 1];
                await handlePromotion(interaction, member, 'promover', proximoCargo.id);
            
            } else if (sub === 'rebaixar') {
                const rankAtualIndex = userProgress.currentRankId 
                    ? faccao.caminho.findIndex(r => r.id === userProgress.currentRankId) 
                    : -1;

                if (rankAtualIndex <= 0) {
                    return interaction.editReply({ content: '❌ Membro já está na patente mínima!' });
                }

                const cargoAnterior = faccao.caminho[rankAtualIndex - 1];
                await handlePromotion(interaction, member, 'rebaixar', cargoAnterior.id);

            } else if (sub === 'setcargo') {
                const cargoId = interaction.options.getString('cargo_id');
                const cargoExiste = faccao.caminho.find(r => r.id === cargoId);
                
                if (!cargoExiste) {
                    return interaction.editReply({ content: `❌ O Cargo ID \`${cargoId}\` não foi encontrado no caminho da facção **${faccao.nome}**.` });
                }
                
                await handlePromotion(interaction, member, 'promover', cargoId);
            
            } else if (sub === 'addwins' || sub === 'removewins') {
                const quantidade = interaction.options.getInteger('quantidade');
                if (quantidade <= 0) {
                    return interaction.editReply({ content: '❌ A quantidade deve ser maior que 0.' });
                }

                if (sub === 'addwins') {
                    progressao[member.id].totalWins += quantidade;
                    await safeWriteJson(progressaoPath, progressao);
                    return interaction.editReply({ content: `✅ ${quantidade} vitórias adicionadas. ${member.displayName} agora tem ${progressao[member.id].totalWins} vitórias.` });
                } else {
                    progressao[member.id].totalWins = Math.max(0, progressao[member.id].totalWins - quantidade);
                    await safeWriteJson(progressaoPath, progressao);
                    return interaction.editReply({ content: `✅ ${quantidade} vitórias removidas. ${member.displayName} agora tem ${progressao[member.id].totalWins} vitórias.` });
                }
            }
        // --- MUDANÇA AQUI: Captura erros e envia para o canal de log ---
        } catch (err) {
            await logErrorToChannel(interaction.client, err, interaction);
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
        // --- FIM DA MUDANÇA ---
    },
};