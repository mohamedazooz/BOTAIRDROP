// ============================================
// BOTAIRDROP - Retry Utility
// Implements exponential backoff with jitter for failed operations
// ============================================

/**
 * Retry options interface
 */
export interface RetryOptions {
  maxRetries: number; // Maximum number of retry attempts
  baseDelay: number; // Base delay in ms
  maxDelay: number; // Maximum delay in ms
  jitterFactor: number; // Jitter factor (0-1)
  shouldRetry: (error: Error, attempt: number) => boolean; // Function to determine if should retry
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.3,
  shouldRetry: () => true, // Always retry by default
};

/**
 * Retry function with exponential backoff and jitter
 * @param fn Function to execute
 * @param options Retry options
 * @returns Promise with the function result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (attempt === opts.maxRetries || !opts.shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = calculateDelay(attempt, opts);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Calculates delay with exponential backoff and jitter
 * @param attempt Current attempt number
 * @param options Retry options
 * @returns Delay in ms
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = options.baseDelay * Math.pow(2, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);

  // Add jitter: ±jitterFactor * delay
  const jitter = (Math.random() * 2 - 1) * options.jitterFactor * cappedDelay;

  // Ensure delay is at least 0
  return Math.max(0, cappedDelay + jitter);
}

/**
 * Retry with custom delay calculation
 * @param fn Function to execute
 * @param delayCalculator Function to calculate delay
 * @param maxRetries Maximum number of retry attempts
 * @returns Promise with the function result
 */
export async function retryWithCustomDelay<T>(
  fn: () => Promise<T>,
  delayCalculator: (attempt: number) => number,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = delayCalculator(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Creates a retry wrapper for a function
 * @param fn Function to wrap
 * @param options Retry options
 * @returns Wrapped function with retry logic
 */
export function withRetry<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: Partial<RetryOptions> = {}
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    return retry(() => fn(...args), options);
  };
}

/**
 * Retry decorator for class methods
 * @param options Retry options
 * @returns Method decorator
 */
export function Retry(options: Partial<RetryOptions> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Common retry configurations
 */
export const RETRY_CONFIGS = {
  // For RPC calls
  rpc: {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    jitterFactor: 0.5,
    shouldRetry: (error: Error) => {
      // Retry on rate limit (429) or timeout
      return (
        error.message.includes('429') ||
        error.message.includes('timeout') ||
        error.message.includes('Rate limit')
      );
    },
  },

  // For transaction submissions
  transaction: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 15000,
    jitterFactor: 0.3,
    shouldRetry: (error: Error) => {
      // Retry on transaction errors
      return (
        error.message.includes('Transaction failed') ||
        error.message.includes('timeout') ||
        error.message.includes('retry')
      );
    },
  },

  // For CAPTCHA solving
  captcha: {
    maxRetries: 2,
    baseDelay: 3000,
    maxDelay: 10000,
    jitterFactor: 0.2,
    shouldRetry: () => true, // Always retry CAPTCHA
  },
};
