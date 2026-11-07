// ============================================
// BOTAIRDROP - Agent Fleet Manager
// Manages multiple wallet agents with anti-Sybil patterns
// ============================================

import { WalletAgent } from './wallet-agent';
import { ProxyConfig, WalletConfig, TransactionResult, NetworkType } from '../types';
import { PathPolymorphismEngine } from '../anti-sybil/path-polymorphism';
import { CircuitBreaker } from '../utils/circuit-breaker';

/**
 * AgentFleet class
 * Manages a fleet of wallet agents for distributed operations
 */
export class AgentFleet {
  private agents: Map<string, WalletAgent>;
  private proxies: ProxyConfig[];
  private pathEngine: PathPolymorphismEngine;
  private circuitBreaker: CircuitBreaker;
  private network: NetworkType;

  /**
   * Creates a new AgentFleet instance
   * @param walletConfigs Array of wallet configurations
   * @param proxyConfigs Array of proxy configurations
   * @param network Network type
   */
  constructor(
    walletConfigs: WalletConfig[],
    proxyConfigs: ProxyConfig[],
    network: NetworkType = 'mainnet-beta'
  ) {
    this.agents = new Map();
    this.proxies = proxyConfigs;
    this.pathEngine = new PathPolymorphismEngine();
    this.circuitBreaker = new CircuitBreaker();
    this.network = network;

    // Initialize all agents
    this.initializeAgents(walletConfigs);
  }

  /**
   * Initializes all wallet agents
   * @param walletConfigs Array of wallet configurations
   */
  private initializeAgents(walletConfigs: WalletConfig[]): void {
    walletConfigs.forEach((config, index) => {
      const proxy = this.proxies[index % this.proxies.length];
      const agent = new WalletAgent(config, proxy, this.network);
      this.agents.set(config.id, agent);
    });
  }

  /**
   * Gets an agent by ID
   * @param id Agent ID
   * @returns WalletAgent or undefined
   */
  getAgent(id: string): WalletAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Gets all agent IDs
   * @returns Array of agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Gets the number of agents
   * @returns Number of agents
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Executes a task on all agents
   * @param task Task function to execute
   * @param options Execution options
   * @returns Map of agent ID to result or error
   */
  async executeAll<T>(
    task: (agent: WalletAgent) => Promise<T>,
    options: ExecutionOptions = {}
  ): Promise<Map<string, T | Error>> {
    const { maxConcurrent = 5, delayBetweenBatches = 5000 } = options;
    const results = new Map<string, T | Error>();
    const agentIds = this.getAgentIds();

    for (let i = 0; i < agentIds.length; i += maxConcurrent) {
      const batch = agentIds.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (agentId) => {
        try {
          const agent = this.agents.get(agentId);
          if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
          }
          const result = await task(agent);
          return { agentId, result };
        } catch (error) {
          return { agentId, error: error as Error };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ agentId, result, error }) => {
        results.set(agentId, error || result);
      });

      // Human-like delay between batches
      if (i + maxConcurrent < agentIds.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return results;
  }

  /**
   * Executes a task on a subset of agents
   * @param task Task function to execute
   * @param agentIds Array of agent IDs to execute on
   * @returns Map of agent ID to result or error
   */
  async executeOn<T>(
    task: (agent: WalletAgent) => Promise<T>,
    agentIds: string[]
  ): Promise<Map<string, T | Error>> {
    const results = new Map<string, T | Error>();
    const promises = agentIds.map(async (agentId) => {
      try {
        const agent = this.agents.get(agentId);
        if (!agent) {
          throw new Error(`Agent ${agentId} not found`);
        }
        const result = await task(agent);
        return { agentId, result };
      } catch (error) {
        return { agentId, error: error as Error };
      }
    });

    const allResults = await Promise.all(promises);
    allResults.forEach(({ agentId, result, error }) => {
      results.set(agentId, error || result);
    });

    return results;
  }

  /**
   * Gets the path for a specific agent
   * @param agentId Agent ID
   * @returns Transaction path
   */
  getPath(agentId: string): string[] {
    return this.pathEngine.getPath(agentId);
  }

  /**
   * Updates the network for all agents
   * @param network Network type
   */
  updateNetwork(network: NetworkType): void {
    this.network = network;
    this.agents.forEach((agent) => {
      agent.updateRpcEndpoint(network);
    });
  }

  /**
   * Updates the proxy for a specific agent
   * @param agentId Agent ID
   * @param proxy Proxy configuration
   */
  updateAgentProxy(agentId: string, proxy: ProxyConfig): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.updateProxy(proxy);
    }
  }

  /**
   * Gets the status of all agents
   * @returns Map of agent ID to status
   */
  getAgentStatuses(): Map<string, AgentStatus> {
    const statuses = new Map<string, AgentStatus>();
    this.agents.forEach((agent, id) => {
      statuses.set(id, 'ready'); // All agents are ready by default
    });
    return statuses;
  }

  /**
   * Stops all agents
   */
  async stopAll(): Promise<void> {
    // Cleanup resources
    this.agents.clear();
  }
}

/**
 * Execution options for agent tasks
 */
export interface ExecutionOptions {
  maxConcurrent?: number; // Maximum concurrent executions
  delayBetweenBatches?: number; // Delay between batches in ms
}

/**
 * Agent status type
 */
export type AgentStatus = 'ready' | 'executing' | 'error' | 'stopped';
