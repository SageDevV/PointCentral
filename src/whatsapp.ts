import axios from 'axios';
import logger from './logger';

class WhatsAppService {
  private get apiKey() { return process.env.CALLMEBOT_API_KEY; }
  private get phoneNumber() { return process.env.RECIPIENT_PHONE_NUMBER; }
  private get appUrl() { return process.env.APP_URL || 'http://localhost:3000'; }

  /**
   * Send the morning greeting notification with a link to the chat
   */
  public async sendEntryReminder(): Promise<boolean> {
    const message =
      `☀️ Bom dia!\n\n` +
      `Informe o horário em que você bateu o ponto de entrada.\n\n` +
      `👉 Acesse o PointCentral:\n${this.appUrl}`;
    return this.sendRawMessage(message);
  }

  /**
   * Send lunch out notification with link
   */
  public async sendLunchOutReminder(suggestedTime: string): Promise<boolean> {
    const message =
      `🍴 Hora do almoço!\n\n` +
      `Horário previsto: ${suggestedTime}\n` +
      `Informe o horário real de saída.\n\n` +
      `👉 ${this.appUrl}`;
    return this.sendRawMessage(message);
  }

  /**
   * Send lunch return notification with link
   */
  public async sendLunchReturnReminder(suggestedTime: string): Promise<boolean> {
    const message =
      `🔙 Hora de voltar!\n\n` +
      `Horário previsto de retorno: ${suggestedTime}\n` +
      `Informe o horário real de retorno.\n\n` +
      `👉 ${this.appUrl}`;
    return this.sendRawMessage(message);
  }

  /**
   * Send final exit notification with link
   */
  public async sendFinalExitReminder(suggestedTime: string): Promise<boolean> {
    const message =
      `🚀 Fim do expediente!\n\n` +
      `Horário calculado: ${suggestedTime}\n` +
      `Informe o horário real de saída.\n\n` +
      `👉 ${this.appUrl}`;
    return this.sendRawMessage(message);
  }

  /**
   * Legacy simple message (kept for compatibility)
   */
  public async sendMessage(time: string): Promise<boolean> {
    const message = `⏰ Hora do Ponto!\nSão ${time}, não esqueça de registrar seu horário.\n\n👉 ${this.appUrl}`;
    return this.sendRawMessage(message);
  }

  public async sendRawMessage(text: string): Promise<boolean> {
    if (!this.apiKey || !this.phoneNumber) {
      logger.error('API Key or Phone Number missing');
      return false;
    }

    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${this.phoneNumber}&text=${encodeURIComponent(text)}&apikey=${this.apiKey}&source=php`;
      const response = await axios.get(url);

      // O CallMeBot às vezes retorna erros no corpo da mensagem mesmo com status 2xx
      if (response.data && (response.data.includes('APIKey is invalid') || response.data.includes('error'))) {
        logger.error(`CallMeBot returned error in body: ${response.data}`);
        return false;
      }

      logger.info('WhatsApp message sent successfully');
      return true;
    } catch (error: any) {
      if (error.response) {
        logger.error(`CallMeBot returned status ${error.response.status}: ${error.response.data}`);
      } else {
        logger.error('Error sending WhatsApp message:', error.message);
      }
      return false;
    }
  }
}

export default new WhatsAppService();
