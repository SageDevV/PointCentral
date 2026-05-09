import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import logger from './logger';
import scheduler from './scheduler';
import apiRoutes from './api-routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use(apiRoutes);

// Health check
app.get('/health', (_req: Request, res: Response) => res.status(200).json({ status: 'ok' }));

// Fallback: serve index.html for any non-API route (SPA behavior)
app.get('/{*path}', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(Number(port), '0.0.0.0', () => {
  logger.info(`🚀 PointCentral server listening on port ${port}`);
  scheduler.start();
});
