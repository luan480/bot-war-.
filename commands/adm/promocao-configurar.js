/* commands/adm/promocao-configurar.js (ATUALIZADO) */

const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

// Este é o ficheiro de configuração correto que o Handler vai ler
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
        // --- MUDANÇA AQUI: Novo sub-comando ---
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
        // --- FIM DA MUDANÇA ---
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Verifica as configurações atuais do sistema de promoção.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Lê a configuração atual (ou cria uma vazia)
        const config = await safeReadJson(configPath, {
            canalDePrints: null,
            vitoriasPorPrint: 1 // Valor padrão
        });

        const sub = interaction.options.getSubcommand();

        if (sub === 'canal') {
            const channel = interaction.options.getChannel('canal');
            config.canalDePrints = channel.id;
            await safeWriteJson(configPath, config);
            return interaction.editReply(`✅ O canal de prints de promoção foi definido para ${channel}.`);
        
        // --- MUDANÇA AQUI: Lógica do novo sub-comando ---
        } else if (sub === 'vitorias') {
            const quantidade = interaction.options.getInteger('quantidade');
            config.vitoriasPorPrint = quantidade;
            await safeWriteJson(configPath, config);
            return interaction.editReply(`✅ Cada print de vitória agora vale **${quantidade}** vitórias.`);
        // --- FIM DA MUDANÇA ---

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