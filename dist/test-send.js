"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const whatsapp_1 = __importDefault(require("./whatsapp"));
const logger_1 = __importDefault(require("./logger"));
async function test() {
    logger_1.default.info('🚀 Iniciando teste de disparo manual...');
    const success = await whatsapp_1.default.sendMessage('TESTE_MANUAL');
    if (success) {
        logger_1.default.info('✅ Teste concluído com sucesso! Verifique seu WhatsApp.');
    }
    else {
        logger_1.default.error('❌ O teste falhou. Verifique os logs acima para detalhes.');
    }
}
test();
