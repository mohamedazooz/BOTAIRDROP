/**
 * HFT Configuration Manager
 * Senior-grade configuration management for HFT system
 * 
 * Features:
 * - Hierarchical configuration (default, environment, custom)
 * - Type-safe configuration loading
 * - Environment variable support
 * - Configuration validation
 * - Hot-reloading support
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  HFTConfig,
  SystemConfig,
  MarketDataConfig,
  ExecutionConfig,
  RiskConfig,
  MonitoringConfig,
  LoggingConfig,
  ExchangeConfig,
  JitoConfig,
  PriorityFeeConfig,
  RiskLimits,
  CircuitBreakerConfig,
  StopLossConfig,
  Exchange,
  StrategyType,
} from '../types';
import { Logger, createLogger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/** Configuration source */
export type ConfigSource = 'default' | 'file' | 'environment' | 'custom';

/** Configuration loader options */
export interface ConfigLoaderOptions {
  configPath?: string;
  envPrefix?: string;
  validate?: boolean;
  hotReload?: boolean;
}

/** Partial HFT configuration for merging */
export type PartialHFTConfig = Partial<{
  system: Partial<SystemConfig>;
  marketData: Partial<MarketDataConfig>;
  execution: Partial<ExecutionConfig>;
  risk: Partial<RiskConfig>;
  monitoring: Partial<MonitoringConfig>;
  logging: Partial<LoggingConfig>;
}>;

// ============================================================================
// Configuration Manager
// ============================================================================

/**
 * Configuration Manager
 * 
 * Manages HFT system configuration with support for multiple sources
 * and hierarchical merging.
 */
export class ConfigManager {
  private config: HFTConfig;
  private sources: ConfigSource[] = [];
  private logger: Logger;
  private options: ConfigLoaderOptions;
  private watchers: Map<string, (config: HFTConfig) => void> = new Map();

  constructor(options: ConfigLoaderOptions = {}) {
    this.logger = createLogger('ConfigManager');
    this.options = {
      configPath: 'config/hft.json',
      envPrefix: 'HFT_',
      validate: true,
      hotReload: false,
      ...options,
    };

    // Initialize with default configuration
    this.config = this.createDefaultConfig();
    this.sources.push('default');

    // Load from other sources
    this.loadFromFile();
    this.loadFromEnvironment();

    // Validate
    if (this.options.validate) {
      this.validate();
    }
  }

  // ==========================================================================
  // Configuration Loading
  // ==========================================================================

