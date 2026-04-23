"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from .env file
dotenv_1.default.config();
const logger_1 = __importDefault(require("./logger"));
const scheduler_1 = __importDefault(require("./scheduler"));
async function main() {
    logger_1.default.info('Initializing Point Notification System...');
    try {
        scheduler_1.default.start();
        logger_1.default.info('System is running in background.');
    }
    catch (error) {
        logger_1.default.error('Fatal error during startup:', error);
        process.exit(1);
    }
}
// Handle termination
process.on('SIGINT', () => {
    logger_1.default.info('Shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger_1.default.info('Shutting down gracefully...');
    process.exit(0);
});
main();
