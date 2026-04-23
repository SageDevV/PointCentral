"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("./logger"));
class WhatsAppService {
    constructor() {
        this.baseUrl = 'https://graph.facebook.com/v17.0';
    }
    async sendMessage(timeId) {
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const recipient = process.env.RECIPIENT_PHONE_NUMBER;
        if (!phoneNumberId || !accessToken || !recipient) {
            logger_1.default.error('WhatsApp credentials or recipient missing in environment variables');
            return false;
        }
        const message = this.getMessageContent(timeId);
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/${phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'text',
                text: { body: message },
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            logger_1.default.info(`Message sent successfully for ${timeId}. Response ID: ${response.data.messages[0].id}`);
            return true;
        }
        catch (error) {
            const errorData = error.response?.data || error.message;
            logger_1.default.error(`Failed to send WhatsApp message for ${timeId}:`, errorData);
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
