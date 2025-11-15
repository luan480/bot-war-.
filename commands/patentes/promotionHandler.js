/* commands/patentes/promotionHandler.js (CORREÇÃO LÓGICA v2 - Sincronização de Veterano) */

const { Events, EmbedBuilder } = require('discord.js');
const path = require('path');
// Importa dos helpers globais
const { safeReadJson, safeWriteJson, logErrorToChannel } = require('../liga/utils/helpers.js'); 
// Importa dos helpers da pasta 'patentes'
const { recalcularRank } = require('./carreiraHelpers.js'); 

// Caminhos locais (dentro da pasta 'patentes')
const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');
const configPath = path.join(__dirname, 'promocao_config.json');


const promotionVigia = async (client) => {
    
    let config, carreirasConfig;
    
    try {
        // 1. Lê as configurações
        config = await safeReadJson(configPath, { canalDePrints: null, vitoriasPorPrint: 1 });
        carreirasConfig = await safeReadJson(carreirasPath); 

        const canalDePrintsId = config.canalDePrints;
        const cargoRecrutaId = carreirasConfig.cargoRecrutaId;

        // 2. Verifica se está configurado
        if (!canalDePrintsId) {
            console.warn("[AVISO DE PROMOÇÃO] O sistema de promoção está desativado. Use `/promocao-configurar canal`.");
            return; // Para a execução
        }
        if (!carreirasConfig || !carreirasConfig.faccoes || !cargoRecrutaId) {
            console.warn("[AVISO DE PROMOÇÃO] O arquivo 'carreiras.json' está mal formatado (falta 'faccoes' ou 'cargoRecrutaId').");
            return; // Para a execução
        }

        // 3. Loga o sucesso
        console.log(`[INFO Promoção] Vigia de patentes ATIVADO. Canal: ${canalDePrintsId}. Vitórias por Print: ${config.vitoriasPorPrint}`);

    } catch (err) {
        console.error("Falha ao iniciar o promotionHandler:", err);
        logErrorToChannel(client, err, null); 
        return;
    }

    // 4. ATIVA O LISTENER DE MENSAGENS (O VIGIA)
    client.on(Events.MessageCreate, async message => {
        // Usamos as configs lidas no início
        if (message.channel.id !== config.canalDePrints) return;
        if (message.author.bot) return;
        if (message.attachments.size === 0) return; // Só conta anexos

        const member = message.member;
        if (!member) return;
        
        // --- [INÍCIO DA LÓGICA CORRIGIDA] ---
        let faccaoId = null;
        let faccao = null;
        const cargoRecrutaId = carreirasConfig.cargoRecrutaId; 
        const faccoes = carreirasConfig.faccoes;

        // 1. Caminho Rápido: Verifica se tem o cargo principal da facção
        for (const id of Object.keys(facoes)) {
            if (member.roles.cache.has(id)) {
                faccaoId = id;
                faccao = faccoes[id];
                break;
            }
        }

        // 2. Caminho Lento (Sincronização de Veterano): Se não achou,
        // procura por QUALQUER cargo de patente para descobrir a facção
        if (!faccaoId) {
            for (const fId of Object.keys(facoes)) {
                const f = faccoes[fId];
                // Loopa por todas as patentes no 'caminho' da facção
                for (const rank of f.caminho) {
                    if (member.roles.cache.has(rank.id)) {
                        faccaoId = fId;
                        faccao = f;
                        // console.log(`[Promoção] Membro ${member.user.tag} identificado como ${f.nome} via cargo de patente ${rank.nome}.`);
                        break; // Sai do loop de patentes
                    }
                }
                if (faccaoId) break; // Sai do loop de facções
            }
        }
        
        // 3. Verificação Final: Se não achou NENHUM cargo de facção/patente
        // E TAMBÉM não é um Recruta, aí sim ignora.
        if (!faccaoId && !member.roles.cache.has(cargoRecrutaId)) {
            // console.log(`[Promoção] Ignorando print de ${member.user.tag}: Sem cargo de facção ou recruta.`);
            return; 
        }
        // --- [FIM DA LÓGICA CORRIGIDA] ---

        try {
            const progressao = await safeReadJson(progressaoPath);
            const userId = member.id;
            
            // Se o usuário não existe no progressao.json (primeiro print)
            if (!progressao[userId]) {
                
                // Se ele for recruta e não tiver pego cargo de facção ainda
                if (!faccaoId) { 
                    if(member.roles.cache.has(cargoRecrutaId)) {
                        await message.reply({ content: `${member}, não consegui identificar sua facção. Você precisa pegar o cargo da sua facção (Exército, Marinha, etc.) antes de registrar sua primeira vitória.`});
                    }
                    return;
                }
                
                // --- SINCRONIZAÇÃO DE VETERANO (A MÁGICA ACONTECE AQUI) ---
                let cargoMaisAlto = null;
                let custoDoCargo = 0;
                
                // 'faccao' foi definido na lógica corrigida acima
                for (let i = faccao.caminho.length - 1; i >= 0; i--) {
                    const rank = faccao.caminho[i];
                    if (member.roles.cache.has(rank.id)) {
                        cargoMaisAlto = rank;
                        custoDoCargo = rank.custo; 
                        break; // Pega o cargo mais alto que ele tiver
                    }
                }

                progressao[userId] = {
                    factionId: faccaoId, 
                    currentRankId: cargoMaisAlto ? cargoMaisAlto.id : null,
                    totalWins: custoDoCargo // Registra as vitórias do cargo atual
                };
                
                console.log(`[Promoção] Usuário VETERANO ${member.user.tag} sincronizado. Começando com ${custoDoCargo} vitórias.`);
            }
            
            const userProgress = progressao[userId];
            
            // Se ele era recruta e acabou de pegar a facção
            if (!userProgress.factionId && faccaoId) {
                userProgress.factionId = faccaoId;
            }
            
            // Segurança: Garante que a facção do usuário existe
            const faccaoDoUsuario = carreirasConfig.facoes[userProgress.factionId];
            if (!faccaoDoUsuario) {
                 console.error(`[Promoção] Usuário ${member.user.tag} tem uma facção ID (${userProgress.factionId}) que não existe no carreiras.json.`);
                 return;
            }

            // --- Lógica de promoção ---
            const cargoAntigoId = userProgress.currentRankId; 
            const vitoriasParaAdicionar = config.vitoriasPorPrint || 1; 
            
            await message.react('🔰'); // REAGE
            userProgress.totalWins = userProgress.totalWins + vitoriasParaAdicionar; // SOMA PONTOS
            
            // Recalcula o rank
            await recalcularRank(member, faccaoDoUsuario, userProgress);
            
            // Salva no JSON
            await safeWriteJson(progressaoPath, progressao);
            
            const cargoNovoId = userProgress.currentRankId; 
            
            console.log(`[Promoção] +${vitoriasParaAdicionar} vitórias para ${member.user.tag}. Total: ${userProgress.totalWins}. Cargo atual: ${cargoNovoId}`);

            // Se mudou de cargo, anuncia
            if (cargoAntigoId !== cargoNovoId) {
                const novoCargo = faccaoDoUsuario.caminho.find(r => r.id === cargoNovoId);
                const canalDeAnuncio = await client.channels.fetch(faccaoDoUsuario.canalDeAnuncio).catch(() => null);
                
                if (canalDeAnuncio && novoCargo) {
                    const embed = new EmbedBuilder()
                        .setColor('#F1C40F') 
                        .setAuthor({ name: `PROMOÇÃO: ${member.user.username}`, iconURL: member.user.displayAvatarURL() })
                        .setThumbnail(faccaoDoUsuario.nome.includes("Exército") ? "https://i.imgur.com/yBfXTrG.png" : faccaoDoUsuario.nome.includes("Marinha") ? "https://i.imgur.com/GjNlGDu.png" : faccaoDoUsuario.nome.includes("Aeronáutica") ? "https://i.imgur.com/4lGjYQx.png" : "https://i.imgur.com/3QGjGjB.png")
                        .addFields(
                            { name: "Facção", value: faccaoDoUsuario.nome, inline: true },
                            { name: "Nova Patente", value: `**${novoCargo.nome}**`, inline: true },
                            { name: "Total de Vitórias", value: `🏆 ${userProgress.totalWins}`, inline: true }
                        )
                        .setTimestamp();

                    await canalDeAnuncio.send({ 
                        content: `🎉 **PROMOÇÃO!** 🎉\nParabéns ${member}, você foi promovido!`, 
                        embeds: [embed] 
                    });
                }
            }

        } catch (err) {
            console.error(`Erro ao processar print de patente [${message.url}]: ${err.message}`);
            await logErrorToChannel(client, err, message); 
        }
    });
};

module.exports = promotionVigia;