# DOCUMENTATION
## BOTAIRDROP - Complete Documentation

## Table of Contents
1. [Introduction](#1-introduction)
2. [Quick Start](#2-quick-start)
3. [Architecture Overview](#3-architecture-overview)
4. [Setup & Installation](#4-setup--installation)
5. [Configuration](#5-configuration)
6. [Core Components](#6-core-components)
7. [Agent System](#7-agent-system)
8. [Anti-Sybil System](#8-anti-sybil-system)
9. [NFT Sniper](#9-nft-sniper)
10. [Airdrop Farmer](#10-airdrop-farmer)
11. [API Reference](#11-api-reference)
12. [Testing](#12-testing)
13. [Deployment](#13-deployment)
14. [Troubleshooting](#14-troubleshooting)
15. [Contributing](#15-contributing)

---

## 1. Introduction

### What is BOTAIRDROP?
BOTAIRDROP is a sophisticated Multi-Agent system designed to manage 100+ Solana wallets for:
- **Airdrop Farming**: Generate organic on-chain footprints that bypass Sybil detection
- **Auto NFT Sniping**: Instantly mint rare NFTs from Candy Machines
- **Stealth Operations**: Hide all operations from detection systems

### Key Features
- Multi-Agent Architecture
- 1:1 Static Residential Proxy Binding
- Path Polymorphism (Markov Chain)
- Human-Like Timing (Poisson/Gaussian)
- Decimal Noise for amounts
- Jito Bundles for priority
- CAPTCHA Bypass
- Circuit Breaker Pattern
- Transaction Analytics

### Use Cases
- Airdrop Farming
- NFT Collection Building
- DeFi Yield Optimization
- Cross-Chain Arbitrage
- Market Making

---

## 2. Quick Start

### Prerequisites
- Node.js 18+
- TypeScript 5+
- Git
- Solana CLI (optional)

### Installation
```bash
# Clone the repository
git clone https://github.com/mohamedazooz/BOTAIRDROP.git
cd BOTAIRDROP

# Install dependencies
npm install

# Build the project
npm run build

# Start the system
npm start
```

### Development
```bash
# Start in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

---

## 3. Architecture Overview

### System Architecture
See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

### Key Components
- **Agent Fleet**: Manages all wallet agents
- **Wallet Manager**: Handles wallet operations
- **Network Manager**: Manages proxies and RPC
- **Behavior Engine**: Implements anti-Sybil patterns
- **Task Dispatcher**: Distributes tasks to agents
- **Sniper Service**: NFT sniping operations
- **Farmer Service**: Airdrop farming operations
- **Stealth Service**: CAPTCHA and fingerprinting

---

## 4. Setup & Installation

### 4.1 Environment Setup

#### Node.js Installation
```bash
# Using nvm (recommended)
nvm install 18
nvm use 18

# Or direct installation
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### TypeScript Installation
```bash
npm install -g typescript ts-node
```

#### Git Installation
```bash
sudo apt-get install -y git
```

### 4.2 Project Setup

#### Clone Repository
```bash
git clone https://github.com/mohamedazooz/BOTAIRDROP.git
cd BOTAIRDROP
```

#### Install Dependencies
```bash
npm install
```

#### Build Project
```bash
npm run build
```

### 4.3 Development Tools

#### Recommended IDE
- Visual Studio Code
- WebStorm

#### Recommended Extensions
- ESLint
- Prettier
- TypeScript Toolbox
- Solana Wallet Adapter

---

## 5. Configuration

### 5.1 Environment Variables

Create a `.env` file in the project root:

```env
# Network Configuration
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Proxy Configuration
PROXY_PROVIDER=luminati
PROXY_API_KEY=your-api-key

# CAPTCHA Configuration
CAPTCHA_PROVIDER=2captcha
CAPTCHA_API_KEY=your-api-key

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/botairdrop.log

# Performance Configuration
MAX_CONCURRENT_TASKS=10
MAX_RETRIES=3
RETRY_DELAY=1000

# Security Configuration
ENCRYPTION_KEY=your-encryption-key
```

### 5.2 Configuration Files

#### wallets.json
```json
{
  "wallets": [
    {
      "id": "wallet-1",
      "publicKey": "YourPublicKeyHere",
      "secretKey": [1, 2, 3, ...],
      "proxyId": "proxy-1",
      "behavior": {
        "meanDelay": 5000,
        "stdDev": 1500,
        "path": ["Jupiter", "Raydium", "Meteora"]
      }
    }
  ]
}
```

#### proxies.json
```json
{
  "proxies": [
    {
      "id": "proxy-1",
      "host": "proxy.provider.com",
      "port": 8080,
      "username": "user",
      "password": "pass",
      "type": "residential",
      "location": "US",
      "userAgent": "Mozilla/5.0 ..."
    }
  ]
}
```

#### rpc.json
```json
{
  "endpoints": [
    {
      "id": "main",
      "url": "https://your-quicknode-endpoint.com",
      "priority": 1
    },
    {
      "id": "backup",
      "url": "https://your-alchemy-endpoint.com",
      "priority": 2
    },
    {
      "id": "jito",
      "url": "https://jito-rpc.com",
      "priority": 3
    }
  ]
}
```

---

## 6. Core Components

### 6.1 Agent Fleet

The Agent Fleet is the main coordinator of all wallet agents.

**File:** `src/core/agent-fleet.ts`

**Features:**
- Manages 100+ wallet agents
- Distributes tasks
- Handles errors
- Monitors performance

**Usage:**
```typescript
import { AgentFleet } from './core/agent-fleet';

const fleet = new AgentFleet(walletConfigs);
await fleet.executeAll(async (agent) => {
  // Your task here
});
```

### 6.2 Wallet Manager

Manages wallet operations including keypair storage, balance tracking, and transaction signing.

**File:** `src/core/wallet-manager.ts`

**Features:**
- Secure keypair storage
- Balance tracking
- Transaction signing
- Multiple wallet support

### 6.3 Network Manager

Manages network connections including proxies and RPC endpoints.

**File:** `src/core/network-manager.ts`

**Features:**
- Proxy rotation
- RPC failover
- Connection pooling
- Load balancing

### 6.4 Behavior Engine

Implements anti-Sybil patterns to avoid detection.

**File:** `src/core/behavior-engine.ts`

**Features:**
- Path polymorphism
- Human timing
- Decimal noise
- Browser fingerprinting

---

## 7. Agent System

### 7.1 Agent Types

#### WalletAgent
Manages a single wallet and its operations.

**Features:**
- Keypair management
- Balance tracking
- Transaction signing
- Network connection

#### SniperAgent
Handles NFT sniping operations.

**Features:**
- Candy machine monitoring
- Jito bundle submission
- Priority fee management
- Whitelist checking

#### FarmerAgent
Handles airdrop farming operations.

**Features:**
- Transaction building
- DApp interactions
- Footprint generation
- Path selection

#### StealthAgent
Handles stealth operations.

**Features:**
- CAPTCHA solving
- Proxy rotation
- Browser fingerprinting
- Anti-detection

### 7.2 Agent Lifecycle

1. **Created**: Agent object is created
2. **Initialized**: Agent is initialized with configuration
3. **Ready**: Agent is ready to receive tasks
4. **Executing**: Agent is executing a task
5. **Completed**: Task completed successfully
6. **Failed**: Task failed
7. **Retrying**: Retrying failed task
8. **Terminated**: Agent is terminated

### 7.3 Agent Communication

- **Decentralized**: Each agent works independently
- **Event-Driven**: Tasks are triggered by events
- **Message Queue**: Optional RabbitMQ/Redis for inter-agent communication
- **No Single Point of Failure**: No central coordinator

---

## 8. Anti-Sybil System

### 8.1 Zero-Linkage Topology

**Rule:** No financial linkage between fleet wallets.

**Implementation:**
- Fund wallets from isolated sources (CEX sub-accounts)
- Use different bridges for different wallets
- Never transfer funds between fleet wallets

### 8.2 Behavioral Entropy

**Rule:** Each wallet has unique, human-like behavior.

**Implementation:**
- Poisson distribution for delays
- Gaussian distribution for timing
- Exponential backoff with jitter

**Example:**
```typescript
import { HumanTimingEngine } from './anti-sybil/human-timing';

const timing = new HumanTimingEngine();
await timing.gaussianDelay(5000, 1500); // Human-like delay
```

### 8.3 Path Polymorphism

**Rule:** Each wallet follows a different transaction path.

**Implementation:**
- Markov Chain State Machine
- Unique path per wallet
- Path rotation

**Example:**
```typescript
import { PathPolymorphismEngine } from './anti-sybil/path-polymorphism';

const pathEngine = new PathPolymorphismEngine();
const path = pathEngine.getPath(walletId);
// Returns: ['Jupiter', 'Raydium', 'Meteora']
```

### 8.4 Decimal Noise

**Rule:** All amounts have random decimal noise.

**Implementation:**
- Add random noise to amounts (0.015 -> 0.015000483)
- Different noise ranges for different operations
- Organic amount generation

**Example:**
```typescript
import { DecimalNoiseGenerator } from './anti-sybil/decimal-noise';

const amount = DecimalNoiseGenerator.addNoise(0.015);
// Returns: 0.015000483
```

### 8.5 Network Isolation

**Rule:** Each wallet has unique network characteristics.

**Implementation:**
- 1:1 Static Residential Proxy Binding
- Unique User-Agent per wallet
- Unique Browser Fingerprint per wallet

---

## 9. NFT Sniper

### 9.1 Candy Machine Monitoring

**Features:**
- Monitor candy machine state
- Check whitelist status
- Detect go-live date
- Track items remaining

**Example:**
```typescript
import { CandyMachineSniper } from './sniper/candy-machine';

const sniper = new CandyMachineSniper(walletAgent);
sniper.monitorAndMint(candyMachineId, (txId) => {
  console.log(`Minted: ${txId}`);
});
```

### 9.2 Jito Bundles

**Features:**
- Submit transactions via Jito
- Set priority fees
- Bundle multiple transactions
- Fast confirmation

**Example:**
```typescript
import { JitoBundler } from './sniper/jito-bundle';

const bundler = new JitoBundler();
const txId = await bundler.submitBundle(transactions, 1000000);
// 1000000 lamports = 0.001 SOL tip
```

### 9.3 Priority Fees

**Features:**
- Dynamic priority fee estimation
- Historical fee analysis
- Fee caps to prevent excessive spending

**Example:**
```typescript
import { PriorityFeeEstimator } from './sniper/priority-fee';

const fee = await PriorityFeeEstimator.estimate();
// Returns: 1000000 lamports (0.001 SOL)
```

---

## 10. Airdrop Farmer

### 10.1 Transaction Building

**Features:**
- Build complex transactions
- Add multiple instructions
- Set compute budget
- Add priority fees

**Example:**
```typescript
import { TransactionBuilder } from './airdrop/transaction-builder';

const tx = await TransactionBuilder.build({
  wallet: walletAgent,
  instructions: [swapInstruction, stakeInstruction],
  priorityFee: 1000000
});
```

### 10.2 DApp Interactions

**Features:**
- Interact with DeFi protocols
- Swap tokens
- Provide liquidity
- Stake tokens

**Example:**
```typescript
import { DAppInteractor } from './airdrop/dapp-interactions';

const interactor = new DAppInteractor(walletAgent);
await interactor.swap('SOL', 'USDC', 0.1);
```

### 10.3 Footprint Generation

**Features:**
- Generate organic transaction history
- Simulate user behavior
- Create realistic patterns
- Avoid detection

**Example:**
```typescript
import { FootprintGenerator } from './airdrop/footprint-generator';

const generator = new FootprintGenerator(walletAgent);
await generator.generateOrganicFootprint();
```

---

## 11. API Reference

### 11.1 Agent Fleet API

#### `new AgentFleet(configs: WalletConfig[])`
Creates a new Agent Fleet.

#### `fleet.executeAll(task: (agent: WalletAgent) => Promise<T>): Promise<Map<string, T | Error>>`
Executes a task on all agents.

#### `fleet.getWallet(id: string): WalletAgent | undefined`
Gets a specific wallet agent.

### 11.2 WalletAgent API

#### `wallet.getKeypair(): Keypair`
Gets the wallet keypair.

#### `wallet.getConnection(): Connection`
Gets the Solana connection.

#### `wallet.sendTransaction(tx: Transaction): Promise<string>`
Sends a transaction.

### 11.3 SniperAgent API

#### `sniper.monitorAndMint(candyMachineId: PublicKey, callback: (txId: string) => void): void`
Monitors a candy machine and mints when active.

#### `sniper.stopMonitoring(): void`
Stops monitoring.

### 11.4 BehaviorEngine API

#### `engine.getPath(walletId: string): string[]`
Gets a unique path for a wallet.

#### `engine.getTiming(walletId: string): TimingConfig`
Gets timing configuration for a wallet.

---

## 12. Testing

### 12.1 Unit Tests

```bash
npm run test:unit
```

### 12.2 Integration Tests

```bash
npm run test:integration
```

### 12.3 E2E Tests

```bash
npm run test:e2e
```

### 12.4 Test Coverage

```bash
npm run test:coverage
```

---

## 13. Deployment

### 13.1 Development Deployment

```bash
npm run dev
```

### 13.2 Production Deployment

#### Using Docker
```bash
# Build the image
docker build -t botairdrop .

# Run the container
docker run -d --name botairdrop botairdrop
```

#### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down
```

### 13.3 Cloud Deployment

#### AWS
```bash
# Deploy to ECS
aws ecs create-service --cli-input-json file://ecs-service.json
```

#### DigitalOcean
```bash
# Deploy to App Platform
doctl apps create --spec app-spec.yaml
```

---

## 14. Troubleshooting

### Common Issues

#### Issue: RPC Connection Failed
**Solution:**
- Check RPC endpoint URL
- Check network connectivity
- Try a different RPC endpoint
- Check rate limits

#### Issue: Insufficient Funds
**Solution:**
- Fund the wallet with SOL
- Check rent-exempt balance (0.002035 SOL)
- Check transaction fees

#### Issue: Transaction Failed
**Solution:**
- Check transaction logs
- Validate transaction inputs
- Check program errors
- Retry with higher priority fee

#### Issue: Proxy Connection Failed
**Solution:**
- Check proxy configuration
- Verify proxy credentials
- Try a different proxy
- Check proxy provider status

#### Issue: CAPTCHA Not Solved
**Solution:**
- Check CAPTCHA API key
- Verify CAPTCHA provider balance
- Try a different CAPTCHA provider
- Check sitekey and page URL

---

## 15. Contributing

### How to Contribute
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

### Code Style
- Follow TypeScript best practices
- Use ESLint and Prettier
- Write self-documenting code
- Add appropriate comments

### Pull Request Guidelines
- Describe your changes
- Reference related issues
- Include tests
- Update documentation

---

## Additional Resources

- [Solana Documentation](https://docs.solana.com/)
- [Metaplex Documentation](https://www.metaplex.com/)
- [AGENT.md](AGENT.md) - Agent System Documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - Architecture Documentation
- [BEST_PRACTICES.md](BEST_PRACTICES.md) - Best Practices Guide

---

## License
This project is licensed under the MIT License.

## Contact
For questions or support, please open an issue on GitHub.
