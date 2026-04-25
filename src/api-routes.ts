import { Router, Request, Response } from 'express';
import stateMachine from './state-machine';
import whatsapp from './whatsapp';
import logger from './logger';

const router = Router();

/** GET /api/state — Returns today's day state */
router.get('/api/state', (_req: Request, res: Response) => {
  try {
    res.json({ state: stateMachine.getState() });
  } catch (err) {
    logger.error('Error fetching state:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/register — Capture current time, advance to next step */
router.post('/api/register', async (_req: Request, res: Response) => {
  try {
    const result = stateMachine.registerCurrentTime();
    
    // Se o registro foi com sucesso, envia confirmação + previsão via WhatsApp
    if (result.success) {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const wppMsg = `✅ *Ponto Registrado!*\n\n${result.message}\n\n👉 Acesse: ${appUrl}`;
      // Não bloqueia a requisição HTTP aguardando o envio do WhatsApp (fire-and-forget)
      whatsapp.sendRawMessage(wppMsg).catch(err => logger.error('Error sending confirmation whatsapp:', err));
    }

    res.json(result);
  } catch (err) {
    logger.error('Error registering time:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
