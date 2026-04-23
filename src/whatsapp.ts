import axios from 'axios';
import logger from './logger';

class WhatsAppService {
  private get apiKey() { return process.env.CALLMEBOT_API_KEY; }
  private get phoneNumber() { return process.env.RECIPIENT_PHONE_NUMBER; }

  public async sendMessage(time: string): Promise<boolean> {
    const message = `⏰ Hora do Ponto!\nSão ${time}, não esqueça de registrar seu horário.`;
    return this.sendRawMessage(message);
  }

  public async sendRawMessage(text: string): Promise<boolean> {
    if (!this.apiKey || !this.phoneNumber) {
      logger.error('API Key or Phone Number missing');
      return false;
    }

    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${this.phoneNumber}&text=${encodeURIComponent(text)}&apikey=${this.apiKey}&source=php`;
      await axios.get(url);
      logger.info('WhatsApp message sent successfully');
      return true;
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      return false;
    }
  }
}

export default new WhatsAppService();
