// ============================================
// BOTAIRDROP - Configuration Loader
// Loads and manages all configuration files
// ============================================

import * as fs from 'fs';
import * as path from 'path';
import { WalletConfig, ProxyConfig, RpcConfig, NetworkType } from '../types';

/**
 * Configuration Interface
 */
export interface AppConfig {
  wallets: WalletConfig[];
  proxies: ProxyConfig[];
  rpc: RpcConfig[];
  network: NetworkType;
  settings: AppSettings;
}

/**
 * Application Settings Interface
 */
export interface AppSettings {
  maxConcurrentTasks: number;
  maxRetries: number;
  retryDelay: number;
  logLevel: string;
  logFile: string;
  captchaProvider: string;
  captchaApiKey: string;
  jitoEndpoint: string;
  jitoApiKey: string;
}

/**
 * Default Configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  wallets: [],
  proxies: [],
  rpc: [
    {
      id: 'main',
      url: 'https://api.mainnet-beta.solana.com',
      priority: 1,
    },
    {
      id: 'backup',
      url: 'https://solana-api.projectserum.com',
      priority: 2,
    },
  ],
  network: 'mainnet-beta',
  settings: {
    maxConcurrentTasks: 10,
    maxRetries: 3,
    retryDelay: 1000,
    logLevel: 'info',
    logFile: 'logs/botairdrop.log',
    captchaProvider: '2captcha',
    captchaApiKey: '',
    jitoEndpoint: 'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
    jitoApiKey: '',
  },
};

/**
 * Configuration Loader class
 * Loads configuration from files and environment variables
 */
export class ConfigLoader {
  private config: AppConfig;
  private configDir: string;

