import axios from 'axios';
import logger from './logger';

class WhatsAppService {
  private readonly baseUrl = 'https://api.callmebot.com/whatsapp.php';

  /**
   * Sends a message using CallMeBot API (GET request)
   */
  public async sendMessage(timeId: string): Promise<boolean> {
    const apiKey = process.env.CALLMEBOT_API_KEY;
    const recipient = process.env.RECIPIENT_PHONE_NUMBER;

    if (!apiKey || !recipient) {
      logger.error('CallMeBot API Key or recipient missing in environment variables');
      return false;
    }

    const messageText = this.getMessageContent(timeId);

    try {
      // CallMeBot uses a simple GET request
      const response = await axios.get(this.baseUrl, {
        params: {
          phone: recipient,
          text: messageText,
          apikey: apiKey,
          source: 'php'
        },
      });

      if (response.status === 200) {
        logger.info(`Message sent via CallMeBot for ${timeId}. Response: ${response.data}`);
        return true;
      } else {
        logger.error(`CallMeBot returned status ${response.status}: ${response.data}`);
        return false;
      }
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      logger.error(`Failed to send CallMeBot message for ${timeId}:`, errorData);
      return false;
    }
  }

  private getMessageContent(timeId: string): string {
    const messages: { [key: string]: string } = {
      '08:00': '⏰ Bom dia! Hora de bater o ponto de ENTRADA.',
      '11:30': '🍴 Quase lá! Não esqueça do ponto de SAÍDA PARA ALMOÇO.',
      '12:30': '💼 De volta ao trabalho? Bata o ponto de RETORNO DO ALMOÇO.',
      '17:45': '🏠 Fim de expediente! Lembre-se de bater o ponto de SAÍDA FINAL.',
    };

    return messages[timeId] || `🔔 Lembrete de ponto: ${timeId}`;
  }
}

export default new WhatsAppService();
