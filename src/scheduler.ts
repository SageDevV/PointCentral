import cron from 'node-cron';
import { DateTime } from 'luxon';
import storage from './storage';
import whatsapp from './whatsapp';
import logger from './logger';

class SchedulerService {
  private timezone = process.env.TIMEZONE || 'America/Sao_Paulo';

  public start() {
    logger.info(`Static Scheduler started for ${this.timezone}`);

    // Roda a cada minuto
    cron.schedule('* * * * *', async () => {
      await this.checkAndNotify();
    }, {
      timezone: this.timezone
    });
  }

  private async checkAndNotify() {
    const now = DateTime.now().setZone(this.timezone);
    const timeStr = now.toFormat('HH:mm');
    const dateStr = now.toFormat('yyyy-MM-dd');
    
    const notificationTimes = (process.env.NOTIFICATION_TIMES || '08:00,11:30,12:30,17:45').split(',');

    for (const time of notificationTimes) {
      const targetTime = time.trim();
      
      if (timeStr === targetTime) {
        const alreadySent = storage.wasSent(dateStr, targetTime);

        if (!alreadySent) {
          logger.info(`Time match found: ${targetTime}. Sending notification...`);
          const success = await whatsapp.sendMessage(targetTime);
          if (success) {
            storage.markAsSent(dateStr, targetTime);
          }
        }
      }
    }
  }
}

export default new SchedulerService();
