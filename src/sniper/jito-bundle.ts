// ============================================
// BOTAIRDROP - Jito Bundle Handler
// Handles Jito Bundle submissions for priority execution
// ============================================

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { SystemProgram } from '@solana/web3.js';
import { WalletAgent } from '../core/wallet-agent';
import { retry, RETRY_CONFIGS } from '../utils/retry';

/**
 * Jito Bundle Configuration
 */
export interface JitoBundleConfig {
  transactions: (Transaction | VersionedTransaction)[];
  tipLamports: number;
  tipAccount?: PublicKey;
  bundleId?: string;
}

/**
 * Jito Bundle Result
 */
export interface JitoBundleResult {
  success: boolean;
  bundleId?: string;
  error?: string;
  transactions?: string[];
}

/**
 * JitoBundler class
 * Handles submission of transaction bundles to Jito Block Engine
 */
export class JitoBundler {
  private connection: Connection;
  private walletAgent: WalletAgent;
  private endpoint: string;
  private apiKey?: string;

  // Jito tip accounts (8 static accounts)
  private static readonly TIP_ACCOUNTS = [
    '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
    'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
    '3AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
    '4AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
    '5AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
    '6AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
    '7AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
    '8AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
  ];

  /**
   * Creates a new JitoBundler instance
   * @param walletAgent Wallet agent to use for signing
   * @param endpoint Jito Block Engine endpoint (default: mainnet)
   * @param apiKey Jito API key (optional)
   */
  constructor(
    walletAgent: WalletAgent,
    endpoint: string = 'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
    apiKey?: string
  ) {
    this.walletAgent = walletAgent;
    this.connection = walletAgent.getConnection();
    this.endpoint = endpoint;
    this.apiKey = apiKey || process.env.JITO_API_KEY;
  }

  /**
   * Submits a bundle to Jito Block Engine
   * @param config Bundle configuration
   * @returns Bundle result
   */
  async submitBundle(config: JitoBundleConfig): Promise<JitoBundleResult> {
    return retry(
      async () => {
        // Validate minimum tip (1000 lamports required by Jito)
        if (config.tipLamports < 1000) {
          return {
            success: false,
            error: 'Minimum tip of 1000 lamports required for Jito bundles',
          };
        }

        // Select a random tip account for load balancing
        const tipAccount = config.tipAccount || this.getRandomTipAccount();

        // Create tip transaction
        const tipTx = this.createTipTransaction(tipAccount, config.tipLamports);
        tipTx.sign(this.walletAgent.getKeypair());

        // Prepare all transactions (tip + user transactions)
        const allTransactions = [tipTx, ...config.transactions];

        // Serialize transactions
        const serializedTxs = allTransactions.map(tx =>
          Buffer.from(tx.serialize()).toString('base64')
        );

        // Submit bundle
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify({
            transactions: serializedTxs,
            // Tip is already included in the tip transaction
            // Don't include tipLamports here to avoid double-tipping
          }),
        });

        const result = await response.json();

        if (response.ok && result.bundleId) {
          return {
            success: true,
            bundleId: result.bundleId,
            transactions: serializedTxs,
          };
        } else {
          return {
            success: false,
            error: result.error || 'Jito bundle submission failed',
          };
        }
      },
      RETRY_CONFIGS.rpc
    );
  }

  /**
   * Creates a tip transaction
   * @param tipAccount Tip account address
   * @param lamports Tip amount in lamports
   * @returns Transaction
   */
  private createTipTransaction(
    tipAccount: PublicKey,
    lamports: number
  ): Transaction {
    return new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.walletAgent.getKeypair().publicKey,
        toPubkey: tipAccount,
        lamports,
      })
    );
  }

  /**
   * Gets a random Jito tip account
   * @returns PublicKey
   */
  private getRandomTipAccount(): PublicKey {
    const index = Math.floor(Math.random() * JitoBundler.TIP_ACCOUNTS.length);
    return new PublicKey(JitoBundler.TIP_ACCOUNTS[index]);
  }

  /**
   * Submits a single transaction with Jito priority
   * @param tx Transaction to submit
   * @param tipLamports Tip amount in lamports (default: 1000000 = 0.001 SOL)
   * @returns Bundle result
   */
  async submitTransactionWithPriority(
    tx: Transaction | VersionedTransaction,
    tipLamports: number = 1000000
  ): Promise<JitoBundleResult> {
    // Sign the transaction
    if (tx instanceof Transaction) {
      tx.sign(this.walletAgent.getKeypair());
    } else {
      tx.sign([this.walletAgent.getKeypair()]);
    }

    return this.submitBundle({
      transactions: [tx],
      tipLamports,
    });
  }

  /**
   * Submits multiple transactions as a bundle
   * @param transactions Array of transactions
   * @param tipLamports Tip amount in lamports
   * @returns Bundle result
   */
  async submitTransactionBundle(
    transactions: (Transaction | VersionedTransaction)[],
    tipLamports: number = 1000000
  ): Promise<JitoBundleResult> {
    // Sign all transactions
    const signedTxs = transactions.map(tx => {
      if (tx instanceof Transaction) {
        tx.sign(this.walletAgent.getKeypair());
      } else {
        tx.sign([this.walletAgent.getKeypair()]);
      }
      return tx;
    });

    return this.submitBundle({
      transactions: signedTxs,
      tipLamports,
    });
  }

  /**
   * Gets the recommended tip amount based on current network conditions
   * @returns Recommended tip in lamports
   */
  async getRecommendedTip(): Promise<number> {
    // For now, return a reasonable default
    // In production, this would query Jito's API or use historical data
    return 1000000; // 0.001 SOL
  }

  /**
   * Gets the current Jito tip accounts
   * @returns Array of tip account addresses
   */
  getTipAccounts(): string[] {
    return [...JitoBundler.TIP_ACCOUNTS];
  }

  /**
   * Gets the wallet agent
   * @returns WalletAgent
   */
  getWalletAgent(): WalletAgent {
    return this.walletAgent;
  }

  /**
   * Updates the Jito endpoint
   * @param endpoint New endpoint URL
   */
  updateEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  /**
   * Updates the API key
   * @param apiKey New API key
   */
  updateApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
}
