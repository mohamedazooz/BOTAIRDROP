# ARCHITECTURE
## BOTAIRDROP - Complete System Architecture

## Overview
BOTAIRDROP is a Modular, Scalable, Fault-Tolerant system for managing 100+ Solana wallets for Airdrop Farming, Auto NFT Sniping, and Stealth Operations.

## System Architecture Diagram

```
BOTAIRDROP SYSTEM
├── Presentation Layer (CLI/Web/API)
├── Application Layer (Agent Fleet, Task Dispatcher)
├── Business Logic Layer (Wallet, Network, Behavior, Sniper, Farmer, Stealth)
├── Data Layer (SQLite/PostgreSQL, Redis, Encryption)
└── Integration Layer (Solana RPC, Proxies, CAPTCHA APIs)
```

## Architecture Layers

### Layer 1: Presentation Layer
- CLI: Node.js, Commander.js, Inquirer.js
- Web: React, Next.js (Optional)
- API: Express.js, Fastify (Optional)

### Layer 2: Application Layer
- Agent Fleet Manager: Coordinates all agents
- Task Dispatcher: Distributes tasks
- Resource Manager: Manages resources
- Error Handler: Handles errors

### Layer 3: Business Logic Layer
**Services:**
- Wallet Service: Keypair management, balance tracking, transaction signing
- Network Service: Proxy management, RPC rotation, connection pooling
- Behavior Service: Path polymorphism, human timing, decimal noise
- Sniper Service: Candy machine monitoring, Jito bundles, priority fees
- Farmer Service: Airdrop farming, transaction building, footprint generation
- Stealth Service: CAPTCHA solving, browser fingerprinting

### Layer 4: Data Layer
- Database: SQLite (local), PostgreSQL (server)
- Cache: Redis
- Storage: Local files, S3 (optional)
- Encryption: AES-256-GCM

### Layer 5: Integration Layer
- Solana: @solana/web3.js, @metaplex-foundation/metaplex
- Proxies: https-proxy-agent
- CAPTCHA: 2captcha, capsolver

## Module Structure

```
BOTAIRDROP/
├── src/
│   ├── core/
│   │   ├── agent-fleet.ts
│   │   ├── wallet-manager.ts
│   │   ├── network-manager.ts
│   │   ├── behavior-engine.ts
│   │   └── task-dispatcher.ts
│   ├── sniper/
│   │   ├── candy-machine.ts
│   │   ├── jito-bundle.ts
│   │   └── sniper-agent.ts
│   ├── anti-sybil/
│   │   ├── path-polymorphism.ts
│   │   ├── decimal-noise.ts
│   │   └── human-timing.ts
│   ├── captcha/
│   │   ├── solver.ts
│   │   ├── turnstile.ts
│   │   └── recaptcha.ts
│   ├── airdrop/
│   │   ├── transaction-builder.ts
│   │   ├── dapp-interactions.ts
│   │   └── farmer-agent.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── circuit-breaker.ts
│   │   └── encryption.ts
│   ├── config/
│   │   ├── wallets.json
│   │   ├── proxies.json
│   │   └── settings.json
│   └── types/
│       └── index.ts
├── docs/
├── tests/
├── scripts/
├── package.json
├── tsconfig.json
└── README.md
```

## Network Architecture

### Proxy Architecture
- 1:1 Static Residential Proxy Binding
- Each wallet has its own unique Proxy
- Each Proxy has its own User-Agent and Browser Fingerprint

### RPC Architecture
- Primary RPC: QuickNode
- Secondary RPC: Alchemy
- Jito RPC: Jito Labs
- Connection Pool: Load balancing, automatic failover

## Security Architecture

### Encryption Architecture
- At Rest: AES-256-GCM (SQLite)
- In Transit: TLS 1.3 (HTTPS)
- In Memory: AES-256-GCM (Ephemeral keys)

### Access Control
- Zero-Trust Model
- Principle of Least Privilege
- Temporary Credentials
- Micro-Segmentation

## Data Flow Architecture

### Transaction Flow
1. Task Creation (Task Dispatcher)
2. Task Assignment (Agent Fleet)
3. Behavior Application (Behavior Engine)
4. Transaction Building (Transaction Builder)
5. Transaction Signing (Wallet Agent)
6. Transaction Submission (Network Agent)
7. Transaction Confirmation (Solana Network)
8. Result Logging (Logger)

### Error Flow
1. Error Detection (Agent/Task)
2. Error Logging (Logger)
3. Circuit Breaker Check (Circuit Breaker)
4. Decision Making (Is Circuit Open?)
   - Yes: Wait & Retry Later
   - No: Retry with Exponential Backoff + Jitter

## Design Principles

### SOLID Principles
- Single Responsibility
- Open/Closed
- Liskov Substitution
- Interface Segregation
- Dependency Inversion

### Clean Architecture Principles
- Separation of Concerns
- Dependency Rule
- Interface Adapters
- Frameworks & Drivers

### Blockchain-Specific Principles
- Decentralization
- Immutability
- Transparency
- Security

## Deployment Architecture

### Development Deployment
- Local Machine: Node.js, TypeScript, SQLite
- Network: Solana Devnet/Testnet
- Proxies: Test Proxies (Optional)
- CAPTCHA: Mock CAPTCHA (Optional)

### Production Deployment
- Cloud Provider: Hetzner, DigitalOcean, AWS
- Containerization: Docker, Docker Compose
- Load Balancing: Nginx, HAProxy
- Monitoring: Prometheus, Grafana, Alertmanager
- Database: PostgreSQL
- Network: Solana Mainnet RPC, Residential Proxies, CAPTCHA API

## Scalability Considerations

### Horizontal Scaling
- Add More Agents
- Add More Proxies
- Add More RPC Endpoints
- Load Balancing

### Vertical Scaling
- Upgrade Hardware
- Increase Memory
- Increase CPU
- Increase Storage

### Microservices Architecture
- Agent Service
- Task Service
- Network Service
- Monitoring Service

## Technology Stack

### Core Technologies
- Node.js 18+
- TypeScript 5+
- Solana Web3.js
- Metaplex

### Network Technologies
- https-proxy-agent
- axios
- WebSocket

### Database Technologies
- SQLite
- PostgreSQL
- Redis

### DevOps Technologies
- Docker
- Docker Compose
- GitHub Actions
- Prometheus
- Grafana

## Conclusion
BOTAIRDROP Architecture is a Modular, Scalable, Fault-Tolerant, Secure design for managing 100+ Solana wallets. The architecture is based on Multi-Agent System, Clean Architecture, SOLID Principles, and Blockchain Best Practices.
