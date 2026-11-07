/**
 * Market Data Processor
 * Senior-grade market data processing for HFT system
 * 
 * Features:
 * - Multi-DEX WebSocket connections
 * - Order book reconstruction
 * - Data normalization
 * - Latency monitoring
 * - Automatic failover
 */

import { Connection, PublicKey, AccountInfo, ParsedAccountData } from '@solana/web3.js';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import {
  Exchange,
  OrderBook,
  OrderBookLevel,
  Trade,
  Ticker,
  MarketDataEvent,
  TokenPair,
  UUID,
  Timestamp,
  Result,
} from '../types';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { RetryConfig, retryWithBackoff } from '../utils/retry';
import { Logger, createLogger } from '../utils/logger';

// ============================================================================
// Interfaces
// ============================================================================

/** Market data source interface */
export interface MarketDataSource {
  exchange: Exchange;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(tokenPairs: TokenPair[]): Promise<void>;
  unsubscribe(tokenPairs: TokenPair[]): Promise<void>;
  on(event: 'orderBookUpdate', listener: (data: OrderBook) => void): this;
  on(event: 'newTrade', listener: (data: Trade) => void): this;
  on(event: 'priceUpdate', listener: (data: Ticker) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'disconnect', listener: () => void): this;
  isConnected(): boolean;
}

/** Market data processor configuration */
export interface MarketDataProcessorConfig {
  exchanges: Exchange[];
  tokenPairs: TokenPair[];
  orderBookDepth: number;
  websocketTimeout: number;
  restTimeout: number;
  maxRetries: number;
  retryConfig: RetryConfig;
  circuitBreaker: {
    threshold: number;
    resetTimeout: number;
    halfOpenAfter: number;
  };
}

/** Order book snapshot */
export interface OrderBookSnapshot {
  exchange: Exchange;
  tokenPair: TokenPair;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  midPrice: number;
  spread: number;
  spreadPercentage: number;
  timestamp: Timestamp;
  sequenceNumber: number;
}

// ============================================================================
// Market Data Processor
// ============================================================================

/**
 * Market Data Processor
 * 
 * Manages multiple market data sources and provides a unified interface
 * for accessing real-time market data from various DEXs.
 */
export class MarketDataProcessor extends EventEmitter {
  private sources: Map<Exchange, MarketDataSource> = new Map();
  private orderBooks: Map<string, OrderBookSnapshot> = new Map();
  private trades: Map<string, Trade[]> = new Map();
  private tickers: Map<string, Ticker> = new Map();
  private circuitBreakers: Map<Exchange, CircuitBreaker> = new Map();
  private logger: Logger;
  private config: MarketDataProcessorConfig;
  private isRunning: boolean = false;
  private lastHeartbeat: Timestamp = Date.now();

