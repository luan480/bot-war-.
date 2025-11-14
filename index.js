/* index.js (RESTRUTURADO, LIMPO E COM FILTRO FINAL v2) */
   
require('dotenv').config(); 
const { Client, GatewayIntentBits, Collection } = require('discord.js'); 
const fs = require('fs');
const path = require('path');
const { logErrorToChannel } = require('./commands/liga/utils/helpers.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans, 
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration
    ],
});

// --- Carregador de Comandos ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath).filter(folder => 
    fs.statSync(path.join(commandsPath, folder)).isDirectory()
);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    
    // --- MUDANÇA AQUI: Adicionado "manager" ao filtro ---
    const commandFiles = fs.readdirSync(folderPath).filter(f => {
        const fLower = f.toLowerCase();
        return f.endsWith('.js') && 
               !fLower.includes('handler') && 
               !fLower.includes('router') &&
               !fLower.includes('helpers') &&
               !fLower.includes('buttons') &&
               !fLower.includes('painel') &&
               !fLower.includes('manager'); // <-- NOVA LINHA
    });
    // --- FIM DA MUDANÇA ---
    
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        try {
            const command = require(filePath);
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
            } else {
                 console.log(`[INFO] O ficheiro ${filePath} não é um comando válido e foi ignorado.`);
            }
        } catch (err) {
            console.error(`[AVISO] Não foi possível carregar o comando ${filePath}: ${err.message}`);
        }
    }
}

// --- Carregador de Eventos ---
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// --- HANDLERS GLOBAIS DE ERRO (ANTI-CRASH) ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERRO CRÍTICO] Rejeição não tratada:', reason);
    logErrorToChannel(client, reason, null); 
});

process.on('uncaughtException', (error) => {
    console.error('[ERRO CRÍTICO] Exceção não capturada:', error);
    logErrorToChannel(client, error, null); 
});

// --- Login do Bot ---
client.login(process.env.TOKEN);