/**
 * Strategy Engine
 * Senior-grade strategy execution engine for HFT system
 * 
 * Features:
 * - Multi-strategy support
 * - Dynamic strategy loading
 * - Risk-aware execution
 * - Performance monitoring
 * - Circuit breakers
 */

import { EventEmitter } from 'events';
import {
  StrategyConfig,
  StrategyType,
  ArbitrageOpportunity,
  OrderRequest,
  ExecutionRequest,
  ExecutionResult,
  UUID,
  Timestamp,
  TokenPair,
  Exchange,
  Result,
} from '../types';
import { MarketDataProcessor } from '../market-data/market-data-processor';
import { ExecutionEngine } from '../execution/execution-engine';
import { RiskManager } from '../risk/risk-manager';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { Logger, createLogger } from '../utils/logger';

// ============================================================================
// Interfaces
// ============================================================================

/** Strategy interface */
export interface Strategy {
  id: UUID;
  name: string;
  type: StrategyType;
  config: StrategyConfig;
  
  /** Initialize the strategy */
  initialize(marketData: MarketDataProcessor, execution: ExecutionEngine, risk: RiskManager): Promise<Result<void>>;
  
  /** Start the strategy */
  start(): Promise<Result<void>>;
  
  /** Stop the strategy */
  stop(): Promise<Result<void>>;
  
  /** Process market data */
  onMarketData(data: any): Promise<void>;
  
  /** Check for opportunities */
  checkOpportunities(): Promise<ArbitrageOpportunity[]>;
  
  /** Execute an opportunity */
  executeOpportunity(opportunity: ArbitrageOpportunity): Promise<Result<ExecutionResult>>;
  
  /** Get strategy status */
  getStatus(): StrategyStatus;
  
  /** Get strategy metrics */
  getMetrics(): StrategyMetrics;
  
  /** Reset strategy state */
  reset(): Promise<Result<void>>;
}

/** Strategy status */
export interface StrategyStatus {
  id: UUID;
  name: string;
  type: StrategyType;
  isRunning: boolean;
  isInitialized: boolean;
  lastCheck: Timestamp;
  lastExecution: Timestamp;
  errors: number;
  warnings: number;
}

/** Strategy metrics */
export interface StrategyMetrics {
  id: UUID;
  opportunitiesFound: number;
  opportunitiesExecuted: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalProfit: number;
  totalLoss: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  maxProfit: number;
  maxLoss: number;
  latency: {
    avg: number;
    min: number;
    max: number;
  };
}

/** Strategy factory */
export interface StrategyFactory {
  createStrategy(config: StrategyConfig): Strategy;
  getStrategyType(type: StrategyType): Strategy | null;
  listAvailableStrategies(): StrategyType[];
}

/** Strategy engine configuration */
export interface StrategyEngineConfig {
  maxConcurrentStrategies: number;
  defaultRiskLimits: any;
  circuitBreaker: {
    threshold: number;
    resetTimeout: number;
    halfOpenAfter: number;
  };
}

// ============================================================================
// Strategy Engine
// ============================================================================

/**
 * Strategy Engine
 * 
 * Manages multiple trading strategies, coordinates their execution,
 * and ensures risk controls are applied.
 */
export class StrategyEngine extends EventEmitter {
  private strategies: Map<UUID, Strategy> = new Map();
  private activeStrategies: Set<UUID> = new Set();
  private marketData: MarketDataProcessor;
  private executionEngine: ExecutionEngine;
  private riskManager: RiskManager;
  private circuitBreaker: CircuitBreaker;
  private logger: Logger;
  private config: StrategyEngineConfig;
  private isRunning: boolean = false;
  private strategyFactory: StrategyFactory;

