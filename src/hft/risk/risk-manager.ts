/**
 * Risk Manager
 * Senior-grade risk management for HFT system
 * 
 * Features:
 * - Position tracking and limits
 * - Circuit breakers for strategies and exchanges
 * - Stop-loss management
 * - Liquidity checks
 * - Portfolio risk monitoring
 * - Real-time risk assessment
 */

import { EventEmitter } from 'events';
import {
  Position,
  PortfolioSnapshot,
  RiskLimits,
  CircuitBreakerConfig,
  CircuitBreakerState as CircuitBreakerStateType,
  StopLossConfig,
  UUID,
  Timestamp,
  TokenAddress,
  Amount,
  Price,
  Strategy,
  OrderRequest,
  OrderSide,
  Result,
} from '../types';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { Logger, createLogger } from '../utils/logger';

// ============================================================================
// Interfaces
// ============================================================================

/** Risk manager configuration */
export interface RiskManagerConfig {
  positionLimits: RiskLimits;
  circuitBreakers: CircuitBreakerConfig;
  stopLoss: StopLossConfig;
  maxOpenPositions: number;
  maxPortfolioRisk: number; // Percentage
  maxDailyLoss: Amount;
  maxDrawdown: number; // Percentage
  liquidityThreshold: Amount;
}

/** Risk check result */
export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
  riskScore: number; // 0-100, higher = more risky
}

/** Position update */
export interface PositionUpdate {
  positionId: UUID;
  token: TokenAddress;
  amount: Amount;
  entryPrice: Price;
  currentPrice: Price;
  timestamp: Timestamp;
}

/** Risk alert */
export interface RiskAlert {
  type: 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  severity: number; // 1-10
  timestamp: Timestamp;
  data?: Record<string, any>;
}

/** Risk metrics */
export interface RiskMetrics {
  currentPortfolioValue: Amount;
  currentDrawdown: number;
  maxDrawdown: number;
  openPositions: number;
  portfolioRisk: number;
  circuitBreakersTripped: number;
  stopLossesTriggered: number;
  liquidityWarnings: number;
}

// ============================================================================
// Risk Manager
// ============================================================================

/**
 * Risk Manager
 * 
 * Manages risk across all trading activities, enforces limits, and prevents
 * catastrophic losses through circuit breakers and stop-loss mechanisms.
 */
export class RiskManager extends EventEmitter {
  private positions: Map<UUID, Position> = new Map();
  private strategyCircuitBreakers: Map<UUID, CircuitBreaker> = new Map();
  private exchangeCircuitBreakers: Map<string, CircuitBreaker> = new Map();
  private globalCircuitBreaker: CircuitBreaker;
  private stopLossOrders: Map<UUID, { positionId: UUID; stopPrice: Price; trailing: boolean }> = new Map();
  private alerts: RiskAlert[] = [];
  private dailyPnL: Amount = 0;
  private dailyLoss: Amount = 0;
  private initialPortfolioValue: Amount = 0;
  private currentPortfolioValue: Amount = 0;
  private logger: Logger;
  private config: RiskManagerConfig;
  private isRunning: boolean = false;

