import dotenv from 'dotenv';
dotenv.config();

import whatsapp from './whatsapp';
import logger from './logger';

async function test() {
  logger.info('🚀 Iniciando teste de disparo manual...');
  
  const success = await whatsapp.sendMessage('TESTE_MANUAL');
  
  if (success) {
    logger.info('✅ Teste concluído com sucesso! Verifique seu WhatsApp.');
  } else {
    logger.error('❌ O teste falhou. Verifique os logs acima para detalhes.');
  }
}

test();
