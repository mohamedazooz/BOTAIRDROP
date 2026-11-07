// ============================================
// BOTAIRDROP - Transaction Builder
// Builds complex transactions for Airdrop Farming
// ============================================

import { Connection, PublicKey, Transaction, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { WalletAgent } from '../core/wallet-agent';
import { DecimalNoiseGenerator } from '../anti-sybil/decimal-noise';
import { PathPolymorphismEngine } from '../anti-sybil/path-polymorphism';
import { retry, RETRY_CONFIGS } from '../utils/retry';

/**
 * Transaction Step Interface
 */
export interface TransactionStep {
  program: string;
  action: string;
  parameters: Record<string, any>;
  build: (tx: Transaction, wallet: WalletAgent) => Promise<Transaction>;
}

/**
 * Transaction Builder class
 * Builds complex transactions for Airdrop Farming
 */
export class TransactionBuilder {
  private walletAgent: WalletAgent;
  private connection: Connection;
  private decimalNoise: DecimalNoiseGenerator;
  private pathEngine: PathPolymorphismEngine;

  /**
   * Creates a new TransactionBuilder instance
   * @param walletAgent Wallet agent to use for building transactions
   */
  constructor(walletAgent: WalletAgent) {
    this.walletAgent = walletAgent;
    this.connection = walletAgent.getConnection();
    this.decimalNoise = new DecimalNoiseGenerator();
    this.pathEngine = new PathPolymorphismEngine();
  }

  /**
   * Builds a transaction based on a path
   * @param path Path name or array of program names
   * @returns Built transaction
   */
  async buildFromPath(path: string | string[]): Promise<Transaction> {
    const pathArray = Array.isArray(path) ? path : this.pathEngine.getPath(path);
    const steps = this.pathEngine.getSteps(pathArray.join('-'));

    let tx = new Transaction();

    for (const step of steps) {
      tx = await this.applyStep(tx, step);
    }

    return tx;
  }

  /**
   * Applies a transaction step
   * @param tx Transaction to modify
   * @param step Transaction step
   * @returns Modified transaction
   */
  private async applyStep(tx: Transaction, step: TransactionStep): Promise<Transaction> {
    // Apply decimal noise to amounts if present
    if (step.parameters.amount) {
      step.parameters.amount = this.decimalNoise.addNoise(step.parameters.amount);
    }

    // Apply the step-specific build logic
    if (step.build) {
      return step.build(tx, this.walletAgent);
    }

    // Default step handling
    return this.applyDefaultStep(tx, step);
  }

  /**
   * Applies a default transaction step
   * @param tx Transaction to modify
   * @param step Transaction step
   * @returns Modified transaction
   */
  private applyDefaultStep(tx: Transaction, step: TransactionStep): Transaction {
    // This is a placeholder for default step handling
    // In a real implementation, you would have specific logic for each program
    console.warn(`No build function for step: ${step.program}.${step.action}`);
    return tx;
  }

  /**
   * Builds a simple transfer transaction
   * @param to Recipient address
   * @param lamports Amount in lamports
   * @returns Transaction
   */
  async buildTransferTransaction(
    to: PublicKey | string,
    lamports: number
  ): Promise<Transaction> {
    const toPubkey = typeof to === 'string' ? new PublicKey(to) : to;
    const noisyLamports = this.decimalNoise.addLamportsNoise(lamports);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.walletAgent.getKeypair().publicKey,
        toPubkey,
        lamports: noisyLamports,
      })
    );

    return tx;
  }

  /**
   * Builds a transaction with compute budget
   * @param instructions Array of instructions
   * @param computeUnits Number of compute units
   * @returns Transaction
   */
  async buildWithComputeBudget(
    instructions: any[],
    computeUnits: number = 200000
  ): Promise<Transaction> {
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits })
    );

    // Add all instructions
    instructions.forEach((instruction) => {
      tx.add(instruction);
    });

    return tx;
  }

  /**
   * Builds a transaction with priority fee
   * @param instructions Array of instructions
   * @param priorityFee Priority fee in micro-lamports per CU
   * @returns Transaction
   */
  async buildWithPriorityFee(
    instructions: any[],
    priorityFee: number = 100000 // 0.0001 SOL per CU
  ): Promise<Transaction> {
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
    );

    // Add all instructions
    instructions.forEach((instruction) => {
      tx.add(instruction);
    });

    return tx;
  }

  /**
   * Builds a complete transaction with compute budget and priority fee
   * @param instructions Array of instructions
   * @param computeUnits Number of compute units
   * @param priorityFee Priority fee in micro-lamports per CU
   * @returns Transaction
   */
  async buildCompleteTransaction(
    instructions: any[],
    computeUnits: number = 200000,
    priorityFee: number = 100000
  ): Promise<Transaction> {
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
    );

    // Add all instructions
    instructions.forEach((instruction) => {
      tx.add(instruction);
    });

    return tx;
  }

  /**
   * Builds a swap transaction (placeholder)
   * @param inputToken Input token symbol
   * @param outputToken Output token symbol
   * @param amount Amount to swap
   * @param slippage Maximum slippage percentage
   * @returns Transaction
   */
  async buildSwapTransaction(
    inputToken: string,
    outputToken: string,
    amount: number,
    slippage: number = 0.5
  ): Promise<Transaction> {
    // In a real implementation, this would use Jupiter, Raydium, or Orca SDK
    // For now, return a placeholder transaction
    const tx = new Transaction();
    
    // Add compute budget
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }));

    // Add placeholder instruction
    // In production: tx.add(await JupiterSwap.buildSwapInstruction(...));

    return tx;
  }

  /**
   * Builds a liquidity add transaction (placeholder)
   * @param tokenA First token symbol
   * @param tokenB Second token symbol
   * @param amountA Amount of first token
   * @param amountB Amount of second token
   * @returns Transaction
   */
  async buildAddLiquidityTransaction(
    tokenA: string,
    tokenB: string,
    amountA: number,
    amountB: number
  ): Promise<Transaction> {
    // In a real implementation, this would use Raydium or Orca SDK
    const tx = new Transaction();
    
    // Add compute budget
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }));

    // Add placeholder instruction
    // In production: tx.add(await Raydium.addLiquidityInstruction(...));

    return tx;
  }

  /**
   * Builds a stake transaction (placeholder)
   * @param pool Pool address
   * @param amount Amount to stake
   * @returns Transaction
   */
  async buildStakeTransaction(
    pool: string | PublicKey,
    amount: number
  ): Promise<Transaction> {
    // In a real implementation, this would use the specific staking program
    const tx = new Transaction();
    
    // Add compute budget
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }));

    // Add placeholder instruction
    // In production: tx.add(await StakingProgram.stakeInstruction(...));

    return tx;
  }

  /**
   * Builds a random transaction for Airdrop Farming
   * @returns Transaction
   */
  async buildRandomTransaction(): Promise<Transaction> {
    const paths = this.pathEngine.getAllPaths();
    const randomPath = paths[Math.floor(Math.random() * paths.length)];
    
    return this.buildFromPath(randomPath.name);
  }

  /**
   * Gets the wallet agent
   * @returns WalletAgent
   */
  getWalletAgent(): WalletAgent {
    return this.walletAgent;
  }

  /**
   * Gets the connection
   * @returns Connection
   */
  getConnection(): Connection {
    return this.connection;
  }
}
