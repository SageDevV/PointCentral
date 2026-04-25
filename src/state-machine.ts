import { DateTime } from 'luxon';
import calculator from './calculator';
import logger from './logger';
import fs from 'fs';
import path from 'path';

export type DayStatus =
  | 'IDLE'
  | 'AWAITING_ENTRY'
  | 'WAITING_LUNCH_OUT'
  | 'AWAITING_LUNCH_OUT'
  | 'WAITING_LUNCH_RETURN'
  | 'AWAITING_LUNCH_RETURN'
  | 'WAITING_FINAL_EXIT'
  | 'AWAITING_FINAL_EXIT'
  | 'COMPLETED';

export interface DayState {
  date: string;
  status: DayStatus;
  entryTime: string | null;
  lunchOutTime: string | null;
  lunchReturnTime: string | null;
  exitTime: string | null;
  nextNotificationAt: string | null;
  completedAt: string | null;
}

export interface ActionResult {
  success: boolean;
  message: string;
  newState: DayState;
  error?: string;
}

class StateMachine {
  private timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
  private stateFilePath: string;
  private state: DayState;

  constructor() {
    this.stateFilePath = path.resolve(process.env.STATE_PATH || './day-state.json');
    this.state = this.loadState();
  }

  private createFreshState(date: string): DayState {
    return {
      date, status: 'IDLE',
      entryTime: null, lunchOutTime: null,
      lunchReturnTime: null, exitTime: null,
      nextNotificationAt: null, completedAt: null,
    };
  }

