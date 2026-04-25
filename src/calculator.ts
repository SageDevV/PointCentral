import { DateTime } from 'luxon';

export const JORNADA_TOTAL_MINUTOS = 8 * 60 + 48; // 528 minutos
export const MEIA_JORNADA_MINUTOS = JORNADA_TOTAL_MINUTOS / 2; // 264 minutos = 4h24
export const INTERVALO_ALMOCO_MINUTOS = 60; // 1 hora fixa

export interface CalculationResult {
  proximoEvento: string;
  horarioAlvo: string;
  mensagem: string;
}

class TimeCalculator {
  private timezone = process.env.TIMEZONE || 'America/Sao_Paulo';

  private parseTime(time: string): DateTime {
    return DateTime.fromFormat(time, 'HH:mm', { zone: this.timezone });
  }

  /**
   * Calcula quando deve ser o almoço com base na entrada (50% da jornada = 4h24)
   */
  public calculateLunchOut(entryTime: string): CalculationResult {
    const entry = this.parseTime(entryTime);
    const lunchOut = entry.plus({ minutes: MEIA_JORNADA_MINUTOS });

    return {
      proximoEvento: 'Saída para Almoço',
      horarioAlvo: lunchOut.toFormat('HH:mm'),
      mensagem: `Entrada registrada: ${entryTime}.\n📍 Saída para almoço prevista: ${lunchOut.toFormat('HH:mm')}`,
    };
  }

  /**
   * Calcula o horário de retorno do almoço (saída almoço + 1h)
   */
  public calculateLunchReturn(lunchOutTime: string): CalculationResult {
    const lOut = this.parseTime(lunchOutTime);
    const returnTime = lOut.plus({ minutes: INTERVALO_ALMOCO_MINUTOS });

    return {
      proximoEvento: 'Retorno do Almoço',
      horarioAlvo: returnTime.toFormat('HH:mm'),
      mensagem: `Saída para almoço: ${lunchOutTime}.\n🍴 Retorno previsto: ${returnTime.toFormat('HH:mm')}`,
    };
  }

  /**
   * Calcula a saída final com base no tempo real trabalhado na manhã
   */
  public calculateFinalExit(entryTime: string, lunchOutTime: string, lunchInTime: string): CalculationResult {
    const entry = this.parseTime(entryTime);
    const lOut = this.parseTime(lunchOutTime);
    const lIn = this.parseTime(lunchInTime);

    const minutosTrabalhadosManha = lOut.diff(entry, 'minutes').minutes;
    const minutosRestantes = JORNADA_TOTAL_MINUTOS - minutosTrabalhadosManha;
    const finalExit = lIn.plus({ minutes: minutosRestantes });

    return {
      proximoEvento: 'Saída Final',
      horarioAlvo: finalExit.toFormat('HH:mm'),
      mensagem: `✅ Você já trabalhou ${this.formatMinutes(minutosTrabalhadosManha)} pela manhã.\n🚀 Fim do expediente: **${finalExit.toFormat('HH:mm')}**`,
    };
  }

  /**
   * Generate a day summary after final exit
   */
  public getDaySummary(entryTime: string, lunchOutTime: string, lunchReturnTime: string, exitTime: string): string {
    const entry = this.parseTime(entryTime);
    const lOut = this.parseTime(lunchOutTime);
    const lIn = this.parseTime(lunchReturnTime);
    const exit = this.parseTime(exitTime);

    const morningMinutes = lOut.diff(entry, 'minutes').minutes;
    const lunchMinutes = lIn.diff(lOut, 'minutes').minutes;
    const afternoonMinutes = exit.diff(lIn, 'minutes').minutes;
    const totalWorked = morningMinutes + afternoonMinutes;

    const lines = [
      `🕐 Entrada: ${entryTime}`,
      `🍴 Saída almoço: ${lunchOutTime}`,
      `🔙 Retorno almoço: ${lunchReturnTime}`,
      `🚪 Saída: ${exitTime}`,
      ``,
      `⏱️ Manhã: ${this.formatMinutes(morningMinutes)}`,
      `🍽️ Almoço: ${this.formatMinutes(lunchMinutes)}`,
      `⏱️ Tarde: ${this.formatMinutes(afternoonMinutes)}`,
      `📊 **Total trabalhado: ${this.formatMinutes(totalWorked)}**`,
    ];

    const diff = totalWorked - JORNADA_TOTAL_MINUTOS;
    if (diff > 0) {
      lines.push(`⚠️ Hora extra: +${this.formatMinutes(diff)}`);
    } else if (diff < 0) {
      lines.push(`⚠️ Faltam: ${this.formatMinutes(Math.abs(diff))}`);
    } else {
      lines.push(`✅ Jornada completa!`);
    }

    return lines.join('\n');
  }

  private formatMinutes(totalMinutes: number): string {
    const h = Math.floor(Math.abs(totalMinutes) / 60);
    const m = Math.round(Math.abs(totalMinutes) % 60);
    return `${h}h${m.toString().padStart(2, '0')}min`;
  }
}

export default new TimeCalculator();
