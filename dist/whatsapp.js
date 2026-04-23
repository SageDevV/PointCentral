"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("./logger"));
class WhatsAppService {
    constructor() {
        this.baseUrl = 'https://api.callmebot.com/whatsapp.php';
    }
    /**
     * Sends a message using CallMeBot API (GET request)
     */
    async sendMessage(timeId) {
        const apiKey = process.env.CALLMEBOT_API_KEY;
        const recipient = process.env.RECIPIENT_PHONE_NUMBER;
        if (!apiKey || !recipient) {
            logger_1.default.error('CallMeBot API Key or recipient missing in environment variables');
            return false;
        }
        const messageText = this.getMessageContent(timeId);
        try {
            // CallMeBot uses a simple GET request
            const response = await axios_1.default.get(this.baseUrl, {
                params: {
                    phone: recipient,
                    text: messageText,
                    apikey: apiKey,
                    source: 'php'
                },
            });
            if (response.status === 200) {
                logger_1.default.info(`Message sent via CallMeBot for ${timeId}. Response: ${response.data}`);
                return true;
            }
            else {
                logger_1.default.error(`CallMeBot returned status ${response.status}: ${response.data}`);
                return false;
            }
        }
        catch (error) {
            const errorData = error.response?.data || error.message;
            logger_1.default.error(`Failed to send CallMeBot message for ${timeId}:`, errorData);
            return false;
        }
    }
    getMessageContent(timeId) {
        const messages = {
            '08:00': '⏰ Bom dia! Hora de bater o ponto de ENTRADA.',
            '11:30': '🍴 Quase lá! Não esqueça do ponto de SAÍDA PARA ALMOÇO.',
            '12:30': '💼 De volta ao trabalho? Bata o ponto de RETORNO DO ALMOÇO.',
            '17:45': '🏠 Fim de expediente! Lembre-se de bater o ponto de SAÍDA FINAL.',
        };
        return messages[timeId] || `🔔 Lembrete de ponto: ${timeId}`;
    }
}
exports.default = new WhatsAppService();
