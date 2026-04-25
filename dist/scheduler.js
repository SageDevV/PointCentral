"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const luxon_1 = require("luxon");
const state_machine_1 = __importDefault(require("./state-machine"));
const whatsapp_1 = __importDefault(require("./whatsapp"));
const logger_1 = __importDefault(require("./logger"));
class SchedulerService {
    constructor() {
        this.timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
        this.morningNotificationSent = false;
        this.lastNotificationDate = '';
    }
    start() {
        logger_1.default.info(`Dynamic Scheduler started for ${this.timezone}`);
        this.lastNotificationDate = luxon_1.DateTime.now().setZone(this.timezone).toFormat('yyyy-MM-dd');
        // Every minute: check for dynamic timer triggers
        node_cron_1.default.schedule('* * * * *', async () => {
            await this.tick();
        }, { timezone: this.timezone });
        // 07:00 Mon-Fri: Morning greeting
        node_cron_1.default.schedule('0 7 * * 1-5', async () => {
            await this.sendMorningGreeting();
        }, { timezone: this.timezone });
        logger_1.default.info('Cron jobs registered: [every minute tick] [07:00 Mon-Fri greeting]');
    }
    async sendMorningGreeting() {
        const today = luxon_1.DateTime.now().setZone(this.timezone).toFormat('yyyy-MM-dd');
        if (this.lastNotificationDate !== today) {
            this.morningNotificationSent = false;
            this.lastNotificationDate = today;
        }
        if (this.morningNotificationSent || !state_machine_1.default.isWeekday())
            return;
        logger_1.default.info('Sending morning greeting...');
        const result = state_machine_1.default.startDay();
        if (result.success) {
            await whatsapp_1.default.sendEntryReminder();
            this.morningNotificationSent = true;
            logger_1.default.info('Morning greeting sent.');
        }
    }
    async tick() {
        const today = luxon_1.DateTime.now().setZone(this.timezone).toFormat('yyyy-MM-dd');
        if (this.lastNotificationDate !== today) {
            this.morningNotificationSent = false;
            this.lastNotificationDate = today;
        }
        if (!state_machine_1.default.shouldTriggerNow())
            return;
        const state = state_machine_1.default.getState();
        logger_1.default.info(`Timer triggered: ${state.status}, target: ${state.nextNotificationAt}`);
        const result = state_machine_1.default.triggerNotification();
        if (!result.success)
            return;
        const targetTime = state.nextNotificationAt || '';
        switch (state.status) {
            case 'WAITING_LUNCH_OUT':
                await whatsapp_1.default.sendLunchOutReminder(targetTime);
                break;
            case 'WAITING_LUNCH_RETURN':
                await whatsapp_1.default.sendLunchReturnReminder(targetTime);
                break;
            case 'WAITING_FINAL_EXIT':
                await whatsapp_1.default.sendFinalExitReminder(targetTime);
                break;
        }
        logger_1.default.info('Dynamic notification sent.');
    }
}
exports.default = new SchedulerService();
