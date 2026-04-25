"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("./logger"));
class WhatsAppService {
    get apiKey() { return process.env.CALLMEBOT_API_KEY; }
    get phoneNumber() { return process.env.RECIPIENT_PHONE_NUMBER; }
    get appUrl() { return process.env.APP_URL || 'http://localhost:3000'; }
    /**
     * Send the morning greeting notification with a link to the chat
     */
    async sendEntryReminder() {
        const message = `☀️ Bom dia!\n\n` +
            `Informe o horário em que você bateu o ponto de entrada.\n\n` +
            `👉 Acesse o PointCentral:\n${this.appUrl}`;
        return this.sendRawMessage(message);
    }
    /**
     * Send lunch out notification with link
     */
    async sendLunchOutReminder(suggestedTime) {
        const message = `🍴 Hora do almoço!\n\n` +
            `Horário previsto: ${suggestedTime}\n` +
            `Informe o horário real de saída.\n\n` +
            `👉 ${this.appUrl}`;
        return this.sendRawMessage(message);
    }
    /**
     * Send lunch return notification with link
     */
    async sendLunchReturnReminder(suggestedTime) {
        const message = `🔙 Hora de voltar!\n\n` +
            `Horário previsto de retorno: ${suggestedTime}\n` +
            `Informe o horário real de retorno.\n\n` +
            `👉 ${this.appUrl}`;
        return this.sendRawMessage(message);
    }
    /**
     * Send final exit notification with link
     */
    async sendFinalExitReminder(suggestedTime) {
        const message = `🚀 Fim do expediente!\n\n` +
            `Horário calculado: ${suggestedTime}\n` +
            `Informe o horário real de saída.\n\n` +
            `👉 ${this.appUrl}`;
        return this.sendRawMessage(message);
    }
    /**
     * Legacy simple message (kept for compatibility)
     */
    async sendMessage(time) {
        const message = `⏰ Hora do Ponto!\nSão ${time}, não esqueça de registrar seu horário.\n\n👉 ${this.appUrl}`;
        return this.sendRawMessage(message);
    }
    async sendRawMessage(text) {
        if (!this.apiKey || !this.phoneNumber) {
            logger_1.default.error('API Key or Phone Number missing');
            return false;
        }
        try {
            const url = `https://api.callmebot.com/whatsapp.php?phone=${this.phoneNumber}&text=${encodeURIComponent(text)}&apikey=${this.apiKey}&source=php`;
            const response = await axios_1.default.get(url);
            // O CallMeBot às vezes retorna erros no corpo da mensagem mesmo com status 2xx
            if (response.data && (response.data.includes('APIKey is invalid') || response.data.includes('error'))) {
                logger_1.default.error(`CallMeBot returned error in body: ${response.data}`);
                return false;
            }
            logger_1.default.info('WhatsApp message sent successfully');
            return true;
        }
        catch (error) {
            if (error.response) {
                logger_1.default.error(`CallMeBot returned status ${error.response.status}: ${error.response.data}`);
            }
            else {
                logger_1.default.error('Error sending WhatsApp message:', error.message);
            }
            return false;
        }
    }
}
exports.default = new WhatsAppService();
