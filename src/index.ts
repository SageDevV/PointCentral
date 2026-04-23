import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

import logger from './logger';
import scheduler from './scheduler';

async function main() {
  logger.info('Initializing Point Notification System...');

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
