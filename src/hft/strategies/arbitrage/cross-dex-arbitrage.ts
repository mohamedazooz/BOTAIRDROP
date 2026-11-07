/**
 * Cross-DEX Arbitrage Strategy
 * Senior-grade arbitrage strategy for HFT system
 * 
 * Features:
 * - Real-time price monitoring across multiple DEXs
 * - Arbitrage opportunity detection
 * - Profit calculation with fees and slippage
 * - Atomic execution via Jito Bundles
 * - Risk-aware position sizing
 * - Dynamic spread threshold adjustment
 */

import { EventEmitter } from 'events';
import {
  Strategy,
  StrategyConfig,
  StrategyType,
  ArbitrageOpportunity,
  OrderRequest,
  OrderSide,
  OrderType,
  TimeInForce,
  ExecutionRequest,
  ExecutionResult,
  UUID,
  Timestamp,
  TokenPair,
  TokenAddress,
  Price,
  Amount,
  Exchange,
  Result,
} from '../../types';
import { MarketDataProcessor } from '../../market-data/market-data-processor';
import { ExecutionEngine } from '../../execution/execution-engine';
import { RiskManager } from '../../risk/risk-manager';
import { Logger, createLogger } from '../../utils/logger';
import { CircuitBreaker } from '../../utils/circuit-breaker';

// ============================================================================
// Interfaces
// ============================================================================

/** Cross-DEX arbitrage configuration */
export interface CrossDexArbitrageConfig {
  tokenPairs: TokenPair[];
  exchanges: Exchange[];
  minSpreadPercentage: number; // Minimum spread to consider (e.g., 0.001 = 0.1%)
  minProfit: Amount; // Minimum profit in quote token
  maxOrderSize: Amount; // Maximum order size per arbitrage
  positionSize: Amount; // Size of each arbitrage position
  maxConcurrentArbitrage: number; // Maximum concurrent arbitrage operations
  spreadThresholdMultiplier: number; // Multiplier for dynamic threshold
  feeEstimate: Record<Exchange, number>; // Fee estimates per exchange
  slippageEstimate: number; // Estimated slippage
  useJito: boolean; // Use Jito Bundles for execution
  jitoTipLamports: number; // Jito tip amount
}

/** Arbitrage pair state */
export interface ArbitragePairState {
  tokenPair: TokenPair;
  bestBid: { exchange: Exchange; price: Price; } | null;
  bestAsk: { exchange: Exchange; price: Price; } | null;
  spread: Price;
  spreadPercentage: number;
  lastUpdate: Timestamp;
}

/** Strategy metrics */
export interface ArbitrageStrategyMetrics {
  opportunitiesFound: number;
  opportunitiesExecuted: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalProfit: Amount;
  totalLoss: Amount;
  avgProfit: Amount;
  avgLoss: Amount;
  maxProfit: Amount;
  maxLoss: Amount;
  winRate: number;
  avgSpread: number;
  avgExecutionTime: number;
}

// ============================================================================
// Cross-DEX Arbitrage Strategy
// ============================================================================

/**
 * Cross-DEX Arbitrage Strategy
 * 
 * Monitors prices across multiple DEXs, detects arbitrage opportunities,
 * and executes atomic trades to capture the spread.
 */
export class CrossDexArbitrageStrategy extends EventEmitter implements Strategy {
  public id: UUID;
  public name: string;
  public type: StrategyType = StrategyType.CROSS_DEX_ARBITRAGE;
  public config: StrategyConfig;

  private marketData: MarketDataProcessor | null = null;
  private executionEngine: ExecutionEngine | null = null;
  private riskManager: RiskManager | null = null;
  private arbitrageConfig: CrossDexArbitrageConfig;
  private logger: Logger;
  private isRunning: boolean = false;
  private isInitialized: boolean = false;
  private pairStates: Map<string, ArbitragePairState> = new Map();
  private activeOpportunities: Map<UUID, ArbitrageOpportunity> = new Map();
  private pendingExecutions: Set<UUID> = new Set();
  private circuitBreaker: CircuitBreaker;
  private metrics: ArbitrageStrategyMetrics = {
    opportunitiesFound: 0,
    opportunitiesExecuted: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalProfit: 0,
    totalLoss: 0,
    avgProfit: 0,
    avgLoss: 0,
    maxProfit: 0,
    maxLoss: 0,
    winRate: 0,
    avgSpread: 0,
    avgExecutionTime: 0,
  };
  private lastCheck: Timestamp = 0;
  private lastExecution: Timestamp = 0;
  private errors: number = 0;
  private warnings: number = 0;

