/**
 * HFT System Types
 * Senior-grade type definitions for the High-Frequency Trading system
 */

// ============================================================================
// Base Types
// ============================================================================

/** Unique identifier type */
export type UUID = string;

/** ISO 8601 date string */
export type ISODateString = string;

/** Milliseconds timestamp */
export type Timestamp = number;

/** Price represented as number (can be integer or decimal) */
export type Price = number;

/** Amount/Quantity represented as number */
export type Amount = number;

/** Token address (Solana public key) */
export type TokenAddress = string;

/** Transaction signature */
export type TransactionSignature = string;

// ============================================================================
// Enums
// ============================================================================

/** Order side: buy or sell */
export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

/** Order type */
export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP = 'STOP',
  STOP_LIMIT = 'STOP_LIMIT',
}

/** Order status */
export enum OrderStatus {
  PENDING = 'PENDING',
  OPEN = 'OPEN',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

/** Time in force */
export enum TimeInForce {
  GTC = 'GTC', // Good Till Cancelled
  IOC = 'IOC', // Immediate Or Cancel
  FOK = 'FOK', // Fill Or Kill
  GTT = 'GTT', // Good Till Time
}

/** Strategy type */
export enum StrategyType {
  CROSS_DEX_ARBITRAGE = 'CROSS_DEX_ARBITRAGE',
  MARKET_MAKING = 'MARKET_MAKING',
  STATISTICAL_ARBITRAGE = 'STATISTICAL_ARBITRAGE',
  TRIANGULAR_ARBITRAGE = 'TRIANGULAR_ARBITRAGE',
  ML_PREDICTION = 'ML_PREDICTION',
  TREND_FOLLOWING = 'TREND_FOLLOWING',
  MEAN_REVERSION = 'MEAN_REVERSION',
}

/** DEX/Exchange identifiers */
export enum Exchange {
  RAYDIUM = 'RAYDIUM',
  JUPITER = 'JUPITER',
  ORCA = 'ORCA',
  SERUM = 'SERUM',
  DRIFT = 'DRIFT',
  METEORA = 'METEORA',
  PHOENIX = 'PHOENIX',
  OPENBOOK = 'OPENBOOK',
}

/** Risk level */
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Circuit breaker state */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

// ============================================================================
// Market Data Types
// ============================================================================

/** Order book level */
export interface OrderBookLevel {
  price: Price;
  size: Amount;
  liquidity: Amount; // Total liquidity at this level
}

/** Order book data */
export interface OrderBook {
  exchange: Exchange;
  baseToken: TokenAddress;
  quoteToken: TokenAddress;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  midPrice: Price;
  spread: Price;
  spreadPercentage: number;
  timestamp: Timestamp;
  sequenceNumber: number; // For ordering updates
}

/** Trade data */
export interface Trade {
  exchange: Exchange;
  baseToken: TokenAddress;
  quoteToken: TokenAddress;
  price: Price;
  amount: Amount;
  side: OrderSide;
  timestamp: Timestamp;
  transactionSignature: TransactionSignature;
}

/** Candle data */
export interface Candle {
  exchange: Exchange;
  baseToken: TokenAddress;
  quoteToken: TokenAddress;
  timeframe: string; // '1m', '5m', '15m', '1h', '4h', '1d'
  open: Price;
  high: Price;
  low: Price;
  close: Price;
  volume: Amount;
  timestamp: Timestamp;
}

/** Ticker data (24h stats) */
export interface Ticker {
  exchange: Exchange;
  baseToken: TokenAddress;
  quoteToken: TokenAddress;
  lastPrice: Price;
  priceChange24h: Price;
  priceChangePercentage24h: number;
  volume24h: Amount;
  quoteVolume24h: Amount;
  high24h: Price;
  low24h: Price;
  timestamp: Timestamp;
}

/** Market data snapshot */
export interface MarketDataSnapshot {
  orderBook: OrderBook;
  recentTrades: Trade[];
  ticker: Ticker;
}

// ============================================================================
// Order Types
// ============================================================================

/** Order request */
export interface OrderRequest {
  id: UUID;
  strategyId: UUID;
  exchange: Exchange;
  baseToken: TokenAddress;
  quoteToken: TokenAddress;
  side: OrderSide;
  type: OrderType;
  amount: Amount;
  price?: Price; // Required for LIMIT, STOP_LIMIT
  stopPrice?: Price; // Required for STOP, STOP_LIMIT
  timeInForce: TimeInForce;
  maxSlippage: number; // Percentage (e.g., 0.01 = 1%)
  clientOrderId?: string;
  timestamp: Timestamp;
}

/** Order response */
export interface OrderResponse {
  id: UUID;
  requestId: UUID;
  exchangeOrderId: string;
  transactionSignature?: TransactionSignature;
  status: OrderStatus;
  filledAmount: Amount;
  remainingAmount: Amount;
  averageFilledPrice: Price;
  fees: Amount;
  timestamp: Timestamp;
}

/** Order update */
export interface OrderUpdate {
  id: UUID;
  exchangeOrderId: string;
  status: OrderStatus;
  filledAmount: Amount;
  remainingAmount: Amount;
  averageFilledPrice: Price;
  lastUpdateTimestamp: Timestamp;
}

// ============================================================================
// Strategy Types
// ============================================================================

/** Strategy configuration */
export interface StrategyConfig {
  id: UUID;
  name: string;
  type: StrategyType;
  exchanges: Exchange[];
  parameters: Record<string, any>;
  riskLimits: RiskLimits;
  isActive: boolean;
  priority: number; // Higher priority strategies execute first
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Arbitrage opportunity */
export interface ArbitrageOpportunity {
  id: UUID;
  strategyId: UUID;
  tokenPair: TokenPair;
  exchanges: [Exchange, Exchange]; // [buyExchange, sellExchange]
  buyPrice: Price;
  sellPrice: Price;
  spread: Price;
  spreadPercentage: number;
  estimatedProfit: Amount;
  estimatedProfitPercentage: number;
  requiredCapital: Amount;
  fees: Amount;
  slippage: number;
  latency: Timestamp; // Time to execute
  timestamp: Timestamp;
}

/** Token pair */
export interface TokenPair {
  baseToken: TokenAddress;
  quoteToken: TokenAddress;
  baseDecimals: number;
  quoteDecimals: number;
}

/** Market making configuration */
export interface MarketMakingConfig {
  tokenPair: TokenPair;
  spread: number; // Percentage
  orderSize: Amount;
  orderRefreshInterval: Timestamp; // ms
  inventoryTarget: Amount; // Target inventory level
  maxInventoryDeviation: Amount;
}

/** Statistical arbitrage configuration */
export interface StatArbConfig {
  tokenPairs: TokenPair[];
  lookbackPeriod: Timestamp; // ms
  zScoreThreshold: number;
  positionSize: Amount;
  maxPositions: number;
}

// ============================================================================
// Execution Types
// ============================================================================

/** Execution request */
export interface ExecutionRequest {
  id: UUID;
  strategyId: UUID;
  opportunity?: ArbitrageOpportunity; // For arbitrage
  orders: OrderRequest[];
  estimatedProfit: Amount;
  maxSlippage: number;
  priority: number;
  timestamp: Timestamp;
}

/** Execution result */
export interface ExecutionResult {
  id: UUID;
  requestId: UUID;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
  orders: OrderResponse[];
  actualProfit: Amount;
  fees: Amount;
  slippage: Amount;
  executionTime: Timestamp; // ms
  timestamp: Timestamp;
  error?: string;
}

/** Jito Bundle */
export interface JitoBundle {
  id: UUID;
  transactions: TransactionRequest[];
  tipAccount: TokenAddress;
  tipAmount: Amount; // In lamports
  priorityFee: Amount; // In lamports
  timestamp: Timestamp;
}

/** Transaction request */
export interface TransactionRequest {
  id: UUID;
  instructions: TransactionInstruction[];
  signers: TokenAddress[];
  feePayer: TokenAddress;
  recentBlockhash: string;
  priorityFee?: Amount;
}

/** Transaction instruction */
export interface TransactionInstruction {
  programId: TokenAddress;
  accounts: TokenAddress[];
  data: Uint8Array;
}

// ============================================================================
// Risk Management Types
// ============================================================================

/** Position data */
export interface Position {
  id: UUID;
  token: TokenAddress;
  amount: Amount; // Positive for long, negative for short
  entryPrice: Price;
  currentPrice: Price;
  entryTimestamp: Timestamp;
  strategyId: UUID;
  exchange: Exchange;
}

/** Portfolio snapshot */
export interface PortfolioSnapshot {
  id: UUID;
  positions: Position[];
  totalValue: Amount;
  cash: Amount;
  leverage: number;
  timestamp: Timestamp;
}

/** Risk limits */
export interface RiskLimits {
  maxPositionSize: Amount; // Max size per position
  maxPortfolioRisk: number; // Max % of portfolio at risk
  maxLeverage: number;
  maxDailyLoss: Amount;
  maxDrawdown: number; // Percentage
  maxOrderSize: Amount;
  maxSlippage: number; // Percentage
  minLiquidity: Amount;
}

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  threshold: number; // Number of failures to trip
  resetTimeout: Timestamp; // ms
  halfOpenAfter: Timestamp; // ms
}

/** Circuit breaker state */
export interface CircuitBreakerState {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTimestamp: Timestamp;
  nextResetTimestamp: Timestamp;
}

/** Stop loss configuration */
export interface StopLossConfig {
  stopLossPercentage: number; // Percentage
  trailingStopPercentage?: number;
  liquidationThreshold: number; // Percentage of collateral
}

// ============================================================================
// Backtesting Types
// ============================================================================

/** Backtest configuration */
export interface BacktestConfig {
  id: UUID;
  strategyId: UUID;
  startDate: ISODateString;
  endDate: ISODateString;
  initialCapital: Amount;
  slippage: number; // Percentage
  latency: Timestamp; // ms
  fees: Record<Exchange, number>; // Percentage fees per exchange
  dataSource: 'clickhouse' | 'csv' | 'api';
}

/** Backtest result */
export interface BacktestResult {
  id: UUID;
  config: BacktestConfig;
  metrics: PerformanceMetrics;
  trades: SimulatedTrade[];
  equityCurve: EquityPoint[];
  timestamp: ISODateString;
}

/** Simulated trade */
export interface SimulatedTrade {
  id: UUID;
  timestamp: Timestamp;
  side: OrderSide;
  amount: Amount;
  entryPrice: Price;
  exitPrice?: Price;
  profit: Amount;
  profitPercentage: number;
  fees: Amount;
  slippage: Amount;
}

/** Equity point */
export interface EquityPoint {
  timestamp: Timestamp;
  equity: Amount;
  drawdown: number; // Percentage
}

/** Performance metrics */
export interface PerformanceMetrics {
  totalReturn: number; // Percentage
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number; // Percentage
  winRate: number; // Percentage
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: Amount;
  avgLoss: Amount;
  totalFees: Amount;
  totalSlippage: Amount;
}

// ============================================================================
// Monitoring Types
// ============================================================================

/** Metric data point */
export interface Metric {
  name: string;
  description: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels: Record<string, string>;
  value: number;
  timestamp: Timestamp;
}

/** Trading metrics */
export interface TradingMetrics {
  ordersExecuted: number;
  ordersFailed: number;
  volume: Amount;
  pnl: Amount;
  feesPaid: Amount;
  slippage: Amount;
  winRate: number;
}

/** Performance metrics */
export interface PerformanceMetricsMonitoring {
  latency: LatencyMetrics;
  successRate: number;
  fillRate: number;
}

/** Latency metrics */
export interface LatencyMetrics {
  marketData: Timestamp;
  strategyCalculation: Timestamp;
  orderRouting: Timestamp;
  transactionSigning: Timestamp;
  rpcSubmission: Timestamp;
  confirmation: Timestamp;
  total: Timestamp;
}

/** Risk metrics */
export interface RiskMetrics {
  currentDrawdown: number;
  maxDrawdown: number;
  portfolioValue: Amount;
  leverage: number;
  openPositions: number;
  circuitBreakersTripped: number;
}

/** System metrics */
export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkIO: number;
  errorRate: number;
  uptime: number;
}

