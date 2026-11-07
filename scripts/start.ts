#!/usr/bin/env ts-node
// ============================================
// BOTAIRDROP - Start Script
// Starts the main application
// ============================================

import { config } from '../src/config';
import { AgentFleet } from '../src/core/agent-fleet';
import { CandyMachineSniper } from '../src/sniper/candy-machine';
import { JitoBundler } from '../src/sniper/jito-bundle';
import { UniversalCaptchaSolver } from '../src/captcha/solver';
import { TransactionBuilder } from '../src/airdrop/transaction-builder';
import { PathPolymorphismEngine } from '../src/anti-sybil/path-polymorphism';
import { DecimalNoiseGenerator } from '../src/anti-sybil/decimal-noise';
import { HumanTimingEngine } from '../src/anti-sybil/human-timing';

/**
 * Main start function
 */
async function start() {
  console.log('🚀 BOTAIRDROP - Starting Application...\n');

  // Load configuration
  const appConfig = config.getConfig();
  console.log(`📋 Configuration loaded:`);
  console.log(`   - Wallets: ${appConfig.wallets.length}`);
  console.log(`   - Proxies: ${appConfig.proxies.length}`);
  console.log(`   - RPC Endpoints: ${appConfig.rpc.length}`);
  console.log(`   - Network: ${appConfig.network}\n`);

  // Validate configuration
  if (appConfig.wallets.length === 0) {
    console.error('❌ No wallets configured. Please add wallets to src/config/wallets.json');
    process.exit(1);
  }

  if (appConfig.proxies.length === 0) {
    console.warn('⚠️ No proxies configured. Using direct connections.');
  }

  // Initialize Agent Fleet
  console.log('📦 Initializing Agent Fleet...');
  const agentFleet = new AgentFleet(
    appConfig.wallets,
    appConfig.proxies,
    appConfig.network
  );
  console.log(`✅ Agent Fleet initialized with ${agentFleet.getAgentCount()} agents\n`);

  // Initialize CAPTCHA Solver
  const captchaSolver = new UniversalCaptchaSolver(
    appConfig.settings.captchaProvider,
    appConfig.settings.captchaApiKey
  );
  console.log(`🔒 CAPTCHA Solver initialized (${appConfig.settings.captchaProvider})\n`);

  // Initialize Path Polymorphism Engine
  const pathEngine = new PathPolymorphismEngine();
  console.log(`🔄 Path Polymorphism Engine initialized with ${pathEngine.getPathCount()} paths\n`);

  // Initialize Decimal Noise Generator
  const decimalNoise = new DecimalNoiseGenerator();
  console.log(`💰 Decimal Noise Generator initialized\n`);

  // Initialize Human Timing Engine
  const timingEngine = new HumanTimingEngine();
  console.log(`⏳ Human Timing Engine initialized\n`);

  // Display agent information
  console.log('👥 Agent Information:');
  const agentIds = agentFleet.getAgentIds();
  for (const agentId of agentIds.slice(0, 5)) {
    const agent = agentFleet.getAgent(agentId);
    if (agent) {
      const balance = await agent.getBalance();
      console.log(`   - ${agentId}: ${agent.getPublicKey().toString().slice(0, 8)}...${agent.getPublicKey().toString().slice(-8)} (${balance} lamports)`);
    }
  }
  if (agentIds.length > 5) {
    console.log(`   ... and ${agentIds.length - 5} more agents`);
  }
  console.log();

  // Example: Start monitoring a Candy Machine
  // Uncomment and replace with actual candy machine address
  // const CANDY_MACHINE_ID = 'YOUR_CANDY_MACHINE_ADDRESS';
  // const firstAgent = agentFleet.getAgent(agentIds[0]);
  // if (firstAgent) {
  //   const sniper = new CandyMachineSniper(firstAgent);
  //   sniper.monitor(
  //     CANDY_MACHINE_ID,
  //     (txId, nftAddress) => {
  //       console.log(`✅ Minted NFT: ${nftAddress} in TX: ${txId}`);
  //     },
  //     1000
  //   );
  //   console.log(`🎯 Started monitoring Candy Machine: ${CANDY_MACHINE_ID}`);
  // }

  // Example: Execute a task on all agents
  console.log('📊 Executing test task on all agents...');
  const results = await agentFleet.executeAll(async (agent) => {
    const balance = await agent.getBalance();
    const path = pathEngine.getPath(agent.getId());
    return {
      walletId: agent.getId(),
      publicKey: agent.getPublicKey().toString(),
      balance: balance,
      path: path.join(' -> '),
    };
  });

  console.log('\n📋 Agent Fleet Status:');
  results.forEach((result, walletId) => {
    if (result instanceof Error) {
      console.log(`   ❌ ${walletId}: ${result.message}`);
    } else {
      console.log(`   ✅ ${walletId}: ${result.balance} lamports, Path: ${result.path}`);
    }
  });

  console.log('\n✅ BOTAIRDROP - Application started successfully!');
  console.log('💡 Press Ctrl+C to stop the application.');
}

// Run the application
start().catch((error) => {
  console.error('❌ Application error:', error);
  process.exit(1);
});
