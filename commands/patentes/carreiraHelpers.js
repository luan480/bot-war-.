/* commands/adm/carreiraHelpers.js (ATUALIZADO E COMPLETO) */

const { EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const carreirasPath = path.join(__dirname, 'carreiras.json');
const progressaoPath = path.join(__dirname, 'progressao.json');

/**
 * (FUNÇÃO INTERNA) Atualiza os cargos de um membro, removendo o antigo e adicionando o novo.
 */
async function _updateMemberRoles(member, oldRankId, newRankId, faccao) {
    const oldRank = faccao.caminho.find(r => r.id === oldRankId);
    const newRank = faccao.caminho.find(r => r.id === newRankId);

    if (!newRank) {
        console.error(`[Carreira] Tentativa de promover para um cargo que não existe: ${newRankId}`);
        return;
    }

    // Remover cargo antigo (se existir)
    if (oldRank && oldRank.roleId) {
        try {
            const role = await member.guild.roles.fetch(oldRank.roleId);
            if (role) await member.roles.remove(role);
        } catch (err) {
            console.error(`[Carreira] Não foi possível remover o cargo antigo ${oldRank.roleId}: ${err.message}`);
        }
    }

    // Adicionar cargo novo
    try {
        const role = await member.guild.roles.fetch(newRank.roleId);
        if (role) await member.roles.add(role);
    } catch (err) {
        console.error(`[Carreira] Não foi possível adicionar o cargo novo ${newRank.roleId}: ${err.message}`);
    }
}

// --- MUDANÇA AQUI: 'recalcularRank' foi re-adicionado e melhorado ---

/**
 * Calcula o cargo correto de um membro com base nas suas vitórias totais.
 * Esta função ATUALIZA os cargos no Discord e MODIFICA o objeto 'userProgress'.
 */
async function recalcularRank(member, faccao, userProgress) {
    const totalWins = userProgress.totalWins;
    const cargoAntigoId = userProgress.currentRankId;
    let cargoNovoId = null;

    // Encontra o cargo mais alto que o membro merece
    for (const rank of faccao.caminho) {
        if (totalWins >= rank.custo) {
            cargoNovoId = rank.id;
        } else {
            // Se não tem vitórias para este, para de procurar
            break; 
        }
    }

    // Se o cargo calculado for diferente do que ele tem, atualiza.
    if (cargoAntigoId !== cargoNovoId) {
        await _updateMemberRoles(member, cargoAntigoId, cargoNovoId, faccao);
        userProgress.currentRankId = cargoNovoId; // Modifica o objeto
    }
}
// --- FIM DA MUDANÇA ---


/**
 * Lida com a lógica de promoção/rebaixamento manual vinda de um comando.
 * (Esta função já existia)
 */
async function handlePromotion(interaction, member, type, newRankId) {
    const progressao = await safeReadJson(progressaoPath); // Usa await
    const carreirasConfig = await safeReadJson(carreirasPath); // Usa await

    if (!progressao[member.id] || !progressao[member.id].factionId) {
        return interaction.editReply({ content: '❌ Erro: Este membro não está em nenhuma facção.' });
    }

    const faccaoId = progressao[member.id].factionId;
    const faccao = carreirasConfig.faccoes[faccaoId];
    if (!faccao) {
        return interaction.editReply({ content: '❌ Erro: Facção não encontrada.' });
    }

    const currentRankId = progressao[member.id].currentRankId;
    const newRank = faccao.caminho.find(r => r.id === newRankId);

    if (!newRank) {
        return interaction.editReply({ content: '❌ Erro: O cargo de destino não foi encontrado.' });
    }

    // Chama a função interna de atualização de cargos
    await _updateMemberRoles(member, currentRankId, newRankId, faccao);

    // Atualizar o progresso
    progressao[member.id].currentRankId = newRankId;
    // Sincroniza as vitórias com o custo do novo cargo (para comandos manuais)
    progressao[member.id].totalWins = newRank.custo; 
    
    await safeWriteJson(progressaoPath, progressao); // Usa await

    const actionText = type === 'promover' ? 'promovido' : 'rebaixado';
    
    await interaction.editReply({ 
        content: `✅ Sucesso! ${member.displayName} foi ${actionText} para **${newRank.nome}** (Vitórias sincronizadas para ${newRank.custo}).`
    });

    try {
        await member.send(`Você foi ${actionText} manualmente para **${newRank.nome}** no servidor **${interaction.guild.name}**!`);
    } catch (dmError) {
        console.log(`[Carreira] Não foi possível notificar ${member.user.tag} por DM.`);
    }
}


/**
 * Gera o Embed de Status de Carreira para um utilizador.
 * (Esta função já existia)
 */
function generateCareerEmbed(member, userProgress, faccao, guild) {
    const totalWins = userProgress.totalWins;
    let currentRankName = "• Recruta";
    let nextRankName = "N/A";
    let progressString = "Patente Máxima Atingida! Parabéns!";
    let custoPatenteAtual = 0;

    if (userProgress.currentRankId) {
        const rankAtual = faccao.caminho.find(r => r.id === userProgress.currentRankId);
        currentRankName = rankAtual.nome;
        custoPatenteAtual = rankAtual.custo;
    }

    const rankAtualIndex = userProgress.currentRankId 
        ? faccao.caminho.findIndex(r => r.id === userProgress.currentRankId) 
        : -1; 
    
    if (rankAtualIndex < faccao.caminho.length - 1) {
        const proximoCargo = faccao.caminho[rankAtualIndex + 1];
        nextRankName = proximoCargo.nome;
        const winsNecessarias = proximoCargo.custo;
        const winsFaltando = winsNecessarias - totalWins;
        const custoPatenteProxima = proximoCargo.custo;
        const winsNestaEtapa = custoPatenteProxima - custoPatenteAtual;
        const winsAtuaisNestaEtapa = totalWins - custoPatenteAtual;
        
        let percent = 0;
        if (winsNestaEtapa > 0) {
            percent = Math.floor((winsAtuaisNestaEtapa / winsNestaEtapa) * 10);
        }
        if (percent < 0) percent = 0;
        if (percent > 10) percent = 10;
        
        const barra = '■'.repeat(percent) + '□'.repeat(10 - percent);
        progressString = `**${winsFaltando} vitórias** para a próxima patente.\n${barra} (${totalWins} / ${winsNecessarias} totais)`;
    }
    
    const embed = new EmbedBuilder()
        .setColor('#F1C40F') 
        .setAuthor({ name: `Status de Carreira: ${member.user.username}`, iconURL: member.user.displayAvatarURL() })
        .setThumbnail(guild.iconURL())
        .addFields(
            { name: "Facção", value: faccao.nome, inline: true },
            { name: "Patente Atual", value: currentRankName, inline: true },
            { name: "Total de Vitórias", value: `🏆 ${totalWins}`, inline: true },
            { name: "Próxima Meta", value: nextRankName, inline: false },
            { name: "Progresso", value: progressString, inline: false }
        )
        .setTimestamp();

    return embed;
}


module.exports = { 
    handlePromotion,
    generateCareerEmbed,
    recalcularRank // Exporta a função corrigida
};