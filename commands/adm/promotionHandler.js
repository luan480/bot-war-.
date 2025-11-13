/* commands/adm/promotionHandler.js (CORRIGIDO COM ASYNC E LOGGER) */

const { Events, EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson, logErrorToChannel } = require('../liga/utils/helpers.js');
const { recalcularRank } = require('./carreiraHelpers.js');

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');


const promotionVigia = (client) => {
    
    // Carrega as configurações de forma assíncrona quando o bot está pronto
    client.once(Events.ClientReady, async () => {
        let carreirasConfig, canalDePrintsId, cargoRecrutaId;

        try {
            carreirasConfig = await safeReadJson(carreirasPath); // Usa await
            canalDePrintsId = carreirasConfig.canalDePrints; 
            cargoRecrutaId = carreirasConfig.cargoRecrutaId;

            if (!canalDePrintsId) {
                console.warn("[AVISO DE PROMOÇÃO] O sistema de promoção está desativado. 'canalDePrints' não encontrado no carreiras.json.");
                return; 
            }
            if (!carreirasConfig || !carreirasConfig.faccoes || !cargoRecrutaId) {
                console.warn("[AVISO DE PROMOÇÃO] O arquivo 'carreiras.json' está mal formatado (falta 'faccoes' ou 'cargoRecrutaId').");
                return;
            }

            console.log(`[INFO Promoção] Vigia de patentes ATIVADO. Canal: ${canalDePrintsId}`);

        } catch (err) {
            console.error("Falha ao iniciar o promotionHandler:", err);
            logErrorToChannel(client, err, null); // Loga a falha no startup
            return;
        }

        // O listener de mensagens fica DENTRO do startup assíncrono
        client.on(Events.MessageCreate, async message => {
            if (message.channel.id !== canalDePrintsId) return;
            if (message.author.bot) return;
            if (message.attachments.size === 0) return;

            const member = message.member;
            if (!member) return;
            
            // --- [CORREÇÃO CRÍTICA AQUI] ---
            // Esta é a lógica CORRETA para um objeto JSON
            let faccaoId = null;
            let faccao = null;
            for (const id of Object.keys(carreirasConfig.faccoes)) {
                if (member.roles.cache.has(id)) {
                    faccaoId = id;
                    faccao = carreirasConfig.faccoes[id];
                    break;
                }
            }
            // --- FIM DA CORREÇÃO ---
            
            // Se não encontrou facção E também não é um recruta, ignora.
            if (!faccaoId && !member.roles.cache.has(cargoRecrutaId)) {
                return;
            }

            try {
                const progressao = await safeReadJson(progressaoPath);
                const userId = member.id;
                
                // --- Sincronização Automática ---
                if (!progressao[userId]) {
                    if (!faccaoId) {
                        await message.reply({ content: `${member}, não consegui identificar sua facção. Você precisa pegar o cargo da sua facção (Exército, Marinha, etc.) antes de registrar sua primeira vitória.`});
                        return;
                    }
                    
                    let cargoMaisAlto = null;
                    let custoDoCargo = 0;
                    // Itera pelo caminho da facção encontrada
                    for (let i = faccao.caminho.length - 1; i >= 0; i--) {
                        const rank = faccao.caminho[i];
                        if (member.roles.cache.has(rank.id)) {
                            cargoMaisAlto = rank;
                            custoDoCargo = rank.custo; 
                            break; 
                        }
                    }

                    progressao[userId] = {
                        factionId: faccaoId, 
                        currentRankId: cargoMaisAlto ? cargoMaisAlto.id : null,
                        totalWins: custoDoCargo 
                    };
                    
                    console.log(`[Promoção] Usuário VETERANO ${member.user.tag} sincronizado. Começando com ${custoDoCargo} vitórias.`);
                }
                
                const userProgress = progressao[userId];
                // Se o usuário não tiver facção no JSON, mas tiver cargo, atualiza
                if (!userProgress.factionId && faccaoId) {
                    userProgress.factionId = faccaoId;
                }
                
                const faccaoDoUsuario = carreirasConfig.faccoes[userProgress.factionId];

                if (!faccaoDoUsuario) {
                    console.error(`[Promoção] Usuário ${member.user.tag} tem uma facção ID (${userProgress.factionId}) que não existe no carreiras.json.`);
                    return;
                }

                // ---- O CONTADOR ----
                const cargoAntigoId = userProgress.currentRankId; 
                
                await message.react('🔰'); 
                userProgress.totalWins = userProgress.totalWins + 1;
                
                // ---- O AGENTE ----
                await recalcularRank(member, faccaoDoUsuario, userProgress);
                
                // ---- O SALVAMENTO ----
                await safeWriteJson(progressaoPath, progressao);
                
                const cargoNovoId = userProgress.currentRankId; 
                
                console.log(`[Promoção] +1 vitória para ${member.user.tag}. Total: ${userProgress.totalWins}. Cargo atual: ${cargoNovoId}`);

                // --- [A NOTIFICAÇÃO] ---
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
                await logErrorToChannel(client, err, message); // Loga o erro no Discord
            }
        });
    });
};

module.exports = promotionVigia;