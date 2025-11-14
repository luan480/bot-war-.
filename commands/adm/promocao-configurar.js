/* commands/adm/promocao-configurar.js (CORRIGIDO E MELHORADO) */

const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const path = require('path');
// --- [CORREÇÃO AQUI] ---
// Importa do helper GLOBAL (liga/utils)
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
// --- FIM DA CORREÇÃO ---

const configPath = path.join(__dirname, 'promocao_config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promocao-configurar')
        .setDescription('Configura o sistema de promoção automática por prints.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(sub =>
            sub.setName('canal')
                .setDescription('Define o canal onde os prints de vitória devem ser enviados.')
                .addChannelOption(opt =>
                    opt.setName('canal')
                        .setDescription('O canal de texto para monitorizar.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(sub =>
            sub.setName('vitorias')
                .setDescription('Define quantas vitórias cada print vale.')
                .addIntegerOption(opt =>
                    opt.setName('quantidade')
                        .setDescription('O número de vitórias por print (padrão: 1).')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Verifica as configurações atuais do sistema de promoção.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 }); // 64 = Ephemeral (corrige aviso de "deprecated")

        const config = await safeReadJson(configPath, {
            canalDePrints: null,
            vitoriasPorPrint: 1 // Valor padrão
        });

        const sub = interaction.options.getSubcommand();

        if (sub === 'canal') {
            const channel = interaction.options.getChannel('canal');
            config.canalDePrints = channel.id;
            await safeWriteJson(configPath, config); // Esta linha agora funciona
            return interaction.editReply(`✅ O canal de prints de promoção foi definido para ${channel}.`);
        
        } else if (sub === 'vitorias') {
            const quantidade = interaction.options.getInteger('quantidade');
            config.vitoriasPorPrint = quantidade;
            await safeWriteJson(configPath, config); // Esta linha agora funciona
            return interaction.editReply(`✅ Cada print de vitória agora vale **${quantidade}** vitórias.`);

        } else if (sub === 'status') {
            const canal = config.canalDePrints ? `<#${config.canalDePrints}>` : 'Nenhum canal definido';
            const vitorias = config.vitoriasPorPrint || 1;
            
            return interaction.editReply(
                `**Configuração Atual do Sistema de Promoção:**\n` +
                `・**Canal de Prints:** ${canal}\n` +
                `・**Vitórias por Print:** ${vitorias}`
            );
        }
    },
};