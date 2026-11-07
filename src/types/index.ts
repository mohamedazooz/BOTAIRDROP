// ============================================
// BOTAIRDROP - Core Types
// ============================================

/**
 * Wallet Configuration Interface
 * Defines the structure for wallet configuration
 */
export interface WalletConfig {
  id: string;
  publicKey: string;
  secretKey: number[];
  proxyId: string;
  behavior: BehaviorConfig;
  userAgent: string;
  fingerprint?: BrowserFingerprint;
}

/**
 * Behavior Configuration Interface
 * Defines behavioral patterns for anti-Sybil
 */
export interface BehaviorConfig {
  meanDelay: number; // ms
  stdDev: number; // ms
  minDelay: number; // ms
  maxDelay: number; // ms
  path: string[]; // Transaction path (e.g., ['Jupiter', 'Raydium', 'Meteora'])
  decimalNoiseRange: [number, number]; // [min, max] noise
}

/**
 * Browser Fingerprint Interface
 * Defines browser fingerprint properties for stealth
 */
export interface BrowserFingerprint {
  canvas: string;
  webgl: string;
  audioContext: string;
  webrtc: string;
  tls: string;
  ja3: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
}

/**
 * Proxy Configuration Interface
 * Defines proxy server configuration
 */
export interface ProxyConfig {
  id: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'residential' | 'datacenter' | 'mobile';
  location: string;
  userAgent: string;
  fingerprint?: BrowserFingerprint;
}

/**
 * RPC Endpoint Configuration Interface
 */
export interface RpcConfig {
  id: string;
  url: string;
  priority: number;
  apiKey?: string;
}

/**
 * Transaction Result Interface
 */
export interface TransactionResult {
  txId: string;
  success: boolean;
  error?: string;
  timestamp: number;
  walletId: string;
  program: string;
  action: string;
}

/**
 * Candy Machine Configuration Interface
 */
export interface CandyMachineConfig {
  id: string;
  address: string;
  authority: string;
  price: number;
  sellerFeeBasisPoints: number;
  itemsAvailable: number;
  goLiveDate?: number;
  whitelistMintSettings?: WhitelistMintSettings;
}

/**
 * Whitelist Mint Settings Interface
 */
export interface WhitelistMintSettings {
  discountPrice?: number;
  addresses: string[];
}

/**
 * Jito Bundle Configuration Interface
 */
export interface JitoBundleConfig {
  transactions: string[]; // Base64 encoded transactions
  tipLamports: number; // Tip amount in lamports
  tipAccount: string; // Jito tip account address
}

/**
 * Circuit Breaker Configuration Interface
 */
export interface CircuitBreakerConfig {
  threshold: number; // Number of failures before opening
  resetTimeout: number; // Time in ms before trying again
  halfOpenAfter: number; // Time in ms before trying half-open state
}

/**
 * Path Polymorphism Configuration Interface
 */
export interface PathConfig {
  name: string;
  steps: TransactionStep[];
}

/**
 * Transaction Step Interface
 */
export interface TransactionStep {
  program: string;
  action: string;
  parameters: Record<string, any>;
}

/**
 * Decimal Noise Configuration Interface
 */
export interface DecimalNoiseConfig {
  min: number;
  max: number;
  precision: number;
}

/**
 * Timing Configuration Interface
 */
export interface TimingConfig {
  distribution: 'poisson' | 'gaussian' | 'exponential';
  mean: number;
  stdDev?: number;
  lambda?: number;
}

/**
 * CAPTCHA Configuration Interface
 */
export interface CaptchaConfig {
  provider: '2captcha' | 'capsolver' | 'anti-captcha';
  apiKey: string;
  sitekey: string;
  pageUrl: string;
  type: 'hCaptcha' | 'reCAPTCHA' | 'turnstile' | 'funcaptcha';
}

/**
 * Agent Type Enum
 */
export type AgentType = 'wallet' | 'sniper' | 'farmer' | 'stealth';

/**
 * Agent Status Enum
 */
export type AgentStatus = 'created' | 'initialized' | 'ready' | 'executing' | 'completed' | 'failed' | 'retrying' | 'terminated';

/**
 * Network Type Enum
 */
export type NetworkType = 'mainnet-beta' | 'devnet' | 'testnet' | 'local';

/**
 * Transaction Status Enum
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'timeout';

// ============================================
// Export all types
// ============================================
export type {
  WalletConfig as IWalletConfig,
  BehaviorConfig as IBehaviorConfig,
  BrowserFingerprint as IBrowserFingerprint,
  ProxyConfig as IProxyConfig,
  RpcConfig as IRpcConfig,
  TransactionResult as ITransactionResult,
  CandyMachineConfig as ICandyMachineConfig,
  WhitelistMintSettings as IWhitelistMintSettings,
  JitoBundleConfig as IJitoBundleConfig,
  CircuitBreakerConfig as ICircuitBreakerConfig,
  PathConfig as IPathConfig,
  TransactionStep as ITransactionStep,
  DecimalNoiseConfig as IDecimalNoiseConfig,
  TimingConfig as ITimingConfig,
  CaptchaConfig as ICaptchaConfig,
};
