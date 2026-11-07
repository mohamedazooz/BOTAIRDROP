// ============================================
// BOTAIRDROP - Wallet Agent
// Core wallet management with anti-Sybil patterns
// ============================================

import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { WalletConfig, ProxyConfig, TransactionResult, NetworkType } from '../types';
import { DecimalNoiseGenerator } from '../anti-sybil/decimal-noise';
import { HumanTimingEngine } from '../anti-sybil/human-timing';
import { CircuitBreaker } from '../utils/circuit-breaker';

/**
 * WalletAgent class
 * Manages a single Solana wallet with unique proxy and behavior
 */
export class WalletAgent {
  private config: WalletConfig;
  private keypair: Keypair;
  private proxy: ProxyConfig;
  private connection: Connection;
  private timingEngine: HumanTimingEngine;
  private decimalNoise: DecimalNoiseGenerator;
  private circuitBreaker: CircuitBreaker;

  /**
   * Creates a new WalletAgent instance
   * @param config Wallet configuration
   * @param proxy Proxy configuration
   * @param network Network type
   */
  constructor(config: WalletConfig, proxy: ProxyConfig, network: NetworkType = 'mainnet-beta') {
    this.config = config;
    this.proxy = proxy;
    this.keypair = Keypair.fromSecretKey(Uint8Array.from(config.secretKey));
    this.timingEngine = new HumanTimingEngine();
    this.decimalNoise = new DecimalNoiseGenerator();
    this.circuitBreaker = new CircuitBreaker();
    this.connection = this.createConnection(network);
  }

  /**
   * Creates a new Solana connection with proxy
   * @param network Network type
   * @returns Connection instance
   */
  private createConnection(network: NetworkType): Connection {
    const proxyUrl = `http://${this.proxy.username ? `${this.proxy.username}:${this.proxy.password}@` : ''}${this.proxy.host}:${this.proxy.port}`;
    const agent = new HttpsProxyAgent(proxyUrl);

    const rpcUrl = this.getRpcUrl(network);
    return new Connection(rpcUrl, {
      httpAgent: agent,
      httpsAgent: agent,
      commitment: 'confirmed',
    });
  }

  /**
   * Gets RPC URL based on network type
   * @param network Network type
   * @returns RPC URL
   */
  private getRpcUrl(network: NetworkType): string {
    const urls: Record<NetworkType, string> = {
      'mainnet-beta': 'https://api.mainnet-beta.solana.com',
      'devnet': 'https://api.devnet.solana.com',
      'testnet': 'https://api.testnet.solana.com',
      'local': 'http://localhost:8899',
    };
    return urls[network] || urls['mainnet-beta'];
  }

  /**
   * Gets the wallet keypair
   * @returns Keypair instance
   */
  getKeypair(): Keypair {
    return this.keypair;
  }

  /**
   * Gets the wallet public key
   * @returns PublicKey instance
   */
  getPublicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  /**
   * Gets the wallet ID
   * @returns Wallet ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * Gets the wallet connection
   * @returns Connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Gets the proxy configuration
   * @returns ProxyConfig
   */
  getProxy(): ProxyConfig {
    return this.proxy;
  }

  /**
   * Applies human-like timing delay
   * Uses Poisson or Gaussian distribution based on configuration
   */
  async applyHumanDelay(): Promise<void> {
    await this.timingEngine.gaussianDelay(
      this.config.behavior.meanDelay,
      this.config.behavior.stdDev
    );
  }

  /**
   * Adds decimal noise to an amount
   * @param amount Base amount
   * @returns Amount with noise
   */
  addDecimalNoise(amount: number): number {
    return this.decimalNoise.addNoise(
      amount,
      this.config.behavior.decimalNoiseRange?.[1] || 8
    );
  }

  /**
   * Sends a transaction with retry logic
   * @param tx Transaction to send
   * @param maxRetries Maximum retry attempts
   * @returns Transaction result
   */
  async sendTransaction(
    tx: Transaction | VersionedTransaction,
    maxRetries: number = 3
  ): Promise<TransactionResult> {
    return this.circuitBreaker.execute(async () => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Apply human delay before sending
          await this.applyHumanDelay();

          // Sign the transaction
          if (tx instanceof Transaction) {
            tx.sign(this.keypair);
          } else {
            tx.sign([this.keypair]);
          }

          // Send the transaction
          const txId = await this.connection.sendRawTransaction(tx.serialize());

          return {
            txId,
            success: true,
            walletId: this.config.id,
            timestamp: Date.now(),
            program: 'unknown',
            action: 'unknown',
          };
        } catch (error) {
          if (attempt === maxRetries - 1) {
            throw error;
          }
          // Exponential backoff with jitter
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      throw new Error('Max retries exceeded');
    });
  }

  /**
   * Gets the wallet balance
   * @returns Balance in lamports
   */
  async getBalance(): Promise<number> {
    return this.circuitBreaker.execute(async () => {
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      return balance;
    });
  }

  /**
   * Checks if the wallet has sufficient funds
   * @param amount Amount in lamports
   * @returns Boolean indicating if sufficient funds
   */
  async hasSufficientFunds(amount: number): Promise<boolean> {
    const balance = await this.getBalance();
    return balance >= amount;
  }

  /**
   * Updates the RPC endpoint
   * @param network Network type
   */
  updateRpcEndpoint(network: NetworkType): void {
    this.connection = this.createConnection(network);
  }

  /**
   * Updates the proxy configuration
   * @param proxy New proxy configuration
   */
  updateProxy(proxy: ProxyConfig): void {
    this.proxy = proxy;
    this.connection = this.createConnection('mainnet-beta');
  }

  /**
   * Gets the behavior configuration
   * @returns BehaviorConfig
   */
  getBehaviorConfig() {
    return this.config.behavior;
  }

  /**
   * Gets the user agent
   * @returns User agent string
   */
  getUserAgent(): string {
    return this.config.userAgent;
  }
}
