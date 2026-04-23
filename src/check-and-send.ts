import dotenv from 'dotenv';
dotenv.config();

import { DateTime } from 'luxon';
import whatsapp from './whatsapp';
import storage from './storage';
import logger from './logger';

async function checkAndNotify() {
  const timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
  const now = DateTime.now().setZone(timezone);
  const currentTimeStr = now.toFormat('HH:mm');
  const today = now.toFormat('yyyy-MM-dd');

  logger.info(`Checking static notifications at ${currentTimeStr} (${timezone})`);

  const notificationTimesRaw = process.env.NOTIFICATION_TIMES || '08:00,11:30,12:30,17:45';
  logger.info(`Notification times loaded: ${notificationTimesRaw}`);
  const notificationTimes = notificationTimesRaw.split(',');

  for (const time of notificationTimes) {
    const targetTime = time.trim();
    
    const diffMinutes = now.diff(DateTime.fromFormat(targetTime, 'HH:mm', { zone: timezone }).set({ 
      year: now.year, month: now.month, day: now.day 
    }), 'minutes').minutes;

    logger.info(`- Target: ${targetTime}, Diff: ${diffMinutes.toFixed(2)} min`);

    if (diffMinutes >= 0 && diffMinutes < 5) {
      const alreadySent = storage.wasSent(today, targetTime);

      if (!alreadySent) {
        logger.info(`Time match found for ${targetTime}. Sending WhatsApp...`);
        const success = await whatsapp.sendMessage(targetTime);
        if (success) {
          storage.markAsSent(today, targetTime);
        }
      }
    }
  }
}

checkAndNotify().catch(err => {
  logger.error('Error in checkAndNotify:', err);
  process.exit(1);
});
