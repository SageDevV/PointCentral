"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
const calculator_1 = __importDefault(require("./calculator"));
const logger_1 = __importDefault(require("./logger"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class StateMachine {
    constructor() {
        this.timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
        this.stateFilePath = path_1.default.resolve(process.env.STATE_PATH || './day-state.json');
        this.state = this.loadState();
    }
    createFreshState(date) {
        return {
            date, status: 'IDLE',
            entryTime: null, lunchOutTime: null,
            lunchReturnTime: null, exitTime: null,
            nextNotificationAt: null, completedAt: null,
            breaks: [], suspendedStatus: null,
            manualFlags: {},
        };
    }
    loadState() {
        try {
            if (fs_1.default.existsSync(this.stateFilePath)) {
                const content = fs_1.default.readFileSync(this.stateFilePath, 'utf-8');
                const saved = JSON.parse(content);
                if (saved.date === this.getToday()) {
                    // Ensure breaks array exists for legacy states
                    if (!saved.breaks)
                        saved.breaks = [];
                    if (!saved.manualFlags)
                        saved.manualFlags = {};
                    return saved;
                }
                logger_1.default.info(`Day changed (${saved.date} → ${this.getToday()}). Resetting state.`);
            }
        }
        catch (err) {
            logger_1.default.error('Error loading day state:', err);
        }
        return this.createFreshState(this.getToday());
    }
    saveState() {
        try {
            fs_1.default.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2));
        }
        catch (err) {
            logger_1.default.error('Error saving day state:', err);
        }
    }
    getToday() {
        return luxon_1.DateTime.now().setZone(this.timezone).toFormat('yyyy-MM-dd');
    }
    getNow() {
        return luxon_1.DateTime.now().setZone(this.timezone).toFormat('HH:mm');
    }
    getState() {
        const today = this.getToday();
        if (this.state.date !== today) {
            this.state = this.createFreshState(today);
            this.saveState();
        }
        return { ...this.state };
    }
    /** Called by cron at 07:00 to kick off the day */
    startDay() {
        const today = this.getToday();
        if (this.state.date !== today)
            this.state = this.createFreshState(today);
        if (this.state.status !== 'IDLE') {
            return { success: false, message: '', newState: this.getState(), error: 'Dia já foi iniciado.' };
        }
        this.state.status = 'AWAITING_ENTRY';
        this.saveState();
        return { success: true, message: 'Jornada iniciada. Registre sua entrada.', newState: this.getState() };
    }
    /** User presses the button — captures current time and advances state */
    registerCurrentTime() {
        const now = this.getNow();
        return this.registerTimeInternal(now, false);
    }
    /** User manually informs a time that was punched externally */
    registerManualTime(time) {
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
    registerTimeInternal(time, isManual) {
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
    registerBreak() {
        const today = this.getToday();
        if (this.state.date !== today) {
            this.state = this.createFreshState(today);
            this.saveState();
        }
        const now = this.getNow();
        const allowedStates = ['WAITING_LUNCH_OUT', 'WAITING_LUNCH_RETURN', 'WAITING_FINAL_EXIT'];
        if (this.state.status === 'IN_BREAK') {
            return this.registerBreakReturn(now);
        }
        if (!allowedStates.includes(this.state.status)) {
            return { success: false, message: 'Não é possível registrar saída não prevista neste momento.', newState: this.getState() };
        }
        return this.registerBreakOut(now);
    }
    registerEntry(time, isManual = false) {
        this.state.entryTime = time;
        this.state.status = 'WAITING_LUNCH_OUT';
        if (isManual)
            this.state.manualFlags.entry = true;
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
    registerLunchOut(time, isManual = false) {
        this.state.lunchOutTime = time;
        this.state.status = 'WAITING_LUNCH_RETURN';
        if (isManual)
            this.state.manualFlags.lunchOut = true;
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
    registerLunchReturn(time, isManual = false) {
        this.state.lunchReturnTime = time;
        this.state.status = 'WAITING_FINAL_EXIT';
        if (isManual)
            this.state.manualFlags.lunchReturn = true;
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
    registerFinalExit(time, isManual = false) {
        this.state.exitTime = time;
        this.state.status = 'COMPLETED';
        this.state.nextNotificationAt = null;
        this.state.completedAt = time;
        if (isManual)
            this.state.manualFlags.exit = true;
        this.saveState();
        const breakMinutes = calculator_1.default.calculateTotalBreakMinutes(this.state.breaks);
        const summary = calculator_1.default.getDaySummary(this.state.entryTime, this.state.lunchOutTime, this.state.lunchReturnTime, time, breakMinutes);
        const tag = isManual ? ' ✏️ (Manual)' : '';
        return {
            success: true,
            message: `Saída registrada: ${time}.${tag} Jornada finalizada!\n${summary}`,
            newState: this.getState(),
            isManual,
        };
    }
    registerBreakOut(time) {
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
    registerBreakReturn(time) {
        const lastBreak = this.state.breaks[this.state.breaks.length - 1];
        if (lastBreak) {
            lastBreak.return = time;
        }
        this.state.status = this.state.suspendedStatus || 'WAITING_LUNCH_OUT';
        this.state.suspendedStatus = null;
        // Recalcular os horários previstos com base no novo tempo de ausência total
        this.recalculateTargets();
        this.saveState();
        const totalBreakMin = calculator_1.default.calculateTotalBreakMinutes(this.state.breaks);
        return {
            success: true,
            isBreak: true,
            message: `✅ Retorno registrado às ${time}. Total ausente hoje: ${calculator_1.default.formatMinutes(totalBreakMin)}.`,
            newState: this.getState(),
        };
    }
    recalculateTargets() {
        const breakMin = calculator_1.default.calculateTotalBreakMinutes(this.state.breaks);
        if (this.state.status === 'WAITING_LUNCH_OUT') {
            const res = calculator_1.default.calculateLunchOut(this.state.entryTime, breakMin);
            this.state.nextNotificationAt = res.horarioAlvo;
        }
        else if (this.state.status === 'WAITING_LUNCH_RETURN') {
            const res = calculator_1.default.calculateLunchReturn(this.state.lunchOutTime);
            this.state.nextNotificationAt = res.horarioAlvo;
        }
        else if (this.state.status === 'WAITING_FINAL_EXIT') {
            const res = calculator_1.default.calculateFinalExit(this.state.entryTime, this.state.lunchOutTime, this.state.lunchReturnTime, breakMin);
            this.state.nextNotificationAt = res.horarioAlvo;
        }
    }
    /** Called by the scheduler when a timer fires */
    triggerNotification() {
        const transitions = {
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
    shouldTriggerNow() {
        if (!this.state.nextNotificationAt)
            return false;
        const waitingStates = ['WAITING_LUNCH_OUT', 'WAITING_LUNCH_RETURN', 'WAITING_FINAL_EXIT'];
        if (!waitingStates.includes(this.state.status))
            return false;
        return this.getNow() >= this.state.nextNotificationAt;
    }
    isWeekday() {
        const now = luxon_1.DateTime.now().setZone(this.timezone);
        return now.weekday >= 1 && now.weekday <= 5;
    }
    skipDay() {
        this.state.status = 'SKIPPED';
        this.state.nextNotificationAt = null;
        this.saveState();
        return { success: true, message: 'Dia pulado com sucesso. Retomaremos amanhã às 07:00.', newState: this.getState() };
    }
    reset() {
        this.state = this.createFreshState(this.getToday());
        this.saveState();
        return this.getState();
    }
}
exports.default = new StateMachine();
