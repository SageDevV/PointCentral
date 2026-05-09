import dotenv from 'dotenv';
dotenv.config();

import telegram from './telegram';
import logger from './logger';

async function test() {
  logger.info('🚀 Iniciando teste de disparo manual via Telegram...');
  
  const success = await telegram.sendMessage('TESTE_MANUAL');
  
  if (success) {
    logger.info('✅ Teste concluído com sucesso! Verifique seu Telegram.');
  } else {
    logger.error('❌ O teste falhou. Verifique os logs acima para detalhes.');
  }
}

test();
