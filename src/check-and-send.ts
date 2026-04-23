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

  logger.info(`Checking notifications at ${currentTimeStr} (${timezone})`);

  const notificationTimes = (process.env.NOTIFICATION_TIMES || '').split(',');

  for (const time of notificationTimes) {
    const targetTime = time.trim();
    
    // Se a hora atual é igual ao horário configurado
    // (Ou se estamos dentro de uma janela de 5 minutos, caso o GitHub atrase um pouco)
    const diffMinutes = now.diff(DateTime.fromFormat(targetTime, 'HH:mm', { zone: timezone }).set({ 
      year: now.year, month: now.month, day: now.day 
    }), 'minutes').minutes;

    // Se estivermos entre 0 e 5 minutos após o horário alvo
    if (diffMinutes >= 0 && diffMinutes < 5) {
      const alreadySent = storage.isAlreadySent(today, targetTime);

      if (!alreadySent) {
        logger.info(`Time match found for ${targetTime}. Sending notification...`);
        const success = await whatsapp.sendMessage(targetTime);
        if (success) {
          storage.markAsSent(today, targetTime);
          logger.info(`Successfully sent and marked ${targetTime} as done.`);
        }
      } else {
        logger.info(`Notification for ${targetTime} already sent today.`);
      }
    }
  }
}

checkAndNotify().catch(err => {
  logger.error('Error in checkAndNotify:', err);
  process.exit(1);
});