/** Alert */
export interface Alert {
  id: UUID;
  type: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  severity: RiskLevel;
  timestamp: Timestamp;
  resolvedAt?: Timestamp;
  metadata: Record<string, any>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/** HFT system configuration */
export interface HFTConfig {
  system: SystemConfig;
  marketData: MarketDataConfig;
  execution: ExecutionConfig;
  risk: RiskConfig;
  monitoring: MonitoringConfig;
  logging: LoggingConfig;
}

/** System configuration */
export interface SystemConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  nodeId: string;
  maxConcurrentStrategies: number;
}

/** Market data configuration */
export interface MarketDataConfig {
  exchanges: ExchangeConfig[];
  websocketTimeout: Timestamp;
  restTimeout: Timestamp;
  orderBookDepth: number;
  maxRetries: number;
}

/** Exchange configuration */
export interface ExchangeConfig {
  exchange: Exchange;
  rpcUrl: string;
  websocketUrl: string;
  apiKey?: string;
  rateLimit: number; // Requests per second
  enabled: boolean;
}

/** Execution configuration */
export interface ExecutionConfig {
  jito: JitoConfig;
  priorityFee: PriorityFeeConfig;
  maxRetries: number;
  retryDelay: Timestamp;
}

/** Jito configuration */
export interface JitoConfig {
  enabled: boolean;
  rpcUrl: string;
  tipAccounts: TokenAddress[];
  minTipLamports: Amount;
  maxTipLamports: Amount;
}

