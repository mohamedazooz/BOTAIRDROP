// ============================================
// BOTAIRDROP - Circuit Breaker Pattern
// Implements fault tolerance for RPC and API calls
// ============================================

/**
 * Circuit Breaker States
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit Breaker Options
 */
export interface CircuitBreakerOptions {
  threshold: number; // Number of failures before opening
  resetTimeout: number; // Time in ms before trying again
  halfOpenAfter: number; // Time in ms before trying half-open state
}

/**
 * CircuitBreaker class
 * Implements the Circuit Breaker pattern for fault tolerance
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private options: CircuitBreakerOptions;
  private halfOpenPromise: Promise<boolean> | null = null;

  /**
   * Creates a new CircuitBreaker instance
   * @param options Circuit breaker options
   */
  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      threshold: 5,
      resetTimeout: 30000,
      halfOpenAfter: 10000,
      ...options,
    };
  }

  /**
   * Gets the current state
   * @returns Current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Gets the failure count
   * @returns Number of failures
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Executes a function with circuit breaker protection
   * @param fn Function to execute
   * @returns Promise with the function result
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    switch (this.state) {
      case 'CLOSED':
        return this.executeClosed(fn);
      case 'OPEN':
        return this.executeOpen(fn);
      case 'HALF_OPEN':
        return this.executeHalfOpen(fn);
      default:
        throw new Error(`Unknown circuit state: ${this.state}`);
    }
  }

  /**
   * Executes function when circuit is closed
   * @param fn Function to execute
   * @returns Promise with the function result
   */
  private async executeClosed<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.failureCount = 0; // Reset failure count on success
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.options.threshold) {
        this.trip();
      }

      throw error;
    }
  }

  /**
   * Executes function when circuit is open
   * @param fn Function to execute
   * @returns Promise with the function result
   */
  private async executeOpen<T>(fn: () => Promise<T>): Promise<T> {
    const timeSinceFailure = Date.now() - this.lastFailureTime;

    if (timeSinceFailure > this.options.resetTimeout) {
      this.state = 'HALF_OPEN';
      return this.executeHalfOpen(fn);
    }

    throw new Error(
      `Circuit breaker is open. Retry after ${this.options.resetTimeout - timeSinceFailure}ms`
    );
  }

  /**
   * Executes function when circuit is half-open
   * @param fn Function to execute
   * @returns Promise with the function result
   */
  private async executeHalfOpen<T>(fn: () => Promise<T>): Promise<T> {
    if (this.halfOpenPromise) {
      const canProceed = await this.halfOpenPromise;
      if (!canProceed) {
        throw new Error('Circuit breaker is half-open and another request is in progress');
      }
    }

    this.halfOpenPromise = new Promise(async (resolve) => {
      try {
        const result = await fn();
        this.reset();
        resolve(true);
        return result;
      } catch (error) {
        this.trip();
        resolve(false);
        throw error;
      }
    });

    return this.halfOpenPromise.then(() => {
      this.halfOpenPromise = null;
      return this.executeHalfOpen(fn);
    });
  }

  /**
   * Trips the circuit breaker (opens it)
   */
  private trip(): void {
    this.state = 'OPEN';
    this.failureCount = 0;
  }

  /**
   * Resets the circuit breaker (closes it)
   */
  private reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenPromise = null;
  }

  /**
   * Forces the circuit to close
   */
  forceClose(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenPromise = null;
  }

  /**
   * Forces the circuit to open
   */
  forceOpen(): void {
    this.state = 'OPEN';
    this.failureCount = 0;
    this.halfOpenPromise = null;
  }

  /**
   * Resets the failure count
   */
  resetFailureCount(): void {
    this.failureCount = 0;
  }

  /**
   * Checks if the circuit is currently allowing requests
   * @returns Boolean indicating if requests are allowed
   */
  allowsRequest(): boolean {
    return this.state === 'CLOSED' || this.state === 'HALF_OPEN';
  }

  /**
   * Gets the time until the circuit will try again
   * @returns Time in ms until retry, or 0 if circuit is closed
   */
  getTimeUntilRetry(): number {
    if (this.state !== 'OPEN') {
      return 0;
    }

    const timeSinceFailure = Date.now() - this.lastFailureTime;
    const timeLeft = this.options.resetTimeout - timeSinceFailure;
    return Math.max(0, timeLeft);
  }
}

/**
 * Creates a circuit breaker with default options
 * @returns CircuitBreaker instance
 */
export function createDefaultCircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker({
    threshold: 5,
    resetTimeout: 30000,
    halfOpenAfter: 10000,
  });
}