  /**
   * Create default configuration
   */
  private createDefaultConfig(): HFTConfig {
    return {
      system: {
        name: 'BOTAIRDROP-HFT',
        version: '1.0.0',
        environment: 'development',
        nodeId: this.generateNodeId(),
        maxConcurrentStrategies: 10,
      },
      marketData: {
        exchanges: [
          { exchange: Exchange.RAYDIUM, rpcUrl: 'https://api.raydium.io', websocketUrl: 'wss://api.raydium.io/ws', enabled: true, rateLimit: 100 },
          { exchange: Exchange.JUPITER, rpcUrl: 'https://jupiterapi.com', websocketUrl: 'wss://jupiterapi.com/ws', enabled: true, rateLimit: 100 },
          { exchange: Exchange.ORCA, rpcUrl: 'https://api.orca.so', websocketUrl: 'wss://api.orca.so/ws', enabled: true, rateLimit: 100 },
          { exchange: Exchange.SERUM, rpcUrl: 'https://api.projectserum.com', websocketUrl: 'wss://api.projectserum.com/ws', enabled: true, rateLimit: 100 },
          { exchange: Exchange.DRIFT, rpcUrl: 'https://api.drift.lol', websocketUrl: 'wss://api.drift.lol/ws', enabled: true, rateLimit: 100 },
          { exchange: Exchange.METEORA, rpcUrl: 'https://api.meteora.ag', websocketUrl: 'wss://api.meteora.ag/ws', enabled: true, rateLimit: 100 },
        ],
        websocketTimeout: 30000,
        restTimeout: 10000,
        orderBookDepth: 20,
        maxRetries: 5,
      },
      execution: {
        jito: {
          enabled: true,
          rpcUrl: 'https://jito-rpc.com',
          tipAccounts: [],
          minTipLamports: 1000,
          maxTipLamports: 100000,
        },
        priorityFee: {
          baseLamports: 5000,
          dynamicMultiplier: 1.5,
          maxLamports: 1000000,
        },
        maxRetries: 3,
        retryConfig: {
          maxRetries: 3,
          initialDelay: 100,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true,
        },
        slippageTolerance: 0.01,
        maxTransactionAge: 150000,
      },
      risk: {
        positionLimits: {
          maxPositionSize: 100,
          maxPortfolioRisk: 0.05,
          maxLeverage: 5,
          maxDailyLoss: 10,
          maxDrawdown: 0.2,
          maxOrderSize: 50,
          maxSlippage: 0.05,
          minLiquidity: 100,
        },
        circuitBreakers: {
          threshold: 5,
          resetTimeout: 60000,
          halfOpenAfter: 30000,
        },
        stopLoss: {
          stopLossPercentage: 0.05,
          trailingStopPercentage: 0.03,
          liquidationThreshold: 0.1,
        },
      },
      monitoring: {
        prometheus: {
          enabled: true,
          port: 9090,
          scrapeInterval: 15000,
        },
        grafana: {
          enabled: true,
          port: 3000,
          adminPassword: 'admin',
        },
        alerting: {
          enabled: true,
          providers: [],
        },
      },
      logging: {
        level: 'info',
        format: 'json',
        output: 'console',
        filePath: 'logs/hft.log',
        maxFileSize: 10 * 1024 * 1024,
        maxFiles: 5,
      },
    };
  }

