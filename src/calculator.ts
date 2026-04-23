import { DateTime } from 'luxon';

export const JORNADA_TOTAL_MINUTOS = 8 * 60 + 48; // 528 minutos
export const INTERVALO_ALMOCO_MINUTOS = 60; // 1 hora fixa

export interface CalculationResult {
  proximoEvento: string;
  horarioAlvo: string;
  mensagem: string;
  linkAcao?: string;
}

class TimeCalculator {
  private timezone = process.env.TIMEZONE || 'America/Sao_Paulo';

  private parseTime(time: string): DateTime {
    return DateTime.fromFormat(time, 'HH:mm', { zone: this.timezone });
  }

  /**
   * Calcula quando deve ser o almoço com base na entrada (50% da jornada)
   */
  public calculateLunchOut(entryTime: string): CalculationResult {
    const entry = this.parseTime(entryTime);
    const lunchOut = entry.plus({ minutes: JORNADA_TOTAL_MINUTOS / 2 });
    const returnTime = lunchOut.plus({ minutes: INTERVALO_ALMOCO_MINUTOS });

    return {
      proximoEvento: 'Saída para Almoço',
      horarioAlvo: lunchOut.toFormat('HH:mm'),
      mensagem: `Entrada registrada: ${entryTime}.\n📍 Saída para almoço prevista: ${lunchOut.toFormat('HH:mm')}\n🍴 Retorno previsto: ${returnTime.toFormat('HH:mm')}`
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
      mensagem: `Retorno do almoço registrado: ${lunchInTime}.\n✅ Você já trabalhou ${this.formatMinutes(minutosTrabalhadosManha)}.\n🚀 Fim do expediente calculado para: ${finalExit.toFormat('HH:mm')}`
    };
  }

  private formatMinutes(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${h}h ${m}m`;
  }
}

export default new TimeCalculator();
