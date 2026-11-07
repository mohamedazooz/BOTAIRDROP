/**
 * HFT System Entry Point
 * Senior-grade High-Frequency Trading system
 * 
 * Features:
 * - Multi-DEX market data processing
 * - Pluggable strategy engine
 * - Risk-aware execution engine
 * - Circuit breaker protection
 * - Jito Bundles for priority execution
 * - Comprehensive monitoring and logging
 */

import { Connection } from '@solana/web3.js';
import { EventEmitter } from 'events';
import {
  HFTConfig,
  StrategyConfig,
  StrategyType,
  TokenPair,
  UUID,
  Result,
} from './types';
import { MarketDataProcessor, createMarketDataProcessor } from './market-data/market-data-processor';
import { ExecutionEngine, createExecutionEngine } from './execution/execution-engine';
import { RiskManager, createRiskManager } from './risk/risk-manager';
import { StrategyEngine, createStrategyEngine, DefaultStrategyFactory } from './strategies/strategy-engine';
import { CrossDexArbitrageStrategy, createCrossDexArbitrageStrategy } from './strategies/arbitrage/cross-dex-arbitrage';
import { ConfigManager, getConfigManager, createConfigManager } from './config';
import { Logger, createLogger, configureLogger } from './utils/logger';

// ============================================================================
// Types
// ============================================================================

/** HFT system status */
export interface HFTSystemStatus {
  isRunning: boolean;
  startedAt: number;
  uptime: number;
  components: {
    marketData: boolean;
    executionEngine: boolean;
    riskManager: boolean;
    strategyEngine: boolean;
  };
  strategies: {
    active: number;
    total: number;
    types: StrategyType[];
  };
  metrics: {
    opportunitiesFound: number;
    opportunitiesExecuted: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalProfit: number;
    totalLoss: number;
    portfolioValue: number;
  };
}

/** HFT system configuration options */
export interface HFTSystemOptions {
  config?: Partial<HFTConfig>;
  configPath?: string;
  connection?: Connection;
  tokenPairs?: TokenPair[];
  strategies?: StrategyConfig[];
  initialPortfolioValue?: number;
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    format?: 'json' | 'text';
    output?: 'console' | 'file' | 'both';
  };
}

// ============================================================================
// HFT System
// ============================================================================

/**
 * HFT System
 * 
 * The main entry point for the High-Frequency Trading system.
 * Orchestrates all components: market data, execution, risk, and strategies.
 */
export class HFTSystem extends EventEmitter {
  private configManager: ConfigManager;
  private marketData: MarketDataProcessor;
  private executionEngine: ExecutionEngine;
  private riskManager: RiskManager;
  private strategyEngine: StrategyEngine;
  private strategyFactory: DefaultStrategyFactory;
  private logger: Logger;
  private connection: Connection;

  private isRunning: boolean = false;
  private startedAt: number = 0;
  private initialPortfolioValue: number;

