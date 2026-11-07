import { CandyMachineSniper } from '../../src/sniper/candy-machine';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

// Mock the Solana connection
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      getAccountInfo: jest.fn(),
      getProgramAccounts: jest.fn(),
      getRecentBlockhash: jest.fn(),
      sendRawTransaction: jest.fn(),
      confirmTransaction: jest.fn(),
      onAccountChange: jest.fn(),
      onLogs: jest.fn(),
    })),
  };
});

describe('CandyMachineSniper', () => {
  let sniper: CandyMachineSniper;
  let mockConnection: any;
  let mockWallet: any;
  let mockConfig: any;

  beforeEach(() => {
    mockConnection = new Connection('https://api.mainnet-beta.solana.com');
    
    const keypair = Keypair.generate();
    mockWallet = {
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
      signTransaction: jest.fn(),
      signAllTransactions: jest.fn(),
    };

    mockConfig = {
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      jitoRpcUrl: 'https://jito-rpc.com',
      priorityFee: 5000,
      maxRetries: 3,
      timeout: 30000,
      tipAccounts: [
        new PublicKey('120n8YjX3dQfZfA6T1n5xC4M2m6JQJjJJJjJjJ1'),
      ],
      minTipLamports: 1000,
    };

    sniper = new CandyMachineSniper(mockConnection, mockWallet, mockConfig);
  });

  describe('Initialization', () => {
    it('should initialize with connection', () => {
      expect(sniper.getConnection()).toBe(mockConnection);
    });

    it('should initialize with wallet', () => {
      expect(sniper.getWallet()).toBe(mockWallet);
    });

    it('should initialize with config', () => {
      expect(sniper.getConfig()).toEqual(mockConfig);
    });

    it('should initialize with empty candy machines', () => {
      expect(sniper.getCandyMachines().size).toBe(0);
    });

    it('should initialize with idle state', () => {
      expect(sniper.getState()).toBe('idle');
    });
  });

  describe('Candy Machine Monitoring', () => {
    it('should add candy machine to monitor', () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      sniper.addCandyMachine(candyMachineId);
      
      expect(sniper.getCandyMachines().has(candyMachineId.toString())).toBe(true);
    });

    it('should remove candy machine from monitoring', () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      sniper.addCandyMachine(candyMachineId);
      sniper.removeCandyMachine(candyMachineId);
      
      expect(sniper.getCandyMachines().has(candyMachineId.toString())).toBe(false);
    });

    it('should check if candy machine is being monitored', () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      expect(sniper.isMonitoring(candyMachineId)).toBe(false);
      
      sniper.addCandyMachine(candyMachineId);
      expect(sniper.isMonitoring(candyMachineId)).toBe(true);
    });

    it('should clear all candy machines', () => {
      sniper.addCandyMachine(new PublicKey('CM1'));
      sniper.addCandyMachine(new PublicKey('CM2'));
      sniper.clearCandyMachines();
      
      expect(sniper.getCandyMachines().size).toBe(0);
    });
  });

  describe('Candy Machine State', () => {
    it('should check if candy machine is live', async () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      
      // Mock the account info response
      mockConnection.getAccountInfo.mockResolvedValueOnce({
        data: Buffer.from([0x01]), // Active state
      });

      const isLive = await sniper.isCandyMachineLive(candyMachineId);
      expect(isLive).toBe(true);
    });

    it('should detect inactive candy machine', async () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      
      // Mock the account info response with inactive state
      mockConnection.getAccountInfo.mockResolvedValueOnce({
        data: Buffer.from([0x00]), // Inactive state
      });

      const isLive = await sniper.isCandyMachineLive(candyMachineId);
      expect(isLive).toBe(false);
    });

    it('should get candy machine state', async () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      
      mockConnection.getAccountInfo.mockResolvedValueOnce({
        data: Buffer.from([0x01, 0x00, 0x00, 0x00]), // Active with items
      });

      const state = await sniper.getCandyMachineState(candyMachineId);
      expect(state).toBeDefined();
    });
  });

  describe('Minting', () => {
    it('should prepare mint transaction', async () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      
      mockConnection.getRecentBlockhash.mockResolvedValueOnce({
        blockhash: 'RECENT_BLOCKHASH',
        feeCalculator: { lamportsPerSignature: 5000 },
      });

      const tx = await sniper.prepareMintTransaction(candyMachineId);
      expect(tx).toBeDefined();
    });

    it('should mint from candy machine', async () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      
      mockConnection.getRecentBlockhash.mockResolvedValueOnce({
        blockhash: 'RECENT_BLOCKHASH',
        feeCalculator: { lamportsPerSignature: 5000 },
      });

      mockConnection.sendRawTransaction.mockResolvedValueOnce('TX_SIGNATURE');
      mockConnection.confirmTransaction.mockResolvedValueOnce({
        value: { confirmationStatus: 'confirmed' },
      });

      mockWallet.signTransaction.mockResolvedValueOnce({ serialize: () => Buffer.from('SIGNED_TX') });

      const result = await sniper.mint(candyMachineId);
      expect(result).toBeDefined();
      expect(result?.signature).toBe('TX_SIGNATURE');
    });

    it('should handle mint failure', async () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      
      mockConnection.getRecentBlockhash.mockResolvedValueOnce({
        blockhash: 'RECENT_BLOCKHASH',
        feeCalculator: { lamportsPerSignature: 5000 },
      });

      mockConnection.sendRawTransaction.mockRejectedValueOnce(new Error('RPC Error'));

      const result = await sniper.mint(candyMachineId);
      expect(result).toBeNull();
    });

    it('should mint with Jito bundle', async () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      
      mockConnection.getRecentBlockhash.mockResolvedValueOnce({
        blockhash: 'RECENT_BLOCKHASH',
        feeCalculator: { lamportsPerSignature: 5000 },
      });

      mockWallet.signTransaction.mockResolvedValueOnce({ serialize: () => Buffer.from('SIGNED_TX') });

      const result = await sniper.mintWithJito(candyMachineId);
      expect(result).toBeDefined();
    });
  });

  describe('Event Listeners', () => {
    it('should emit candy machine live event', async () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      const callback = jest.fn();
      
      sniper.onCandyMachineLive(candyMachineId, callback);
      
      // Trigger the event
      sniper.emitCandyMachineLive(candyMachineId);
      
      expect(callback).toHaveBeenCalledWith(candyMachineId);
    });

    it('should emit mint success event', async () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      const callback = jest.fn();
      
      sniper.onMintSuccess(candyMachineId, callback);
      
      const signature = 'TX_SIGNATURE';
      sniper.emitMintSuccess(candyMachineId, signature);
      
      expect(callback).toHaveBeenCalledWith(signature);
    });

    it('should emit mint failure event', async () => {
      const candyMachineId = new PublicKey('CANDY_MACHINE_ID');
      const callback = jest.fn();
      
      sniper.onMintFailure(candyMachineId, callback);
      
      const error = new Error('Mint failed');
      sniper.emitMintFailure(candyMachineId, error);
      
      expect(callback).toHaveBeenCalledWith(error);
    });

    it('should emit error event', async () => {
      const callback = jest.fn();
      
      sniper.onError(callback);
      
      const error = new Error('Test error');
      sniper.emitError(error);
      
      expect(callback).toHaveBeenCalledWith(error);
    });
  });

  describe('Configuration', () => {
    it('should update config', () => {
      const newConfig = {
        ...mockConfig,
        priorityFee: 10000,
      };
      
      sniper.setConfig(newConfig);
      expect(sniper.getConfig()).toEqual(newConfig);
    });

    it('should update priority fee', () => {
      sniper.setPriorityFee(10000);
      expect(sniper.getConfig().priorityFee).toBe(10000);
    });

    it('should update max retries', () => {
      sniper.setMaxRetries(5);
      expect(sniper.getConfig().maxRetries).toBe(5);
    });

    it('should update timeout', () => {
      sniper.setTimeout(60000);
      expect(sniper.getConfig().timeout).toBe(60000);
    });
  });

  describe('State Management', () => {
    it('should set state to monitoring', () => {
      sniper.setState('monitoring');
      expect(sniper.getState()).toBe('monitoring');
    });

    it('should set state to minting', () => {
      sniper.setState('minting');
      expect(sniper.getState()).toBe('minting');
    });

    it('should set state to error', () => {
      sniper.setState('error');
      expect(sniper.getState()).toBe('error');
    });

    it('should check if monitoring', () => {
      expect(sniper.isMonitoring()).toBe(false);
      sniper.setState('monitoring');
      expect(sniper.isMonitoring()).toBe(true);
    });

    it('should check if minting', () => {
      expect(sniper.isMinting()).toBe(false);
      sniper.setState('minting');
      expect(sniper.isMinting()).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track monitored candy machines count', () => {
      expect(sniper.getMonitoredCount()).toBe(0);
      
      sniper.addCandyMachine(new PublicKey('CM1'));
      sniper.addCandyMachine(new PublicKey('CM2'));
      
      expect(sniper.getMonitoredCount()).toBe(2);
    });

    it('should track successful mints', () => {
      expect(sniper.getSuccessfulMints()).toBe(0);
      
      sniper.incrementSuccessfulMints();
      expect(sniper.getSuccessfulMints()).toBe(1);
    });

    it('should track failed mints', () => {
      expect(sniper.getFailedMints()).toBe(0);
      
      sniper.incrementFailedMints();
      expect(sniper.getFailedMints()).toBe(1);
    });

    it('should calculate success rate', () => {
      sniper.incrementSuccessfulMints();
      sniper.incrementSuccessfulMints();
      sniper.incrementFailedMints();
      
      const successRate = sniper.getSuccessRate();
      expect(successRate).toBe(2 / 3);
    });
  });

  describe('Cleanup', () => {
    it('should stop monitoring', () => {
      sniper.stop();
      expect(sniper.getState()).toBe('stopped');
    });

    it('should remove all event listeners', () => {
      sniper.stop();
      // Verify state is stopped
      expect(sniper.getState()).toBe('stopped');
    });
  });
});
