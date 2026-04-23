import cron from 'node-cron';
import { DateTime } from 'luxon';
import storage from './storage';
import whatsapp from './whatsapp';
import logger from './logger';

class SchedulerService {
  private timezone = process.env.TIMEZONE || 'America/Sao_Paulo';

  public start() {
    logger.info(`Smart Scheduler started for ${this.timezone}`);

    // Verifica a cada minuto se há notificações pendentes
    cron.schedule('* * * * *', async () => {
      await this.checkNotifications();
    }, {
      timezone: this.timezone
    });
  }

  private async checkNotifications() {
    const now = DateTime.now().setZone(this.timezone);
    const dateStr = now.toFormat('yyyy-MM-dd');
    const timeStr = now.toFormat('HH:mm');
    
    const logs = storage.getDayLogs(dateStr);

    // 1. Notificação de Saída para Almoço (baseado na entrada)
    if (logs.entry && !logs.lunchOut && !logs.notifiedLunch) {
      // Calcula o alvo de almoço (4h 24m após a entrada)
      const entry = DateTime.fromFormat(logs.entry, 'HH:mm', { zone: this.timezone });
      const targetLunch = entry.plus({ minutes: 264 }); // Metade de 8h48m

      if (now >= targetLunch) {
        const msg = `🍴 Hora do Almoço!\nSeu horário de saída ideal é agora (${targetLunch.toFormat('HH:mm')}).\nNão esqueça de registrar o retorno em 1 hora!`;
        await whatsapp.sendRawMessage(msg);
        storage.updateDayLogs(dateStr, { notifiedLunch: true });
      }
    }

    // 2. Notificação de Saída Final (baseado no cálculo real)
    if (logs.exit && !logs.notifiedExit) {
      const targetExit = DateTime.fromFormat(logs.exit, 'HH:mm', { zone: this.timezone });

      if (now >= targetExit) {
        const msg = `🚀 Fim do Expediente!\nSua jornada de 08:48 foi concluída.\nBom descanso!`;
        await whatsapp.sendRawMessage(msg);
        storage.updateDayLogs(dateStr, { notifiedExit: true });
      }
    }
  }
}

export default new SchedulerService();