  constructor(options: HFTSystemOptions = {}) {
    super();

    // Configure logging
    if (options.logging) {
      configureLogger(options.logging);
    }

    this.logger = createLogger('HFTSystem');
    this.logger.info('Initializing HFT System...');

    // Initialize configuration manager
    this.configManager = options.config
      ? createConfigManager({ configPath: options.configPath })
      : getConfigManager();

    // Update configuration with options
    if (options.config) {
      this.configManager.updateConfig(options.config);
    }

    // Get configuration
    const config = this.configManager.getConfig();

    // Initialize connection
    this.connection = options.connection || new Connection(config.execution.jito.rpcUrl);

    // Set initial portfolio value
    this.initialPortfolioValue = options.initialPortfolioValue || 100; // Default: 100 SOL

    // Initialize components
    this.logger.info('Initializing components...');

    // Market Data Processor
    const marketDataConfig = this.configManager.getMarketDataConfig();
    this.marketData = createMarketDataProcessor({
      exchanges: marketDataConfig.exchanges.map(e => e.exchange),
      tokenPairs: options.tokenPairs || [],
      orderBookDepth: marketDataConfig.orderBookDepth,
      websocketTimeout: marketDataConfig.websocketTimeout,
      restTimeout: marketDataConfig.restTimeout,
      maxRetries: marketDataConfig.maxRetries,
      retryConfig: {
        maxRetries: marketDataConfig.maxRetries,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
      },
      circuitBreaker: {
        threshold: 3,
        resetTimeout: 60000,
        halfOpenAfter: 30000,
      },
    });

    // Execution Engine
    const executionConfig = this.configManager.getExecutionConfig();
    this.executionEngine = createExecutionEngine(this.marketData, {
      connection: this.connection,
      jito: executionConfig.jito,
      priorityFee: executionConfig.priorityFee,
      maxRetries: executionConfig.maxRetries,
      retryConfig: {
        maxRetries: executionConfig.maxRetries,
        initialDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: true,
      },
      circuitBreaker: {
        threshold: 5,
        resetTimeout: 60000,
        halfOpenAfter: 30000,
      },
      slippageTolerance: executionConfig.slippageTolerance,
      maxTransactionAge: executionConfig.maxTransactionAge,
    });

    // Risk Manager
    const riskConfig = this.configManager.getRiskConfig();
    this.riskManager = createRiskManager({
      positionLimits: riskConfig.positionLimits,
      circuitBreakers: riskConfig.circuitBreakers,
      stopLoss: riskConfig.stopLoss,
      maxOpenPositions: 20,
      maxPortfolioRisk: 0.2,
      maxDailyLoss: riskConfig.positionLimits.maxDailyLoss,
      maxDrawdown: riskConfig.positionLimits.maxDrawdown,
      liquidityThreshold: riskConfig.positionLimits.minLiquidity,
    });

    // Strategy Factory
    this.strategyFactory = new DefaultStrategyFactory();

    // Register strategy types
    this.registerStrategyTypes();

    // Strategy Engine
    const strategyConfig = this.configManager.getSystemConfig();
    this.strategyEngine = createStrategyEngine(
      this.marketData,
      this.executionEngine,
      this.riskManager,
      this.strategyFactory,
      {
        maxConcurrentStrategies: strategyConfig.maxConcurrentStrategies,
        circuitBreaker: {
          threshold: 5,
          resetTimeout: 60000,
          halfOpenAfter: 30000,
        },
      }
    );

    // Add default strategies if none provided
    if (!options.strategies || options.strategies.length === 0) {
      this.addDefaultStrategies();
    } else {
      // Add provided strategies
      for (const strategyConfig of options.strategies) {
        this.strategyEngine.addStrategy(strategyConfig);
      }
    }

    this.logger.info('HFT System initialized successfully');
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Start the HFT system
   */
  public async start(): Promise<Result<void>> {
    if (this.isRunning) {
      this.logger.warn('HFT System is already running');
      return { success: false, error: new Error('Already running') };
    }

    try {
      this.logger.info('Starting HFT System...');

      // Start risk manager
      this.logger.info('Starting Risk Manager...');
      const riskResult = await this.riskManager.start(this.initialPortfolioValue);
      if (!riskResult.success) {
        this.logger.error('Failed to start Risk Manager', riskResult.error);
        return riskResult;
      }

      // Start market data processor
      this.logger.info('Starting Market Data Processor...');
      const marketDataResult = await this.marketData.start();
      if (!marketDataResult.success) {
        this.logger.error('Failed to start Market Data Processor', marketDataResult.error);
        return marketDataResult;
      }

      // Start execution engine
      this.logger.info('Starting Execution Engine...');
      const executionResult = await this.executionEngine.start();
      if (!executionResult.success) {
        this.logger.error('Failed to start Execution Engine', executionResult.error);
        return executionResult;
      }

      // Start strategy engine
      this.logger.info('Starting Strategy Engine...');
      const strategyResult = await this.strategyEngine.start();
      if (!strategyResult.success) {
        this.logger.error('Failed to start Strategy Engine', strategyResult.error);
        return strategyResult;
      }

      // Set up strategy engine event handlers
      this.setupEventHandlers();

      this.isRunning = true;
      this.startedAt = Date.now();

      this.logger.info('HFT System started successfully');

      // Emit start event
      this.emit('started', { timestamp: this.startedAt });

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to start HFT System', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Stop the HFT system
   */
  public async stop(): Promise<Result<void>> {
    if (!this.isRunning) {
      this.logger.warn('HFT System is not running');
      return { success: false, error: new Error('Not running') };
    }

    try {
      this.logger.info('Stopping HFT System...');

      // Stop strategy engine
      this.logger.info('Stopping Strategy Engine...');
      await this.strategyEngine.stop();

      // Stop execution engine
      this.logger.info('Stopping Execution Engine...');
      await this.executionEngine.stop();

      // Stop market data processor
      this.logger.info('Stopping Market Data Processor...');
      await this.marketData.stop();

      // Stop risk manager
      this.logger.info('Stopping Risk Manager...');
      await this.riskManager.stop();

      this.isRunning = false;

      this.logger.info('HFT System stopped successfully');

      // Emit stop event
      this.emit('stopped', { timestamp: Date.now() });

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to stop HFT System', error);
      return { success: false, error: error as Error };
    }
  }

  // ==========================================================================
  // Strategy Management
  // ==========================================================================

  /**
   * Add a strategy
   */
  public addStrategy(config: StrategyConfig): Result<StrategyConfig> {
    try {
      this.logger.info(`Adding strategy: ${config.name}`);
      const result = this.strategyEngine.addStrategy(config);
      
      if (result.success) {
        this.logger.info(`Strategy added: ${config.name} (${config.id})`);
        this.emit('strategyAdded', config);
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to add strategy', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Remove a strategy
   */
  public removeStrategy(strategyId: UUID): Result<void> {
    try {
      this.logger.info(`Removing strategy: ${strategyId}`);
      const result = this.strategyEngine.removeStrategy(strategyId);
      
      if (result.success) {
        this.logger.info(`Strategy removed: ${strategyId}`);
        this.emit('strategyRemoved', { strategyId });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to remove strategy', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Activate a strategy
   */
  public async activateStrategy(strategyId: UUID): Promise<Result<void>> {
    try {
      this.logger.info(`Activating strategy: ${strategyId}`);
      const result = await this.strategyEngine.activateStrategy(strategyId);
      
      if (result.success) {
        this.logger.info(`Strategy activated: ${strategyId}`);
        this.emit('strategyActivated', { strategyId });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to activate strategy', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Deactivate a strategy
   */
  public async deactivateStrategy(strategyId: UUID): Promise<Result<void>> {
    try {
      this.logger.info(`Deactivating strategy: ${strategyId}`);
      const result = await this.strategyEngine.deactivateStrategy(strategyId);
      
      if (result.success) {
        this.logger.info(`Strategy deactivated: ${strategyId}`);
        this.emit('strategyDeactivated', { strategyId });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to deactivate strategy', error);
      return { success: false, error: error as Error };
    }
  }

  // ==========================================================================
  // System Status and Metrics
  // ==========================================================================

  /**
   * Get system status
   */
  public getStatus(): HFTSystemStatus {
    const uptime = this.isRunning ? Date.now() - this.startedAt : 0;

    const strategyMetrics = this.strategyEngine.getCombinedMetrics();

    return {
      isRunning: this.isRunning,
      startedAt: this.startedAt,
      uptime,
      components: {
        marketData: this.marketData.isRunning(),
        executionEngine: this.executionEngine.getStatus().isRunning,
        riskManager: this.riskManager.getStatus().isRunning,
        strategyEngine: this.strategyEngine.getStatus().isRunning,
      },
      strategies: {
        active: this.strategyEngine.getActiveStrategies().length,
        total: this.strategyEngine.getAllStrategies().length,
        types: this.strategyEngine.getAllStrategies().map(s => s.type),
      },
      metrics: {
        opportunitiesFound: strategyMetrics.opportunitiesFound,
        opportunitiesExecuted: strategyMetrics.opportunitiesExecuted,
        successfulExecutions: strategyMetrics.successfulExecutions,
        failedExecutions: strategyMetrics.failedExecutions,
        totalProfit: strategyMetrics.totalProfit,
        totalLoss: strategyMetrics.totalLoss,
        portfolioValue: this.riskManager.getPortfolioValue(),
      },
    };
  }

  /**
   * Get detailed metrics
   */
  public getMetrics() {
    return {
      marketData: this.marketData.getStats(),
      executionEngine: this.executionEngine.getStatus().metrics,
      riskManager: this.riskManager.getMetrics(),
      strategyEngine: this.strategyEngine.getCombinedMetrics(),
    };
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Get configuration manager
   */
  public getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Get configuration
   */
  public getConfig(): HFTConfig {
    return this.configManager.getConfig();
  }

  /**
   * Update configuration
   */
  public updateConfig(partialConfig: Partial<HFTConfig>): void {
    this.configManager.updateConfig(partialConfig);
  }

  // ==========================================================================
  // Component Access
  // ==========================================================================

  /**
   * Get market data processor
   */
  public getMarketDataProcessor(): MarketDataProcessor {
    return this.marketData;
  }

  /**
   * Get execution engine
   */
  public getExecutionEngine(): ExecutionEngine {
    return this.executionEngine;
  }

  /**
   * Get risk manager
   */
  public getRiskManager(): RiskManager {
    return this.riskManager;
  }

  /**
   * Get strategy engine
   */
  public getStrategyEngine(): StrategyEngine {
    return this.strategyEngine;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Register strategy types with the factory
   */
  private registerStrategyTypes(): void {
    this.logger.info('Registering strategy types...');

    // Register Cross-DEX Arbitrage
    this.strategyFactory.registerStrategyType(
      StrategyType.CROSS_DEX_ARBITRAGE,
      (config) => new CrossDexArbitrageStrategy(config)
    );

    // TODO: Register other strategy types
    // this.strategyFactory.registerStrategyType(
    //   StrategyType.MARKET_MAKING,
    //   (config) => new MarketMakingStrategy(config)
    // );
    // this.strategyFactory.registerStrategyType(
    //   StrategyType.STATISTICAL_ARBITRAGE,
    //   (config) => new StatArbStrategy(config)
    // );

    this.logger.info('Strategy types registered');
  }

  /**
   * Add default strategies
   */
  private addDefaultStrategies(): void {
    this.logger.info('Adding default strategies...');

    // Cross-DEX Arbitrage
    const arbitrageStrategy = createCrossDexArbitrageStrategy({
      id: 'cross-dex-arbitrage-1',
      name: 'Cross-DEX Arbitrage',
      type: StrategyType.CROSS_DEX_ARBITRAGE,
      exchanges: [Exchange.RAYDIUM, Exchange.JUPITER, Exchange.ORCA],
      parameters: {
        tokenPairs: [
          { baseToken: 'So11111111111111111111111111111111111111112', quoteToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', baseDecimals: 9, quoteDecimals: 6 }, // SOL/USDC
          { baseToken: 'So11111111111111111111111111111111111111112', quoteToken: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', baseDecimals: 9, quoteDecimals: 9 }, // SOL/USDT
        ],
        minSpreadPercentage: 0.001,
        minProfit: 0.01,
        maxOrderSize: 10,
        positionSize: 1,
        maxConcurrentArbitrage: 3,
      },
      riskLimits: {
        maxPositionSize: 10,
        maxPortfolioRisk: 0.05,
        maxLeverage: 1,
        maxDailyLoss: 1,
        maxDrawdown: 0.2,
        maxOrderSize: 5,
        maxSlippage: 0.01,
        minLiquidity: 100,
      },
      isActive: true,
      priority: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.strategyEngine.addStrategy(arbitrageStrategy.config);

    this.logger.info('Default strategies added');
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    this.logger.info('Setting up event handlers...');

    // Strategy engine events
    this.strategyEngine
      .on('orderExecuted', (data) => {
        this.emit('orderExecuted', data);
      })
      .on('opportunityFound', (data) => {
        this.emit('opportunityFound', data);
      })
      .on('strategyError', (data) => {
        this.logger.error(`Strategy error: ${data.strategyId}`, data.error);
        this.emit('strategyError', data);
      });

    // Market data events
    this.marketData
      .on('orderBookUpdate', (data) => {
        this.emit('orderBookUpdate', data);
      })
      .on('newTrade', (data) => {
        this.emit('newTrade', data);
      })
      .on('priceUpdate', (data) => {
        this.emit('priceUpdate', data);
      })
      .on('error', (data) => {
        this.logger.error(`Market data error: ${data.exchange}`, data.error);
        this.emit('marketDataError', data);
      });

    // Risk manager events
    this.riskManager
      .on('positionOpened', (position) => {
        this.emit('positionOpened', position);
      })
      .on('positionClosed', (position) => {
        this.emit('positionClosed', position);
      })
      .on('stopLossTriggered', (data) => {
        this.emit('stopLossTriggered', data);
      })
      .on('circuitBreakerTripped', (data) => {
        this.logger.warn(`Circuit breaker tripped: ${data.type} ${data.id}`);
        this.emit('circuitBreakerTripped', data);
      })
      .on('alert', (alert) => {
        this.emit('alert', alert);
      });

    this.logger.info('Event handlers set up');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an HFT system with the given options
 */
export function createHFTSystem(options?: HFTSystemOptions): HFTSystem {
  return new HFTSystem(options);
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Singleton HFT system instance */
let hftSystemInstance: HFTSystem | null = null;

/**
 * Get the singleton HFT system
 */
export function getHFTSystem(options?: HFTSystemOptions): HFTSystem {
  if (!hftSystemInstance) {
    hftSystemInstance = createHFTSystem(options);
  }
  return hftSystemInstance;
}

/**
 * Reset the singleton HFT system (for testing)
 */
export function resetHFTSystem(): void {
  hftSystemInstance = null;
}

// ============================================================================
// Exports
// ============================================================================

export {
  MarketDataProcessor,
  createMarketDataProcessor,
  ExecutionEngine,
  createExecutionEngine,
  RiskManager,
  createRiskManager,
  StrategyEngine,
  createStrategyEngine,
  DefaultStrategyFactory,
  CrossDexArbitrageStrategy,
  createCrossDexArbitrageStrategy,
  ConfigManager,
  getConfigManager,
  createConfigManager,
  getConfigManager as getConfig,
  configureLogger,
  createLogger,
};