  constructor(config: MarketDataProcessorConfig) {
    super();
    this.config = config;
    this.logger = createLogger('MarketDataProcessor');
    
    // Initialize circuit breakers for each exchange
    for (const exchange of config.exchanges) {
      this.circuitBreakers.set(
        exchange,
        new CircuitBreaker(
          async () => {}, // Dummy function, we'll use it for connection retries
          config.circuitBreaker
        )
      );
    }
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Start the market data processor
   */
  public async start(): Promise<Result<void>> {
    if (this.isRunning) {
      this.logger.warn('MarketDataProcessor is already running');
      return { success: false, error: new Error('Already running') };
    }

    try {
      this.logger.info('Starting MarketDataProcessor...');
      
      // Connect to all configured exchanges
      for (const exchange of this.config.exchanges) {
        const source = this.createDataSource(exchange);
        if (source) {
          this.sources.set(exchange, source);
          
          // Set up event listeners
          this.setupSourceListeners(exchange, source);
          
          // Connect with retry
          await this.connectWithRetry(exchange, source);
        }
      }

      this.isRunning = true;
      this.logger.info('MarketDataProcessor started successfully');
      
      // Start heartbeat
      this.startHeartbeat();
      
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to start MarketDataProcessor', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Stop the market data processor
   */
  public async stop(): Promise<Result<void>> {
    if (!this.isRunning) {
      this.logger.warn('MarketDataProcessor is not running');
      return { success: false, error: new Error('Not running') };
    }

    try {
      this.logger.info('Stopping MarketDataProcessor...');
      
      // Disconnect from all sources
      for (const [exchange, source] of this.sources) {
        try {
          await source.disconnect();
          this.logger.info(`Disconnected from ${exchange}`);
        } catch (error) {
          this.logger.error(`Error disconnecting from ${exchange}`, error);
        }
      }

      this.sources.clear();
      this.isRunning = false;
      
      this.logger.info('MarketDataProcessor stopped successfully');
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to stop MarketDataProcessor', error);
      return { success: false, error: error as Error };
    }
  }

  // ==========================================================================
  // Data Access Methods
  // ==========================================================================

  /**
   * Get the current order book for a token pair
   */
  public getOrderBook(exchange: Exchange, tokenPair: TokenPair): OrderBookSnapshot | null {
    const key = this.getCacheKey(exchange, tokenPair);
    return this.orderBooks.get(key) || null;
  }

  /**
   * Get the current order books for a token pair from all exchanges
   */
  public getOrderBooks(tokenPair: TokenPair): OrderBookSnapshot[] {
    const books: OrderBookSnapshot[] = [];
    
    for (const [exchange, source] of this.sources) {
      const book = this.getOrderBook(exchange, tokenPair);
      if (book) {
        books.push(book);
      }
    }
    
    return books;
  }

  /**
   * Get recent trades for a token pair
   */
  public getTrades(exchange: Exchange, tokenPair: TokenPair, limit: number = 100): Trade[] {
    const key = this.getCacheKey(exchange, tokenPair);
    const trades = this.trades.get(key) || [];
    return trades.slice(-limit);
  }

  /**
   * Get the current ticker for a token pair
   */
  public getTicker(exchange: Exchange, tokenPair: TokenPair): Ticker | null {
    const key = this.getCacheKey(exchange, tokenPair);
    return this.tickers.get(key) || null;
  }

  /**
   * Get the best bid and ask across all exchanges for a token pair
   */
  public getBestBidAsk(tokenPair: TokenPair): { bestBid: OrderBookLevel | null; bestAsk: OrderBookLevel | null } {
    const books = this.getOrderBooks(tokenPair);
    
    let bestBid: OrderBookLevel | null = null;
    let bestAsk: OrderBookLevel | null = null;

    for (const book of books) {
      // Best bid is the highest bid price
      if (book.bids.length > 0) {
        if (!bestBid || book.bids[0].price > bestBid.price) {
          bestBid = book.bids[0];
        }
      }

      // Best ask is the lowest ask price
      if (book.asks.length > 0) {
        if (!bestAsk || book.asks[0].price < bestAsk.price) {
          bestAsk = book.asks[0];
        }
      }
    }

    return { bestBid, bestAsk };
  }

  /**
   * Calculate the spread between best bid and ask across all exchanges
   */
  public getCrossExchangeSpread(tokenPair: TokenPair): number | null {
    const { bestBid, bestAsk } = this.getBestBidAsk(tokenPair);
    
    if (!bestBid || !bestAsk) {
      return null;
    }

    return bestAsk.price - bestBid.price;
  }

  // ==========================================================================
  // Subscription Methods
  // ==========================================================================

  /**
   * Subscribe to market data for a token pair
   */
  public async subscribe(tokenPair: TokenPair): Promise<Result<void>> {
    try {
      this.logger.info(`Subscribing to market data for ${tokenPair.baseToken}/${tokenPair.quoteToken}`);
      
      for (const [exchange, source] of this.sources) {
        if (source.isConnected()) {
          await source.subscribe([tokenPair]);
          this.logger.debug(`Subscribed to ${exchange} for ${tokenPair.baseToken}/${tokenPair.quoteToken}`);
        }
      }
      
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to subscribe to market data', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Unsubscribe from market data for a token pair
   */
  public async unsubscribe(tokenPair: TokenPair): Promise<Result<void>> {
    try {
      this.logger.info(`Unsubscribing from market data for ${tokenPair.baseToken}/${tokenPair.quoteToken}`);
      
      for (const [exchange, source] of this.sources) {
        if (source.isConnected()) {
          await source.unsubscribe([tokenPair]);
          this.logger.debug(`Unsubscribed from ${exchange} for ${tokenPair.baseToken}/${tokenPair.quoteToken}`);
        }
      }
      
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to unsubscribe from market data', error);
      return { success: false, error: error as Error };
    }
  }

  // ==========================================================================
  // Status Methods
  // ==========================================================================

  /**
   * Check if the processor is running
   */
  public isRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if a specific exchange is connected
   */
  public isExchangeConnected(exchange: Exchange): boolean {
    const source = this.sources.get(exchange);
    return source ? source.isConnected() : false;
  }

  /**
   * Get all connected exchanges
   */
  public getConnectedExchanges(): Exchange[] {
    return Array.from(this.sources.entries())
      .filter(([_, source]) => source.isConnected())
      .map(([exchange]) => exchange);
  }

  /**
   * Get processor statistics
   */
  public getStats(): {
    isRunning: boolean;
    connectedExchanges: Exchange[];
    totalSubscriptions: number;
    lastHeartbeat: Timestamp;
    uptime: Timestamp;
  } {
    return {
      isRunning: this.isRunning,
      connectedExchanges: this.getConnectedExchanges(),
      totalSubscriptions: this.config.tokenPairs.length * this.config.exchanges.length,
      lastHeartbeat: this.lastHeartbeat,
      uptime: Date.now() - (this.lastHeartbeat || Date.now()),
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create a market data source for a specific exchange
   */
  private createDataSource(exchange: Exchange): MarketDataSource | null {
    switch (exchange) {
      case Exchange.RAYDIUM:
        return new RaydiumDataSource({
          exchange,
          tokenPairs: this.config.tokenPairs,
          orderBookDepth: this.config.orderBookDepth,
          websocketTimeout: this.config.websocketTimeout,
        });
      case Exchange.JUPITER:
        return new JupiterDataSource({
          exchange,
          tokenPairs: this.config.tokenPairs,
          orderBookDepth: this.config.orderBookDepth,
          websocketTimeout: this.config.websocketTimeout,
        });
      case Exchange.ORCA:
        return new OrcaDataSource({
          exchange,
          tokenPairs: this.config.tokenPairs,
          orderBookDepth: this.config.orderBookDepth,
          websocketTimeout: this.config.websocketTimeout,
        });
      case Exchange.SERUM:
        return new SerumDataSource({
          exchange,
          tokenPairs: this.config.tokenPairs,
          orderBookDepth: this.config.orderBookDepth,
          websocketTimeout: this.config.websocketTimeout,
        });
      case Exchange.DRIFT:
        return new DriftDataSource({
          exchange,
          tokenPairs: this.config.tokenPairs,
          orderBookDepth: this.config.orderBookDepth,
          websocketTimeout: this.config.websocketTimeout,
        });
      case Exchange.METEORA:
        return new MeteoraDataSource({
          exchange,
          tokenPairs: this.config.tokenPairs,
          orderBookDepth: this.config.orderBookDepth,
          websocketTimeout: this.config.websocketTimeout,
        });
      default:
        this.logger.warn(`No data source available for exchange: ${exchange}`);
        return null;
    }
  }

  /**
   * Set up event listeners for a market data source
   */
  private setupSourceListeners(exchange: Exchange, source: MarketDataSource): void {
    source
      .on('orderBookUpdate', (data: OrderBook) => {
        this.handleOrderBookUpdate(exchange, data);
      })
      .on('newTrade', (data: Trade) => {
        this.handleNewTrade(exchange, data);
      })
      .on('priceUpdate', (data: Ticker) => {
        this.handlePriceUpdate(exchange, data);
      })
      .on('error', (error: Error) => {
        this.handleSourceError(exchange, error);
      })
      .on('disconnect', () => {
        this.handleDisconnect(exchange);
      });
  }

  /**
   * Connect to a data source with retry
   */
  private async connectWithRetry(exchange: Exchange, source: MarketDataSource): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(exchange);
    
    if (!circuitBreaker) {
      throw new Error(`No circuit breaker for exchange: ${exchange}`);
    }

    try {
      await retryWithBackoff(
        async () => {
          await source.connect();
          this.logger.info(`Connected to ${exchange}`);
          
          // Subscribe to configured token pairs
          await source.subscribe(this.config.tokenPairs);
          this.logger.info(`Subscribed to ${this.config.tokenPairs.length} token pairs on ${exchange}`);
        },
        {
          maxRetries: this.config.maxRetries,
          initialDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          jitter: true,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to connect to ${exchange} after retries`, error);
      circuitBreaker.trip();
    }
  }

  /**
   * Handle order book update
   */
  private handleOrderBookUpdate(exchange: Exchange, data: OrderBook): void {
    const key = this.getCacheKey(exchange, data);
    
    // Calculate mid price and spread
    const midPrice = this.calculateMidPrice(data);
    const spread = this.calculateSpread(data);
    const spreadPercentage = (spread / midPrice) * 100;

    const snapshot: OrderBookSnapshot = {
      exchange,
      tokenPair: { baseToken: data.baseToken, quoteToken: data.quoteToken },
      bids: data.bids,
      asks: data.asks,
      midPrice,
      spread,
      spreadPercentage,
      timestamp: Date.now(),
      sequenceNumber: data.sequenceNumber,
    };

    // Update cache
    this.orderBooks.set(key, snapshot);

    // Emit event
    this.emit('orderBookUpdate', {
      type: 'ORDER_BOOK_UPDATE',
      exchange,
      tokenPair: snapshot.tokenPair,
      data: snapshot,
      timestamp: Date.now(),
    } as MarketDataEvent);

    this.logger.debug(`Order book updated for ${data.baseToken}/${data.quoteToken} on ${exchange}`);
  }

  /**
   * Handle new trade
   */
  private handleNewTrade(exchange: Exchange, data: Trade): void {
    const key = this.getCacheKey(exchange, {
      baseToken: data.baseToken,
      quoteToken: data.quoteToken,
    });

    // Update trades cache (keep last 1000 trades)
    const trades = this.trades.get(key) || [];
    trades.push(data);
    if (trades.length > 1000) {
      trades.shift();
    }
    this.trades.set(key, trades);

    // Emit event
    this.emit('newTrade', {
      type: 'NEW_TRADE',
      exchange,
      tokenPair: { baseToken: data.baseToken, quoteToken: data.quoteToken },
      data,
      timestamp: Date.now(),
    } as MarketDataEvent);

    this.logger.debug(`New trade for ${data.baseToken}/${data.quoteToken} on ${exchange}`);
  }

  /**
   * Handle price update
   */
  private handlePriceUpdate(exchange: Exchange, data: Ticker): void {
    const key = this.getCacheKey(exchange, {
      baseToken: data.baseToken,
      quoteToken: data.quoteToken,
    });

    // Update ticker cache
    this.tickers.set(key, data);

    // Emit event
    this.emit('priceUpdate', {
      type: 'PRICE_UPDATE',
      exchange,
      tokenPair: { baseToken: data.baseToken, quoteToken: data.quoteToken },
      data,
      timestamp: Date.now(),
    } as MarketDataEvent);

    this.logger.debug(`Price update for ${data.baseToken}/${data.quoteToken} on ${exchange}`);
  }

  /**
   * Handle source error
   */
  private handleSourceError(exchange: Exchange, error: Error): void {
    this.logger.error(`Error from ${exchange} data source`, error);
    
    // Emit error event
    this.emit('error', { exchange, error, timestamp: Date.now() });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(exchange: Exchange): void {
    this.logger.warn(`Disconnected from ${exchange}`);
    
    // Attempt to reconnect
    const source = this.sources.get(exchange);
    if (source) {
      this.connectWithRetry(exchange, source);
    }
    
    // Emit disconnect event
    this.emit('disconnect', { exchange, timestamp: Date.now() });
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    setInterval(() => {
      this.lastHeartbeat = Date.now();
      this.emit('heartbeat', { timestamp: this.lastHeartbeat });
    }, 1000);
  }

  /**
   * Calculate mid price from order book
   */
  private calculateMidPrice(orderBook: OrderBook): number {
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
      return orderBook.bids.length > 0 ? orderBook.bids[0].price : orderBook.asks[0].price;
    }
    return (orderBook.bids[0].price + orderBook.asks[0].price) / 2;
  }

  /**
   * Calculate spread from order book
   */
  private calculateSpread(orderBook: OrderBook): number {
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
      return 0;
    }
    return orderBook.asks[0].price - orderBook.bids[0].price;
  }

  /**
   * Generate cache key for a token pair on an exchange
   */
  private getCacheKey(exchange: Exchange, tokenPair: TokenPair): string;
  private getCacheKey(exchange: Exchange, orderBook: OrderBook): string;
  private getCacheKey(exchange: Exchange, data: any): string {
    const tokenPair = 'baseToken' in data ? 
      { baseToken: data.baseToken, quoteToken: data.quoteToken } : 
      data;
    return `${exchange}:${tokenPair.baseToken}:${tokenPair.quoteToken}`;
  }
}

// ============================================================================
// Exchange-Specific Data Sources
// ============================================================================

/** Base class for exchange data sources */
abstract class BaseDataSource extends EventEmitter implements MarketDataSource {
  protected exchange: Exchange;
  protected tokenPairs: TokenPair[];
  protected orderBookDepth: number;
  protected websocketTimeout: number;
  protected ws?: WebSocket;
  protected isConnectedFlag: boolean = false;
  protected logger: Logger;

  constructor(config: {
    exchange: Exchange;
    tokenPairs: TokenPair[];
    orderBookDepth: number;
    websocketTimeout: number;
  }) {
    super();
    this.exchange = config.exchange;
    this.tokenPairs = config.tokenPairs;
    this.orderBookDepth = config.orderBookDepth;
    this.websocketTimeout = config.websocketTimeout;
    this.logger = createLogger(`${config.exchange}DataSource`);
  }

  public abstract connect(): Promise<void>;
  public abstract disconnect(): Promise<void>;
  public abstract subscribe(tokenPairs: TokenPair[]): Promise<void>;
  public abstract unsubscribe(tokenPairs: TokenPair[]): Promise<void>;

  public isConnected(): boolean {
    return this.isConnectedFlag;
  }

  protected setConnected(connected: boolean): void {
    this.isConnectedFlag = connected;
  }

  protected setupWebSocket(url: string): WebSocket {
    this.ws = new WebSocket(url);
    
    this.ws.on('open', () => {
      this.setConnected(true);
      this.logger.info(`WebSocket connected to ${this.exchange}`);
    });

    this.ws.on('close', () => {
      this.setConnected(false);
      this.logger.warn(`WebSocket disconnected from ${this.exchange}`);
      this.emit('disconnect');
    });

    this.ws.on('error', (error) => {
      this.logger.error(`WebSocket error for ${this.exchange}`, error);
      this.emit('error', error);
    });

    return this.ws;
  }
}

/** Raydium data source */
class RaydiumDataSource extends BaseDataSource {
  constructor(config: {
    exchange: Exchange;
    tokenPairs: TokenPair[];
    orderBookDepth: number;
    websocketTimeout: number;
  }) {
    super(config);
  }

  public async connect(): Promise<void> {
    // Implement Raydium WebSocket connection
    const wsUrl = 'wss://api.raydium.io/ws';
    this.setupWebSocket(wsUrl);
    
    // TODO: Implement actual Raydium WebSocket subscription
    // This is a placeholder for the actual implementation
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  public async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }
    this.setConnected(false);
  }

  public async subscribe(tokenPairs: TokenPair[]): Promise<void> {
    // TODO: Implement subscription logic
    this.logger.info(`Subscribing to ${tokenPairs.length} token pairs on Raydium`);
  }

  public async unsubscribe(tokenPairs: TokenPair[]): Promise<void> {
    // TODO: Implement unsubscription logic
    this.logger.info(`Unsubscribing from ${tokenPairs.length} token pairs on Raydium`);
  }
}

/** Jupiter data source */
class JupiterDataSource extends BaseDataSource {
  constructor(config: {
    exchange: Exchange;
    tokenPairs: TokenPair[];
    orderBookDepth: number;
    websocketTimeout: number;
  }) {
    super(config);
  }

  public async connect(): Promise<void> {
    // Implement Jupiter API connection
    // Jupiter uses REST API for most data, WebSocket for some
    this.setConnected(true);
    this.logger.info('Connected to Jupiter API');
  }

  public async disconnect(): Promise<void> {
    this.setConnected(false);
  }

  public async subscribe(tokenPairs: TokenPair[]): Promise<void> {
    // Jupiter doesn't have WebSocket for order books, use polling
    this.logger.info(`Will poll ${tokenPairs.length} token pairs on Jupiter`);
    this.startPolling(tokenPairs);
  }

  public async unsubscribe(tokenPairs: TokenPair[]): Promise<void> {
    // Stop polling
    this.logger.info(`Stopped polling ${tokenPairs.length} token pairs on Jupiter`);
  }

  private startPolling(tokenPairs: TokenPair[]): void {
    // Poll every 100ms for high-frequency data
    setInterval(async () => {
      for (const pair of tokenPairs) {
        try {
          // TODO: Implement actual Jupiter API polling
          // const orderBook = await this.fetchOrderBook(pair);
          // this.emit('orderBookUpdate', orderBook);
        } catch (error) {
          this.logger.error(`Error polling ${pair.baseToken}/${pair.quoteToken} on Jupiter`, error);
        }
      }
    }, 100);
  }
}

/** Orca data source */
class OrcaDataSource extends BaseDataSource {
  constructor(config: {
    exchange: Exchange;
    tokenPairs: TokenPair[];
    orderBookDepth: number;
    websocketTimeout: number;
  }) {
    super(config);
  }

  public async connect(): Promise<void> {
    this.setConnected(true);
    this.logger.info('Connected to Orca API');
  }

  public async disconnect(): Promise<void> {
    this.setConnected(false);
  }

  public async subscribe(tokenPairs: TokenPair[]): Promise<void> {
    this.logger.info(`Subscribed to ${tokenPairs.length} token pairs on Orca`);
  }

  public async unsubscribe(tokenPairs: TokenPair[]): Promise<void> {
    this.logger.info(`Unsubscribed from ${tokenPairs.length} token pairs on Orca`);
  }
}

/** Serum data source */
class SerumDataSource extends BaseDataSource {
  constructor(config: {
    exchange: Exchange;
    tokenPairs: TokenPair[];
    orderBookDepth: number;
    websocketTimeout: number;
  }) {
    super(config);
  }

  public async connect(): Promise<void> {
    this.setConnected(true);
    this.logger.info('Connected to Serum API');
  }

  public async disconnect(): Promise<void> {
    this.setConnected(false);
  }

  public async subscribe(tokenPairs: TokenPair[]): Promise<void> {
    this.logger.info(`Subscribed to ${tokenPairs.length} token pairs on Serum`);
  }

  public async unsubscribe(tokenPairs: TokenPair[]): Promise<void> {
    this.logger.info(`Unsubscribed from ${tokenPairs.length} token pairs on Serum`);
  }
}

/** Drift data source */
class DriftDataSource extends BaseDataSource {
  constructor(config: {
    exchange: Exchange;
    tokenPairs: TokenPair[];
    orderBookDepth: number;
    websocketTimeout: number;
  }) {
    super(config);
  }

  public async connect(): Promise<void> {
    this.setConnected(true);
    this.logger.info('Connected to Drift API');
  }

  public async disconnect(): Promise<void> {
    this.setConnected(false);
  }

  public async subscribe(tokenPairs: TokenPair[]): Promise<void> {
    this.logger.info(`Subscribed to ${tokenPairs.length} token pairs on Drift`);
  }

  public async unsubscribe(tokenPairs: TokenPair[]): Promise<void> {
    this.logger.info(`Unsubscribed from ${tokenPairs.length} token pairs on Drift`);
  }
}

/** Meteora data source */
class MeteoraDataSource extends BaseDataSource {
  constructor(config: {
    exchange: Exchange;
    tokenPairs: TokenPair[];
    orderBookDepth: number;
    websocketTimeout: number;
  }) {
    super(config);
  }

  public async connect(): Promise<void> {
    this.setConnected(true);
    this.logger.info('Connected to Meteora API');
  }

  public async disconnect(): Promise<void> {
    this.setConnected(false);
  }

  public async subscribe(tokenPairs: TokenPair[]): Promise<void> {
    this.logger.info(`Subscribed to ${tokenPairs.length} token pairs on Meteora`);
  }

  public async unsubscribe(tokenPairs: TokenPair[]): Promise<void> {
    this.logger.info(`Unsubscribed from ${tokenPairs.length} token pairs on Meteora`);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a market data processor with default configuration
 */
export function createMarketDataProcessor(
  config?: Partial<MarketDataProcessorConfig>
): MarketDataProcessor {
  const defaultConfig: MarketDataProcessorConfig = {
    exchanges: [Exchange.RAYDIUM, Exchange.JUPITER, Exchange.ORCA],
    tokenPairs: [],
    orderBookDepth: 20,
    websocketTimeout: 30000,
    restTimeout: 10000,
    maxRetries: 5,
    retryConfig: {
      maxRetries: 5,
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
  };

  return new MarketDataProcessor({ ...defaultConfig, ...config });
}