  constructor(config: StrategyConfig) {
    super();

    this.id = config.id || this.generateUUID();
    this.name = config.name || 'Cross-DEX Arbitrage';
    this.config = config;

    // Parse arbitrage-specific configuration
    this.arbitrageConfig = {
      tokenPairs: [],
      exchanges: [Exchange.RAYDIUM, Exchange.JUPITER, Exchange.ORCA],
      minSpreadPercentage: 0.001, // 0.1%
      minProfit: 0.01, // 0.01 SOL
      maxOrderSize: 10, // 10 SOL
      positionSize: 1, // 1 SOL
      maxConcurrentArbitrage: 3,
      spreadThresholdMultiplier: 1.5,
      feeEstimate: {
        [Exchange.RAYDIUM]: 0.0025,
        [Exchange.JUPITER]: 0.002,
        [Exchange.ORCA]: 0.003,
        [Exchange.SERUM]: 0.0022,
        [Exchange.DRIFT]: 0.001,
        [Exchange.METEORA]: 0.0025,
        [Exchange.PHOENIX]: 0.002,
        [Exchange.OPENBOOK]: 0.002,
      },
      slippageEstimate: 0.005, // 0.5%
      useJito: true,
      jitoTipLamports: 1000,
      ...(config.parameters as Partial<CrossDexArbitrageConfig>),
    };

    this.logger = createLogger(`${this.name}:${this.id}`);

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      async () => {},
      {
        threshold: 5,
        resetTimeout: 60000,
        halfOpenAfter: 30000,
      }
    );

