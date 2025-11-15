/* commands/patentes/patentes-painel.js (ARQUIVO NOVO) */
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');

// Caminho para o "cérebro" das carreiras
const carreirasPath = path.join(__dirname, 'carreiras.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('patentes-painel')
        .setDescription('Posta o painel de registro de facção.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        try {
            const carreirasConfig = await safeReadJson(carreirasPath);
            if (!carreirasConfig || !carreirasConfig.faccoes) {
                return interaction.reply({ content: '❌ O arquivo `carreiras.json` não foi encontrado ou está mal formatado.', ephemeral: true });
            }
            
            // Pega os IDs das facções
            const faccaoIds = Object.keys(carreirasConfig.faccoes);
            if (faccaoIds.length < 4) {
                 return interaction.reply({ content: '❌ O `carreiras.json` precisa ter as 4 facções configuradas.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor('#2c2d31')
                .setTitle('🔰 REGISTRO DE FACÇÃO')
                .setDescription('Para iniciar sua jornada em nosso exército, selecione sua facção abaixo.\n\nVocê receberá um cargo de **Recruta** e, ao enviar os prints de suas vitórias no canal correto, será promovido automaticamente.')
                .setThumbnail(interaction.guild.iconURL())
                .setImage('https://i.imgur.com/your-banner-image.png'); // <-- Troque este link por uma imagem de banner sua

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`carreira_${faccaoIds[0]}`) // ID da Marinha
                        .setLabel('Marinha')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚓'),
                    new ButtonBuilder()
                        .setCustomId(`carreira_${faccaoIds[1]}`) // ID do Exército
                        .setLabel('Exército')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🎖️'),
                    new ButtonBuilder()
                        .setCustomId(`carreira_${faccaoIds[2]}`) // ID da Aeronáutica
                        .setLabel('Aeronáutica')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✈️'),
                    new ButtonBuilder()
                        .setCustomId(`carreira_${faccaoIds[3]}`) // ID dos Mercenários
                        .setLabel('Mercenários')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚔️')
                );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: 'Painel de registro postado!', ephemeral: true });

        } catch (error) {
            console.error('Erro ao postar o painel de patentes:', error);
            await interaction.reply({ content: '❌ Ocorreu um erro ao executar este comando.', ephemeral: true });
        }
    },
};