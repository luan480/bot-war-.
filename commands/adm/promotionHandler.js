/* commands/adm/promotionHandler.js (ATUALIZADO) */

const { Events, EmbedBuilder } = require('discord.js');
const path = require('path');

// --- MUDANÇA AQUI: Importa o logger e lê os helpers certos ---
const { safeReadJson, safeWriteJson, logErrorToChannel } = require('../liga/utils/helpers.js');
const { recalcularRank } = require('./carreiraHelpers.js'); // O recalcularRank continua no helpers
// --- FIM DA MUDANÇA ---

// Caminhos para os arquivos JSON
const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');
// --- MUDANÇA AQUI: Lê o ficheiro de CONFIGURAÇÃO correto ---
const configPath = path.join(__dirname, 'promocao_config.json');
// --- FIM DA MUDANÇA ---


const promotionVigia = (client) => {
    
    // Carrega as configurações de forma assíncrona quando o bot está pronto
    client.once(Events.ClientReady, async () => {
        let config, carreirasConfig;
        
        try {
            // Lê os dois ficheiros de configuração
            config = await safeReadJson(configPath, { canalDePrints: null, vitoriasPorPrint: 1 });
            carreirasConfig = await safeReadJson(carreirasPath); // Continua a precisar disto para as facções

            const canalDePrintsId = config.canalDePrints;
            const cargoRecrutaId = carreirasConfig.cargoRecrutaId;

            if (!canalDePrintsId) {
                console.warn("[AVISO DE PROMOÇÃO] O sistema de promoção está desativado. Use `/promocao-configurar canal`.");
                return; 
            }
            if (!carreirasConfig || !carreirasConfig.faccoes || !cargoRecrutaId) {
                console.warn("[AVISO DE PROMOÇÃO] O arquivo 'carreiras.json' está mal formatado (falta 'faccoes' ou 'cargoRecrutaId').");
                return;
            }

            console.log(`[INFO Promoção] Vigia de patentes ATIVADO. Canal: ${canalDePrintsId}. Vitórias por Print: ${config.vitoriasPorPrint}`);

        } catch (err) {
            console.error("Falha ao iniciar o promotionHandler:", err);
            logErrorToChannel(client, err, null); // Loga a falha no startup
            return;
        }

        // O listener de mensagens fica DENTRO do startup assíncrono
        client.on(Events.MessageCreate, async message => {
            // O bot só deve ler o canal que está na config
            if (message.channel.id !== config.canalDePrints) return;
            if (message.author.bot) return;
            if (message.attachments.size === 0) return;

            const member = message.member;
            if (!member) return;
            
            // Lógica para encontrar a facção (esta parte está correta)
            let faccaoId = null;
            let faccao = null;
            const cargoRecrutaId = carreirasConfig.cargoRecrutaId; // Pega o ID do cargo de recruta
            
            for (const id of Object.keys(carreirasConfig.faccoes)) {
                if (member.roles.cache.has(id)) {
                    faccaoId = id;
                    faccao = carreirasConfig.faccoes[id];
                    break;
                }
            }
            
            if (!faccaoId && !member.roles.cache.has(cargoRecrutaId)) {
                return; // Ignora se não for de nenhuma facção E não for um recruta
            }

            try {
                const progressao = await safeReadJson(progressaoPath);
                const userId = member.id;
                
                // --- Sincronização Automática ---
                if (!progressao[userId]) {
                    if (!faccaoId) {
                        // Se é um recruta sem facção, avisa
                        if(member.roles.cache.has(cargoRecrutaId)) {
                            await message.reply({ content: `${member}, não consegui identificar sua facção. Você precisa pegar o cargo da sua facção (Exército, Marinha, etc.) antes de registrar sua primeira vitória.`});
                        }
                        return;
                    }
                    
                    // Sincroniza um membro que já tem cargos mas não está no JSON
                    let cargoMaisAlto = null;
                    let custoDoCargo = 0;
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
                const vitoriasParaAdicionar = config.vitoriasPorPrint || 1; // Pega o valor da config
                
                await message.react('🔰'); 
                userProgress.totalWins = userProgress.totalWins + vitoriasParaAdicionar; // Adiciona a quantidade correta
                
                // ---- O AGENTE ----
                await recalcularRank(member, faccaoDoUsuario, userProgress);
                
                // ---- O SALVAMENTO ----
                await safeWriteJson(progressaoPath, progressao);
                
                const cargoNovoId = userProgress.currentRankId; 
                
                console.log(`[Promoção] +${vitoriasParaAdicionar} vitórias para ${member.user.tag}. Total: ${userProgress.totalWins}. Cargo atual: ${cargoNovoId}`);

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
                await logErrorToChannel(client, err, message); 
            }
        });
    });
};

module.exports = promotionVigia;