  constructor(config: Partial<RiskManagerConfig> = {}) {
    super();

    const defaultConfig: RiskManagerConfig = {
      positionLimits: {
        maxPositionSize: 100, // Max SOL per position
        maxPortfolioRisk: 0.05, // 5% of portfolio per position
        maxLeverage: 5,
        maxDailyLoss: 10, // 10 SOL
        maxDrawdown: 0.2, // 20%
        maxOrderSize: 50, // 50 SOL
        maxSlippage: 0.05, // 5%
        minLiquidity: 100, // 100 SOL liquidity required
      },
      circuitBreakers: {
        threshold: 5,
        resetTimeout: 60000,
        halfOpenAfter: 30000,
      },
      stopLoss: {
        stopLossPercentage: 0.05, // 5%
        trailingStopPercentage: 0.03, // 3%
        liquidationThreshold: 0.1, // 10%
      },
      maxOpenPositions: 20,
      maxPortfolioRisk: 0.2, // 20% of portfolio at risk
      maxDailyLoss: 10,
      maxDrawdown: 0.2,
      liquidityThreshold: 100,
    };

    this.config = { ...defaultConfig, ...config };
    this.logger = createLogger('RiskManager');

    // Initialize global circuit breaker
    this.globalCircuitBreaker = new CircuitBreaker(
      async () => {},
      this.config.circuitBreakers
    );
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Start the risk manager
   */
  public async start(initialPortfolioValue: Amount): Promise<Result<void>> {
    if (this.isRunning) {
      this.logger.warn('RiskManager is already running');
      return { success: false, error: new Error('Already running') };
    }

    try {
      this.logger.info('Starting RiskManager...');

      this.initialPortfolioValue = initialPortfolioValue;
      this.currentPortfolioValue = initialPortfolioValue;

      this.isRunning = true;
      this.logger.info('RiskManager started successfully');

      // Start monitoring loop
      this.startMonitoring();

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to start RiskManager', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Stop the risk manager
   */
  public async stop(): Promise<Result<void>> {
    if (!this.isRunning) {
      this.logger.warn('RiskManager is not running');
      return { success: false, error: new Error('Not running') };
    }

    try {
      this.logger.info('Stopping RiskManager...');

      this.isRunning = false;
      this.logger.info('RiskManager stopped successfully');

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to stop RiskManager', error);
      return { success: false, error: error as Error };
    }
  }

  // ==========================================================================
  // Position Management
  // ==========================================================================

  /**
   * Open a new position
   */
  public async openPosition(
    token: TokenAddress,
    amount: Amount,
    entryPrice: Price,
    strategyId: UUID,
    exchange: string
  ): Promise<Result<Position>> {
    try {
      this.logger.debug(`Opening position: ${amount} ${token} @ ${entryPrice}`);

      // Check if we can open this position
      const checkResult = await this.checkPositionOpening(token, amount, entryPrice);
      if (!checkResult.allowed) {
        this.logger.warn(`Cannot open position: ${checkResult.reason}`);
        return { success: false, error: new Error(checkResult.reason || 'Risk check failed') };
      }

      const positionId = this.generateUUID();

      const position: Position = {
        id: positionId,
        token,
        amount,
        entryPrice,
        currentPrice: entryPrice,
        entryTimestamp: Date.now(),
        strategyId,
        exchange,
      };

      this.positions.set(positionId, position);

      // Emit event
      this.emit('positionOpened', position);

      this.logger.info(`Position opened: ${positionId}, ${amount} ${token} @ ${entryPrice}`);

      return { success: true, data: position };
    } catch (error) {
      this.logger.error('Error opening position', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Update a position
   */
  public async updatePosition(
    positionId: UUID,
    newAmount: Amount,
    newPrice: Price
  ): Promise<Result<Position>> {
    try {
      const position = this.positions.get(positionId);
      if (!position) {
        return { success: false, error: new Error('Position not found') };
      }

      this.logger.debug(`Updating position ${positionId}: amount=${newAmount}, price=${newPrice}`);

      position.amount = newAmount;
      position.currentPrice = newPrice;

      // Emit event
      this.emit('positionUpdated', position);

      this.logger.info(`Position updated: ${positionId}, amount=${newAmount}, price=${newPrice}`);

      return { success: true, data: position };
    } catch (error) {
      this.logger.error('Error updating position', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Close a position
   */
  public async closePosition(positionId: UUID, exitPrice: Price): Promise<Result<Position>> {
    try {
      const position = this.positions.get(positionId);
      if (!position) {
        return { success: false, error: new Error('Position not found') };
      }

      this.logger.debug(`Closing position ${positionId} @ ${exitPrice}`);

      position.currentPrice = exitPrice;

      // Remove stop-loss order if exists
      for (const [orderId, stopLoss] of this.stopLossOrders) {
        if (stopLoss.positionId === positionId) {
          this.stopLossOrders.delete(orderId);
          break;
        }
      }

      // Emit event
      this.emit('positionClosed', position);

      // Don't remove from map - keep for history
      // this.positions.delete(positionId);

      this.logger.info(`Position closed: ${positionId} @ ${exitPrice}`);

      return { success: true, data: position };
    } catch (error) {
      this.logger.error('Error closing position', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Get a position by ID
   */
  public getPosition(positionId: UUID): Position | null {
    return this.positions.get(positionId) || null;
  }

  /**
   * Get all open positions
   */
  public getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get positions for a specific strategy
   */
  public getPositionsByStrategy(strategyId: UUID): Position[] {
    return Array.from(this.positions.values())
      .filter(p => p.strategyId === strategyId);
  }

  /**
   * Get positions for a specific token
   */
  public getPositionsByToken(token: TokenAddress): Position[] {
    return Array.from(this.positions.values())
      .filter(p => p.token === token);
  }

  // ==========================================================================
  // Risk Check Methods
  // ==========================================================================

  /**
   * Check if an order can be executed
   */
  public async canExecuteOrder(
    order: OrderRequest,
    currentPrice: Price
  ): Promise<Result<RiskCheckResult>> {
    try {
      const result: RiskCheckResult = {
        allowed: true,
        warnings: [],
        riskScore: 0,
      };

      // Check global circuit breaker
      if (this.globalCircuitBreaker.getState() === 'OPEN') {
        result.allowed = false;
        result.reason = 'Global circuit breaker is open';
        result.riskScore = 100;
        return { success: true, data: result };
      }

      // Check strategy circuit breaker
      const strategyCircuitBreaker = this.strategyCircuitBreakers.get(order.strategyId);
      if (strategyCircuitBreaker && strategyCircuitBreaker.getState() === 'OPEN') {
        result.allowed = false;
        result.reason = `Strategy circuit breaker is open for ${order.strategyId}`;
        result.riskScore = 100;
        return { success: true, data: result };
      }

      // Check exchange circuit breaker
      const exchangeCircuitBreaker = this.exchangeCircuitBreakers.get(order.exchange);
      if (exchangeCircuitBreaker && exchangeCircuitBreaker.getState() === 'OPEN') {
        result.allowed = false;
        result.reason = `Exchange circuit breaker is open for ${order.exchange}`;
        result.riskScore = 100;
        return { success: true, data: result };
      }

      // Check position limits
      const positionCheck = await this.checkPositionLimits(order, currentPrice);
      if (!positionCheck.allowed) {
        result.allowed = false;
        result.reason = positionCheck.reason;
        result.riskScore = Math.max(result.riskScore, 80);
        result.warnings.push(...positionCheck.warnings);
      }

      // Check order size
      const amountInSOL = order.amount * currentPrice;
      if (amountInSOL > this.config.positionLimits.maxOrderSize) {
        result.allowed = false;
        result.reason = `Order size exceeds maximum: ${amountInSOL} > ${this.config.positionLimits.maxOrderSize}`;
        result.riskScore = Math.max(result.riskScore, 70);
      }

      // Check slippage
      if (order.maxSlippage > this.config.positionLimits.maxSlippage) {
        result.allowed = false;
        result.reason = `Slippage exceeds maximum: ${order.maxSlippage} > ${this.config.positionLimits.maxSlippage}`;
        result.riskScore = Math.max(result.riskScore, 60);
      }

      // Check liquidity
      const liquidityCheck = await this.checkLiquidity(order);
      if (!liquidityCheck.allowed) {
        result.allowed = false;
        result.reason = liquidityCheck.reason;
        result.riskScore = Math.max(result.riskScore, 75);
      }

      // Check portfolio risk
      const portfolioRisk = await this.calculatePortfolioRisk(order, currentPrice);
      if (portfolioRisk > this.config.maxPortfolioRisk) {
        result.allowed = false;
        result.reason = `Portfolio risk exceeds maximum: ${portfolioRisk} > ${this.config.maxPortfolioRisk}`;
        result.riskScore = Math.max(result.riskScore, 90);
      }

      // Check daily loss limit
      if (this.dailyLoss >= this.config.maxDailyLoss) {
        result.allowed = false;
        result.reason = `Daily loss limit reached: ${this.dailyLoss} >= ${this.config.maxDailyLoss}`;
        result.riskScore = 100;
      }

      // Check drawdown
      const currentDrawdown = this.calculateDrawdown();
      if (currentDrawdown > this.config.maxDrawdown) {
        result.allowed = false;
        result.reason = `Drawdown exceeds maximum: ${currentDrawdown} > ${this.config.maxDrawdown}`;
        result.riskScore = 100;
      }

      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Error checking if order can be executed', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Check if a strategy can execute
   */
  public async canExecuteStrategy(strategy: Strategy): Promise<Result<boolean>> {
    try {
      // Check strategy circuit breaker
      const circuitBreaker = this.strategyCircuitBreakers.get(strategy.id);
      if (circuitBreaker && circuitBreaker.getState() === 'OPEN') {
        return { success: true, data: false };
      }

      // Check strategy-specific limits
      const positions = this.getPositionsByStrategy(strategy.id);
      if (positions.length >= this.config.maxOpenPositions) {
        return { success: true, data: false };
      }

      return { success: true, data: true };
    } catch (error) {
      this.logger.error('Error checking if strategy can execute', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Check position opening
   */
  private async checkPositionOpening(
    token: TokenAddress,
    amount: Amount,
    entryPrice: Price
  ): Promise<RiskCheckResult> {
    const result: RiskCheckResult = {
      allowed: true,
      warnings: [],
      riskScore: 0,
    };

    const positionValue = amount * entryPrice;

    // Check max position size
    if (positionValue > this.config.positionLimits.maxPositionSize) {
      result.allowed = false;
      result.reason = `Position size exceeds maximum: ${positionValue} > ${this.config.positionLimits.maxPositionSize}`;
      result.riskScore = 80;
      return result;
    }

    // Check max open positions
    if (this.positions.size >= this.config.maxOpenPositions) {
      result.allowed = false;
      result.reason = `Maximum open positions reached: ${this.positions.size} >= ${this.config.maxOpenPositions}`;
      result.riskScore = 70;
      return result;
    }

    // Check existing position in same token
    const existingPositions = this.getPositionsByToken(token);
    const totalTokenPosition = existingPositions.reduce((sum, p) => sum + p.amount, 0);
    const totalTokenValue = (totalTokenPosition + amount) * entryPrice;

    if (totalTokenValue > this.config.positionLimits.maxPositionSize * 2) {
      result.warnings.push(`High exposure to ${token}: ${totalTokenValue}`);
      result.riskScore += 20;
    }

    return result;
  }

  /**
   * Check position limits for an order
   */
  private async checkPositionLimits(
    order: OrderRequest,
    currentPrice: Price
  ): Promise<RiskCheckResult> {
    const result: RiskCheckResult = {
      allowed: true,
      warnings: [],
      riskScore: 0,
    };

    const positionValue = order.amount * currentPrice;

    // Check max position size
    if (positionValue > this.config.positionLimits.maxPositionSize) {
      result.allowed = false;
      result.reason = `Position size exceeds maximum`;
      result.riskScore = 80;
      return result;
    }

    return result;
  }

  /**
   * Check liquidity for an order
   */
  private async checkLiquidity(order: OrderRequest): Promise<RiskCheckResult> {
    const result: RiskCheckResult = {
      allowed: true,
      warnings: [],
      riskScore: 0,
    };

    // In practice, this would check the liquidity on the exchange
    // For now, we'll assume liquidity is sufficient

    return result;
  }

  /**
   * Calculate portfolio risk for an order
   */
  private async calculatePortfolioRisk(
    order: OrderRequest,
    currentPrice: Price
  ): Promise<number> {
    const orderValue = order.amount * currentPrice;
    const portfolioValue = this.currentPortfolioValue;

    return orderValue / portfolioValue;
  }

  // ==========================================================================
  // Circuit Breaker Methods
  // ==========================================================================

  /**
   * Register a strategy circuit breaker
   */
  public registerStrategyCircuitBreaker(
    strategyId: UUID,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    const circuitConfig = { ...this.config.circuitBreakers, ...config };
    const circuitBreaker = new CircuitBreaker(
      async () => {},
      circuitConfig
    );

    this.strategyCircuitBreakers.set(strategyId, circuitBreaker);

    // Set up event listeners
    circuitBreaker.on('open', () => {
      this.logger.warn(`Strategy circuit breaker opened: ${strategyId}`);
      this.emit('circuitBreakerTripped', { type: 'strategy', id: strategyId });
      this.addAlert({
        type: 'WARNING',
        code: 'CB_STRATEGY_OPEN',
        message: `Strategy circuit breaker opened: ${strategyId}`,
        severity: 8,
        timestamp: Date.now(),
      });
    });

    circuitBreaker.on('close', () => {
      this.logger.info(`Strategy circuit breaker closed: ${strategyId}`);
      this.emit('circuitBreakerReset', { type: 'strategy', id: strategyId });
    });

    return circuitBreaker;
  }

  /**
   * Register an exchange circuit breaker
   */
  public registerExchangeCircuitBreaker(
    exchange: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    const circuitConfig = { ...this.config.circuitBreakers, ...config };
    const circuitBreaker = new CircuitBreaker(
      async () => {},
      circuitConfig
    );

    this.exchangeCircuitBreakers.set(exchange, circuitBreaker);

    // Set up event listeners
    circuitBreaker.on('open', () => {
      this.logger.warn(`Exchange circuit breaker opened: ${exchange}`);
      this.emit('circuitBreakerTripped', { type: 'exchange', id: exchange });
      this.addAlert({
        type: 'WARNING',
        code: 'CB_EXCHANGE_OPEN',
        message: `Exchange circuit breaker opened: ${exchange}`,
        severity: 8,
        timestamp: Date.now(),
      });
    });

    circuitBreaker.on('close', () => {
      this.logger.info(`Exchange circuit breaker closed: ${exchange}`);
      this.emit('circuitBreakerReset', { type: 'exchange', id: exchange });
    });

    return circuitBreaker;
  }

  /**
   * Trip a strategy circuit breaker
   */
  public tripStrategyCircuitBreaker(strategyId: UUID): void {
    const circuitBreaker = this.strategyCircuitBreakers.get(strategyId);
    if (circuitBreaker) {
      circuitBreaker.trip();
    }
  }

  /**
   * Trip an exchange circuit breaker
   */
  public tripExchangeCircuitBreaker(exchange: string): void {
    const circuitBreaker = this.exchangeCircuitBreakers.get(exchange);
    if (circuitBreaker) {
      circuitBreaker.trip();
    }
  }

  /**
   * Trip the global circuit breaker
   */
  public tripGlobalCircuitBreaker(): void {
    this.globalCircuitBreaker.trip();
    this.addAlert({
      type: 'CRITICAL',
      code: 'CB_GLOBAL_OPEN',
      message: 'Global circuit breaker opened',
      severity: 10,
      timestamp: Date.now(),
    });
  }

  /**
   * Reset a strategy circuit breaker
   */
  public resetStrategyCircuitBreaker(strategyId: UUID): void {
    const circuitBreaker = this.strategyCircuitBreakers.get(strategyId);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }

  /**
   * Reset an exchange circuit breaker
   */
  public resetExchangeCircuitBreaker(exchange: string): void {
    const circuitBreaker = this.exchangeCircuitBreakers.get(exchange);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }

  /**
   * Reset the global circuit breaker
   */
  public resetGlobalCircuitBreaker(): void {
    this.globalCircuitBreaker.reset();
  }

  // ==========================================================================
  // Stop-Loss Methods
  // ==========================================================================

  /**
   * Set a stop-loss for a position
   */
  public setStopLoss(
    positionId: UUID,
    stopPrice: Price,
    trailing: boolean = false
  ): UUID {
    const orderId = this.generateUUID();

    this.stopLossOrders.set(orderId, {
      positionId,
      stopPrice,
      trailing,
    });

    this.logger.info(`Stop-loss set for position ${positionId}: ${stopPrice} (trailing: ${trailing})`);

    return orderId;
  }

  /**
   * Check if stop-loss should be triggered
   */
  public async checkStopLosses(currentPrices: Map<TokenAddress, Price>): Promise<UUID[]> {
    const triggered: UUID[] = [];

    for (const [orderId, stopLoss] of this.stopLossOrders) {
      const position = this.positions.get(stopLoss.positionId);
      if (!position) {
        continue;
      }

      const currentPrice = currentPrices.get(position.token);
      if (currentPrice === undefined) {
        continue;
      }

      // For long positions: stop if price falls below stopPrice
      // For short positions: stop if price rises above stopPrice
      const shouldTrigger = position.amount > 0
        ? currentPrice <= stopLoss.stopPrice
        : currentPrice >= stopLoss.stopPrice;

      if (shouldTrigger) {
        triggered.push(orderId);
        this.logger.warn(`Stop-loss triggered for position ${position.id} at price ${currentPrice}`);

        // Emit event
        this.emit('stopLossTriggered', {
          positionId: position.id,
          stopPrice: stopLoss.stopPrice,
          currentPrice,
          orderId,
        });

        this.addAlert({
          type: 'CRITICAL',
          code: 'STOP_LOSS_TRIGGERED',
          message: `Stop-loss triggered for position ${position.id}`,
          severity: 9,
          timestamp: Date.now(),
          data: { positionId: position.id, stopPrice: stopLoss.stopPrice, currentPrice },
        });
      }
    }

    return triggered;
  }

  /**
   * Cancel a stop-loss order
   */
  public cancelStopLoss(orderId: UUID): boolean {
    return this.stopLossOrders.delete(orderId);
  }

  // ==========================================================================
  // PnL and Drawdown Methods
  // ==========================================================================

  /**
   * Update PnL
   */
  public updatePnL(profit: Amount): void {
    this.dailyPnL += profit;

    if (profit < 0) {
      this.dailyLoss += Math.abs(profit);
    }

    // Update portfolio value
    this.currentPortfolioValue += profit;

    this.logger.debug(`PnL updated: +${profit}, Daily: ${this.dailyPnL}, Portfolio: ${this.currentPortfolioValue}`);
  }

  /**
   * Calculate current drawdown
   */
  public calculateDrawdown(): number {
    const peakValue = Math.max(this.initialPortfolioValue, this.currentPortfolioValue);
    const drawdown = (peakValue - this.currentPortfolioValue) / peakValue;
    return drawdown;
  }

  /**
   * Get current portfolio value
   */
  public getPortfolioValue(): Amount {
    return this.currentPortfolioValue;
  }

  /**
   * Get portfolio snapshot
   */
  public getPortfolioSnapshot(): PortfolioSnapshot {
    const positions = this.getAllPositions();
    const totalValue = positions.reduce(
      (sum, p) => sum + p.amount * p.currentPrice,
      0
    );

    return {
      id: this.generateUUID(),
      positions: positions.map(p => ({ ...p })),
      totalValue,
      cash: this.currentPortfolioValue - totalValue,
      leverage: 1, // Simplified
      timestamp: Date.now(),
    };
  }

  // ==========================================================================
  // Alert Methods
  // ==========================================================================

  /**
   * Add an alert
   */
  private addAlert(alert: RiskAlert): void {
    this.alerts.push(alert);
    this.emit('alert', alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
  }

  /**
   * Get recent alerts
   */
  public getAlerts(limit: number = 20): RiskAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get alert count by type
   */
  public getAlertCount(type: 'WARNING' | 'CRITICAL'): number {
    return this.alerts.filter(a => a.type === type).length;
  }

  // ==========================================================================
  // Monitoring Methods
  // ==========================================================================

  /**
   * Start monitoring loop
   */
  private startMonitoring(): void {
    // Check circuit breakers every second
    setInterval(() => {
      this.checkCircuitBreakers();
    }, 1000);

    // Check stop-losses every second
    setInterval(async () => {
      // In practice, this would use current market prices
      const currentPrices = new Map<TokenAddress, Price>();
      await this.checkStopLosses(currentPrices);
    }, 1000);

    // Log metrics every minute
    setInterval(() => {
      const metrics = this.getMetrics();
      this.logger.info('Risk Metrics:', metrics);
    }, 60000);
  }

  /**
   * Check all circuit breakers
   */
  private checkCircuitBreakers(): void {
    // Check global circuit breaker
    if (this.globalCircuitBreaker.getState() === 'OPEN') {
      this.logger.warn('Global circuit breaker is OPEN');
    }

    // Check strategy circuit breakers
    for (const [strategyId, cb] of this.strategyCircuitBreakers) {
      if (cb.getState() === 'OPEN') {
        this.logger.warn(`Strategy circuit breaker OPEN: ${strategyId}`);
      }
    }

    // Check exchange circuit breakers
    for (const [exchange, cb] of this.exchangeCircuitBreakers) {
      if (cb.getState() === 'OPEN') {
        this.logger.warn(`Exchange circuit breaker OPEN: ${exchange}`);
      }
    }
  }

  /**
   * Get risk metrics
   */
  public getMetrics(): RiskMetrics {
    const openPositions = this.getAllPositions().length;
    const circuitBreakersTripped = [
      this.globalCircuitBreaker.getState() === 'OPEN' ? 1 : 0,
      ...Array.from(this.strategyCircuitBreakers.values())
        .map(cb => cb.getState() === 'OPEN' ? 1 : 0),
      ...Array.from(this.exchangeCircuitBreakers.values())
        .map(cb => cb.getState() === 'OPEN' ? 1 : 0),
    ].reduce((a, b) => a + b, 0);

    return {
      currentPortfolioValue: this.currentPortfolioValue,
      currentDrawdown: this.calculateDrawdown(),
      maxDrawdown: this.config.maxDrawdown,
      openPositions,
      portfolioRisk: 0, // Simplified
      circuitBreakersTripped,
      stopLossesTriggered: 0, // Simplified
      liquidityWarnings: 0, // Simplified
    };
  }

  // ==========================================================================
  // Status Methods
  // ==========================================================================

  /**
   * Get risk manager status
   */
  public getStatus(): {
    isRunning: boolean;
    portfolioValue: Amount;
    dailyPnL: Amount;
    dailyLoss: Amount;
    openPositions: number;
    circuitBreakers: {
      global: string;
      strategies: Map<UUID, string>;
      exchanges: Map<string, string>;
    };
    stopLossOrders: number;
    alerts: number;
  } {
    return {
      isRunning: this.isRunning,
      portfolioValue: this.currentPortfolioValue,
      dailyPnL: this.dailyPnL,
      dailyLoss: this.dailyLoss,
      openPositions: this.positions.size,
      circuitBreakers: {
        global: this.globalCircuitBreaker.getState(),
        strategies: new Map(
          Array.from(this.strategyCircuitBreakers.entries())
            .map(([id, cb]) => [id, cb.getState()])
        ),
        exchanges: new Map(
          Array.from(this.exchangeCircuitBreakers.entries())
            .map(([id, cb]) => [id, cb.getState()])
        ),
      },
      stopLossOrders: this.stopLossOrders.size,
      alerts: this.alerts.length,
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

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
   * Reset risk manager state
   */
  public reset(): void {
    this.positions.clear();
    this.strategyCircuitBreakers.clear();
    this.exchangeCircuitBreakers.clear();
    this.stopLossOrders.clear();
    this.alerts = [];
    this.dailyPnL = 0;
    this.dailyLoss = 0;
    this.currentPortfolioValue = this.initialPortfolioValue;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a risk manager with default configuration
 */
export function createRiskManager(
  config?: Partial<RiskManagerConfig>
): RiskManager {
  return new RiskManager(config);
}
