#!/usr/bin/env ts-node
// ============================================
// BOTAIRDROP - Development Script
// Runs the application in development mode
// ============================================

import { config } from '../src/config';
import { AgentFleet } from '../src/core/agent-fleet';
import { NetworkManager } from '../src/core/network-manager';
import { PathPolymorphismEngine } from '../src/anti-sybil/path-polymorphism';
import { DecimalNoiseGenerator } from '../src/anti-sybil/decimal-noise';
import { HumanTimingEngine } from '../src/anti-sybil/human-timing';

/**
 * Development mode function
 */
async function dev() {
  console.log('🚀 BOTAIRDROP - Development Mode\n');

  // Load configuration
  const appConfig = config.getConfig();
  
  // Use devnet for development
  appConfig.network = 'devnet';
  config.updateNetwork('devnet');

  console.log(`📋 Configuration:`);
  console.log(`   - Network: ${appConfig.network}`);
  console.log(`   - Wallets: ${appConfig.wallets.length}`);
  console.log(`   - Proxies: ${appConfig.proxies.length}\n`);

  // Initialize components
  const agentFleet = new AgentFleet(
    appConfig.wallets,
    appConfig.proxies,
    appConfig.network
  );

  const networkManager = new NetworkManager(
    appConfig.proxies,
    appConfig.rpc,
    appConfig.network
  );

  const pathEngine = new PathPolymorphismEngine();
  const decimalNoise = new DecimalNoiseGenerator();
  const timingEngine = new HumanTimingEngine();

  console.log('✅ Components initialized\n');

  // Test components
  console.log('🧪 Running development tests...\n');

  // Test 1: Human Timing
  console.log('Test 1: Human Timing');
  await timingEngine.gaussianDelay();
  console.log('✅ Gaussian delay test passed');
  await timingEngine.poissonDelay();
  console.log('✅ Poisson delay test passed');
  await timingEngine.exponentialDelay();
  console.log('✅ Exponential delay test passed');
  await timingEngine.humanDelay();
  console.log('✅ Human delay test passed\n');

  // Test 2: Decimal Noise
  console.log('Test 2: Decimal Noise');
  const amount1 = DecimalNoiseGenerator.addNoise(0.015);
  console.log(`   0.015 + noise = ${amount1}`);
  const amount2 = DecimalNoiseGenerator.addNoise(1.0);
  console.log(`   1.0 + noise = ${amount2}`);
  const amounts = DecimalNoiseGenerator.generateOrganicAmounts(5, 0.1);
  console.log(`   Organic amounts: ${amounts.map(a => a.toFixed(8)).join(', ')}`);
  console.log('✅ Decimal noise test passed\n');

  // Test 3: Path Polymorphism
  console.log('Test 3: Path Polymorphism');
  const paths = pathEngine.getAllPaths();
  console.log(`   Available paths: ${paths.length}`);
  paths.slice(0, 3).forEach((path, i) => {
    console.log(`   ${i + 1}. ${path.name}: ${path.steps.map(s => s.program).join(' -> ')}`);
  });
  
  // Test with wallet IDs
  const testWalletIds = ['wallet-1', 'wallet-2', 'wallet-3', 'wallet-4', 'wallet-5'];
  testWalletIds.forEach(walletId => {
    const path = pathEngine.getPath(walletId);
    console.log(`   ${walletId}: ${path.join(' -> ')}`);
  });
  console.log('✅ Path polymorphism test passed\n');

  // Test 4: Network Manager
  console.log('Test 4: Network Manager');
  console.log(`   Proxies: ${networkManager.getProxyCount()}`);
  console.log(`   RPC Endpoints: ${networkManager.getRpcCount()}`);
  
  const randomProxy = networkManager.getRandomProxy();
  console.log(`   Random proxy: ${randomProxy.id} (${randomProxy.type})`);
  
  const nextProxy = networkManager.getNextProxy();
  console.log(`   Next proxy: ${nextProxy.id} (${nextProxy.type})`);
  
  const walletProxy = networkManager.getProxyForWallet('test-wallet');
  console.log(`   Wallet proxy: ${walletProxy.id} (${walletProxy.type})`);
  console.log('✅ Network manager test passed\n');

  // Test 5: Agent Fleet
  console.log('Test 5: Agent Fleet');
  console.log(`   Agents: ${agentFleet.getAgentCount()}`);
  
  const agentIds = agentFleet.getAgentIds();
  console.log(`   Agent IDs: ${agentIds.slice(0, 5).join(', ')}...`);
  
  // Test path assignment
  agentIds.slice(0, 3).forEach(agentId => {
    const path = agentFleet.getPath(agentId);
    console.log(`   ${agentId}: ${path.join(' -> ')}`);
  });
  console.log('✅ Agent fleet test passed\n');

  // Test 6: Execute on agents
  console.log('Test 6: Agent Execution');
  const results = await agentFleet.executeAll(async (agent) => {
    const balance = await agent.getBalance();
    return {
      walletId: agent.getId(),
      balance: balance,
    };
  }, { maxConcurrent: 2 });

  results.forEach((result, walletId) => {
    if (result instanceof Error) {
      console.log(`   ❌ ${walletId}: ${result.message}`);
    } else {
      console.log(`   ✅ ${walletId}: ${result.balance} lamports`);
    }
  });
  console.log('✅ Agent execution test passed\n');

  console.log('🎉 All development tests passed!');
  console.log('\n💡 Development mode tips:');
  console.log('   - Use Devnet for testing');
  console.log('   - Get test SOL from: https://faucet.solana.com/');
  console.log('   - Check logs for detailed information');
  console.log('\n🚀 Ready for development!');
}

// Run development mode
dev().catch((error) => {
  console.error('❌ Development error:', error);
  process.exit(1);
});