  /**
   * Creates a new ConfigLoader instance
   * @param configDir Configuration directory (default: src/config)
   */
  constructor(configDir: string = path.join(__dirname, '..', 'config')) {
    this.configDir = configDir;
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Loads configuration from files
   */
  load(): void {
    this.loadWallets();
    this.loadProxies();
    this.loadRpc();
    this.loadSettings();
    this.loadEnvironment();
  }

  /**
   * Loads wallet configurations
   */
  private loadWallets(): void {
    try {
      const walletsPath = path.join(this.configDir, 'wallets.json');
      if (fs.existsSync(walletsPath)) {
        const wallets = JSON.parse(fs.readFileSync(walletsPath, 'utf-8'));
        this.config.wallets = wallets;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load wallets.json:', error);
    }
  }

  /**
   * Loads proxy configurations
   */
  private loadProxies(): void {
    try {
      const proxiesPath = path.join(this.configDir, 'proxies.json');
      if (fs.existsSync(proxiesPath)) {
        const proxies = JSON.parse(fs.readFileSync(proxiesPath, 'utf-8'));
        this.config.proxies = proxies;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load proxies.json:', error);
    }
  }

  /**
   * Loads RPC configurations
   */
  private loadRpc(): void {
    try {
      const rpcPath = path.join(this.configDir, 'rpc.json');
      if (fs.existsSync(rpcPath)) {
        const rpc = JSON.parse(fs.readFileSync(rpcPath, 'utf-8'));
        this.config.rpc = rpc;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load rpc.json:', error);
    }
  }

  /**
   * Loads application settings
   */
  private loadSettings(): void {
    try {
      const settingsPath = path.join(this.configDir, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        this.config.settings = { ...this.config.settings, ...settings };
      }
    } catch (error) {
      console.warn('⚠️ Failed to load settings.json:', error);
    }
  }

  /**
   * Loads environment variables
   */
  private loadEnvironment(): void {
    // Network
    if (process.env.SOLANA_NETWORK) {
      this.config.network = process.env.SOLANA_NETWORK as NetworkType;
    }

    // RPC URL
    if (process.env.SOLANA_RPC_URL) {
      this.config.rpc[0].url = process.env.SOLANA_RPC_URL;
    }

    // Settings
    if (process.env.MAX_CONCURRENT_TASKS) {
      this.config.settings.maxConcurrentTasks = parseInt(process.env.MAX_CONCURRENT_TASKS);
    }

    if (process.env.MAX_RETRIES) {
      this.config.settings.maxRetries = parseInt(process.env.MAX_RETRIES);
    }

    if (process.env.RETRY_DELAY) {
      this.config.settings.retryDelay = parseInt(process.env.RETRY_DELAY);
    }

    if (process.env.LOG_LEVEL) {
      this.config.settings.logLevel = process.env.LOG_LEVEL;
    }

    if (process.env.LOG_FILE) {
      this.config.settings.logFile = process.env.LOG_FILE;
    }

    // CAPTCHA
    if (process.env.CAPTCHA_PROVIDER) {
      this.config.settings.captchaProvider = process.env.CAPTCHA_PROVIDER;
    }

    if (process.env.CAPTCHA_API_KEY) {
      this.config.settings.captchaApiKey = process.env.CAPTCHA_API_KEY;
    }

    // Jito
    if (process.env.JITO_ENDPOINT) {
      this.config.settings.jitoEndpoint = process.env.JITO_ENDPOINT;
    }

    if (process.env.JITO_API_KEY) {
      this.config.settings.jitoApiKey = process.env.JITO_API_KEY;
    }
  }

  /**
   * Gets the configuration
   * @returns AppConfig
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Gets wallet configurations
   * @returns WalletConfig[]
   */
  getWallets(): WalletConfig[] {
    return this.config.wallets;
  }

  /**
   * Gets proxy configurations
   * @returns ProxyConfig[]
   */
  getProxies(): ProxyConfig[] {
    return this.config.proxies;
  }

  /**
   * Gets RPC configurations
   * @returns RpcConfig[]
   */
  getRpcConfigs(): RpcConfig[] {
    return this.config.rpc;
  }

  /**
   * Gets network type
   * @returns NetworkType
   */
  getNetwork(): NetworkType {
    return this.config.network;
  }

  /**
   * Gets application settings
   * @returns AppSettings
   */
  getSettings(): AppSettings {
    return this.config.settings;
  }

  /**
   * Saves configuration to files
   */
  save(): void {
    this.saveWallets();
    this.saveProxies();
    this.saveRpc();
    this.saveSettings();
  }

  /**
   * Saves wallet configurations
   */
  private saveWallets(): void {
    try {
      const walletsPath = path.join(this.configDir, 'wallets.json');
      fs.writeFileSync(walletsPath, JSON.stringify(this.config.wallets, null, 2));
    } catch (error) {
      console.error('❌ Failed to save wallets.json:', error);
    }
  }

  /**
   * Saves proxy configurations
   */
  private saveProxies(): void {
    try {
      const proxiesPath = path.join(this.configDir, 'proxies.json');
      fs.writeFileSync(proxiesPath, JSON.stringify(this.config.proxies, null, 2));
    } catch (error) {
      console.error('❌ Failed to save proxies.json:', error);
    }
  }

  /**
   * Saves RPC configurations
   */
  private saveRpc(): void {
    try {
      const rpcPath = path.join(this.configDir, 'rpc.json');
      fs.writeFileSync(rpcPath, JSON.stringify(this.config.rpc, null, 2));
    } catch (error) {
      console.error('❌ Failed to save rpc.json:', error);
    }
  }

  /**
   * Saves application settings
   */
  private saveSettings(): void {
    try {
      const settingsPath = path.join(this.configDir, 'settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify(this.config.settings, null, 2));
    } catch (error) {
      console.error('❌ Failed to save settings.json:', error);
    }
  }

  /**
   * Updates wallet configurations
   * @param wallets Wallet configurations
   */
  updateWallets(wallets: WalletConfig[]): void {
    this.config.wallets = wallets;
  }

  /**
   * Updates proxy configurations
   * @param proxies Proxy configurations
   */
  updateProxies(proxies: ProxyConfig[]): void {
    this.config.proxies = proxies;
  }

  /**
   * Updates RPC configurations
   * @param rpc RPC configurations
   */
  updateRpc(rpc: RpcConfig[]): void {
    this.config.rpc = rpc;
  }

  /**
   * Updates network type
   * @param network Network type
   */
  updateNetwork(network: NetworkType): void {
    this.config.network = network;
  }

  /**
   * Updates application settings
   * @param settings Application settings
   */
  updateSettings(settings: Partial<AppSettings>): void {
    this.config.settings = { ...this.config.settings, ...settings };
  }
}

/**
 * Global configuration instance
 */
export const config = new ConfigLoader();

/**
 * Loads configuration and exports it
 */
config.load();

export default config;
