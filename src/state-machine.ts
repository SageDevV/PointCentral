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
  | 'IN_BREAK'
  | 'SKIPPED'
  | 'COMPLETED';

export interface ManualFlags {
  entry?: boolean;
  lunchOut?: boolean;
  lunchReturn?: boolean;
  exit?: boolean;
}

export interface DayState {
  date: string;
  status: DayStatus;
  entryTime: string | null;
  lunchOutTime: string | null;
  lunchReturnTime: string | null;
  exitTime: string | null;
  nextNotificationAt: string | null;
  completedAt: string | null;
  breaks: { out: string; return: string | null }[];
  suspendedStatus: DayStatus | null;
  manualFlags: ManualFlags;
}

export interface ActionResult {
  success: boolean;
  message: string;
  newState: DayState;
  error?: string;
  isBreak?: boolean;
  isManual?: boolean;
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
      breaks: [], suspendedStatus: null,
      manualFlags: {},
    };
  }

  private loadState(): DayState {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const content = fs.readFileSync(this.stateFilePath, 'utf-8');
        const saved = JSON.parse(content) as DayState;
        if (saved.date === this.getToday()) {
          // Ensure breaks array exists for legacy states
          if (!saved.breaks) saved.breaks = [];
          if (!saved.manualFlags) saved.manualFlags = {};
          return saved;
        }
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
    const now = this.getNow();
    return this.registerTimeInternal(now, false);
  }

  /** User manually informs a time that was punched externally */
  public registerManualTime(time: string): ActionResult {
    // Validate format HH:mm
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return { success: false, message: 'Formato inválido. Use HH:mm.', newState: this.getState() };
    }
    const [h, m] = time.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      return { success: false, message: 'Horário inválido.', newState: this.getState() };
    }
    return this.registerTimeInternal(time, true);
  }

  /** Core registration logic shared by automatic and manual flows */
  private registerTimeInternal(time: string, isManual: boolean): ActionResult {
    const today = this.getToday();
    if (this.state.date !== today) {
      this.state = this.createFreshState(today);
      this.saveState();
    }

    switch (this.state.status) {
      case 'IDLE':
      case 'AWAITING_ENTRY':
        return this.registerEntry(time, isManual);

      case 'WAITING_LUNCH_OUT':
      case 'AWAITING_LUNCH_OUT':
        return this.registerLunchOut(time, isManual);

      case 'WAITING_LUNCH_RETURN':
      case 'AWAITING_LUNCH_RETURN':
        return this.registerLunchReturn(time, isManual);

      case 'WAITING_FINAL_EXIT':
      case 'AWAITING_FINAL_EXIT':
        return this.registerFinalExit(time, isManual);

      case 'IN_BREAK':
        return this.registerBreakReturn(time);

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

  /** Explicitly register an unscheduled break (called via dedicated button) */
  public registerBreak(): ActionResult {
    const today = this.getToday();
    if (this.state.date !== today) {
      this.state = this.createFreshState(today);
      this.saveState();
    }

    const now = this.getNow();
    const allowedStates: DayStatus[] = ['WAITING_LUNCH_OUT', 'WAITING_LUNCH_RETURN', 'WAITING_FINAL_EXIT'];

    if (this.state.status === 'IN_BREAK') {
      return this.registerBreakReturn(now);
    }

    if (!allowedStates.includes(this.state.status)) {
      return { success: false, message: 'Não é possível registrar saída não prevista neste momento.', newState: this.getState() };
    }

    return this.registerBreakOut(now);
  }

  private registerEntry(time: string, isManual: boolean = false): ActionResult {
    this.state.entryTime = time;
    this.state.status = 'WAITING_LUNCH_OUT';
    if (isManual) this.state.manualFlags.entry = true;
    this.recalculateTargets();
    this.saveState();

    const tag = isManual ? ' ✏️ (Manual)' : '';
    return {
      success: true,
      message: `Entrada registrada: ${time}.${tag} Próximo passo: Almoço.`,
      newState: this.getState(),
      isManual,
    };
  }

  private registerLunchOut(time: string, isManual: boolean = false): ActionResult {
    this.state.lunchOutTime = time;
    this.state.status = 'WAITING_LUNCH_RETURN';
    if (isManual) this.state.manualFlags.lunchOut = true;
    this.recalculateTargets();
    this.saveState();

    const tag = isManual ? ' ✏️ (Manual)' : '';
    return {
      success: true,
      message: `Saída almoço registrada: ${time}.${tag} Próximo passo: Retorno.`,
      newState: this.getState(),
      isManual,
    };
  }

  private registerLunchReturn(time: string, isManual: boolean = false): ActionResult {
    this.state.lunchReturnTime = time;
    this.state.status = 'WAITING_FINAL_EXIT';
    if (isManual) this.state.manualFlags.lunchReturn = true;
    this.recalculateTargets();
    this.saveState();

    const tag = isManual ? ' ✏️ (Manual)' : '';
    return {
      success: true,
      message: `Retorno registrado: ${time}.${tag} Próximo passo: Saída Final.`,
      newState: this.getState(),
      isManual,
    };
  }

  private registerFinalExit(time: string, isManual: boolean = false): ActionResult {
    this.state.exitTime = time;
    this.state.status = 'COMPLETED';
    this.state.nextNotificationAt = null;
    this.state.completedAt = time;
    if (isManual) this.state.manualFlags.exit = true;
    this.saveState();

    const breakMinutes = calculator.calculateTotalBreakMinutes(this.state.breaks);
    const summary = calculator.getDaySummary(
      this.state.entryTime!, this.state.lunchOutTime!,
      this.state.lunchReturnTime!, time,
      breakMinutes
    );

    const tag = isManual ? ' ✏️ (Manual)' : '';
    return {
      success: true,
      message: `Saída registrada: ${time}.${tag} Jornada finalizada!\n${summary}`,
      newState: this.getState(),
      isManual,
    };
  }

  private registerBreakOut(time: string): ActionResult {
    this.state.suspendedStatus = this.state.status;
    this.state.status = 'IN_BREAK';
    this.state.breaks.push({ out: time, return: null });
    this.saveState();

    return {
      success: true,
      isBreak: true,
      message: `⚠️ Saída não prevista registrada às ${time}. Registre o retorno ao voltar.`,
      newState: this.getState(),
    };
  }

  private registerBreakReturn(time: string): ActionResult {
    const lastBreak = this.state.breaks[this.state.breaks.length - 1];
    if (lastBreak) {
      lastBreak.return = time;
    }

    this.state.status = this.state.suspendedStatus || 'WAITING_LUNCH_OUT';
    this.state.suspendedStatus = null;
    
    // Recalcular os horários previstos com base no novo tempo de ausência total
    this.recalculateTargets();
    this.saveState();

    const totalBreakMin = calculator.calculateTotalBreakMinutes(this.state.breaks);
    return {
      success: true,
      isBreak: true,
      message: `✅ Retorno registrado às ${time}. Total ausente hoje: ${calculator.formatMinutes(totalBreakMin)}.`,
      newState: this.getState(),
    };
  }

  private recalculateTargets() {
    const breakMin = calculator.calculateTotalBreakMinutes(this.state.breaks);

    if (this.state.status === 'WAITING_LUNCH_OUT') {
      const res = calculator.calculateLunchOut(this.state.entryTime!, breakMin);
      this.state.nextNotificationAt = res.horarioAlvo;
    } 
    else if (this.state.status === 'WAITING_LUNCH_RETURN') {
      const res = calculator.calculateLunchReturn(this.state.lunchOutTime!);
      this.state.nextNotificationAt = res.horarioAlvo;
    }
    else if (this.state.status === 'WAITING_FINAL_EXIT') {
      const res = calculator.calculateFinalExit(
        this.state.entryTime!, 
        this.state.lunchOutTime!, 
        this.state.lunchReturnTime!,
        breakMin
      );
      this.state.nextNotificationAt = res.horarioAlvo;
    }
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

  public skipDay(): ActionResult {
    this.state.status = 'SKIPPED';
    this.state.nextNotificationAt = null;
    this.saveState();
    return { success: true, message: 'Dia pulado com sucesso. Retomaremos amanhã às 07:00.', newState: this.getState() };
  }

  public reset(): DayState {
    this.state = this.createFreshState(this.getToday());
    this.saveState();
    return this.getState();
  }
}

export default new StateMachine();
