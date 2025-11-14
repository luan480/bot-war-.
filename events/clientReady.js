/* events/clientReady.js (ATUALIZADO) */
const { Events } = require('discord.js');

// --- Carregadores de Módulos (Vigias e Handlers) ---
const ligaButtonHandler = require('../commands/liga/buttons.js');
const carreiraButtonHandler = require('../commands/adm/carreiraButtonHandler.js');
const promotionVigia = require('../commands/adm/promotionHandler.js'); 
const ticketButtonRouter = require('../commands/ticket/buttonRouter.js'); 
const logHandler = require('../commands/adm/logHandler.js'); 
const welcomeHandler = require('../commands/adm/welcomeHandler.js');
const autoResponderHandler = require('../commands/adm/autoResponderHandler.js'); 
const statusHandler = require('../commands/adm/statusHandler.js');
//const { connectToChannel } = require('../commands/adm/voiceHandler.js'); // <-- COMENTA ESTA LINHA

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) { // O 'client' é recebido aqui
		console.log(`🤖 ${client.user.tag} está online!`);
    
        client.buttonHandlers = {
            liga: ligaButtonHandler,
            carreira: carreiraButtonHandler,
            ticket: ticketButtonRouter
        };
        console.log("[INFO] Handlers de botões carregados.");

		// --- Ativa os Vigias ---
		try {
			statusHandler(client);
			console.log("✅ Sistema de Status Rotativo ativado.");
		} catch (err) {
			console.error("❌ Falha ao ativar o Sistema de Status:", err);
		}
		try {
			promotionVigia(client); 
			console.log("✅ Sistema de Promoção (vigia de prints) ativado.");
		} catch (err) {
			console.error("❌ Falha ao ativar o Sistema de Promoção:", err);
		}
		try {
			logHandler(client); 
			console.log("✅ Sistema de Logs (Poderoso) ativado.");
		} catch (err) {
			console.error("❌ Falha ao ativar o Sistema de Logs:", err);
		}
		try {
			welcomeHandler(client); 
			console.log("✅ Sistema de Boas-Vindas ativado.");
		} catch (err) {
			console.error("❌ Falha ao ativar o Sistema de Boas-Vindas:", err);
		}
		try {
			autoResponderHandler(client); 
			console.log("✅ Sistema de Auto-Responder (Chatbot) ativado.");
		} catch (err) {
			console.error("❌ Falha ao ativar o Auto-Responder:", err);
		}

        // --- MUDANÇA AQUI: Tenta conectar ao canal de voz AFK ---
        /* <-- COMENTA ESTAS LINHAS
        try {
            console.log("[INFO] Tentando conectar ao canal de voz AFK...");
            await connectToChannel(client);
        } catch (err) {
            console.error("❌ Falha ao conectar no canal de voz AFK:", err);
        }
        */ // <-- ATÉ AQUI
	},
};