/** Priority fee configuration */
export interface PriorityFeeConfig {
  baseLamports: Amount;
  dynamicMultiplier: number;
  maxLamports: Amount;
}

/** Risk configuration */
export interface RiskConfig {
  positionLimits: RiskLimits;
  circuitBreakers: CircuitBreakerConfig;
  stopLoss: StopLossConfig;
}

/** Monitoring configuration */
export interface MonitoringConfig {
  prometheus: PrometheusConfig;
  grafana: GrafanaConfig;
  alerting: AlertingConfig;
}

/** Prometheus configuration */
export interface PrometheusConfig {
  enabled: boolean;
  port: number;
  scrapeInterval: Timestamp;
}

/** Grafana configuration */
export interface GrafanaConfig {
  enabled: boolean;
  port: number;
  adminPassword: string;
}

/** Alerting configuration */
export interface AlertingConfig {
  enabled: boolean;
  providers: AlertProvider[];
}

/** Alert provider */
export type AlertProvider = TelegramAlertProvider | DiscordAlertProvider | EmailAlertProvider;

/** Telegram alert provider */
export interface TelegramAlertProvider {
  type: 'telegram';
  botToken: string;
  chatId: string;
}

/** Discord alert provider */
export interface DiscordAlertProvider {
  type: 'discord';
  webhookUrl: string;
}

