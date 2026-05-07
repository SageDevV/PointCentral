"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const logger_1 = __importDefault(require("./logger"));
const DEFAULT_POINT_URL = 'https://platform.senior.com.br/senior-x/#/Gest%C3%A3o%20de%20Pessoas%20%7C%20HCM/1/res:%2F%2Fsenior.com.br%2Fhcm%2Fpontomobile%2FclockingEvent?category=frame&link=https:%2F%2Fplatform.senior.com.br%2Fhcm-pontomobile%2Fhcm%2Fpontomobile%2F%23%2Fclocking-event&withCredentials=true&r=1';
class SeniorAutomationService {
    async verifyAccess() {
        return this.run({ dryRun: true });
    }
    async registerPoint() {
        return this.run({ dryRun: false });
    }
    async run(options) {
        const config = this.getConfig();
        let browser = null;
        let context = null;
        try {
            browser = await playwright_1.chromium.launch({
                headless: config.headless,
                executablePath: config.executablePath,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            context = await browser.newContext({
                locale: 'pt-BR',
                timezoneId: process.env.TIMEZONE || 'America/Sao_Paulo',
                viewport: { width: 1366, height: 768 },
            });
            const page = await context.newPage();
            page.setDefaultTimeout(config.timeoutMs);
            page.setDefaultNavigationTimeout(config.timeoutMs);
            await this.openPointPage(page, config);
            await this.ensureLoggedIn(page, config);
            await this.openPointPage(page, config);
            const button = await this.waitForRegisterButton(page, config);
            if (!button) {
                return {
                    success: false,
                    message: 'Login concluido, mas o botao Registrar Ponto nao foi encontrado na tela da Senior.',
                    dryRun: options.dryRun,
                    clicked: false,
                    buttonFound: false,
                    finalUrl: page.url(),
                };
            }
            if (!options.dryRun) {
                await button.click();
                await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
                await page.waitForTimeout(1500);
            }
            return {
                success: true,
                message: options.dryRun
                    ? 'Login validado e pagina de marcacao localizada. O botao Registrar Ponto nao foi clicado.'
                    : 'Ponto registrado na Senior.',
                dryRun: options.dryRun,
                clicked: !options.dryRun,
                buttonFound: true,
                finalUrl: page.url(),
            };
        }
        catch (err) {
            logger_1.default.error('Senior automation failed:', this.redactError(err));
            return {
                success: false,
                message: err instanceof Error ? err.message : 'Falha ao automatizar a Senior.',
                dryRun: options.dryRun,
                clicked: false,
                buttonFound: false,
            };
        }
        finally {
            if (context)
                await context.close().catch(() => undefined);
            if (browser)
                await browser.close().catch(() => undefined);
        }
    }
    getConfig() {
        const username = process.env.SENIOR_USERNAME || process.env.SENIOR_USER;
        const password = process.env.SENIOR_PASSWORD || process.env.SENIOR_PASS;
        if (!username || !password) {
            throw new Error('Configure SENIOR_USERNAME e SENIOR_PASSWORD para usar a automacao da Senior.');
        }
        const timeoutMs = Number(process.env.SENIOR_AUTOMATION_TIMEOUT_MS || 90000);
        return {
            username,
            password,
            pointUrl: process.env.SENIOR_POINT_URL || DEFAULT_POINT_URL,
            buttonText: process.env.SENIOR_REGISTER_BUTTON_TEXT || 'Registrar Ponto',
            timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 90000,
            headless: process.env.SENIOR_BROWSER_HEADLESS !== 'false',
            executablePath: process.env.SENIOR_BROWSER_EXECUTABLE_PATH || undefined,
        };
    }
    async openPointPage(page, config) {
        await page.goto(config.pointUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
    }
    async ensureLoggedIn(page, config) {
        if (await this.waitForRegisterButton(page, config, 3500))
            return;
        const usernameInput = await this.findVisibleInput(page, [
            'input[type="email"]',
            'input[name*="user" i]',
            'input[id*="user" i]',
            'input[placeholder*="usuario" i]',
            'input[placeholder*="usu" i]',
            'input[placeholder*="email" i]',
            'input[placeholder*="e-mail" i]',
            'input[aria-label*="usuario" i]',
            'input[aria-label*="usu" i]',
            'input[type="text"]',
        ]);
        if (usernameInput) {
            await usernameInput.fill(config.username);
            await this.clickFirstVisibleButton(page, /^(proximo|próximo|continuar|avancar|avançar|entrar|acessar|login)$/i);
            await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
            await page.waitForTimeout(800);
        }
        const passwordInput = await this.findVisibleInput(page, [
            'input[type="password"]',
            'input[name*="pass" i]',
            'input[id*="pass" i]',
            'input[placeholder*="senha" i]',
            'input[aria-label*="senha" i]',
        ]);
        if (passwordInput) {
            await passwordInput.fill(config.password);
            const clicked = await this.clickFirstVisibleButton(page, /^(entrar|acessar|login|sign in|conectar)$/i);
            if (!clicked)
                await passwordInput.press('Enter');
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
            await page.waitForTimeout(2500);
        }
    }
    async waitForRegisterButton(page, config, timeoutMs = config.timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        const buttonPattern = new RegExp(this.escapeRegExp(config.buttonText), 'i');
        while (Date.now() < deadline) {
            const locator = await this.findVisibleButton(page, buttonPattern);
            if (locator)
                return locator;
            await page.waitForTimeout(1000);
        }
        return null;
    }
    async findVisibleButton(page, label) {
        for (const frame of page.frames()) {
            const roleButton = frame.getByRole('button', { name: label }).first();
            if (await this.isUsable(roleButton))
                return roleButton;
            const textButton = frame.locator('button, [role="button"], a, input[type="button"], input[type="submit"]').filter({
                hasText: label,
            }).first();
            if (await this.isUsable(textButton))
                return textButton;
        }
        return null;
    }
    async clickFirstVisibleButton(page, label) {
        const button = await this.findVisibleButton(page, label);
        if (!button)
            return false;
        await button.click();
        return true;
    }
    async findVisibleInput(page, selectors) {
        for (const frame of page.frames()) {
            const input = await this.findVisibleInputInFrame(frame, selectors);
            if (input)
                return input;
        }
        return null;
    }
    async findVisibleInputInFrame(frame, selectors) {
        for (const selector of selectors) {
            const inputs = frame.locator(selector);
            const count = await inputs.count().catch(() => 0);
            for (let index = 0; index < Math.min(count, 5); index += 1) {
                const input = inputs.nth(index);
                if (await this.isUsable(input))
                    return input;
            }
        }
        return null;
    }
    async isUsable(locator) {
        return locator.isVisible()
            .then(async (visible) => visible && await locator.isEnabled().catch(() => false))
            .catch(() => false);
    }
    escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    redactError(err) {
        if (!(err instanceof Error))
            return err;
        return { name: err.name, message: err.message, stack: err.stack };
    }
}
exports.default = new SeniorAutomationService();
