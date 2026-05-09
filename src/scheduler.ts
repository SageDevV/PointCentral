import cron from 'node-cron';
import { DateTime } from 'luxon';
import stateMachine from './state-machine';
import telegram from './telegram';
import logger from './logger';

class SchedulerService {
  private timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
  private morningNotificationSent = false;
  private lastNotificationDate = '';

  public start() {
    logger.info(`Dynamic Scheduler started for ${this.timezone}`);
    this.lastNotificationDate = DateTime.now().setZone(this.timezone).toFormat('yyyy-MM-dd');

    // Every minute: check for dynamic timer triggers
    cron.schedule('* * * * *', async () => {
      await this.tick();
    }, { timezone: this.timezone });

    // 07:00 Mon-Fri: Morning greeting
    cron.schedule('0 7 * * 1-5', async () => {
      await this.sendMorningGreeting();
    }, { timezone: this.timezone });

    logger.info('Cron jobs registered: [every minute tick] [07:00 Mon-Fri greeting]');
  }

  private async sendMorningGreeting() {
    const today = DateTime.now().setZone(this.timezone).toFormat('yyyy-MM-dd');
    if (this.lastNotificationDate !== today) {
      this.morningNotificationSent = false;
      this.lastNotificationDate = today;
    }

    if (this.morningNotificationSent || !stateMachine.isWeekday()) return;

    logger.info('Sending morning greeting...');
    const result = stateMachine.startDay();
    if (result.success) {
      await telegram.sendEntryReminder();
      this.morningNotificationSent = true;
      logger.info('Morning greeting sent.');
    }
  }

  private async tick() {
    const today = DateTime.now().setZone(this.timezone).toFormat('yyyy-MM-dd');
    if (this.lastNotificationDate !== today) {
      this.morningNotificationSent = false;
      this.lastNotificationDate = today;
    }

    if (!stateMachine.shouldTriggerNow()) return;

    const state = stateMachine.getState();
    logger.info(`Timer triggered: ${state.status}, target: ${state.nextNotificationAt}`);

    const result = stateMachine.triggerNotification();
    if (!result.success) return;

    const targetTime = state.nextNotificationAt || '';
    switch (state.status) {
      case 'WAITING_LUNCH_OUT':
        await telegram.sendLunchOutReminder(targetTime);
        break;
      case 'WAITING_LUNCH_RETURN':
        await telegram.sendLunchReturnReminder(targetTime);
        break;
      case 'WAITING_FINAL_EXIT':
        await telegram.sendFinalExitReminder(targetTime);
        break;
    }

    logger.info('Dynamic notification sent.');
  }
}

export default new SchedulerService();
