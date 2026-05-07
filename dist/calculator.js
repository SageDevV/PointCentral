"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERVALO_ALMOCO_MINUTOS = exports.MEIA_JORNADA_MINUTOS = exports.JORNADA_TOTAL_MINUTOS = void 0;
const luxon_1 = require("luxon");
exports.JORNADA_TOTAL_MINUTOS = 8 * 60 + 48; // 528 minutos
exports.MEIA_JORNADA_MINUTOS = exports.JORNADA_TOTAL_MINUTOS / 2; // 264 minutos = 4h24
exports.INTERVALO_ALMOCO_MINUTOS = 60; // 1 hora fixa
class TimeCalculator {
    constructor() {
        this.timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
    }
    parseTime(time) {
        return luxon_1.DateTime.fromFormat(time, 'HH:mm', { zone: this.timezone });
    }
    /**
     * Soma o total de minutos ausentes em saídas não previstas
     */
    calculateTotalBreakMinutes(breaks) {
        return breaks.reduce((total, b) => {
            if (!b.out || !b.return)
                return total;
            const out = this.parseTime(b.out);
            const ret = this.parseTime(b.return);
            return total + ret.diff(out, 'minutes').minutes;
        }, 0);
    }
    /**
     * Calcula quando deve ser o almoço com base na entrada + breaks acumulados
     */
    calculateLunchOut(entryTime, breakMinutes = 0) {
        const entry = this.parseTime(entryTime);
        const lunchOut = entry.plus({ minutes: exports.MEIA_JORNADA_MINUTOS + breakMinutes });
        return {
            proximoEvento: 'Saída para Almoço',
            horarioAlvo: lunchOut.toFormat('HH:mm'),
            mensagem: `Entrada registrada: ${entryTime}.${breakMinutes > 0 ? ` (Ausência: ${this.formatMinutes(breakMinutes)})` : ''}\n📍 Saída para almoço prevista: ${lunchOut.toFormat('HH:mm')}`,
        };
    }
    /**
     * Calcula o horário de retorno do almoço
     */
    calculateLunchReturn(lunchOutTime) {
        const lOut = this.parseTime(lunchOutTime);
        const returnTime = lOut.plus({ minutes: exports.INTERVALO_ALMOCO_MINUTOS });
        return {
            proximoEvento: 'Retorno do Almoço',
            horarioAlvo: returnTime.toFormat('HH:mm'),
            mensagem: `Saída para almoço: ${lunchOutTime}.\n🍴 Retorno previsto: ${returnTime.toFormat('HH:mm')}`,
        };
    }
    /**
     * Calcula a saída final com base no tempo trabalhado e breaks totais
     */
    calculateFinalExit(entryTime, lunchOutTime, lunchInTime, breakMinutes = 0) {
        const entry = this.parseTime(entryTime);
        const lOut = this.parseTime(lunchOutTime);
        const lIn = this.parseTime(lunchInTime);
        const minutosTrabalhadosManha = lOut.diff(entry, 'minutes').minutes;
        // O tempo trabalhado na manhã já desconta os breaks que ocorreram ANTES do almoço, 
        // mas precisamos garantir que o cálculo considere breaks que ocorreram DEPOIS do retorno do almoço também.
        // Na verdade, a lógica mais simples é: 
        // Saída Final = Retorno Almoço + (Jornada Total - Minutos Trabalhados Manhã) + Breaks da Tarde.
        const minutosRestantes = exports.JORNADA_TOTAL_MINUTOS - minutosTrabalhadosManha;
        const finalExit = lIn.plus({ minutes: minutosRestantes + breakMinutes });
        return {
            proximoEvento: 'Saída Final',
            horarioAlvo: finalExit.toFormat('HH:mm'),
            mensagem: `✅ Trabalhado manhã: ${this.formatMinutes(minutosTrabalhadosManha)}.${breakMinutes > 0 ? ` Ausência total: ${this.formatMinutes(breakMinutes)}.` : ''}\n🚀 Fim do expediente: **${finalExit.toFormat('HH:mm')}**`,
        };
    }
    /**
     * Generate a day summary after final exit
     */
    getDaySummary(entryTime, lunchOutTime, lunchReturnTime, exitTime, breakMinutes = 0) {
        const entry = this.parseTime(entryTime);
        const lOut = this.parseTime(lunchOutTime);
        const lIn = this.parseTime(lunchReturnTime);
        const exit = this.parseTime(exitTime);
        const morningMinutes = lOut.diff(entry, 'minutes').minutes;
        const lunchMinutes = lIn.diff(lOut, 'minutes').minutes;
        const afternoonMinutes = exit.diff(lIn, 'minutes').minutes;
        // totalWorked = (Tempo entre as marcações oficiais) - (tempo de breaks)
        // Mas morningMinutes e afternoonMinutes aqui são calculados puramente entre os marcos.
        // Então o tempo trabalhado REAL é a soma deles menos os breaks.
        const totalWorked = morningMinutes + afternoonMinutes - breakMinutes;
        const lines = [
            `🕐 Entrada: ${entryTime}`,
            `🍴 Saída almoço: ${lunchOutTime}`,
            `🔙 Retorno almoço: ${lunchReturnTime}`,
            `🚪 Saída: ${exitTime}`,
            ``,
            `⏱️ Manhã: ${this.formatMinutes(morningMinutes)}`,
            `🍽️ Almoço: ${this.formatMinutes(lunchMinutes)}`,
            `⏱️ Tarde: ${this.formatMinutes(afternoonMinutes)}`,
            breakMinutes > 0 ? `☕ Ausências: ${this.formatMinutes(breakMinutes)}` : null,
            `📊 **Total trabalhado: ${this.formatMinutes(totalWorked)}**`,
        ].filter(Boolean);
        const diff = totalWorked - exports.JORNADA_TOTAL_MINUTOS;
        if (diff > 0) {
            lines.push(`⚠️ Hora extra: +${this.formatMinutes(diff)}`);
        }
        else if (diff < 0) {
            lines.push(`⚠️ Faltam: ${this.formatMinutes(Math.abs(diff))}`);
        }
        else {
            lines.push(`✅ Jornada completa!`);
        }
        return lines.join('\n');
    }
    formatMinutes(totalMinutes) {
        const h = Math.floor(Math.abs(totalMinutes) / 60);
        const m = Math.round(Math.abs(totalMinutes) % 60);
        return `${h}h${m.toString().padStart(2, '0')}min`;
    }
}
exports.default = new TimeCalculator();
