import dotenv from 'dotenv';
import express from 'express';
import logger from './logger';
import scheduler from './scheduler';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 1. Iniciar o servidor IMEDIATAMENTE (Prioridade para o Render)
app.get('/', (req, res) => res.send('Point Notification System is running! 🤖'));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.listen(Number(port), '0.0.0.0', () => {
  logger.info(`🚀 Health check server listening on port ${port}`);
});

// 2. Iniciar a lógica do sistema
async function main() {
  logger.info('Initializing Scheduler...');
  try {
    scheduler.start();
    logger.info('System is running in background.');
  } catch (error) {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
  }
}

// Handle termination
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main();