  /**
   * Load configuration from file
   */
  private loadFromFile(): void {
    const configPath = this.resolveConfigPath();

    if (!existsSync(configPath)) {
      this.logger.warn(`Configuration file not found: ${configPath}`);
      return;
    }

    try {
      this.logger.info(`Loading configuration from file: ${configPath}`);
      const fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      this.mergeConfig(fileConfig);
      this.sources.push('file');
      this.logger.info('Configuration loaded from file successfully');
    } catch (error) {
      this.logger.error('Failed to load configuration from file', error);
      throw error;
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    this.logger.info('Loading configuration from environment variables');

    const envConfig: PartialHFTConfig = {};
    const prefix = this.options.envPrefix || 'HFT_';

    // System configuration
    if (process.env[`${prefix}SYSTEM_NAME`]) {
      envConfig.system = {
        name: process.env[`${prefix}SYSTEM_NAME`] || envConfig.system?.name,
      };
    }

    // Environment
    if (process.env[`${prefix}ENVIRONMENT`]) {
      envConfig.system = {
        ...envConfig.system,
        environment: process.env[`${prefix}ENVIRONMENT`] as 'development' | 'staging' | 'production',
      };
    }

    // Logging level
    if (process.env[`${prefix}LOGGING_LEVEL`]) {
      envConfig.logging = {
        level: process.env[`${prefix}LOGGING_LEVEL`] as 'debug' | 'info' | 'warn' | 'error',
      };
    }

    // Jito enabled
    if (process.env[`${prefix}JITO_ENABLED`]) {
      envConfig.execution = {
        jito: {
          enabled: process.env[`${prefix}JITO_ENABLED`] === 'true',
        },
      };
    }

    // Merge environment configuration
    this.mergeConfig(envConfig);
    this.sources.push('environment');

    this.logger.info('Configuration loaded from environment variables');
  }

  /**
   * Merge configuration from multiple sources
   */
  private mergeConfig(partialConfig: PartialHFTConfig): void {
    this.config = {
      ...this.config,
      system: { ...this.config.system, ...partialConfig.system },
      marketData: { ...this.config.marketData, ...partialConfig.marketData },
      execution: { ...this.config.execution, ...partialConfig.execution },
      risk: { ...this.config.risk, ...partialConfig.risk },
      monitoring: { ...this.config.monitoring, ...partialConfig.monitoring },
      logging: { ...this.config.logging, ...partialConfig.logging },
    };

    // Deep merge exchanges
    if (partialConfig.marketData?.exchanges) {
      const existingExchanges = new Map<string, ExchangeConfig>(
        this.config.marketData.exchanges.map(e => [e.exchange, e])
      );

      for (const exchangeConfig of partialConfig.marketData.exchanges) {
        existingExchanges.set(exchangeConfig.exchange, {
          ...existingExchanges.get(exchangeConfig.exchange),
          ...exchangeConfig,
        });
      }

      this.config.marketData.exchanges = Array.from(existingExchanges.values());
    }

    // Deep merge jito config
    if (partialConfig.execution?.jito) {
      this.config.execution.jito = {
        ...this.config.execution.jito,
        ...partialConfig.execution.jito,
      };
    }

    // Deep merge priority fee config
    if (partialConfig.execution?.priorityFee) {
      this.config.execution.priorityFee = {
        ...this.config.execution.priorityFee,
        ...partialConfig.execution.priorityFee,
      };
    }

    // Deep merge position limits
    if (partialConfig.risk?.positionLimits) {
      this.config.risk.positionLimits = {
        ...this.config.risk.positionLimits,
        ...partialConfig.risk.positionLimits,
      };
    }

    // Deep merge circuit breakers
    if (partialConfig.risk?.circuitBreakers) {
      this.config.risk.circuitBreakers = {
        ...this.config.risk.circuitBreakers,
        ...partialConfig.risk.circuitBreakers,
      };
    }

    // Deep merge stop loss
    if (partialConfig.risk?.stopLoss) {
      this.config.risk.stopLoss = {
        ...this.config.risk.stopLoss,
        ...partialConfig.risk.stopLoss,
      };
    }
  }

  // ==========================================================================
  // Configuration Validation
  // ==========================================================================

  /**
   * Validate configuration
   */
  private validate(): void {
    this.logger.info('Validating configuration...');

    const errors: string[] = [];

    // Check system configuration
    if (!this.config.system.name) {
      errors.push('System name is required');
    }

    if (!this.config.system.version) {
      errors.push('System version is required');
    }

    // Check market data configuration
    if (!this.config.marketData.exchanges || this.config.marketData.exchanges.length === 0) {
      errors.push('At least one exchange must be configured');
    }

    // Check execution configuration
    if (!this.config.execution.jito) {
      errors.push('Jito configuration is required');
    }

    if (!this.config.execution.priorityFee) {
      errors.push('Priority fee configuration is required');
    }

    // Check risk configuration
    if (!this.config.risk.positionLimits) {
      errors.push('Position limits configuration is required');
    }

    if (!this.config.risk.circuitBreakers) {
      errors.push('Circuit breakers configuration is required');
    }

    if (!this.config.risk.stopLoss) {
      errors.push('Stop loss configuration is required');
    }

    if (errors.length > 0) {
      this.logger.error(`Configuration validation failed: ${errors.join(', ')}`);
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    this.logger.info('Configuration validated successfully');
  }

  // ==========================================================================
  // Configuration Access
  // ==========================================================================

  /**
   * Get the full configuration
   */
  public getConfig(): HFTConfig {
    return { ...this.config };
  }

  /**
   * Get system configuration
   */
  public getSystemConfig(): SystemConfig {
    return { ...this.config.system };
  }

  /**
   * Get market data configuration
   */
  public getMarketDataConfig(): MarketDataConfig {
    return { ...this.config.marketData };
  }

  /**
   * Get execution configuration
   */
  public getExecutionConfig(): ExecutionConfig {
    return { ...this.config.execution };
  }

  /**
   * Get risk configuration
   */
  public getRiskConfig(): RiskConfig {
    return { ...this.config.risk };
  }

  /**
   * Get monitoring configuration
   */
  public getMonitoringConfig(): MonitoringConfig {
    return { ...this.config.monitoring };
  }

  /**
   * Get logging configuration
   */
  public getLoggingConfig(): LoggingConfig {
    return { ...this.config.logging };
  }

  /**
   * Get configuration for a specific exchange
   */
  public getExchangeConfig(exchange: Exchange): ExchangeConfig | null {
    const config = this.config.marketData.exchanges.find(
      e => e.exchange === exchange
    );
    return config ? { ...config } : null;
  }

  /**
   * Get Jito configuration
   */
  public getJitoConfig(): JitoConfig {
    return { ...this.config.execution.jito };
  }

  /**
   * Get priority fee configuration
   */
  public getPriorityFeeConfig(): PriorityFeeConfig {
    return { ...this.config.execution.priorityFee };
  }

  /**
   * Get position limits
   */
  public getPositionLimits(): RiskLimits {
    return { ...this.config.risk.positionLimits };
  }

  /**
   * Get circuit breaker configuration
   */
  public getCircuitBreakerConfig(): CircuitBreakerConfig {
    return { ...this.config.risk.circuitBreakers };
  }

  /**
   * Get stop loss configuration
   */
  public getStopLossConfig(): StopLossConfig {
    return { ...this.config.risk.stopLoss };
  }

  // ==========================================================================
  // Configuration Updates
  // ==========================================================================

  /**
   * Update configuration
   */
  public updateConfig(partialConfig: PartialHFTConfig): void {
    this.logger.info('Updating configuration...');
    this.mergeConfig(partialConfig);

    if (this.options.validate) {
      this.validate();
    }

    // Notify watchers
    this.notifyWatchers();

    this.logger.info('Configuration updated successfully');
  }

  /**
   * Update a specific section of configuration
   */
  public updateSection<K extends keyof HFTConfig>(
    section: K,
    partialSection: Partial<HFTConfig[K]>
  ): void {
    this.updateConfig({ [section]: partialSection } as PartialHFTConfig);
  }

  // ==========================================================================
  // Configuration Watching
  // ==========================================================================

  /**
   * Watch for configuration changes
   */
  public watch(id: string, callback: (config: HFTConfig) => void): void {
    this.watchers.set(id, callback);
  }

  /**
   * Unwatch configuration changes
   */
  public unwatch(id: string): void {
    this.watchers.delete(id);
  }

  /**
   * Notify all watchers of configuration change
   */
  private notifyWatchers(): void {
    for (const [id, callback] of this.watchers) {
      try {
        callback(this.getConfig());
      } catch (error) {
        this.logger.error(`Error in watcher ${id}`, error);
      }
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Resolve configuration file path
   */
  private resolveConfigPath(): string {
    const path = this.options.configPath || 'config/hft.json';
    return resolve(process.cwd(), path);
  }

  /**
   * Generate a unique node ID
   */
  private generateNodeId(): string {
    return `node-${Math.random().toString(36).substring(2, 8)}-${Date.now()}`;
  }

  /**
   * Get configuration sources
   */
  public getSources(): ConfigSource[] {
    return [...this.sources];
  }

  /**
   * Check if configuration is valid
   */
  public isValid(): boolean {
    try {
      this.validate();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save current configuration to file
   */
  public saveToFile(path?: string): void {
    const savePath = path || this.resolveConfigPath();

    try {
      const fs = require('fs');
      const dir = require('path').dirname(savePath);

      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(savePath, JSON.stringify(this.config, null, 2));
      this.logger.info(`Configuration saved to: ${savePath}`);
    } catch (error) {
      this.logger.error('Failed to save configuration to file', error);
      throw error;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Singleton configuration manager instance */
let configManagerInstance: ConfigManager | null = null;

/**
 * Get the singleton configuration manager
 */
export function getConfigManager(options?: ConfigLoaderOptions): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager(options);
  }
  return configManagerInstance;
}

/**
 * Reset the singleton configuration manager (for testing)
 */
export function resetConfigManager(): void {
  configManagerInstance = null;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a configuration manager with custom options
 */
export function createConfigManager(options?: ConfigLoaderOptions): ConfigManager {
  return new ConfigManager(options);
}

// ============================================================================
// Default Configuration Export
// ============================================================================

/** Default HFT configuration */
export const defaultHFTConfig: HFTConfig = new ConfigManager().getConfig();
