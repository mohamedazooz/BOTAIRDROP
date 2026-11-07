// ============================================
// BOTAIRDROP - CAPTCHA Solver
// Handles CAPTCHA solving for various providers
// ============================================

import axios from 'axios';
import { CaptchaConfig } from '../types';
import { retry, RETRY_CONFIGS } from '../utils/retry';

/**
 * CAPTCHA Solver Interface
 */
export interface CaptchaSolver {
  solve(config: CaptchaConfig): Promise<string>;
  getBalance(): Promise<number>;
}

/**
 * CAPTCHA Solution Result
 */
export interface CaptchaSolution {
  token: string;
  provider: string;
  sitekey: string;
  pageUrl: string;
  timestamp: number;
}

/**
 * 2Captcha Solver
 * Solves CAPTCHAs using 2Captcha service
 */
export class TwoCaptchaSolver implements CaptchaSolver {
  private apiKey: string;
  private baseUrl: string = 'https://2captcha.com';

  /**
   * Creates a new 2CaptchaSolver instance
   * @param apiKey 2Captcha API key
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Solves a CAPTCHA
   * @param config CAPTCHA configuration
   * @returns CAPTCHA solution token
   */
  async solve(config: CaptchaConfig): Promise<string> {
    return retry(
      async () => {
        const params = this.buildParams(config);
        
        // Submit CAPTCHA
        const submitResponse = await axios.post(
          `${this.baseUrl}/in.php`,
          new URLSearchParams({
            key: this.apiKey,
            ...params,
          })
        );

        const responseText = submitResponse.data;
        
        if (!responseText.includes('OK')) {
          throw new Error(`2Captcha submission failed: ${responseText}`);
        }

        // Extract CAPTCHA ID
        const captchaId = responseText.split('|')[1];

        // Poll for solution
        let solution: string | null = null;
        let attempts = 0;
        const maxAttempts = 30;
        const delay = 5000;

        while (!solution && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempts++;

          const pollResponse = await axios.get(
            `${this.baseUrl}/res.php`,
            {
              params: {
                key: this.apiKey,
                action: 'get',
                id: captchaId,
              },
            }
          );

          const pollText = pollResponse.data;
          
          if (pollText === 'CAPCHA_NOT_READY') {
            continue;
          }

          if (pollText.includes('OK')) {
            solution = pollText.split('|')[1];
          } else if (pollText.includes('ERROR_')) {
            throw new Error(`2Captcha error: ${pollText}`);
          }
        }

        if (!solution) {
          throw new Error('2Captcha solution timeout');
        }

        return solution;
      },
      RETRY_CONFIGS.captcha
    );
  }

  /**
   * Builds parameters for different CAPTCHA types
   * @param config CAPTCHA configuration
   * @returns Parameters object
   */
  private buildParams(config: CaptchaConfig): Record<string, string> {
    const params: Record<string, string> = {
      method: this.getMethod(config.type),
      sitekey: config.sitekey,
      pageurl: config.pageUrl,
    };

    if (config.type === 'hCaptcha') {
      params.method = 'hcaptcha';
    } else if (config.type === 'reCAPTCHA') {
      params.method = 'userrecaptcha';
      params.version = 'v2';
      params.googlekey = config.sitekey;
    } else if (config.type === 'turnstile') {
      params.method = 'turnstile';
      params.sitekey = config.sitekey;
      params.pageurl = config.pageUrl;
    } else if (config.type === 'funcaptcha') {
      params.method = 'funcaptcha';
      params.publickey = config.sitekey;
      params.pageurl = config.pageUrl;
    }

    return params;
  }

  /**
   * Gets the method name for CAPTCHA type
   * @param type CAPTCHA type
   * @returns Method name
   */
  private getMethod(type: string): string {
    const methods: Record<string, string> = {
      'hCaptcha': 'hcaptcha',
      'reCAPTCHA': 'userrecaptcha',
      'turnstile': 'turnstile',
      'funcaptcha': 'funcaptcha',
    };
    return methods[type] || 'base64';
  }

  /**
   * Gets the account balance
   * @returns Balance in USD
   */
  async getBalance(): Promise<number> {
    const response = await axios.get(`${this.baseUrl}/res.php`, {
      params: {
        key: this.apiKey,
        action: 'getbalance',
      },
    });

    const balance = parseFloat(response.data);
    return isNaN(balance) ? 0 : balance;
  }
}

/**
 * CapSolver Solver
 * Solves CAPTCHAs using CapSolver service
 */
export class CapSolverSolver implements CaptchaSolver {
  private apiKey: string;
  private baseUrl: string = 'https://api.capsolver.com';