  constructor(
    marketData: MarketDataProcessor,
    executionEngine: ExecutionEngine,
    riskManager: RiskManager,
    strategyFactory: StrategyFactory,
    config?: Partial<StrategyEngineConfig>
  ) {
    super();
    
    this.marketData = marketData;
    this.executionEngine = executionEngine;
    this.riskManager = riskManager;
    this.strategyFactory = strategyFactory;
    this.logger = createLogger('StrategyEngine');
    
    this.config = {
      maxConcurrentStrategies: 10,
      defaultRiskLimits: {},
      circuitBreaker: {
        threshold: 5,
        resetTimeout: 60000,
        halfOpenAfter: 30000,
      },
      ...config,
    };

    this.circuitBreaker = new CircuitBreaker(
      async () => {},
      this.config.circuitBreaker
    );
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Start the strategy engine
   */
  public async start(): Promise<Result<void>> {
    if (this.isRunning) {
      this.logger.warn('StrategyEngine is already running');
      return { success: false, error: new Error('Already running') };
    }

    try {
      this.logger.info('Starting StrategyEngine...');
      
      // Initialize all strategies
      for (const strategy of this.strategies.values()) {
        const result = await strategy.initialize(
          this.marketData,
          this.executionEngine,
          this.riskManager
        );
        
        if (!result.success) {
          this.logger.error(`Failed to initialize strategy ${strategy.name}`, result.error);
          continue;
        }
        
        this.logger.info(`Initialized strategy: ${strategy.name}`);
      }

      this.isRunning = true;
      this.logger.info('StrategyEngine started successfully');
      
      // Start all active strategies
      for (const strategyId of this.activeStrategies) {
        const strategy = this.strategies.get(strategyId);
        if (strategy) {
          await strategy.start();
          this.logger.info(`Started strategy: ${strategy.name}`);
        }
      }

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to start StrategyEngine', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Stop the strategy engine
   */
  public async stop(): Promise<Result<void>> {
    if (!this.isRunning) {
      this.logger.warn('StrategyEngine is not running');
      return { success: false, error: new Error('Not running') };
    }

    try {
      this.logger.info('Stopping StrategyEngine...');
      
      // Stop all active strategies
      for (const strategyId of this.activeStrategies) {
        const strategy = this.strategies.get(strategyId);
        if (strategy) {
          await strategy.stop();
          this.logger.info(`Stopped strategy: ${strategy.name}`);
        }
      }

      this.isRunning = false;
      this.logger.info('StrategyEngine stopped successfully');
      
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to stop StrategyEngine', error);
      return { success: false, error: error as Error };
    }
  }

  // ==========================================================================
  // Strategy Management
  // ==========================================================================

  /**
   * Add a new strategy
   */
  public addStrategy(config: StrategyConfig): Result<Strategy> {
    try {
      this.logger.info(`Adding strategy: ${config.name}`);
      
      const strategy = this.strategyFactory.createStrategy(config);
      this.strategies.set(strategy.id, strategy);
      
      this.logger.info(`Added strategy: ${strategy.name} (${strategy.id})`);
      return { success: true, data: strategy };
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
      const strategy = this.strategies.get(strategyId);
      
      if (!strategy) {
        this.logger.warn(`Strategy ${strategyId} not found`);
        return { success: false, error: new Error('Strategy not found') };
      }

      // Stop the strategy if it's running
      if (this.activeStrategies.has(strategyId)) {
        this.activeStrategies.delete(strategyId);
        await strategy.stop();
      }

      this.strategies.delete(strategyId);
      this.logger.info(`Removed strategy: ${strategy.name}`);
      
      return { success: true, data: undefined };
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
      const strategy = this.strategies.get(strategyId);
      
      if (!strategy) {
        this.logger.warn(`Strategy ${strategyId} not found`);
        return { success: false, error: new Error('Strategy not found') };
      }

      if (this.activeStrategies.size >= this.config.maxConcurrentStrategies) {
        this.logger.warn('Maximum concurrent strategies reached');
        return { success: false, error: new Error('Max concurrent strategies reached') };
      }

      this.activeStrategies.add(strategyId);
      
      // Initialize if not already initialized
      if (!strategy.getStatus().isInitialized) {
        await strategy.initialize(
          this.marketData,
          this.executionEngine,
          this.riskManager
        );
      }

      await strategy.start();
      this.logger.info(`Activated strategy: ${strategy.name}`);
      
      return { success: true, data: undefined };
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
      const strategy = this.strategies.get(strategyId);
      
      if (!strategy) {
        this.logger.warn(`Strategy ${strategyId} not found`);
        return { success: false, error: new Error('Strategy not found') };
      }

      if (!this.activeStrategies.has(strategyId)) {
        this.logger.warn(`Strategy ${strategyId} is not active`);
        return { success: false, error: new Error('Strategy not active') };
      }

      this.activeStrategies.delete(strategyId);
      await strategy.stop();
      
      this.logger.info(`Deactivated strategy: ${strategy.name}`);
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to deactivate strategy', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Get a strategy by ID
   */
  public getStrategy(strategyId: UUID): Strategy | null {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * Get all strategies
   */
  public getAllStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get active strategies
   */
  public getActiveStrategies(): Strategy[] {
    return Array.from(this.activeStrategies.values())
      .map(id => this.strategies.get(id))
      .filter((s): s is Strategy => s !== null);
  }

  // ==========================================================================
  // Status and Metrics
  // ==========================================================================

  /**
   * Get engine status
   */
  public getStatus(): {
    isRunning: boolean;
    strategyCount: number;
    activeStrategyCount: number;
    maxConcurrentStrategies: number;
    circuitBreakerState: string;
  } {
    return {
      isRunning: this.isRunning,
      strategyCount: this.strategies.size,
      activeStrategyCount: this.activeStrategies.size,
      maxConcurrentStrategies: this.config.maxConcurrentStrategies,
      circuitBreakerState: this.circuitBreaker.getState(),
    };
  }

  /**
   * Get all strategy statuses
   */
  public getAllStrategyStatuses(): StrategyStatus[] {
    return Array.from(this.strategies.values())
      .map(strategy => strategy.getStatus());
  }

  /**
   * Get all strategy metrics
   */
  public getAllStrategyMetrics(): StrategyMetrics[] {
    return Array.from(this.strategies.values())
      .map(strategy => strategy.getMetrics());
  }

  /**
   * Get combined metrics for all strategies
   */
  public getCombinedMetrics(): StrategyMetrics {
    const allMetrics = this.getAllStrategyMetrics();
    
    if (allMetrics.length === 0) {
      return {
        id: 'combined',
        opportunitiesFound: 0,
        opportunitiesExecuted: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalProfit: 0,
        totalLoss: 0,
        winRate: 0,
        avgProfit: 0,
        avgLoss: 0,
        maxProfit: 0,
        maxLoss: 0,
        latency: { avg: 0, min: 0, max: 0 },
      };
    }

    const combined: StrategyMetrics = {
      id: 'combined',
      opportunitiesFound: allMetrics.reduce((sum, m) => sum + m.opportunitiesFound, 0),
      opportunitiesExecuted: allMetrics.reduce((sum, m) => sum + m.opportunitiesExecuted, 0),
      successfulExecutions: allMetrics.reduce((sum, m) => sum + m.successfulExecutions, 0),
      failedExecutions: allMetrics.reduce((sum, m) => sum + m.failedExecutions, 0),
      totalProfit: allMetrics.reduce((sum, m) => sum + m.totalProfit, 0),
      totalLoss: allMetrics.reduce((sum, m) => sum + m.totalLoss, 0),
      winRate: allMetrics.reduce((sum, m, _, arr) => 
        sum + (m.successfulExecutions / (m.successfulExecutions + m.failedExecutions || 1)), 0) / allMetrics.length,
      avgProfit: allMetrics.reduce((sum, m) => sum + m.avgProfit, 0) / allMetrics.length,
      avgLoss: allMetrics.reduce((sum, m) => sum + m.avgLoss, 0) / allMetrics.length,
      maxProfit: Math.max(...allMetrics.map(m => m.maxProfit)),
      maxLoss: Math.min(...allMetrics.map(m => m.maxLoss)),
      latency: {
        avg: allMetrics.reduce((sum, m) => sum + m.latency.avg, 0) / allMetrics.length,
        min: Math.min(...allMetrics.map(m => m.latency.min)),
        max: Math.max(...allMetrics.map(m => m.latency.max)),
      },
    };

    return combined;
  }

  // ==========================================================================
  // Opportunity Handling
  // ==========================================================================

  /**
   * Check all strategies for opportunities
   */
  public async checkAllOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    for (const strategy of this.activeStrategies.values()) {
      const strat = this.strategies.get(strategy);
      if (strat) {
        try {
          const stratOpps = await strat.checkOpportunities();
          opportunities.push(...stratOpps);
        } catch (error) {
          this.logger.error(`Error checking opportunities for strategy ${strat.name}`, error);
        }
      }
    }

    // Sort by estimated profit (descending)
    opportunities.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
    
    return opportunities;
  }

  /**
   * Execute the best opportunity
   */
  public async executeBestOpportunity(): Promise<Result<ExecutionResult>> {
    const opportunities = await this.checkAllOpportunities();
    
    if (opportunities.length === 0) {
      return { success: false, error: new Error('No opportunities found') };
    }

    const bestOpportunity = opportunities[0];
    return this.executeOpportunity(bestOpportunity);
  }

  /**
   * Execute a specific opportunity
   */
  public async executeOpportunity(opportunity: ArbitrageOpportunity): Promise<Result<ExecutionResult>> {
    // Check circuit breaker
    if (this.circuitBreaker.getState() === 'OPEN') {
      this.logger.warn('Circuit breaker is open, not executing opportunity');
      return { success: false, error: new Error('Circuit breaker open') };
    }

    try {
      const strategy = this.strategies.get(opportunity.strategyId);
      
      if (!strategy) {
        this.logger.error(`Strategy ${opportunity.strategyId} not found`);
        return { success: false, error: new Error('Strategy not found') };
      }

      // Execute with circuit breaker protection
      const result = await this.circuitBreaker.execute(async () => {
        return strategy.executeOpportunity(opportunity);
      });

      if (!result.success) {
        this.logger.error(`Failed to execute opportunity: ${result.error.message}`);
        return result;
      }

      this.logger.info(`Executed opportunity: ${opportunity.id}, Profit: ${opportunity.estimatedProfit}`);
      return result;
    } catch (error) {
      this.logger.error('Error executing opportunity', error);
      return { success: false, error: error as Error };
    }
  }

  // ==========================================================================
  // Risk Management
  // ==========================================================================

  /**
   * Check if a strategy can execute based on risk limits
   */
  public async canExecuteStrategy(strategyId: UUID): Promise<Result<boolean>> {
    const strategy = this.strategies.get(strategyId);
    
    if (!strategy) {
      return { success: false, error: new Error('Strategy not found') };
    }

    try {
      const canExecute = await this.riskManager.canExecute(strategy);
      return { success: true, data: canExecute };
    } catch (error) {
      this.logger.error('Error checking if strategy can execute', error);
      return { success: false, error: error as Error };
    }
  }

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  /**
   * Set up market data event handlers
   */
  public setupMarketDataHandlers(): void {
    this.marketData
      .on('orderBookUpdate', (event) => {
        this.handleMarketDataEvent(event);
      })
      .on('newTrade', (event) => {
        this.handleMarketDataEvent(event);
      })
      .on('priceUpdate', (event) => {
        this.handleMarketDataEvent(event);
      });
  }

  /**
   * Handle market data events
   */
  private async handleMarketDataEvent(event: any): Promise<void> {
    for (const strategy of this.activeStrategies.values()) {
      const strat = this.strategies.get(strategy);
      if (strat) {
        try {
          await strat.onMarketData(event);
        } catch (error) {
          this.logger.error(`Error processing market data for strategy ${strat.name}`, error);
        }
      }
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Initialize default strategies
   */
  private async initializeDefaultStrategies(): Promise<void> {
    // Add default strategies based on configuration
    const defaultStrategies = [
      {
        id: 'cross-dex-arbitrage',
        name: 'Cross-DEX Arbitrage',
        type: StrategyType.CROSS_DEX_ARBITRAGE,
        exchanges: [Exchange.RAYDIUM, Exchange.JUPITER, Exchange.ORCA],
        parameters: {
          minSpreadPercentage: 0.1,
          minProfit: 0.01,
          maxOrderSize: 1,
        },
        isActive: true,
        priority: 1,
      },
      {
        id: 'market-making',
        name: 'Market Making',
        type: StrategyType.MARKET_MAKING,
        exchanges: [Exchange.RAYDIUM, Exchange.JUPITER],
        parameters: {
          spreadPercentage: 0.2,
          orderSize: 0.1,
          orderRefreshInterval: 100,
        },
        isActive: true,
        priority: 2,
      },
      {
        id: 'stat-arb',
        name: 'Statistical Arbitrage',
        type: StrategyType.STATISTICAL_ARBITRAGE,
        exchanges: [Exchange.RAYDIUM, Exchange.JUPITER],
        parameters: {
          zScoreThreshold: 2,
          lookbackPeriod: 3600000, // 1 hour
        },
        isActive: true,
        priority: 3,
      },
    ];

    for (const config of defaultStrategies) {
      this.addStrategy(config as StrategyConfig);
    }
  }
}

// ============================================================================
// Default Strategy Factory
// ============================================================================

/**
 * Default Strategy Factory
 * 
 * Creates strategy instances based on configuration.
 */
export class DefaultStrategyFactory implements StrategyFactory {
  private strategyClasses: Map<StrategyType, new (config: StrategyConfig) => Strategy> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = createLogger('DefaultStrategyFactory');
    
    // Register default strategy classes
    // Note: These will be implemented in separate files
    // this.strategyClasses.set(StrategyType.CROSS_DEX_ARBITRAGE, CrossDexArbitrageStrategy);
    // this.strategyClasses.set(StrategyType.MARKET_MAKING, MarketMakingStrategy);
    // this.strategyClasses.set(StrategyType.STATISTICAL_ARBITRAGE, StatArbStrategy);
  }

  public createStrategy(config: StrategyConfig): Strategy {
    const StrategyClass = this.strategyClasses.get(config.type);
    
    if (!StrategyClass) {
      this.logger.error(`No strategy class registered for type: ${config.type}`);
      throw new Error(`No strategy class for type: ${config.type}`);
    }

    return new StrategyClass(config);
  }

  public getStrategyType(type: StrategyType): Strategy | null {
    const StrategyClass = this.strategyClasses.get(type);
    return StrategyClass ? new StrategyClass({} as StrategyConfig) : null;
  }

  public listAvailableStrategies(): StrategyType[] {
    return Array.from(this.strategyClasses.keys());
  }

  /**
   * Register a new strategy class
   */
  public registerStrategyType(type: StrategyType, strategyClass: new (config: StrategyConfig) => Strategy): void {
    this.strategyClasses.set(type, strategyClass);
    this.logger.info(`Registered strategy type: ${type}`);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a strategy engine with default configuration
 */
export function createStrategyEngine(
  marketData: MarketDataProcessor,
  executionEngine: ExecutionEngine,
  riskManager: RiskManager,
  config?: Partial<StrategyEngineConfig>
): StrategyEngine {
  const strategyFactory = new DefaultStrategyFactory();
  return new StrategyEngine(
    marketData,
    executionEngine,
    riskManager,
    strategyFactory,
    config
  );
}
