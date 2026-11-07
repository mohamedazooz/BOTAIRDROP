// ============================================
// BOTAIRDROP - Path Polymorphism Engine
// Implements transaction path polymorphism for anti-Sybil
// ============================================

import { PathConfig, TransactionStep } from '../types';

/**
 * PathPolymorphismEngine class
 * Generates unique transaction paths for each wallet to avoid detection
 */
export class PathPolymorphismEngine {
  private paths: PathConfig[];
  private walletPathMap: Map<string, number>;

  /**
   * Creates a new PathPolymorphismEngine instance
   * Initializes with predefined paths
   */
  constructor() {
    this.paths = this.initializePaths();
    this.walletPathMap = new Map();
  }

  /**
   * Initializes predefined transaction paths
   * @returns Array of path configurations
   */
  private initializePaths(): PathConfig[] {
    return [
      {
        name: 'Jupiter -> Raydium -> Meteora',
        steps: [
          {
            program: 'Jupiter',
            action: 'swap',
            parameters: { inputToken: 'SOL', outputToken: 'USDC', slippage: 0.5 }
          },
          {
            program: 'Raydium',
            action: 'addLiquidity',
            parameters: { tokenA: 'USDC', tokenB: 'USDT', amountA: 1, amountB: 1 }
          },
          {
            program: 'Meteora',
            action: 'stake',
            parameters: { pool: 'USDC-USDT', amount: 2 }
          }
        ]
      },
      {
        name: 'Raydium -> Orca -> Jupiter',
        steps: [
          {
            program: 'Raydium',
            action: 'swap',
            parameters: { inputToken: 'SOL', outputToken: 'BONK', slippage: 1 }
          },
          {
            program: 'Orca',
            action: 'addLiquidity',
            parameters: { tokenA: 'BONK', tokenB: 'SOL', amountA: 1000, amountB: 0.001 }
          },
          {
            program: 'Jupiter',
            action: 'swap',
            parameters: { inputToken: 'BONK', outputToken: 'USDC', slippage: 0.5 }
          }
        ]
      },
      {
        name: 'Meteora -> Jupiter -> Orca',
        steps: [
          {
            program: 'Meteora',
            action: 'stake',
            parameters: { pool: 'SOL-USDC', amount: 0.1 }
          },
          {
            program: 'Jupiter',
            action: 'swap',
            parameters: { inputToken: 'SOL', outputToken: 'JUP', slippage: 0.5 }
          },
          {
            program: 'Orca',
            action: 'removeLiquidity',
            parameters: { tokenA: 'JUP', tokenB: 'SOL', liquidityAmount: 1 }
          }
        ]
      },
      {
        name: 'Orca -> Meteora -> Raydium',
        steps: [
          {
            program: 'Orca',
            action: 'swap',
            parameters: { inputToken: 'SOL', outputToken: 'mSOL', slippage: 0.3 }
          },
          {
            program: 'Meteora',
            action: 'stake',
            parameters: { pool: 'mSOL', amount: 0.1 }
          },
          {
            program: 'Raydium',
            action: 'swap',
            parameters: { inputToken: 'mSOL', outputToken: 'USDC', slippage: 0.5 }
          }
        ]
      },
      {
        name: 'Jupiter -> Meteora -> Orca',
        steps: [
          {
            program: 'Jupiter',
            action: 'swap',
            parameters: { inputToken: 'SOL', outputToken: 'USDC', slippage: 0.5 }
          },
          {
            program: 'Meteora',
            action: 'stake',
            parameters: { pool: 'SOL-USDC', amount: 0.1 }
          },
          {
            program: 'Orca',
            action: 'addLiquidity',
            parameters: { tokenA: 'SOL', tokenB: 'USDC', amountA: 0.05, amountB: 1 }
          }
        ]
      },
      {
        name: 'Raydium -> Jupiter -> Meteora',
        steps: [
          {
            program: 'Raydium',
            action: 'swap',
            parameters: { inputToken: 'SOL', outputToken: 'RAY', slippage: 0.5 }
          },
          {
            program: 'Jupiter',
            action: 'swap',
            parameters: { inputToken: 'RAY', outputToken: 'USDC', slippage: 0.5 }
          },
          {
            program: 'Meteora',
            action: 'stake',
            parameters: { pool: 'USDC', amount: 1 }
          }
        ]
      }
    ];
  }

  /**
   * Gets a unique path for a wallet
   * Uses deterministic hash to select path
   * @param walletId Wallet ID
   * @returns Transaction path (array of program names)
   */
  getPath(walletId: string): string[] {
    if (!this.walletPathMap.has(walletId)) {
      const index = this.hashWalletId(walletId) % this.paths.length;
      this.walletPathMap.set(walletId, index);
    }
    const index = this.walletPathMap.get(walletId)!;
    return this.paths[index].steps.map(step => step.program);
  }

  /**
   * Gets the full path configuration for a wallet
   * @param walletId Wallet ID
   * @returns PathConfig
   */
  getPathConfig(walletId: string): PathConfig {
    if (!this.walletPathMap.has(walletId)) {
      const index = this.hashWalletId(walletId) % this.paths.length;
      this.walletPathMap.set(walletId, index);
    }
    const index = this.walletPathMap.get(walletId)!;
    return this.paths[index];
  }

  /**
   * Gets the steps for a wallet's path
   * @param walletId Wallet ID
   * @returns Array of transaction steps
   */
  getSteps(walletId: string): TransactionStep[] {
    const config = this.getPathConfig(walletId);
    return config.steps;
  }

  /**
   * Hashes wallet ID to a deterministic number
   * @param walletId Wallet ID
   * @returns Hash number
   */
  private hashWalletId(walletId: string): number {
    let hash = 0;
    for (let i = 0; i < walletId.length; i++) {
      const char = walletId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Rotates the path for a wallet
   * @param walletId Wallet ID
   * @returns New path
   */
  rotatePath(walletId: string): string[] {
    const currentIndex = this.walletPathMap.get(walletId) || 0;
    const newIndex = (currentIndex + 1) % this.paths.length;
    this.walletPathMap.set(walletId, newIndex);
    return this.paths[newIndex].steps.map(step => step.program);
  }

  /**
   * Adds a custom path
   * @param config Path configuration
   */
  addPath(config: PathConfig): void {
    this.paths.push(config);
  }

  /**
   * Removes a path by name
   * @param name Path name
   */
  removePath(name: string): void {
    this.paths = this.paths.filter(path => path.name !== name);
    // Rebuild wallet path map
    this.walletPathMap.clear();
  }

  /**
   * Gets all available paths
   * @returns Array of all path configurations
   */
  getAllPaths(): PathConfig[] {
    return [...this.paths];
  }

  /**
   * Gets the number of available paths
   * @returns Number of paths
   */
  getPathCount(): number {
    return this.paths.length;
  }
}
