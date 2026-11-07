# BOTAIRDROP

## 🚀 Multi-Agent System for Solana Airdrop Farming & NFT Sniping

**BOTAIRDROP** is a **Senior Blockchain Engineer** designed system for managing **100+ Solana wallets** with **Anti-Sybil**, **Stealth**, and **Automation** capabilities.

---

## 🎯 **Features**

### ✅ Core Capabilities
- **Multi-Agent Architecture** - Manage 100+ wallets independently
- **Airdrop Farming** - Generate organic on-chain footprints
- **Auto NFT Sniper** - Instantly mint rare NFTs from Candy Machines
- **Stealth Operations** - Hide all operations from detection systems

### ✅ Anti-Sybil Techniques
- **1:1 Static Residential Proxy Binding** - Each wallet has unique IP
- **Path Polymorphism** - Different transaction paths per wallet (Markov Chain)
- **Human-Like Timing** - Poisson/Gaussian distribution delays
- **Decimal Noise** - Unrounded amounts (0.015 → 0.015000483)
- **Zero-Linkage Topology** - No financial connection between fleet wallets

### ✅ Performance Optimization
- **Jito Bundles** - Priority transaction execution
- **RPC Rotation** - Automatic failover between RPC endpoints
- **Connection Pooling** - Efficient resource management
- **Circuit Breaker** - Fault tolerance pattern

---

## 📚 **Documentation**

| Document | Description |
|----------|-------------|
| **[AGENT.md](AGENT.md)** | Agent System, Rules, and Workflows |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Complete System Architecture |
| **[BEST_PRACTICES.md](BEST_PRACTICES.md)** | Blockchain & Solana Best Practices |
| **[DOCUMENTATION.md](DOCUMENTATION.md)** | Full Documentation Guide |

---

## 🏗️ **Architecture**

```
BOTAIRDROP/
├── src/
│   ├── core/              # Core services (Agent Fleet, Wallet, Network)
│   ├── sniper/            # NFT Sniper (Candy Machine, Jito Bundles)
│   ├── anti-sybil/        # Anti-Sybil (Path Poly, Timing, Decimal Noise)
│   ├── captcha/           # CAPTCHA Solving
│   ├── airdrop/           # Airdrop Farming
│   ├── utils/             # Utilities (Logger, Circuit Breaker)
│   └── config/            # Configuration files
├── docs/                  # Documentation
├── tests/                 # Tests
├── scripts/               # Scripts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 **Quick Start**

### Prerequisites
- Node.js 18+
- TypeScript 5+
- Git

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

## 📋 **Configuration**

### Environment Variables
Copy `.env.example` to `.env` and configure:
```env
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PROXY_PROVIDER=luminati
PROXY_API_KEY=your-api-key
CAPTCHA_PROVIDER=2captcha
CAPTCHA_API_KEY=your-api-key
```

### Configuration Files
- `src/config/wallets.json` - Wallet configurations
- `src/config/proxies.json` - Proxy configurations
- `src/config/rpc.json` - RPC endpoint configurations

---

## 🤖 **Agent System**

### Agent Types
| Agent | Responsibility |
|-------|----------------|
| **WalletAgent** | Wallet management, transaction signing |
| **SniperAgent** | NFT sniping, candy machine monitoring |
| **FarmerAgent** | Airdrop farming, footprint generation |
| **StealthAgent** | CAPTCHA solving, proxy rotation |

### Agent Workflow
1. **Monitor** → 2. **Analyze** → 3. **Execute** → 4. **Verify** → 5. **Log**

---

## 🛡️ **Anti-Sybil System**

### Key Techniques
- **Path Polymorphism**: Each wallet follows unique transaction paths
- **Human Timing**: Poisson/Gaussian distribution delays
- **Decimal Noise**: Random decimal variations in amounts
- **Network Isolation**: 1:1 Static Residential Proxy Binding
- **Zero-Linkage**: No financial connection between wallets

---

## 🎨 **NFT Sniper**

### Features
- Candy Machine v3 Monitoring
- Jito Bundle Submission
- Priority Fee Optimization
- Whitelist Checking
- Instant Minting

---

## 🌱 **Airdrop Farmer**

### Features
- Organic Footprint Generation
- DApp Interactions
- Transaction Building
- Path Selection
- Behavioral Simulation

---

## 📊 **Monitoring & Analytics**

### Metrics
- Success Rate
- Error Rate
- Latency
- Throughput
- Resource Usage

### Logging
- Transaction Logs
- Error Logs
- Performance Logs
- Security Logs

---

## 🔧 **Requirements**

### Hardware
- **CPU**: 8+ cores
- **RAM**: 16GB+
- **Storage**: 200GB+ SSD
- **OS**: Linux/Windows/macOS

### Network
- **Proxies**: 100+ Residential Proxies
- **RPC**: Multiple Solana RPC Endpoints
- **Bandwidth**: 100 Mbps+

### Software
- Node.js 18+
- TypeScript 5+
- Git

### Funding
- ~10 SOL for wallet balances
- API credits for Proxies & CAPTCHA

---

## 📦 **Technology Stack**

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js 18+ |
| **Language** | TypeScript 5+ |
| **Blockchain** | Solana Web3.js, Metaplex |
| **Network** | https-proxy-agent, axios |
| **Database** | SQLite, PostgreSQL, Redis |
| **DevOps** | Docker, GitHub Actions |
| **Monitoring** | Prometheus, Grafana |

---

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

---

## 📜 **License**

This project is licensed under the **MIT License**.

---

## 📞 **Contact**

For questions or support, please open an issue on GitHub.

---

## 🌐 **Links**

- [GitHub Repository](https://github.com/mohamedazooz/BOTAIRDROP)
- [Solana Documentation](https://docs.solana.com/)
- [Metaplex Documentation](https://www.metaplex.com/)

---

**Built with ❤️ by Senior Blockchain Engineers**
