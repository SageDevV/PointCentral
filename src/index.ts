import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { DateTime } from 'luxon';
import logger from './logger';
import storage from './storage';
import calculator from './calculator';
import whatsapp from './whatsapp';
import scheduler from './scheduler';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const timezone = process.env.TIMEZONE || 'America/Sao_Paulo';

// Função para pegar a URL base do servidor
const getBaseUrl = (req: express.Request) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return `${protocol}://${req.get('host')}`;
};

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Endpoint simplificado para cliques via WhatsApp (GET)
app.get('/log/:type', async (req, res) => {
  const { type } = req.params;
  const baseUrl = getBaseUrl(req);
  await handleLog(type, baseUrl);
  res.send(`
    <html>
      <body style="background:#0f172a; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; text-align:center;">
        <div>
          <h1 style="color:#6366f1;">✅ Sucesso!</h1>
          <p>O evento <b>${type}</b> foi registrado.</p>
          <p>Pode fechar esta aba e voltar para o WhatsApp.</p>
        </div>
      </body>
    </html>
  `);
});

// API original para o Dashboard (POST)
app.post('/api/log/:type', async (req, res) => {
  const { type } = req.params;
  const baseUrl = getBaseUrl(req);
  const result = await handleLog(type, baseUrl);
  res.json({ success: true, message: result });
});

async function handleLog(type: string, baseUrl: string) {
  const now = DateTime.now().setZone(timezone);
  const timeStr = now.toFormat('HH:mm');
  const dateStr = now.toFormat('yyyy-MM-dd');

  const currentLogs = storage.getDayLogs(dateStr);
  let message = '';

  if (type === 'entry') {
    storage.updateDayLogs(dateStr, { entry: timeStr });
    const calc = calculator.calculateLunchOut(timeStr);
    message = `${calc.mensagem}\n\n🍴 Quando sair para o almoço, clique aqui:\n${baseUrl}/log/lunchOut`;
  } 
  else if (type === 'lunchOut') {
    storage.updateDayLogs(dateStr, { lunchOut: timeStr });
    const returnTime = now.plus({ minutes: 60 }).toFormat('HH:mm');
    message = `Almoço iniciado às ${timeStr}.\n\n🔙 Quando retornar, clique aqui:\n${baseUrl}/log/lunchIn`;
  }
  else if (type === 'lunchIn') {
    storage.updateDayLogs(dateStr, { lunchIn: timeStr });
    const calc = calculator.calculateFinalExit(currentLogs.entry || '08:00', currentLogs.lunchOut || timeStr, timeStr);
    storage.updateDayLogs(dateStr, { exit: calc.horarioAlvo });
    message = `${calc.mensagem}\n\n🚀 O robô te avisará quando o expediente acabar!`;
  }

  await whatsapp.sendRawMessage(message);
  return message;
}

app.listen(Number(port), '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${port}`);
  scheduler.start();
});
