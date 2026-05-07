import { chromium, type Browser, type BrowserContext, type Frame, type Locator, type Page } from 'playwright';
import logger from './logger';

const DEFAULT_POINT_URL =
  'https://platform.senior.com.br/senior-x/#/Gest%C3%A3o%20de%20Pessoas%20%7C%20HCM/1/res:%2F%2Fsenior.com.br%2Fhcm%2Fpontomobile%2FclockingEvent?category=frame&link=https:%2F%2Fplatform.senior.com.br%2Fhcm-pontomobile%2Fhcm%2Fpontomobile%2F%23%2Fclocking-event&withCredentials=true&r=1';

export interface SeniorAutomationResult {
  success: boolean;
  message: string;
  dryRun: boolean;
  clicked: boolean;
  buttonFound: boolean;
  finalUrl?: string;
}

interface SeniorAutomationConfig {
  username: string;
  password: string;
  pointUrl: string;
  buttonText: string;
  timeoutMs: number;
  headless: boolean;
  executablePath?: string;
}

class SeniorAutomationService {
  public async verifyAccess(): Promise<SeniorAutomationResult> {
    return this.run({ dryRun: true });
  }

  public async registerPoint(): Promise<SeniorAutomationResult> {
    return this.run({ dryRun: false });
  }

  public async run(options: { dryRun: boolean }): Promise<SeniorAutomationResult> {
    const config = this.getConfig();
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      browser = await chromium.launch({
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
    } catch (err) {
      logger.error('Senior automation failed:', this.redactError(err));
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Falha ao automatizar a Senior.',
        dryRun: options.dryRun,
        clicked: false,
        buttonFound: false,
      };
    } finally {
      if (context) await context.close().catch(() => undefined);
      if (browser) await browser.close().catch(() => undefined);
    }
  }

  private getConfig(): SeniorAutomationConfig {
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

  private async openPointPage(page: Page, config: SeniorAutomationConfig): Promise<void> {
    await page.goto(config.pointUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  }

  private async ensureLoggedIn(page: Page, config: SeniorAutomationConfig): Promise<void> {
    if (await this.waitForRegisterButton(page, config, 3500)) return;

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
      if (!clicked) await passwordInput.press('Enter');
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(2500);
    }
  }

  private async waitForRegisterButton(
    page: Page,
    config: SeniorAutomationConfig,
    timeoutMs = config.timeoutMs,
  ): Promise<Locator | null> {
    const deadline = Date.now() + timeoutMs;
    const buttonPattern = new RegExp(this.escapeRegExp(config.buttonText), 'i');

    while (Date.now() < deadline) {
      const locator = await this.findVisibleButton(page, buttonPattern);
      if (locator) return locator;
      await page.waitForTimeout(1000);
    }

    return null;
  }

  private async findVisibleButton(page: Page, label: RegExp): Promise<Locator | null> {
    for (const frame of page.frames()) {
      const roleButton = frame.getByRole('button', { name: label }).first();
      if (await this.isUsable(roleButton)) return roleButton;

      const textButton = frame.locator('button, [role="button"], a, input[type="button"], input[type="submit"]').filter({
        hasText: label,
      }).first();
      if (await this.isUsable(textButton)) return textButton;
    }

    return null;
  }

  private async clickFirstVisibleButton(page: Page, label: RegExp): Promise<boolean> {
    const button = await this.findVisibleButton(page, label);
    if (!button) return false;
    await button.click();
    return true;
  }

  private async findVisibleInput(page: Page, selectors: string[]): Promise<Locator | null> {
    for (const frame of page.frames()) {
      const input = await this.findVisibleInputInFrame(frame, selectors);
      if (input) return input;
    }

    return null;
  }

  private async findVisibleInputInFrame(frame: Frame, selectors: string[]): Promise<Locator | null> {
    for (const selector of selectors) {
      const inputs = frame.locator(selector);
      const count = await inputs.count().catch(() => 0);
      for (let index = 0; index < Math.min(count, 5); index += 1) {
        const input = inputs.nth(index);
        if (await this.isUsable(input)) return input;
      }
    }

    return null;
  }

  private async isUsable(locator: Locator): Promise<boolean> {
    return locator.isVisible()
      .then(async visible => visible && await locator.isEnabled().catch(() => false))
      .catch(() => false);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private redactError(err: unknown): unknown {
    if (!(err instanceof Error)) return err;
    return { name: err.name, message: err.message, stack: err.stack };
  }
}

export default new SeniorAutomationService();
