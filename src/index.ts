import dotenv from 'dotenv';
import path from 'path';
import express from 'express';

// Load environment variables
dotenv.config();

import logger from './logger';
import scheduler from './scheduler';

const app = express();
const port = process.env.PORT || 3000;

async function main() {
  logger.info('Initializing Point Notification System...');

  // Simple endpoint to keep the service alive
  app.get('/', (req, res) => {
    res.send('Point Notification System is running! 🤖');
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  app.listen(port, () => {
    logger.info(`Health check server listening on port ${port}`);
  });

  try {
    scheduler.start();
    logger.info('System is running in background.');
  } catch (error) {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
  }
}

// Handle termination
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

main();
