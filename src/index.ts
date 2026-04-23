import dotenv from 'dotenv';
import express from 'express';
import logger from './logger';
import scheduler from './scheduler';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Point Notification System is active! 🤖'));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.listen(Number(port), '0.0.0.0', () => {
  logger.info(`🚀 Health check server listening on port ${port}`);
  scheduler.start();
});
