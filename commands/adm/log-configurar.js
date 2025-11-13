/* commands/adm/log-configurar.js (ATUALIZADO) */

const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const logConfigPath = path.join(__dirname, 'log_config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('log-configurar')
        .setDescription('Configura os canais de log do servidor.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(sub =>
            sub.setName('canal')
                .setDescription('Define um canal para um tipo específico de log.')
                .addStringOption(opt =>
                    opt.setName('tipo_log')
                        .setDescription('O tipo de log que este canal deve receber.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Entrada de Membros', value: 'guildMemberAdd' },
                            { name: 'Saída de Membros', value: 'guildMemberRemove' },
                            { name: 'Mensagem Apagada', value: 'messageDelete' },
                            { name: 'Mensagem Editada', value: 'messageUpdate' },
                            { name: 'Banimento Adicionado', value: 'guildBanAdd' },
                            { name: 'Banimento Removido', value: 'guildBanRemove' },
                            { name: 'Canal Criado', value: 'channelCreate' },
                            { name: 'Canal Apagado', value: 'channelDelete' },
                            { name: 'Canal Atualizado', value: 'channelUpdate' },
                            { name: 'Cargo Criado', value: 'roleCreate' },
                            { name: 'Cargo Apagado', value: 'roleDelete' },
                            { name: 'Cargo Atualizado', value: 'roleUpdate' },
                            { name: 'Estado de Voz Atualizado', value: 'voiceStateUpdate' },
                            // --- MUDANÇA AQUI ---
                            { name: 'Logs de Erros do Bot', value: 'botErrorLog' }
                            // --- FIM DA MUDANÇA ---
                        )
                )
                .addChannelOption(opt =>
                    opt.setName('canal')
                        .setDescription('O canal de texto que receberá os logs.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        if (sub === 'canal') {
            const logType = interaction.options.getString('tipo_log');
            const channel = interaction.options.getChannel('canal');

            const config = await safeReadJson(logConfigPath);
            config[logType] = channel.id; // Define ou atualiza o ID do canal para esse tipo de log
            await safeWriteJson(logConfigPath, config);

            await interaction.editReply(`✅ O canal ${channel} foi definido com sucesso para os logs do tipo: **${logType}**.`);
        }
    },
};