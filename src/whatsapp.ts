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
