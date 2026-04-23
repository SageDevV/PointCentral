"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const logger_1 = __importDefault(require("./logger"));
const scheduler_1 = __importDefault(require("./scheduler"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// 1. Iniciar o servidor IMEDIATAMENTE (Prioridade para o Render)
app.get('/', (req, res) => res.send('Point Notification System is running! 🤖'));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.listen(Number(port), '0.0.0.0', () => {
    logger_1.default.info(`🚀 Health check server listening on port ${port}`);
});
// 2. Iniciar a lógica do sistema
async function main() {
    logger_1.default.info('Initializing Scheduler...');
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
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
main();
