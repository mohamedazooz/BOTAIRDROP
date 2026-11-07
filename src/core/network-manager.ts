// ============================================
// BOTAIRDROP - Network Manager
// Manages RPC endpoints and proxy rotation
// ============================================

import { Connection, PublicKey } from '@solana/web3.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyConfig, RpcConfig, NetworkType } from '../types';
import { CircuitBreaker } from '../utils/circuit-breaker';

/**
 * NetworkManager class
 * Manages network connections, RPC rotation, and proxy management
 */
export class NetworkManager {
  private proxies: ProxyConfig[];
  private rpcConfigs: RpcConfig[];
  private currentRpcIndex: number = 0;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private network: NetworkType;

  /**
   * Creates a new NetworkManager instance
   * @param proxies Array of proxy configurations
   * @param rpcConfigs Array of RPC configurations
   * @param network Network type
   */
  constructor(
    proxies: ProxyConfig[],
    rpcConfigs: RpcConfig[],
    network: NetworkType = 'mainnet-beta'
  ) {
    this.proxies = proxies;
    this.rpcConfigs = rpcConfigs.sort((a, b) => a.priority - b.priority);
    this.network = network;
    this.circuitBreakers = new Map();

    // Initialize circuit breakers for each RPC
    this.rpcConfigs.forEach((config) => {
      this.circuitBreakers.set(config.url, new CircuitBreaker());
    });
  }

  /**
   * Gets a connection with a specific proxy
   * @param proxy Proxy configuration
   * @returns Connection instance
   */
  getConnectionWithProxy(proxy: ProxyConfig): Connection {
    const proxyUrl = `http://${proxy.username ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`;
    const agent = new HttpsProxyAgent(proxyUrl);

    const rpcUrl = this.getCurrentRpcUrl();
    return new Connection(rpcUrl, {
      httpAgent: agent,
      httpsAgent: agent,
      commitment: 'confirmed',
    });
  }

  /**
   * Gets a connection with a random proxy
   * @returns Connection instance
   */
  getConnectionWithRandomProxy(): Connection {
    const proxy = this.getRandomProxy();
    return this.getConnectionWithProxy(proxy);
  }

  /**
   * Gets a connection with the next proxy (round-robin)
   * @returns Connection instance
   */
  getConnectionWithNextProxy(): Connection {
    const proxy = this.getNextProxy();
    return this.getConnectionWithProxy(proxy);
  }

  /**
   * Gets a connection for a specific wallet
   * @param walletId Wallet ID
   * @returns Connection instance
   */
  getConnectionForWallet(walletId: string): Connection {
    // Use deterministic proxy assignment
    const proxy = this.getProxyForWallet(walletId);
    return this.getConnectionWithProxy(proxy);
  }

  /**
   * Gets the current RPC URL
   * @returns RPC URL
   */
  getCurrentRpcUrl(): string {
    return this.rpcConfigs[this.currentRpcIndex]?.url || this.getFallbackRpcUrl();
  }

  /**
   * Gets a fallback RPC URL
   * @returns Fallback RPC URL
   */
  private getFallbackRpcUrl(): string {
    const urls: Record<NetworkType, string> = {
      'mainnet-beta': 'https://api.mainnet-beta.solana.com',
      'devnet': 'https://api.devnet.solana.com',
      'testnet': 'https://api.testnet.solana.com',
      'local': 'http://localhost:8899',
    };
    return urls[this.network] || urls['mainnet-beta'];
  }

  /**
   * Rotates to the next RPC endpoint
   * Used when current RPC fails
   */
  rotateRpc(): void {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcConfigs.length;
  }

  /**
   * Gets a connection with automatic RPC rotation
   * @returns Connection instance
   */
  getConnectionWithRotation(): Connection {
    const rpcUrl = this.getCurrentRpcUrl();
    return new Connection(rpcUrl, {
      commitment: 'confirmed',
    });
  }

  /**
   * Executes a function with automatic RPC rotation on failure
   * @param fn Function to execute
   * @returns Promise with the function result
   */
  async executeWithRotation<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < this.rpcConfigs.length; attempt++) {
      try {
        const connection = this.getConnectionWithRotation();
        return await fn(connection);
      } catch (error) {
        this.rotateRpc();
        if (attempt === this.rpcConfigs.length - 1) {
          throw error;
        }
      }
    }
    throw new Error('All RPC endpoints failed');
  }

  /**
   * Gets a random proxy
   * @returns Proxy configuration
   */
  getRandomProxy(): ProxyConfig {
    const index = Math.floor(Math.random() * this.proxies.length);
    return this.proxies[index];
  }

  /**
   * Gets the next proxy (round-robin)
   * @returns Proxy configuration
   */
  getNextProxy(): ProxyConfig {
    const index = Math.floor(Math.random() * this.proxies.length); // Simple round-robin
    return this.proxies[index];
  }

  /**
   * Gets a proxy for a specific wallet (deterministic)
   * @param walletId Wallet ID
   * @returns Proxy configuration
   */
  getProxyForWallet(walletId: string): ProxyConfig {
    const index = this.hashWalletId(walletId) % this.proxies.length;
    return this.proxies[index];
  }

  /**
   * Hashes wallet ID to a deterministic number
   * @param walletId Wallet ID
   * @returns Hash number
   */
  private hashWalletId(walletId: string): number {
    let hash = 0;
    for (let i = 0; i < walletId.length; i++) {
      hash = (hash << 5) - hash + walletId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Gets all proxies
   * @returns Array of proxy configurations
   */
  getAllProxies(): ProxyConfig[] {
    return [...this.proxies];
  }

  /**
   * Gets all RPC configurations
   * @returns Array of RPC configurations
   */
  getAllRpcConfigs(): RpcConfig[] {
    return [...this.rpcConfigs];
  }

  /**
   * Adds a new proxy
   * @param proxy Proxy configuration
   */
  addProxy(proxy: ProxyConfig): void {
    this.proxies.push(proxy);
  }

  /**
   * Removes a proxy by ID
   * @param id Proxy ID
   */
  removeProxy(id: string): void {
    this.proxies = this.proxies.filter((p) => p.id !== id);
  }

  /**
   * Adds a new RPC configuration
   * @param config RPC configuration
   */
  addRpcConfig(config: RpcConfig): void {
    this.rpcConfigs.push(config);
    this.rpcConfigs.sort((a, b) => a.priority - b.priority);
    this.circuitBreakers.set(config.url, new CircuitBreaker());
  }

  /**
   * Removes an RPC configuration by ID
   * @param id RPC ID
   */
  removeRpcConfig(id: string): void {
    const config = this.rpcConfigs.find((c) => c.id === id);
    if (config) {
      this.rpcConfigs = this.rpcConfigs.filter((c) => c.id !== id);
      this.circuitBreakers.delete(config.url);
    }
  }

  /**
   * Updates the network type
   * @param network Network type
   */
  updateNetwork(network: NetworkType): void {
    this.network = network;
  }

  /**
   * Gets the current network type
   * @returns Network type
   */
  getNetwork(): NetworkType {
    return this.network;
  }

  /**
   * Gets the number of proxies
   * @returns Number of proxies
   */
  getProxyCount(): number {
    return this.proxies.length;
  }

  /**
   * Gets the number of RPC endpoints
   * @returns Number of RPC endpoints
   */
  getRpcCount(): number {
    return this.rpcConfigs.length;
  }
}