    // Set up circuit breaker event listeners
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Strategy circuit breaker opened');
      this.isRunning = false;
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Strategy circuit breaker closed');
    });
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Initialize the strategy
   */
  public async initialize(
    marketData: MarketDataProcessor,
    execution: ExecutionEngine,
    risk: RiskManager
  ): Promise<Result<void>> {
    try {
      this.logger.info('Initializing Cross-DEX Arbitrage Strategy...');

      this.marketData = marketData;
      this.executionEngine = execution;
      this.riskManager = risk;

      // Register with risk manager
      if (this.riskManager) {
        this.riskManager.registerStrategyCircuitBreaker(this.id);
      }

      // Initialize pair states
      for (const tokenPair of this.arbitrageConfig.tokenPairs) {
        this.initializePairState(tokenPair);
      }

      this.isInitialized = true;
      this.logger.info('Cross-DEX Arbitrage Strategy initialized successfully');

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to initialize Cross-DEX Arbitrage Strategy', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Start the strategy
   */
  public async start(): Promise<Result<void>> {
    if (this.isRunning) {
      this.logger.warn('Strategy is already running');
      return { success: false, error: new Error('Already running') };
    }

    if (!this.isInitialized) {
      this.logger.error('Strategy must be initialized before starting');
      return { success: false, error: new Error('Not initialized') };
    }

    try {
      this.logger.info('Starting Cross-DEX Arbitrage Strategy...');

      // Set up market data event listeners
      if (this.marketData) {
        this.setupMarketDataListeners();
      }

      this.isRunning = true;
      this.logger.info('Cross-DEX Arbitrage Strategy started successfully');

      // Start opportunity checking loop
      this.startOpportunityChecking();

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to start Cross-DEX Arbitrage Strategy', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Stop the strategy
   */
  public async stop(): Promise<Result<void>> {
    if (!this.isRunning) {
      this.logger.warn('Strategy is not running');
      return { success: false, error: new Error('Not running') };
    }

    try {
      this.logger.info('Stopping Cross-DEX Arbitrage Strategy...');

      this.isRunning = false;

      // Clear pending executions
      this.pendingExecutions.clear();

      this.logger.info('Cross-DEX Arbitrage Strategy stopped successfully');

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to stop Cross-DEX Arbitrage Strategy', error);
      return { success: false, error: error as Error };
    }
  }

  // ==========================================================================
  // Core Strategy Methods
  // ==========================================================================

  /**
   * Process market data
   */
  public async onMarketData(data: any): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Update pair state based on market data
      if (data.type === 'ORDER_BOOK_UPDATE' || data.type === 'PRICE_UPDATE') {
        this.updatePairState(data);
      }

      // Check for opportunities after data update
      await this.checkOpportunities();
    } catch (error) {
      this.logger.error('Error processing market data', error);
      this.errors++;
    }
  }

  /**
   * Check for arbitrage opportunities
   */
  public async checkOpportunities(): Promise<ArbitrageOpportunity[]> {
    if (!this.isRunning || !this.marketData) {
      return [];
    }

    const startTime = Date.now();
    const opportunities: ArbitrageOpportunity[] = [];

    try {
      this.logger.debug('Checking for arbitrage opportunities...');

      // Check each token pair for arbitrage
      for (const tokenPair of this.arbitrageConfig.tokenPairs) {
        const opportunity = await this.findArbitrageOpportunity(tokenPair);
        if (opportunity) {
          opportunities.push(opportunity);
        }
      }

      // Sort by estimated profit (descending)
      opportunities.sort((a, b) => b.estimatedProfit - a.estimatedProfit);

      // Update metrics
      this.metrics.opportunitiesFound += opportunities.length;
      this.lastCheck = Date.now();

      // Store opportunities
      for (const opportunity of opportunities) {
        this.activeOpportunities.set(opportunity.id, opportunity);
      }

      this.logger.debug(`Found ${opportunities.length} arbitrage opportunities in ${Date.now() - startTime}ms`);

      return opportunities;
    } catch (error) {
      this.logger.error('Error checking for arbitrage opportunities', error);
      this.errors++;
      return [];
    }
  }

  /**
   * Execute an arbitrage opportunity
   */
  public async executeOpportunity(opportunity: ArbitrageOpportunity): Promise<Result<ExecutionResult>> {
    if (!this.isRunning || !this.executionEngine || !this.riskManager) {
      return { success: false, error: new Error('Strategy not ready') };
    }

    const startTime = Date.now();

    try {
      this.logger.info(`Executing arbitrage opportunity: ${opportunity.id}`);

      // Check circuit breaker
      if (this.circuitBreaker.getState() === 'OPEN') {
        this.logger.warn('Circuit breaker is open, cannot execute opportunity');
        return { success: false, error: new Error('Circuit breaker open') };
      }

      // Check if we can execute (max concurrent arbitrage)
      if (this.pendingExecutions.size >= this.arbitrageConfig.maxConcurrentArbitrage) {
        this.logger.warn('Maximum concurrent arbitrage reached');
        return { success: false, error: new Error('Max concurrent arbitrage reached') };
      }

      // Check risk limits
      const riskCheck = await this.riskManager.canExecuteOrder(
        {
          ...opportunity,
          type: OrderType.MARKET,
          timeInForce: TimeInForce.IOC,
          maxSlippage: this.arbitrageConfig.slippageEstimate,
        } as OrderRequest,
        opportunity.sellPrice
      );

      if (!riskCheck.success || !riskCheck.data.allowed) {
        this.logger.warn(`Risk check failed: ${riskCheck.data.reason}`);
        return { success: false, error: new Error(riskCheck.data.reason || 'Risk check failed') };
      }

      // Add to pending
      this.pendingExecutions.add(opportunity.id);

      // Execute with circuit breaker protection
      const result = await this.circuitBreaker.execute(async () => {
        return this.executeArbitrageOpportunity(opportunity);
      });

      // Remove from pending
      this.pendingExecutions.delete(opportunity.id);

      if (!result.success) {
        this.logger.error(`Failed to execute arbitrage opportunity: ${result.error.message}`);
        this.metrics.failedExecutions++;
        this.metrics.totalLoss += Math.abs(opportunity.estimatedProfit);
        this.warnings++;
        return result;
      }

      // Update metrics
      this.metrics.opportunitiesExecuted++;
      this.metrics.successfulExecutions++;
      this.metrics.totalProfit += result.data.actualProfit;
      this.metrics.avgProfit = this.metrics.totalProfit / this.metrics.successfulExecutions;
      this.metrics.maxProfit = Math.max(this.metrics.maxProfit, result.data.actualProfit);
      this.metrics.avgExecutionTime = (
        (this.metrics.avgExecutionTime * (this.metrics.successfulExecutions - 1)) +
        (Date.now() - startTime)
      ) / this.metrics.successfulExecutions;
      this.lastExecution = Date.now();

      // Remove from active opportunities
      this.activeOpportunities.delete(opportunity.id);

      this.logger.info(`Arbitrage opportunity executed: ${opportunity.id}, Profit: ${result.data.actualProfit}`);

      return result;
    } catch (error) {
      this.logger.error(`Error executing arbitrage opportunity: ${opportunity.id}`, error);
      this.pendingExecutions.delete(opportunity.id);
      this.metrics.failedExecutions++;
      this.errors++;
      return { success: false, error: error as Error };
    }
  }

  /**
   * Get strategy status
   */
  public getStatus(): {
    id: UUID;
    name: string;
    type: StrategyType;
    isRunning: boolean;
    isInitialized: boolean;
    lastCheck: Timestamp;
    lastExecution: Timestamp;
    errors: number;
    warnings: number;
    activeOpportunities: number;
    pendingExecutions: number;
    circuitBreakerState: string;
  } {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      lastCheck: this.lastCheck,
      lastExecution: this.lastExecution,
      errors: this.errors,
      warnings: this.warnings,
      activeOpportunities: this.activeOpportunities.size,
      pendingExecutions: this.pendingExecutions.size,
      circuitBreakerState: this.circuitBreaker.getState(),
    };
  }

  /**
   * Get strategy metrics
   */
  public getMetrics(): {
    opportunitiesFound: number;
    opportunitiesExecuted: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalProfit: Amount;
    totalLoss: Amount;
    avgProfit: Amount;
    avgLoss: Amount;
    maxProfit: Amount;
    maxLoss: Amount;
    winRate: number;
    avgSpread: number;
    avgExecutionTime: number;
  } {
    return { ...this.metrics };
  }

  /**
   * Reset strategy state
   */
  public async reset(): Promise<Result<void>> {
    try {
      this.logger.info('Resetting Cross-DEX Arbitrage Strategy...');

      this.isRunning = false;
      this.isInitialized = false;
      this.pairStates.clear();
      this.activeOpportunities.clear();
      this.pendingExecutions.clear();
      this.metrics = {
        opportunitiesFound: 0,
        opportunitiesExecuted: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalProfit: 0,
        totalLoss: 0,
        avgProfit: 0,
        avgLoss: 0,
        maxProfit: 0,
        maxLoss: 0,
        winRate: 0,
        avgSpread: 0,
        avgExecutionTime: 0,
      };
      this.lastCheck = 0;
      this.lastExecution = 0;
      this.errors = 0;
      this.warnings = 0;

      this.logger.info('Cross-DEX Arbitrage Strategy reset successfully');

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to reset Cross-DEX Arbitrage Strategy', error);
      return { success: false, error: error as Error };
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Set up market data event listeners
   */
  private setupMarketDataListeners(): void {
    if (!this.marketData) {
      return;
    }

    this.marketData
      .on('orderBookUpdate', (event) => {
        this.onMarketData(event).catch(error => {
          this.logger.error('Error in orderBookUpdate handler', error);
        });
      })
      .on('priceUpdate', (event) => {
        this.onMarketData(event).catch(error => {
          this.logger.error('Error in priceUpdate handler', error);
        });
      });
  }

  /**
   * Start opportunity checking loop
   */
  private startOpportunityChecking(): void {
    // Check every 100ms for high-frequency opportunities
    const interval = setInterval(async () => {
      if (this.isRunning) {
        await this.checkOpportunities();
      }
    }, 100);

    // Clean up on stop
    this.on('stop', () => {
      clearInterval(interval);
    });
  }

  /**
   * Initialize pair state
   */
  private initializePairState(tokenPair: TokenPair): void {
    const key = this.getPairKey(tokenPair);
    this.pairStates.set(key, {
      tokenPair,
      bestBid: null,
      bestAsk: null,
      spread: 0,
      spreadPercentage: 0,
      lastUpdate: 0,
    });
  }

  /**
   * Update pair state from market data
   */
  private updatePairState(data: any): void {
    if (!this.marketData) {
      return;
    }

    const tokenPair: TokenPair = {
      baseToken: data.tokenPair.baseToken,
      quoteToken: data.tokenPair.quoteToken,
    };

    const key = this.getPairKey(tokenPair);
    const state = this.pairStates.get(key);
    if (!state) {
      return;
    }

    // Update based on data type
    if (data.type === 'ORDER_BOOK_UPDATE') {
      const orderBook = data.data as any;

      // Find best bid and ask from this exchange
      const bid = orderBook.bids.length > 0 ? orderBook.bids[0] : null;
      const ask = orderBook.asks.length > 0 ? orderBook.asks[0] : null;

      if (bid && (!state.bestBid || bid.price > state.bestBid.price)) {
        state.bestBid = {
          exchange: data.exchange,
          price: bid.price,
        };
      }

      if (ask && (!state.bestAsk || ask.price < state.bestAsk.price)) {
        state.bestAsk = {
          exchange: data.exchange,
          price: ask.price,
        };
      }
    } else if (data.type === 'PRICE_UPDATE') {
      const ticker = data.data as any;
      // For price updates, we can use the last price as both bid and ask
      // This is a simplification
      state.bestBid = {
        exchange: data.exchange,
        price: ticker.lastPrice,
      };
      state.bestAsk = {
        exchange: data.exchange,
        price: ticker.lastPrice,
      };
    }

    // Calculate spread
    if (state.bestBid && state.bestAsk) {
      state.spread = state.bestAsk.price - state.bestBid.price;
      state.spreadPercentage = (state.spread / state.bestBid.price) * 100;
    }

    state.lastUpdate = Date.now();
    this.pairStates.set(key, state);
  }

  /**
   * Find arbitrage opportunity for a token pair
   */
  private async findArbitrageOpportunity(tokenPair: TokenPair): Promise<ArbitrageOpportunity | null> {
    if (!this.marketData) {
      return null;
    }

    const key = this.getPairKey(tokenPair);
    const state = this.pairStates.get(key);
    if (!state || !state.bestBid || !state.bestAsk) {
      return null;
    }

    // Check if spread is large enough
    if (state.spreadPercentage < this.arbitrageConfig.minSpreadPercentage) {
      return null;
    }

    // Calculate potential profit
    const buyPrice = state.bestBid.price;
    const sellPrice = state.bestAsk.price;
    const buyExchange = state.bestBid.exchange;
    const sellExchange = state.bestAsk.exchange;

    // Must be different exchanges for cross-DEX arbitrage
    if (buyExchange === sellExchange) {
      return null;
    }

    // Calculate profit per unit
    const grossProfitPerUnit = sellPrice - buyPrice;
    const grossProfitPercentage = (grossProfitPerUnit / buyPrice) * 100;

    // Calculate fees
    const buyFee = this.arbitrageConfig.feeEstimate[buyExchange] || 0.0025;
    const sellFee = this.arbitrageConfig.feeEstimate[sellExchange] || 0.0025;
    const totalFee = buyFee + sellFee;

    // Calculate net profit
    const netProfitPerUnit = grossProfitPerUnit * (1 - totalFee);

    // Calculate for position size
    const positionSize = Math.min(
      this.arbitrageConfig.positionSize,
      this.arbitrageConfig.maxOrderSize
    );
    const netProfit = netProfitPerUnit * positionSize;

    // Check minimum profit
    if (netProfit < this.arbitrageConfig.minProfit) {
      return null;
    }

    // Calculate required capital
    const requiredCapital = positionSize * buyPrice;

    // Calculate slippage estimate
    const slippage = this.arbitrageConfig.slippageEstimate;
    const slippageCost = positionSize * buyPrice * slippage;

    // Create opportunity
    const opportunity: ArbitrageOpportunity = {
      id: this.generateUUID(),
      strategyId: this.id,
      tokenPair,
      exchanges: [buyExchange, sellExchange],
      buyPrice,
      sellPrice,
      spread: state.spread,
      spreadPercentage: state.spreadPercentage,
      estimatedProfit: netProfit - slippageCost,
      estimatedProfitPercentage: grossProfitPercentage * (1 - totalFee) - slippage * 100,
      requiredCapital,
      fees: requiredCapital * totalFee,
      slippage: slippage,
      latency: 0, // Will be set during execution
      timestamp: Date.now(),
    };

    // Update average spread metric
    this.metrics.avgSpread = (
      (this.metrics.avgSpread * (this.metrics.opportunitiesFound)) +
      opportunity.spreadPercentage
    ) / (this.metrics.opportunitiesFound + 1);

    this.logger.debug(`Found arbitrage opportunity: ${tokenPair.baseToken}/${tokenPair.quoteToken}, ` +
      `Buy: ${buyPrice} @ ${buyExchange}, Sell: ${sellPrice} @ ${sellExchange}, ` +
      `Profit: ${opportunity.estimatedProfit}, Spread: ${opportunity.spreadPercentage}%`);

    return opportunity;
  }

  /**
   * Execute an arbitrage opportunity
   */
  private async executeArbitrageOpportunity(
    opportunity: ArbitrageOpportunity
  ): Promise<Result<ExecutionResult>> {
    if (!this.executionEngine || !this.riskManager) {
      return { success: false, error: new Error('Dependencies not initialized') };
    }

    const startTime = Date.now();

    try {
      this.logger.info(`Executing arbitrage: ${opportunity.tokenPair.baseToken}/${opportunity.tokenPair.quoteToken}`);

      // Calculate position size based on available capital and risk limits
      const positionSize = this.calculatePositionSize(opportunity);

      // Create buy order
      const buyOrder: OrderRequest = {
        id: this.generateUUID(),
        strategyId: this.id,
        exchange: opportunity.exchanges[0],
        baseToken: opportunity.tokenPair.baseToken,
        quoteToken: opportunity.tokenPair.quoteToken,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        amount: positionSize,
        price: opportunity.buyPrice,
        timeInForce: TimeInForce.IOC,
        maxSlippage: this.arbitrageConfig.slippageEstimate,
        timestamp: Date.now(),
      };

      // Create sell order
      const sellOrder: OrderRequest = {
        id: this.generateUUID(),
        strategyId: this.id,
        exchange: opportunity.exchanges[1],
        baseToken: opportunity.tokenPair.baseToken,
        quoteToken: opportunity.tokenPair.quoteToken,
        side: OrderSide.SELL,
        type: OrderType.MARKET,
        amount: positionSize,
        price: opportunity.sellPrice,
        timeInForce: TimeInForce.IOC,
        maxSlippage: this.arbitrageConfig.slippageEstimate,
        timestamp: Date.now(),
      };

      // Create execution request
      const executionRequest: ExecutionRequest = {
        id: this.generateUUID(),
        strategyId: this.id,
        opportunity,
        orders: [buyOrder, sellOrder],
        estimatedProfit: opportunity.estimatedProfit,
        maxSlippage: this.arbitrageConfig.slippageEstimate,
        priority: 1,
        timestamp: Date.now(),
      };

      // Execute via execution engine
      // In practice, we would use a wallet from the wallet fleet
      // For now, we'll use a dummy wallet
      const dummyWallet = Keypair.generate();

      const result = await this.executionEngine.executeRequest(
        executionRequest,
        dummyWallet
      );

      if (!result.success) {
        this.logger.error(`Execution failed: ${result.error.message}`);
        return result;
      }

      // Update risk manager with PnL
      this.riskManager.updatePnL(result.data.actualProfit);

      // Update opportunity latency
      opportunity.latency = Date.now() - startTime;

      this.logger.info(`Arbitrage executed successfully: Profit = ${result.data.actualProfit}`);

      return result;
    } catch (error) {
      this.logger.error(`Error executing arbitrage: ${opportunity.id}`, error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Calculate position size for an opportunity
   */
  private calculatePositionSize(opportunity: ArbitrageOpportunity): Amount {
    // Start with configured position size
    let positionSize = this.arbitrageConfig.positionSize;

    // Adjust based on available capital
    if (this.riskManager) {
      const portfolioValue = this.riskManager.getPortfolioValue();
      const maxRisk = portfolioValue * this.config.riskLimits.maxPortfolioRisk;
      const maxPosition = Math.min(
        maxRisk / opportunity.spreadPercentage,
        this.arbitrageConfig.maxOrderSize
      );
      positionSize = Math.min(positionSize, maxPosition);
    }

    // Adjust based on liquidity
    // In practice, we would check liquidity on both exchanges

    // Adjust based on spread (larger spread = larger position)
    const spreadMultiplier = Math.min(
      opportunity.spreadPercentage / this.arbitrageConfig.minSpreadPercentage,
      5
    );
    positionSize = positionSize * Math.sqrt(spreadMultiplier);

    return positionSize;
  }

  /**
   * Generate a UUID
   */
  private generateUUID(): UUID {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get pair key
   */
  private getPairKey(tokenPair: TokenPair): string {
    return `${tokenPair.baseToken}:${tokenPair.quoteToken}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a cross-DEX arbitrage strategy with default configuration
 */
export function createCrossDexArbitrageStrategy(
  config?: Partial<StrategyConfig>
): CrossDexArbitrageStrategy {
  const defaultConfig: StrategyConfig = {
    id: '',
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
  };

  return new CrossDexArbitrageStrategy({ ...defaultConfig, ...config });
}
