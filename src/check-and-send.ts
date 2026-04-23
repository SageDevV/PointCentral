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

  const notificationTimes = (process.env.NOTIFICATION_TIMES || '08:00,11:30,12:30,17:45').split(',');

  for (const time of notificationTimes) {
    const targetTime = time.trim();
    
    // Verifica se estamos no minuto exato ou em uma janela de 5 minutos (para o GitHub Actions)
    const diffMinutes = now.diff(DateTime.fromFormat(targetTime, 'HH:mm', { zone: timezone }).set({ 
      year: now.year, month: now.month, day: now.day 
    }), 'minutes').minutes;

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
