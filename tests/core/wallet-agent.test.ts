import { WalletAgent } from '../../src/core/wallet-agent';
import { Keypair, PublicKey } from '@solana/web3.js';

describe('WalletAgent', () => {
  let walletAgent: WalletAgent;
  let keypair: Keypair;
  let mockProxyConfig: any;
  let mockRpcConfig: any;
  let mockBehaviorConfig: any;

  beforeEach(() => {
    keypair = Keypair.generate();
    
    mockProxyConfig = {
      id: 'proxy-1',
      host: 'localhost',
      port: 8080,
      username: 'user',
      password: 'pass',
      protocol: 'http',
      type: 'residential',
    };

    mockRpcConfig = {
      id: 'rpc-1',
      url: 'https://api.mainnet-beta.solana.com',
      type: 'public',
      priority: 1,
    };

    mockBehaviorConfig = {
      meanDelay: 5000,
      stdDev: 1000,
      path: ['Jupiter', 'Raydium'],
      decimalNoiseRange: [0.00000001, 0.001],
    };

    walletAgent = new WalletAgent({
      id: 'wallet-1',
      publicKey: keypair.publicKey.toString(),
      secretKey: Array.from(keypair.secretKey),
      proxyId: 'proxy-1',
      behavior: mockBehaviorConfig,
      userAgent: 'Mozilla/5.0',
    }, mockProxyConfig, mockRpcConfig);
  });

  describe('Initialization', () => {
    it('should initialize with keypair', () => {
      expect(walletAgent.getPublicKey()).toEqual(keypair.publicKey);
    });

    it('should initialize with proxy config', () => {
      expect(walletAgent.getProxyConfig()).toEqual(mockProxyConfig);
    });

    it('should initialize with RPC config', () => {
      expect(walletAgent.getRpcConfig()).toEqual(mockRpcConfig);
    });

    it('should initialize with behavior config', () => {
      expect(walletAgent.getBehaviorConfig()).toEqual(mockBehaviorConfig);
    });

    it('should initialize with wallet ID', () => {
      expect(walletAgent.getWalletId()).toBe('wallet-1');
    });

    it('should initialize with user agent', () => {
      expect(walletAgent.getUserAgent()).toBe('Mozilla/5.0');
    });
  });

  describe('Keypair Management', () => {
    it('should return public key', () => {
      const publicKey = walletAgent.getPublicKey();
      expect(publicKey).toBeInstanceOf(PublicKey);
      expect(publicKey.toString()).toBe(keypair.publicKey.toString());
    });

    it('should check if keypair is valid', () => {
      expect(walletAgent.isValid()).toBe(true);
    });

    it('should detect invalid keypair', () => {
      const invalidAgent = new WalletAgent({
        id: 'invalid-wallet',
        publicKey: 'invalid',
        secretKey: [1, 2, 3],
        proxyId: 'proxy-1',
        behavior: mockBehaviorConfig,
        userAgent: 'Mozilla/5.0',
      }, mockProxyConfig, mockRpcConfig);
      
      expect(invalidAgent.isValid()).toBe(false);
    });
  });

  describe('Transaction Signing', () => {
    it('should sign a message', async () => {
      const message = 'test message';
      const signature = await walletAgent.signMessage(message);
      
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should sign different messages differently', async () => {
      const message1 = 'message 1';
      const message2 = 'message 2';
      
      const signature1 = await walletAgent.signMessage(message1);
      const signature2 = await walletAgent.signMessage(message2);
      
      expect(signature1).not.toBe(signature2);
    });

    it('should verify signed message', async () => {
      const message = 'test message';
      const signature = await walletAgent.signMessage(message);
      
      const isValid = await walletAgent.verifyMessage(message, signature);
      expect(isValid).toBe(true);
    });

    it('should detect tampered message', async () => {
      const message = 'test message';
      const signature = await walletAgent.signMessage(message);
      
      const isValid = await walletAgent.verifyMessage('tampered message', signature);
      expect(isValid).toBe(false);
    });
  });

  describe('Human Timing', () => {
    it('should apply human timing delay', async () => {
      const startTime = Date.now();
      await walletAgent.applyHumanTiming();
      const endTime = Date.now();
      
      const delay = endTime - startTime;
      expect(delay).toBeGreaterThanOrEqual(0);
    });

    it('should respect behavior config timing', async () => {
      const behaviorWithTiming = {
        ...mockBehaviorConfig,
        meanDelay: 100,
        stdDev: 10,
      };
      
      const agent = new WalletAgent({
        id: 'wallet-timing',
        publicKey: keypair.publicKey.toString(),
        secretKey: Array.from(keypair.secretKey),
        proxyId: 'proxy-1',
        behavior: behaviorWithTiming,
        userAgent: 'Mozilla/5.0',
      }, mockProxyConfig, mockRpcConfig);
      
      const startTime = Date.now();
      await agent.applyHumanTiming();
      const endTime = Date.now();
      
      const delay = endTime - startTime;
      // Should be around 100ms, allow some variance
      expect(delay).toBeGreaterThanOrEqual(50);
      expect(delay).toBeLessThanOrEqual(150);
    });
  });

  describe('Decimal Noise', () => {
    it('should add decimal noise to amount', () => {
      const amount = 1.0;
      const noisyAmount = walletAgent.addDecimalNoise(amount);
      
      expect(noisyAmount).not.toBe(amount);
      expect(noisyAmount).toBeGreaterThanOrEqual(amount);
      expect(noisyAmount).toBeLessThanOrEqual(amount + 0.001);
    });

    it('should generate organic amount', () => {
      const min = 0.01;
      const max = 0.1;
      const amount = walletAgent.generateOrganicAmount(min, max);
      
      expect(amount).toBeGreaterThanOrEqual(min);
      expect(amount).toBeLessThanOrEqual(max);
    });
  });

  describe('Proxy Management', () => {
    it('should update proxy config', () => {
      const newProxyConfig = {
        ...mockProxyConfig,
        id: 'proxy-2',
        host: 'new-host',
      };
      
      walletAgent.setProxyConfig(newProxyConfig);
      expect(walletAgent.getProxyConfig()).toEqual(newProxyConfig);
    });

    it('should get proxy URL', () => {
      const proxyUrl = walletAgent.getProxyUrl();
      expect(proxyUrl).toBe('http://user:pass@localhost:8080');
    });

    it('should handle proxy without authentication', () => {
      const noAuthProxy = {
        id: 'proxy-no-auth',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
      };
      
      const agent = new WalletAgent({
        id: 'wallet-no-auth',
        publicKey: keypair.publicKey.toString(),
        secretKey: Array.from(keypair.secretKey),
        proxyId: 'proxy-no-auth',
        behavior: mockBehaviorConfig,
        userAgent: 'Mozilla/5.0',
      }, noAuthProxy, mockRpcConfig);
      
      const proxyUrl = agent.getProxyUrl();
      expect(proxyUrl).toBe('http://localhost:8080');
    });
  });

  describe('RPC Management', () => {
    it('should update RPC config', () => {
      const newRpcConfig = {
        ...mockRpcConfig,
        id: 'rpc-2',
        url: 'https://new-rpc.com',
      };
      
      walletAgent.setRpcConfig(newRpcConfig);
      expect(walletAgent.getRpcConfig()).toEqual(newRpcConfig);
    });

    it('should get RPC URL', () => {
      const rpcUrl = walletAgent.getRpcUrl();
      expect(rpcUrl).toBe('https://api.mainnet-beta.solana.com');
    });
  });

  describe('Behavior Configuration', () => {
    it('should update behavior config', () => {
      const newBehavior = {
        ...mockBehaviorConfig,
        meanDelay: 10000,
      };
      
      walletAgent.setBehaviorConfig(newBehavior);
      expect(walletAgent.getBehaviorConfig()).toEqual(newBehavior);
    });

    it('should get path from behavior', () => {
      const path = walletAgent.getPath();
      expect(path).toEqual(mockBehaviorConfig.path);
    });
  });

  describe('Agent State', () => {
    it('should initialize with idle state', () => {
      expect(walletAgent.getState()).toBe('idle');
    });

    it('should set state to busy', () => {
      walletAgent.setState('busy');
      expect(walletAgent.getState()).toBe('busy');
    });

    it('should set state to error', () => {
      walletAgent.setState('error');
      expect(walletAgent.getState()).toBe('error');
    });

    it('should check if busy', () => {
      expect(walletAgent.isBusy()).toBe(false);
      walletAgent.setState('busy');
      expect(walletAgent.isBusy()).toBe(true);
    });

    it('should check if idle', () => {
      expect(walletAgent.isIdle()).toBe(true);
      walletAgent.setState('busy');
      expect(walletAgent.isIdle()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should get last error', () => {
      expect(walletAgent.getLastError()).toBeNull();
      
      walletAgent.setLastError(new Error('Test error'));
      const error = walletAgent.getLastError();
      expect(error).toBeDefined();
      expect(error?.message).toBe('Test error');
    });

    it('should clear last error', () => {
      walletAgent.setLastError(new Error('Test error'));
      walletAgent.clearLastError();
      expect(walletAgent.getLastError()).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should track transaction count', () => {
      expect(walletAgent.getTransactionCount()).toBe(0);
      
      walletAgent.incrementTransactionCount();
      expect(walletAgent.getTransactionCount()).toBe(1);
      
      walletAgent.incrementTransactionCount();
      expect(walletAgent.getTransactionCount()).toBe(2);
    });

    it('should track success count', () => {
      expect(walletAgent.getSuccessCount()).toBe(0);
      
      walletAgent.incrementSuccessCount();
      expect(walletAgent.getSuccessCount()).toBe(1);
    });

    it('should track failure count', () => {
      expect(walletAgent.getFailureCount()).toBe(0);
      
      walletAgent.incrementFailureCount();
      expect(walletAgent.getFailureCount()).toBe(1);
    });

    it('should calculate success rate', () => {
      walletAgent.incrementSuccessCount();
      walletAgent.incrementSuccessCount();
      walletAgent.incrementFailureCount();
      
      const successRate = walletAgent.getSuccessRate();
      expect(successRate).toBe(2 / 3);
    });

    it('should return 0 success rate when no transactions', () => {
      expect(walletAgent.getSuccessRate()).toBe(0);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const json = walletAgent.toJSON();
      expect(json).toBeDefined();
      expect(json.id).toBe('wallet-1');
      expect(json.publicKey).toBe(keypair.publicKey.toString());
      // Secret key should not be included
      expect(json.secretKey).toBeUndefined();
    });

    it('should deserialize from JSON', () => {
      const json = walletAgent.toJSON();
      const deserialized = WalletAgent.fromJSON(json, mockProxyConfig, mockRpcConfig);
      
      expect(deserialized.getWalletId()).toBe(walletAgent.getWalletId());
      expect(deserialized.getPublicKey().toString()).toBe(
        walletAgent.getPublicKey().toString()
      );
    });
  });
});
