"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = __importDefault(require("./logger"));
const storage_1 = __importDefault(require("./storage"));
const whatsapp_1 = __importDefault(require("./whatsapp"));
class SchedulerService {
    constructor() {
        this.timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
        this.notificationTimes = (process.env.NOTIFICATION_TIMES || '08:00,11:30,12:30,17:45').split(',');
    }
    start() {
        logger_1.default.info(`Scheduler started. Timezone: ${this.timezone}. Configured times: ${this.notificationTimes.join(', ')}`);
        // Run every minute
        node_cron_1.default.schedule('* * * * *', () => {
            this.checkAndNotify();
        }, {
            timezone: this.timezone
        });
        // Cleanup storage every day at midnight
        node_cron_1.default.schedule('0 0 * * *', () => {
            storage_1.default.cleanup();
            logger_1.default.info('Storage cleanup executed.');
        }, {
            timezone: this.timezone
        });
    }
    async checkAndNotify() {
        const now = luxon_1.DateTime.now().setZone(this.timezone);
        const currentTime = now.toFormat('HH:mm');
        const currentDate = now.toFormat('yyyy-MM-dd');
        logger_1.default.debug(`Checking time: ${currentTime} (${currentDate})`);
        if (this.notificationTimes.includes(currentTime)) {
            if (storage_1.default.wasSent(currentDate, currentTime)) {
                logger_1.default.debug(`Notification for ${currentTime} already sent today.`);
                return;
            }
            logger_1.default.info(`Triggering notification for ${currentTime}...`);
            const success = await whatsapp_1.default.sendMessage(currentTime);
            if (success) {
                storage_1.default.markAsSent(currentDate, currentTime);
            }
            else {
                logger_1.default.error(`Failed to send notification for ${currentTime}. Will retry in the next minute check if still applicable.`);
            }
        }
    }
}
exports.default = new SchedulerService();
