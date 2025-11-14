/* commands/adm/definir-canal-afk.js */

const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const serverDataPath = path.join(__dirname, 'server_data.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('definir-canal-afk')
        .setDescription('Define o canal de voz onde o bot deve ficar 24/7.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('O canal de voz para o bot entrar.')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice) // Só permite canais de voz
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('canal');

        // Lê a configuração atual, atualiza e salva
        const serverData = await safeReadJson(serverDataPath);
        serverData.afkVoiceChannel = channel.id;
        await safeWriteJson(serverDataPath, serverData);

        await interaction.editReply(`✅ Canal de voz AFK definido para **${channel.name}**. O bot irá entrar neste canal na próxima vez que reiniciar.`);
        
        // (Opcional) Chamar a função para conectar imediatamente
        // const { connectToChannel } = require('./voiceHandler.js');
        // connectToChannel(interaction.client);
    },
};