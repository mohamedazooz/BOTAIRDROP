// ============================================
// BOTAIRDROP - Main Entry Point
// Multi-Agent System for Solana Airdrop Farming & NFT Sniping
// ============================================

import { AgentFleet } from './core/agent-fleet';
import { WalletAgent } from './core/wallet-agent';
import { CandyMachineSniper } from './sniper/candy-machine';
import { JitoBundler } from './sniper/jito-bundle';
import { PathPolymorphismEngine } from './anti-sybil/path-polymorphism';
import { DecimalNoiseGenerator } from './anti-sybil/decimal-noise';
import { HumanTimingEngine } from './anti-sybil/human-timing';
import { CircuitBreaker } from './utils/circuit-breaker';
import { retry } from './utils/retry';
import { WalletConfig, ProxyConfig, NetworkType } from './types';

// ============================================
// Example Usage
// ============================================

/**
 * Example: Initialize and run the BOTAIRDROP system
 */
async function main() {
  console.log('🚀 BOTAIRDROP - Starting...');

  // 1. Load configuration (in production, load from config files)
  const walletConfigs: WalletConfig[] = [
    // Example wallet configurations
    {
      id: 'wallet-1',
      publicKey: 'YOUR_PUBLIC_KEY_1',
      secretKey: [/* Your secret key array */],
      proxyId: 'proxy-1',
      behavior: {
        meanDelay: 5000,
        stdDev: 1500,
        minDelay: 2000,
        maxDelay: 10000,
        path: ['Jupiter', 'Raydium', 'Meteora'],
        decimalNoiseRange: [0.00000001, 0.001],
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    // Add more wallets...
  ];

  const proxyConfigs: ProxyConfig[] = [
    // Example proxy configurations
    {
      id: 'proxy-1',
      host: 'proxy.provider.com',
      port: 8080,
      username: 'user1',
      password: 'pass1',
      type: 'residential',
      location: 'US',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    // Add more proxies...
  ];

  // 2. Initialize the Agent Fleet
  console.log('📦 Initializing Agent Fleet...');
  const agentFleet = new AgentFleet(
    walletConfigs,
    proxyConfigs,
    'mainnet-beta' as NetworkType
  );
  console.log(`✅ Agent Fleet initialized with ${agentFleet.getAgentCount()} agents`);

  // 3. Example: Use individual components
  console.log('\n🎯 Testing individual components...');

  // Get first agent
  const firstAgent = agentFleet.getAgent('wallet-1');
  if (firstAgent) {
    console.log(`✅ Wallet Agent: ${firstAgent.getPublicKey().toString()}`);
    
    // Test human timing
    const timing = new HumanTimingEngine();
    console.log('⏳ Testing human timing...');
    await timing.gaussianDelay();
    console.log('✅ Human timing test passed');

    // Test decimal noise
    const amount = DecimalNoiseGenerator.addNoise(0.015);
    console.log(`💰 Decimal noise test: 0.015 -> ${amount}`);

    // Test path polymorphism
    const pathEngine = new PathPolymorphismEngine();
    const path = pathEngine.getPath('wallet-1');
    console.log(`🔄 Path polymorphism: ${path.join(' -> ')}`);

    // Test circuit breaker
    const circuitBreaker = new CircuitBreaker();
    const result = await circuitBreaker.execute(async () => {
      return '✅ Circuit breaker test passed';
    });
    console.log(result);

    // Test retry
    const retryResult = await retry(async () => {
      return '✅ Retry test passed';
    });
    console.log(retryResult);
  }

  // 4. Example: Monitor Candy Machines
  console.log('\n🎨 Testing Candy Machine Sniper...');
  const walletAgent = agentFleet.getAgent('wallet-1');
  if (walletAgent) {
    const sniper = new CandyMachineSniper(walletAgent);
    
    // Example: Monitor a specific candy machine
    const candyMachineId = 'YOUR_CANDY_MACHINE_ADDRESS';
    console.log(`🔍 Monitoring Candy Machine: ${candyMachineId}`);
    
    // Start monitoring (in production, use actual candy machine address)
    // sniper.monitor(
    //   candyMachineId,
    //   (txId, nftAddress) => {
    //     console.log(`✅ Minted NFT: ${nftAddress} in TX: ${txId}`);
    //   },
    //   1000
    // );
    
    // Example: Check candy machine status
    const status = await sniper.checkCandyMachine(candyMachineId);
    console.log(`Candy Machine Status:`, {
      isActive: status.isActive,
      itemsRemaining: status.itemsRemaining,
      price: status.price,
    });
  }

  // 5. Example: Jito Bundle
  console.log('\n⚡ Testing Jito Bundler...');
  if (walletAgent) {
    const jitoBundler = new JitoBundler(walletAgent);
    console.log(`✅ Jito Bundler initialized`);
    console.log(`Tip Accounts: ${jitoBundler.getTipAccounts().length} accounts`);
    
    const recommendedTip = await jitoBundler.getRecommendedTip();
    console.log(`💡 Recommended Jito tip: ${recommendedTip} lamports (${recommendedTip / 1000000000} SOL)`);
  }

  // 6. Example: Execute on all agents
  console.log('\n👥 Testing Agent Fleet execution...');
  const results = await agentFleet.executeAll(async (agent) => {
    const balance = await agent.getBalance();
    return {
      walletId: agent.getId(),
      publicKey: agent.getPublicKey().toString(),
      balance: balance,
    };
  });

  console.log('📊 Agent Fleet Results:');
  results.forEach((result, walletId) => {
    if (result instanceof Error) {
      console.log(`  ❌ ${walletId}: ${result.message}`);
    } else {
      console.log(`  ✅ ${walletId}: ${result.balance} lamports`);
    }
  });

  console.log('\n🎉 BOTAIRDROP - All tests passed!');
  console.log('📖 Check documentation for more details:');
  console.log('   - AGENT.md: Agent System documentation');
  console.log('   - ARCHITECTURE.md: System architecture');
  console.log('   - BEST_PRACTICES.md: Best practices guide');
  console.log('   - DOCUMENTATION.md: Full documentation');
}

// ============================================
// Error Handling
// ============================================

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// ============================================
// Export all main components
// ============================================

export {
  AgentFleet,
  WalletAgent,
  CandyMachineSniper,
  JitoBundler,
  PathPolymorphismEngine,
  DecimalNoiseGenerator,
  HumanTimingEngine,
  CircuitBreaker,
  retry,
};

// ============================================
// Run if this is the main module
// ============================================

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}
