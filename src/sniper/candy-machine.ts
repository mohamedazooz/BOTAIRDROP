// ============================================
// BOTAIRDROP - Candy Machine Sniper
// Monitors and mints from Candy Machines v3
// ============================================

import { Metaplex, keypairIdentity, toMetaplexFile } from '@metaplex-foundation/metaplex';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { WalletAgent } from '../core/wallet-agent';
import { retry, RETRY_CONFIGS } from '../utils/retry';
import { CircuitBreaker } from '../utils/circuit-breaker';

/**
 * CandyMachineSniper class
 * Monitors Candy Machines and mints NFTs when available
 */
export class CandyMachineSniper {
  private metaplex: Metaplex;
  private walletAgent: WalletAgent;
  private circuitBreaker: CircuitBreaker;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  /**
   * Creates a new CandyMachineSniper instance
   * @param walletAgent Wallet agent to use for minting
   */
  constructor(walletAgent: WalletAgent) {
    this.walletAgent = walletAgent;
    this.metaplex = Metaplex.make(walletAgent.getConnection())
      .use(keypairIdentity(walletAgent.getKeypair()));
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Starts monitoring a Candy Machine
   * @param candyMachineId Candy Machine address
   * @param onMint Callback when NFT is minted
   * @param interval Monitoring interval in ms (default: 1000)
   */
  monitor(
    candyMachineId: PublicKey | string,
    onMint: (txId: string, nftAddress: string) => void,
    interval: number = 1000
  ): void {
    if (this.isMonitoring) {
      this.stop();
    }

    this.isMonitoring = true;
    const id = typeof candyMachineId === 'string' ? new PublicKey(candyMachineId) : candyMachineId;

    this.monitoringInterval = setInterval(async () => {
      try {
        const result = await this.checkCandyMachine(id);
        if (result.isActive && result.itemsRemaining > 0) {
          const mintResult = await this.attemptMint(id);
          if (mintResult.success) {
            onMint(mintResult.txId, mintResult.nftAddress);
          }
        }
      } catch (error) {
        console.error(`Error monitoring candy machine ${id.toString()}:`, error);
      }
    }, interval);
  }

  /**
   * Checks the status of a Candy Machine
   * @param candyMachineId Candy Machine address
   * @returns Candy Machine status
   */
  async checkCandyMachine(
    candyMachineId: PublicKey | string
  ): Promise<CandyMachineStatus> {
    return this.circuitBreaker.execute(async () => {
      const id = typeof candyMachineId === 'string' ? new PublicKey(candyMachineId) : candyMachineId;
      const candyMachine = await this.metaplex.candyMachines().findByAddress({ address: id });

      return {
        isActive: candyMachine.isActive,
        itemsRemaining: candyMachine.itemsRemaining,
        goLiveDate: candyMachine.goLiveDate?.toNumber(),
        price: candyMachine.price.toNumber(),
        sellerFeeBasisPoints: candyMachine.sellerFeeBasisPoints,
        address: id.toString(),
      };
    });
  }

  /**
   * Attempts to mint from a Candy Machine
   * @param candyMachineId Candy Machine address
   * @returns Mint result
   */
  async attemptMint(
    candyMachineId: PublicKey | string
  ): Promise<MintResult> {
    return retry(
      async () => {
        const id = typeof candyMachineId === 'string' ? new PublicKey(candyMachineId) : candyMachineId;

        // Check if mint is available
        const status = await this.checkCandyMachine(id);
        if (!status.isActive || status.itemsRemaining <= 0) {
          return {
            success: false,
            error: 'Candy machine not active or no items remaining',
          };
        }

        // Attempt mint
        const { nft } = await this.metaplex.candyMachines().mint({
          candyMachine: id,
          collectionUpdateAuthority: this.walletAgent.getKeypair(),
        });

        return {
          success: true,
          txId: nft.address.toString(),
          nftAddress: nft.address.toString(),
        };
      },
      RETRY_CONFIGS.transaction
    ).catch((error) => ({
      success: false,
      error: error.message,
    }));
  }

  /**
   * Attempts to mint with Jito Bundle for priority
   * @param candyMachineId Candy Machine address
   * @param jitoEndpoint Jito Block Engine endpoint
   * @param tipLamports Tip amount in lamports (default: 1000000 = 0.001 SOL)
   * @returns Mint result
   */
  async attemptMintWithJito(
    candyMachineId: PublicKey | string,
    jitoEndpoint: string = 'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
    tipLamports: number = 1000000
  ): Promise<MintResult> {
    try {
      const id = typeof candyMachineId === 'string' ? new PublicKey(candyMachineId) : candyMachineId;

      // Build the mint transaction
      const { transaction } = await this.metaplex.candyMachines().buildMintTransaction({
        candyMachine: id,
        payer: this.walletAgent.getKeypair(),
        collectionUpdateAuthority: this.walletAgent.getKeypair(),
      });

      // Sign the transaction
      transaction.sign(this.walletAgent.getKeypair());

      // Select a random Jito tip account
      const tipAccounts = [
        '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
        'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
        '3 AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
        '4 AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
        '5 AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
        '6 AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
        '7 AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
        '8 AVNw5UUm68wBvB8U3nT2kZ7u5XxXxXxXxXxXxX',
      ];
      const tipAccount = new PublicKey(tipAccounts[Math.floor(Math.random() * tipAccounts.length)]);

      // Create tip transaction
      const tipTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.walletAgent.getKeypair().publicKey,
          toPubkey: tipAccount,
          lamports: tipLamports,
        })
      );
      tipTx.sign(this.walletAgent.getKeypair());

      // Submit bundle
      const response = await fetch(jitoEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.JITO_API_KEY || ''}`,
        },
        body: JSON.stringify({
          transactions: [
            Buffer.from(tipTx.serialize()).toString('base64'),
            Buffer.from(transaction.serialize()).toString('base64'),
          ],
          tipLamports: 0, // Tip is already in the transaction
        }),
      });

      const result = await response.json();

      if (result.bundleId) {
        return {
          success: true,
          txId: result.bundleId,
          nftAddress: '', // Will be updated after confirmation
        };
      } else {
        return {
          success: false,
          error: result.error || 'Jito bundle submission failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Stops monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Checks if currently monitoring
   * @returns Boolean indicating if monitoring
   */
  isMonitoringCandyMachine(): boolean {
    return this.isMonitoring;
  }

  /**
   * Gets the wallet agent
   * @returns WalletAgent
   */
  getWalletAgent(): WalletAgent {
    return this.walletAgent;
  }
}

/**
 * Candy Machine status interface
 */
export interface CandyMachineStatus {
  isActive: boolean;
  itemsRemaining: number;
  goLiveDate?: number;
  price: number;
  sellerFeeBasisPoints: number;
  address: string;
}

/**
 * Mint result interface
 */
export interface MintResult {
  success: boolean;
  txId?: string;
  nftAddress?: string;
  error?: string;
}

// Import SystemProgram for Jito tip transactions
import { SystemProgram } from '@solana/web3.js';
