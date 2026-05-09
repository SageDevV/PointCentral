"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const state_machine_1 = __importDefault(require("./state-machine"));
const telegram_1 = __importDefault(require("./telegram"));
const logger_1 = __importDefault(require("./logger"));
const senior_automation_1 = __importDefault(require("./senior-automation"));
const router = (0, express_1.Router)();
/** GET /api/state — Returns today's day state */
router.get('/api/state', (_req, res) => {
    try {
        res.json({ state: state_machine_1.default.getState() });
    }
    catch (err) {
        logger_1.default.error('Error fetching state:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/** POST /api/senior/verify - Login and locate the Senior point page without clicking register */
router.post('/api/senior/verify', async (_req, res) => {
    try {
        const seniorResult = await senior_automation_1.default.verifyAccess();
        res.status(seniorResult.success ? 200 : 502).json(seniorResult);
    }
    catch (err) {
        logger_1.default.error('Error validating Senior access:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/** POST /api/register - Register in Senior, then capture current time and advance to next step */
router.post('/api/register', async (req, res) => {
    try {
        const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;
        const seniorResult = dryRun
            ? await senior_automation_1.default.verifyAccess()
            : await senior_automation_1.default.registerPoint();
        if (!seniorResult.success) {
            res.status(502).json({
                success: false,
                message: 'Nao foi possivel registrar o ponto na Senior.',
                error: seniorResult.message,
                senior: seniorResult,
                newState: state_machine_1.default.getState(),
            });
            return;
        }
        if (dryRun) {
            res.json({
                success: true,
                message: 'Verificacao da Senior concluida sem registrar o ponto.',
                senior: seniorResult,
                newState: state_machine_1.default.getState(),
            });
            return;
        }
        const result = state_machine_1.default.registerCurrentTime();
        // Se o registro foi com sucesso, envia confirmação + previsão via Telegram
        if (result.success) {
            const appUrl = process.env.APP_URL || 'http://localhost:3000';
            let tgMsg = '';
            if (result.isBreak) {
                // Mensagem customizada para saídas/retornos não previstos
                tgMsg = result.message.includes('Saída não prevista')
                    ? `⚠️ <b>Saída não prevista registrada!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse para registrar o retorno</a>`
                    : `✅ <b>Retorno registrado!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse</a>`;
            }
            else {
                // Mensagem padrão para marcos oficiais
                tgMsg = `✅ <b>Ponto Registrado!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse</a>`;
            }
            // Não bloqueia a requisição HTTP aguardando o envio do Telegram (fire-and-forget)
            telegram_1.default.sendRawMessage(tgMsg).catch(err => logger_1.default.error('Error sending confirmation telegram:', err));
        }
        res.json({ ...result, senior: seniorResult });
    }
    catch (err) {
        logger_1.default.error('Error registering time:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/** POST /api/register-break — Register an unscheduled break out/return */
router.post('/api/register-break', async (_req, res) => {
    try {
        const result = state_machine_1.default.registerBreak();
        if (result.success) {
            const appUrl = process.env.APP_URL || 'http://localhost:3000';
            const tgMsg = result.isBreak
                ? (result.message.includes('Saída não prevista')
                    ? `⚠️ <b>Saída não prevista registrada!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse para registrar o retorno</a>`
                    : `✅ <b>Retorno registrado!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse</a>`)
                : `✅ <b>Ponto Registrado!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse</a>`;
            telegram_1.default.sendRawMessage(tgMsg).catch(err => logger_1.default.error('Error sending break telegram:', err));
        }
        res.json(result);
    }
    catch (err) {
        logger_1.default.error('Error registering break:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/** POST /api/register-manual — Register a manually informed time */
router.post('/api/register-manual', async (req, res) => {
    try {
        const { time } = req.body;
        if (!time || typeof time !== 'string') {
            res.status(400).json({ error: 'Campo "time" é obrigatório (formato HH:mm).' });
            return;
        }
        const result = state_machine_1.default.registerManualTime(time);
        if (result.success) {
            const appUrl = process.env.APP_URL || 'http://localhost:3000';
            const tgMsg = `✏️ <b>Ponto Manual Registrado!</b>\n\n${result.message}\n\n👉 <a href="${appUrl}">Acesse</a>`;
            telegram_1.default.sendRawMessage(tgMsg).catch(err => logger_1.default.error('Error sending manual telegram:', err));
        }
        res.json(result);
    }
    catch (err) {
        logger_1.default.error('Error registering manual time:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/** POST /api/reset — Reset the day */
router.post('/api/reset', async (_req, res) => {
    try {
        const newState = state_machine_1.default.reset();
        res.json({ success: true, message: 'Dia resetado com sucesso.', newState });
    }
    catch (err) {
        logger_1.default.error('Error resetting day:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/** POST /api/skip — Skip the rest of the day */
router.post('/api/skip', async (_req, res) => {
    try {
        const result = state_machine_1.default.skipDay();
        res.json(result);
    }
    catch (err) {
        logger_1.default.error('Error skipping day:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
