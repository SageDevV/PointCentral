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
      let wppMsg = '';

      if (result.isBreak) {
        // Mensagem customizada para saídas/retornos não previstos
        wppMsg = result.message.includes('Saída não prevista') 
          ? `⚠️ *Saída não prevista registrada!*\n\n${result.message}\n\n👉 Acesse para registrar o retorno: ${appUrl}`
          : `✅ *Retorno registrado!*\n\n${result.message}\n\n👉 Acesse: ${appUrl}`;
      } else {
        // Mensagem padrão para marcos oficiais
        wppMsg = `✅ *Ponto Registrado!*\n\n${result.message}\n\n👉 Acesse: ${appUrl}`;
      }

      // Não bloqueia a requisição HTTP aguardando o envio do WhatsApp (fire-and-forget)
      whatsapp.sendRawMessage(wppMsg).catch(err => logger.error('Error sending confirmation whatsapp:', err));
    }

    res.json(result);
  } catch (err) {
    logger.error('Error registering time:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/register-break — Register an unscheduled break out/return */
router.post('/api/register-break', async (_req: Request, res: Response) => {
  try {
    const result = stateMachine.registerBreak();

    if (result.success) {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const wppMsg = result.isBreak
        ? (result.message.includes('Saída não prevista')
          ? `⚠️ *Saída não prevista registrada!*\n\n${result.message}\n\n👉 Acesse para registrar o retorno: ${appUrl}`
          : `✅ *Retorno registrado!*\n\n${result.message}\n\n👉 Acesse: ${appUrl}`)
        : `✅ *Ponto Registrado!*\n\n${result.message}\n\n👉 Acesse: ${appUrl}`;
      whatsapp.sendRawMessage(wppMsg).catch(err => logger.error('Error sending break whatsapp:', err));
    }

    res.json(result);
  } catch (err) {
    logger.error('Error registering break:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/register-manual — Register a manually informed time */
router.post('/api/register-manual', async (req: Request, res: Response) => {
  try {
    const { time } = req.body;
    if (!time || typeof time !== 'string') {
      res.status(400).json({ error: 'Campo "time" é obrigatório (formato HH:mm).' });
      return;
    }

    const result = stateMachine.registerManualTime(time);

    if (result.success) {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const wppMsg = `✏️ *Ponto Manual Registrado!*\n\n${result.message}\n\n👉 Acesse: ${appUrl}`;
      whatsapp.sendRawMessage(wppMsg).catch(err => logger.error('Error sending manual whatsapp:', err));
    }

    res.json(result);
  } catch (err) {
    logger.error('Error registering manual time:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/reset — Reset the day */
router.post('/api/reset', async (_req: Request, res: Response) => {
  try {
    const newState = stateMachine.reset();
    res.json({ success: true, message: 'Dia resetado com sucesso.', newState });
  } catch (err) {
    logger.error('Error resetting day:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/skip — Skip the rest of the day */
router.post('/api/skip', async (_req: Request, res: Response) => {
  try {
    const result = stateMachine.skipDay();
    res.json(result);
  } catch (err) {
    logger.error('Error skipping day:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