/** Email alert provider */
export interface EmailAlertProvider {
  type: 'email';
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  from: string;
  to: string[];
}

/** Logging configuration */
export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  output: 'console' | 'file' | 'both';
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

// ============================================================================
// Event Types
// ============================================================================

/** Market data event */
export interface MarketDataEvent {
  type: 'ORDER_BOOK_UPDATE' | 'NEW_TRADE' | 'PRICE_UPDATE';
  exchange: Exchange;
  tokenPair: TokenPair;
  data: OrderBook | Trade | Ticker;
  timestamp: Timestamp;
}

/** Order event */
export interface OrderEvent {
  type: 'ORDER_PLACED' | 'ORDER_FILLED' | 'ORDER_CANCELLED' | 'ORDER_REJECTED';
  order: OrderRequest | OrderResponse | OrderUpdate;
  timestamp: Timestamp;
}

/** Strategy event */
export interface StrategyEvent {
  type: 'STRATEGY_STARTED' | 'STRATEGY_STOPPED' | 'STRATEGY_ERROR' | 'OPPORTUNITY_FOUND';
  strategyId: UUID;
  data?: any;
  timestamp: Timestamp;
}

/** Risk event */
export interface RiskEvent {
  type: 'POSITION_OPENED' | 'POSITION_CLOSED' | 'POSITION_UPDATED' | 'CIRCUIT_BREAKER_TRIPPED';
  data: Position | CircuitBreakerState;
  timestamp: Timestamp;
}

/** System event */
export interface SystemEvent {
  type: 'SYSTEM_STARTED' | 'SYSTEM_STOPPED' | 'SYSTEM_ERROR' | 'HEARTBEAT';
  data?: any;
  timestamp: Timestamp;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Result type for operations that can fail */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/** Async result type */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/** Partial type (all properties optional) */
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

/** Required type (all properties required) */
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

/** Readonly type */
export type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

/** Pick specific properties from a type */
export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

/** Omit specific properties from a type */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/** Record type with string keys */
export type StringRecord<T = any> = Record<string, T>;

/** Deep partial type */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