  /**
   * Creates a new CapSolverSolver instance
   * @param apiKey CapSolver API key
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Solves a CAPTCHA
   * @param config CAPTCHA configuration
   * @returns CAPTCHA solution token
   */
  async solve(config: CaptchaConfig): Promise<string> {
    return retry(
      async () => {
        const payload = this.buildPayload(config);
        
        // Submit CAPTCHA
        const response = await axios.post(`${this.baseUrl}/createTask`, payload);
        const taskId = response.data.taskId;

        if (!taskId) {
          throw new Error('CapSolver task creation failed');
        }

        // Poll for solution
        let solution: string | null = null;
        let attempts = 0;
        const maxAttempts = 30;
        const delay = 5000;

        while (!solution && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempts++;

          const pollResponse = await axios.post(`${this.baseUrl}/getTaskResult`, {
            taskId,
          });

          const status = pollResponse.data.status;
          
          if (status === 'ready') {
            solution = pollResponse.data.solution.token || pollResponse.data.solution.gRecaptchaResponse;
          } else if (status === 'failed') {
            throw new Error(`CapSolver error: ${pollResponse.data.errorDescription}`);
          }
        }

        if (!solution) {
          throw new Error('CapSolver solution timeout');
        }

        return solution;
      },
      RETRY_CONFIGS.captcha
    );
  }

  /**
   * Builds payload for different CAPTCHA types
   * @param config CAPTCHA configuration
   * @returns Payload object
   */
  private buildPayload(config: CaptchaConfig): Record<string, any> {
    const payload: Record<string, any> = {
      clientKey: this.apiKey,
    };

    if (config.type === 'hCaptcha') {
      payload.task = {
        type: 'HCaptchaTask',
        websiteURL: config.pageUrl,
        websiteKey: config.sitekey,
      };
    } else if (config.type === 'reCAPTCHA') {
      payload.task = {
        type: 'ReCaptchaV2Task',
        websiteURL: config.pageUrl,
        websiteKey: config.sitekey,
      };
    } else if (config.type === 'turnstile') {
      payload.task = {
        type: 'TurnstileTask',
        websiteURL: config.pageUrl,
        websiteKey: config.sitekey,
      };
    } else if (config.type === 'funcaptcha') {
      payload.task = {
        type: 'FunCaptchaTask',
        websiteURL: config.pageUrl,
        websitePublicKey: config.sitekey,
      };
    }

    return payload;
  }

  /**
   * Gets the account balance
   * @returns Balance in USD
   */
  async getBalance(): Promise<number> {
    const response = await axios.post(`${this.baseUrl}/getBalance`, {
      clientKey: this.apiKey,
    });

    const balance = response.data.balance;
    return isNaN(balance) ? 0 : balance;
  }
}

/**
 * CAPTCHA Solver Factory
 * Creates CAPTCHA solvers based on provider
 */
export class CaptchaSolverFactory {
  /**
   * Creates a CAPTCHA solver based on provider
   * @param provider CAPTCHA provider
   * @param apiKey API key
   * @returns CAPTCHA solver instance
   */
  static createSolver(provider: string, apiKey: string): CaptchaSolver {
    switch (provider.toLowerCase()) {
      case '2captcha':
        return new TwoCaptchaSolver(apiKey);
      case 'capsolver':
        return new CapSolverSolver(apiKey);
      default:
        throw new Error(`Unsupported CAPTCHA provider: ${provider}`);
    }
  }
}

/**
 * Universal CAPTCHA Solver
 * Uses the configured provider to solve CAPTCHAs
 */
export class UniversalCaptchaSolver implements CaptchaSolver {
  private solver: CaptchaSolver;

  /**
   * Creates a new UniversalCaptchaSolver instance
   * @param provider CAPTCHA provider
   * @param apiKey API key
   */
  constructor(provider: string, apiKey: string) {
    this.solver = CaptchaSolverFactory.createSolver(provider, apiKey);
  }

  /**
   * Solves a CAPTCHA
   * @param config CAPTCHA configuration
   * @returns CAPTCHA solution token
   */
  async solve(config: CaptchaConfig): Promise<string> {
    return this.solver.solve(config);
  }

  /**
   * Gets the account balance
   * @returns Balance in USD
   */
  async getBalance(): Promise<number> {
    return this.solver.getBalance();
  }

  /**
   * Updates the provider
   * @param provider New provider
   * @param apiKey New API key
   */
  updateProvider(provider: string, apiKey: string): void {
    this.solver = CaptchaSolverFactory.createSolver(provider, apiKey);
  }
}
