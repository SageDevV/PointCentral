import { DateTime } from 'luxon';
import cron from 'node-cron';
import logger from './logger';
import storage from './storage';
import whatsapp from './whatsapp';

class SchedulerService {
  private timezone: string;
  private notificationTimes: string[];

  constructor() {
    this.timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
    this.notificationTimes = (process.env.NOTIFICATION_TIMES || '08:00,11:30,12:30,17:45').split(',');
  }

  public start() {
    logger.info(`Scheduler started. Timezone: ${this.timezone}. Configured times: ${this.notificationTimes.join(', ')}`);

    // Run every minute
    cron.schedule('* * * * *', () => {
      this.checkAndNotify();
    }, {
      timezone: this.timezone
    });

    // Cleanup storage every day at midnight
    cron.schedule('0 0 * * *', () => {
      storage.cleanup();
      logger.info('Storage cleanup executed.');
    }, {
      timezone: this.timezone
    });
  }

  private async checkAndNotify() {
    const now = DateTime.now().setZone(this.timezone);
    const currentTime = now.toFormat('HH:mm');
    const currentDate = now.toFormat('yyyy-MM-dd');

    logger.debug(`Checking time: ${currentTime} (${currentDate})`);

    if (this.notificationTimes.includes(currentTime)) {
      if (storage.wasSent(currentDate, currentTime)) {
        logger.debug(`Notification for ${currentTime} already sent today.`);
        return;
      }

      logger.info(`Triggering notification for ${currentTime}...`);
      
      const success = await whatsapp.sendMessage(currentTime);
      
      if (success) {
        storage.markAsSent(currentDate, currentTime);
      } else {
        logger.error(`Failed to send notification for ${currentTime}. Will retry in the next minute check if still applicable.`);
      }
    }
  }
}

export default new SchedulerService();
