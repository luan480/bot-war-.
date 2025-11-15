/* commands/patentes/promotionHandler.js (v5 - CORREÇÃO DO CRASH 'facoes' E DO LOG 'undefined') */

const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
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
        // --- [CORREÇÃO DO BUG 'undefined'] ---
        // Define o padrão
        const defaultConfig = { canalDePrints: null, vitoriasPorPrint: 1 };
        // Lê o arquivo
        const configLido = await safeReadJson(configPath, defaultConfig);
        // Junta o padrão com o lido, para garantir que 'vitoriasPorPrint' exista
        config = { ...defaultConfig, ...configLido };
        // --- [FIM DA CORREÇÃO] ---

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

        // 3. Loga o sucesso (agora corrigido)
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
        
        // --- [CORREÇÃO DO BUG 'facoes is not defined'] ---
        let faccaoId = null;
        let faccao = null;
        const cargoRecrutaId = carreirasConfig.cargoRecrutaId; 
        // A variável 'facoes' agora é definida AQUI, lendo do 'carreirasConfig'
        const faccoes = carreirasConfig.faccoes; 
        // --- [FIM DA CORREÇÃO] ---

        // 1. Caminho Rápido: Cargo principal
        for (const id of Object.keys(facoes)) {
            if (member.roles.cache.has(id)) {
                faccaoId = id;
                faccao = faccoes[id];
                break;
            }
        }

        // 2. Caminho Lento (Sincronização de Veterano)
        if (!faccaoId) {
            for (const fId of Object.keys(facoes)) {
                const f = faccoes[fId];
                for (const rank of f.caminho) {
                    if (member.roles.cache.has(rank.id)) {
                        faccaoId = fId;
                        faccao = f;
                        break; 
                    }
                }
                if (faccaoId) break; 
            }
        }
        
        // 3. Verificação Final
        if (!faccaoId && !member.roles.cache.has(cargoRecrutaId)) {
            return; 
        }
        // --- FIM DA LÓGICA DE IDENTIFICAÇÃO ---

        try {
            const progressao = await safeReadJson(progressaoPath);
            const userId = member.id;
            
            // Se o usuário não existe no progressao.json (primeiro print)
            if (!progressao[userId]) {
                if (!faccaoId) { 
                    if(member.roles.cache.has(cargoRecrutaId)) {
                        await message.reply({ content: `${member}, não consegui identificar sua facção. Você precisa pegar o cargo da sua facção (Exército, Marinha, etc.) antes de registrar sua primeira vitória.`});
                    }
                    return;
                }
                
                // SINCRONIZAÇÃO DE VETERANO
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
            
            if (!userProgress.factionId && faccaoId) {
                userProgress.factionId = faccaoId;
            }
            
            const faccaoDoUsuario = carreirasConfig.facoes[userProgress.factionId];
            if (!faccaoDoUsuario) {
                 console.error(`[Promoção] Usuário ${member.user.tag} tem uma facção ID (${userProgress.factionId}) que não existe no carreiras.json.`);
                 return;
            }

            // --- Lógica de promoção ---
            const cargoAntigoId = userProgress.currentRankId; 
            // Usa o 'config' corrigido
            const vitoriasParaAdicionar = config.vitoriasPorPrint; 
            
            await message.react('🔰'); 
            userProgress.totalWins = userProgress.totalWins + vitoriasParaAdicionar; 
            
            await recalcularRank(member, faccaoDoUsuario, userProgress);
            await safeWriteJson(progressaoPath, progressao);
            
            const cargoNovoId = userProgress.currentRankId; 
            
            console.log(`[Promoção] +${vitoriasParaAdicionar} vitórias para ${member.user.tag}. Total: ${userProgress.totalWins}. Cargo atual: ${cargoNovoId}`);

            // --- Lógica de Anúncio Público ---
            if (cargoAntigoId !== cargoNovoId) {
                const novoCargo = faccaoDoUsuario.caminho.find(r => r.id === cargoNovoId);
                
                // 1. Criar o Embed Bonito
                const embedPromocao = new EmbedBuilder()
                    .setColor('#F1C40F') 
                    .setAuthor({ name: `PROMOÇÃO: ${member.user.username}`, iconURL: member.user.displayAvatarURL() })
                    .setThumbnail(faccaoDoUsuario.nome.includes("Exército") ? "https://i.imgur.com/yBfXTrG.png" : faccaoDoUsuario.nome.includes("Marinha") ? "https://i.imgur.com/GjNlGDu.png" : faccaoDoUsuario.nome.includes("Aeronáutica") ? "https://i.imgur.com/4lGjYQx.png" : "https://i.imgur.com/3QGjGjB.png")
                    .addFields(
                        { name: "Facção", value: faccaoDoUsuario.nome, inline: true },
                        { name: "Nova Patente", value: `**${novoCargo.nome}**`, inline: true },
                        { name: "Total de Vitórias", value: `🏆 ${userProgress.totalWins}`, inline: true }
                    )
                    .setTimestamp();

                // 2. Criar o Botão de Status
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`carreira_status_${member.id}`) // ID único para o botão
                            .setLabel('Ver Meu Status de Carreira')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📊')
                    );

                // 3. Enviar Anúncio Público (COM O BOTÃO)
                const canalDeAnuncio = await client.channels.fetch(faccaoDoUsuario.canalDeAnuncio).catch(() => null);
                if (canalDeAnuncio && novoCargo) {
                    await canalDeAnuncio.send({ 
                        content: `🎉 **PROMOÇÃO!** 🎉\nParabéns ${member}, você foi promovido!`, 
                        embeds: [embedPromocao],
                        components: [row] // <-- O botão agora vai aqui
                    });
                }
            }
            // --- [FIM DA LÓGICA DE NOTIFICAÇÃO] ---

        } catch (err) {
            console.error(`Erro ao processar print de patente [${message.url}]: ${err.message}`);
            await logErrorToChannel(client, err, message); 
        }
    });
};

module.exports = promotionVigia;