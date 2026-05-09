import axios from 'axios';
import logger from './logger';

class TelegramService {
  private get botToken() { return process.env.TELEGRAM_BOT_TOKEN?.trim(); }
  private get chatId() { return process.env.TELEGRAM_CHAT_ID?.trim(); }
  private get appUrl() { return (process.env.APP_URL || 'http://localhost:3000').trim(); }

  /**
   * Send the morning greeting notification with a link to the chat
   */
  public async sendEntryReminder(): Promise<boolean> {
    const message =
      `☀️ <b>Bom dia!</b>\n\n` +
      `Informe o horário em que você bateu o ponto de entrada.\n\n` +
      `👉 <a href="${this.appUrl}">Acesse o PointCentral</a>`;
    return this.sendRawMessage(message);
  }

  /**
   * Send lunch out notification with link
   */
  public async sendLunchOutReminder(suggestedTime: string): Promise<boolean> {
    const message =
      `🍴 <b>Hora do almoço!</b>\n\n` +
      `Horário previsto: <b>${suggestedTime}</b>\n` +
      `Informe o horário real de saída.\n\n` +
      `👉 <a href="${this.appUrl}">Acesse</a>`;
    return this.sendRawMessage(message);
  }

  /**
   * Send lunch return notification with link
   */
  public async sendLunchReturnReminder(suggestedTime: string): Promise<boolean> {
    const message =
      `🔙 <b>Hora de voltar!</b>\n\n` +
      `Horário previsto de retorno: <b>${suggestedTime}</b>\n` +
      `Informe o horário real de retorno.\n\n` +
      `👉 <a href="${this.appUrl}">Acesse</a>`;
    return this.sendRawMessage(message);
  }

  /**
   * Send final exit notification with link
   */
  public async sendFinalExitReminder(suggestedTime: string): Promise<boolean> {
    const message =
      `🚀 <b>Fim do expediente!</b>\n\n` +
      `Horário calculado: <b>${suggestedTime}</b>\n` +
      `Informe o horário real de saída.\n\n` +
      `👉 <a href="${this.appUrl}">Acesse</a>`;
    return this.sendRawMessage(message);
  }

  /**
   * Legacy simple message (kept for compatibility)
   */
  public async sendMessage(time: string): Promise<boolean> {
    const message = `⏰ <b>Hora do Ponto!</b>\nSão ${time}, não esqueça de registrar seu horário.\n\n👉 <a href="${this.appUrl}">Acesse</a>`;
    return this.sendRawMessage(message);
  }

  /**
   * Core method to send message via Telegram Bot API
   */
  public async sendRawMessage(text: string): Promise<boolean> {
    if (!this.botToken || !this.chatId) {
      logger.error('Telegram Bot Token or Chat ID missing in environment variables');
      return false;
    }

    try {
      const maskedToken = this.botToken ? `${this.botToken.substring(0, 5)}...` : 'MISSING';
      logger.info(`Sending Telegram message to Chat ID: ${this.chatId} (Token: ${maskedToken})`);

      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await axios.post(url, {
        chat_id: this.chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });

      if (response.data && response.data.ok) {
        logger.info('Telegram message sent successfully');
        return true;
      } else {
        logger.error(`Telegram API returned error: ${JSON.stringify(response.data)}`);
        return false;
      }
    } catch (error: any) {
      if (error.response) {
        logger.error(`Telegram API returned status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else {
        logger.error('Error sending Telegram message:', error.message);
      }
      return false;
    }
  }
}

export default new TelegramService();
