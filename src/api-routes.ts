import { Router, Request, Response } from 'express';
import stateMachine from './state-machine';
import telegram from './telegram';
import logger from './logger';
import seniorAutomation from './senior-automation';

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

/** POST /api/senior/verify - Login and locate the Senior point page without clicking register */
router.post('/api/senior/verify', async (_req: Request, res: Response) => {
  try {
    const seniorResult = await seniorAutomation.verifyAccess();
    res.status(seniorResult.success ? 200 : 502).json(seniorResult);
  } catch (err) {
    logger.error('Error validating Senior access:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/** POST /api/register - Register in Senior, then capture current time and advance to next step */
router.post('/api/register', async (req: Request, res: Response) => {
  try {
    const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;
    const seniorResult = dryRun
      ? await seniorAutomation.verifyAccess()
      : await seniorAutomation.registerPoint();

    if (!seniorResult.success) {
      res.status(502).json({
        success: false,
        message: 'Nao foi possivel registrar o ponto na Senior.',
        error: seniorResult.message,
        senior: seniorResult,
        newState: stateMachine.getState(),
      });
      return;
    }

    if (dryRun) {
      res.json({
        success: true,
        message: 'Verificacao da Senior concluida sem registrar o ponto.',
        senior: seniorResult,
        newState: stateMachine.getState(),
      });
      return;
    }

    const result = stateMachine.registerCurrentTime();
    
    // Se o registro foi com sucesso, envia confirmação + previsão via WhatsApp
    if (result.success) {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      let tgMsg = '';

      if (result.isBreak) {
        // Mensagem customizada para saídas/retornos não previstos
        tgMsg = result.message.includes('Saída não prevista') 
          ? `⚠️ <b>Saída não prevista registrada!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse para registrar o retorno</a>`
          : `✅ <b>Retorno registrado!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse</a>`;
      } else {
        // Mensagem padrão para marcos oficiais
        tgMsg = `✅ <b>Ponto Registrado!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse</a>`;
      }

      // Não bloqueia a requisição HTTP aguardando o envio do Telegram (fire-and-forget)
      telegram.sendRawMessage(tgMsg).catch(err => logger.error('Error sending confirmation telegram:', err));
    }

    res.json({ ...result, senior: seniorResult });
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
      const tgMsg = result.isBreak
        ? (result.message.includes('Saída não prevista')
          ? `⚠️ <b>Saída não prevista registrada!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse para registrar o retorno</a>`
          : `✅ <b>Retorno registrado!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse</a>`)
        : `✅ <b>Ponto Registrado!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse</a>`;
      telegram.sendRawMessage(tgMsg).catch(err => logger.error('Error sending break telegram:', err));
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
      const tgMsg = `✏️ <b>Ponto Manual Registrado!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse</a>`;
      telegram.sendRawMessage(tgMsg).catch(err => logger.error('Error sending manual telegram:', err));
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