  private loadState(): DayState {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const content = fs.readFileSync(this.stateFilePath, 'utf-8');
        const saved = JSON.parse(content) as DayState;
        if (saved.date === this.getToday()) return saved;
        logger.info(`Day changed (${saved.date} → ${this.getToday()}). Resetting state.`);
      }
    } catch (err) {
      logger.error('Error loading day state:', err);
    }
    return this.createFreshState(this.getToday());
  }

  private saveState() {
    try {
      fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2));
    } catch (err) {
      logger.error('Error saving day state:', err);
    }
  }

  private getToday(): string {
    return DateTime.now().setZone(this.timezone).toFormat('yyyy-MM-dd');
  }

  private getNow(): string {
    return DateTime.now().setZone(this.timezone).toFormat('HH:mm');
  }

  public getState(): DayState {
    const today = this.getToday();
    if (this.state.date !== today) {
      this.state = this.createFreshState(today);
      this.saveState();
    }
    return { ...this.state };
  }

  /** Called by cron at 07:00 to kick off the day */
  public startDay(): ActionResult {
    const today = this.getToday();
    if (this.state.date !== today) this.state = this.createFreshState(today);

    if (this.state.status !== 'IDLE') {
      return { success: false, message: '', newState: this.getState(), error: 'Dia já foi iniciado.' };
    }

    this.state.status = 'AWAITING_ENTRY';
    this.saveState();
    return { success: true, message: 'Jornada iniciada. Registre sua entrada.', newState: this.getState() };
  }

  /** User presses the button — captures current time and advances state */
  public registerCurrentTime(): ActionResult {
    const today = this.getToday();
    if (this.state.date !== today) {
      this.state = this.createFreshState(today);
      this.saveState();
    }

    const now = this.getNow();

    switch (this.state.status) {
      case 'IDLE':
        // Auto-start + register entry
        this.state.status = 'AWAITING_ENTRY';
        return this.registerEntry(now);

      case 'AWAITING_ENTRY':
        return this.registerEntry(now);

      case 'AWAITING_LUNCH_OUT':
        return this.registerLunchOut(now);

      case 'AWAITING_LUNCH_RETURN':
        return this.registerLunchReturn(now);

      case 'AWAITING_FINAL_EXIT':
        return this.registerFinalExit(now);

      case 'WAITING_LUNCH_OUT':
      case 'WAITING_LUNCH_RETURN':
      case 'WAITING_FINAL_EXIT':
        return {
          success: false,
          message: `Aguardando próxima etapa às ${this.state.nextNotificationAt}.`,
          newState: this.getState(),
        };

      case 'COMPLETED':
        return {
          success: false,
          message: 'Jornada já foi finalizada hoje.',
          newState: this.getState(),
        };

      default:
        return { success: false, message: 'Estado desconhecido.', newState: this.getState() };
    }
  }

  private registerEntry(time: string): ActionResult {
    this.state.entryTime = time;
    const lunch = calculator.calculateLunchOut(time);
    this.state.status = 'WAITING_LUNCH_OUT';
    this.state.nextNotificationAt = lunch.horarioAlvo;
    this.saveState();

    return {
      success: true,
      message: `Entrada registrada: ${time}. Almoço previsto: ${lunch.horarioAlvo}.`,
      newState: this.getState(),
    };
  }

  private registerLunchOut(time: string): ActionResult {
    this.state.lunchOutTime = time;
    const ret = calculator.calculateLunchReturn(time);
    this.state.status = 'WAITING_LUNCH_RETURN';
    this.state.nextNotificationAt = ret.horarioAlvo;
    this.saveState();

    return {
      success: true,
      message: `Saída almoço registrada: ${time}. Retorno previsto: ${ret.horarioAlvo}.`,
      newState: this.getState(),
    };
  }

  private registerLunchReturn(time: string): ActionResult {
    this.state.lunchReturnTime = time;
    const exit = calculator.calculateFinalExit(this.state.entryTime!, this.state.lunchOutTime!, time);
    this.state.status = 'WAITING_FINAL_EXIT';
    this.state.nextNotificationAt = exit.horarioAlvo;
    this.saveState();

    return {
      success: true,
      message: `Retorno registrado: ${time}. Saída prevista: ${exit.horarioAlvo}.`,
      newState: this.getState(),
    };
  }

  private registerFinalExit(time: string): ActionResult {
    this.state.exitTime = time;
    this.state.status = 'COMPLETED';
    this.state.nextNotificationAt = null;
    this.state.completedAt = time;
    this.saveState();

    const summary = calculator.getDaySummary(
      this.state.entryTime!, this.state.lunchOutTime!,
      this.state.lunchReturnTime!, time,
    );

    return {
      success: true,
      message: `Saída registrada: ${time}. Jornada finalizada!\n${summary}`,
      newState: this.getState(),
    };
  }

  /** Called by the scheduler when a timer fires */
  public triggerNotification(): ActionResult {
    const transitions: Record<string, { next: DayStatus; label: string }> = {
      'WAITING_LUNCH_OUT': { next: 'AWAITING_LUNCH_OUT', label: 'Hora do almoço!' },
      'WAITING_LUNCH_RETURN': { next: 'AWAITING_LUNCH_RETURN', label: 'Hora de voltar!' },
      'WAITING_FINAL_EXIT': { next: 'AWAITING_FINAL_EXIT', label: 'Fim do expediente!' },
    };

    const t = transitions[this.state.status];
    if (!t) {
      return { success: false, message: '', newState: this.getState(), error: `Cannot trigger in state: ${this.state.status}` };
    }

    this.state.status = t.next;
    this.saveState();
    return { success: true, message: t.label, newState: this.getState() };
  }

  public shouldTriggerNow(): boolean {
    if (!this.state.nextNotificationAt) return false;
    const waitingStates: DayStatus[] = ['WAITING_LUNCH_OUT', 'WAITING_LUNCH_RETURN', 'WAITING_FINAL_EXIT'];
    if (!waitingStates.includes(this.state.status)) return false;
    return this.getNow() >= this.state.nextNotificationAt;
  }

  public isWeekday(): boolean {
    const now = DateTime.now().setZone(this.timezone);
    return now.weekday >= 1 && now.weekday <= 5;
  }

  public reset(): DayState {
    this.state = this.createFreshState(this.getToday());
    this.saveState();
    return this.getState();
  }
}

export default new StateMachine();
