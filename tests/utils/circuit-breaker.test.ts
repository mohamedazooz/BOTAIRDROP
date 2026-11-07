import { CircuitBreaker, CircuitBreakerState } from '../../src/utils/circuit-breaker';

describe('Circuit Breaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockFn: jest.Mock;

  beforeEach(() => {
    mockFn = jest.fn().mockResolvedValue('success');
    
    circuitBreaker = new CircuitBreaker(mockFn, {
      threshold: 3,
      resetTimeout: 1000,
      halfOpenAfter: 500,
    });
  });

  describe('Initialization', () => {
    it('should initialize in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should initialize with default threshold', () => {
      const defaultBreaker = new CircuitBreaker(mockFn);
      expect(defaultBreaker.getThreshold()).toBe(5);
    });

    it('should initialize with custom threshold', () => {
      expect(circuitBreaker.getThreshold()).toBe(3);
    });

    it('should initialize with custom reset timeout', () => {
      expect(circuitBreaker.getResetTimeout()).toBe(1000);
    });

    it('should initialize with custom half-open timeout', () => {
      expect(circuitBreaker.getHalfOpenAfter()).toBe(500);
    });
  });

  describe('State Transitions', () => {
    it('should transition to OPEN after threshold failures', async () => {
      mockFn.mockRejectedValueOnce(new Error('Failure 1'));
      mockFn.mockRejectedValueOnce(new Error('Failure 2'));
      mockFn.mockRejectedValueOnce(new Error('Failure 3'));

      await circuitBreaker.execute();
      await circuitBreaker.execute();
      await circuitBreaker.execute();

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should stay in OPEN state after threshold reached', async () => {
      mockFn.mockRejectedValue(new Error('Failure'));

      // First 3 calls to reach threshold
      await circuitBreaker.execute();
      await circuitBreaker.execute();
      await circuitBreaker.execute();

      // Additional call should still be OPEN
      await circuitBreaker.execute();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      jest.useFakeTimers();

      mockFn.mockRejectedValue(new Error('Failure'));

      // Reach threshold
      await circuitBreaker.execute();
      await circuitBreaker.execute();
      await circuitBreaker.execute();

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Advance time past halfOpenAfter
      jest.advanceTimersByTime(600);

      // Check state (should be HALF_OPEN)
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      jest.useRealTimers();
    });

    it('should transition back to CLOSED on success in HALF_OPEN', async () => {
      jest.useFakeTimers();

      mockFn.mockRejectedValue(new Error('Failure'));

      // Reach threshold
      await circuitBreaker.execute();
      await circuitBreaker.execute();
      await circuitBreaker.execute();

      // Advance to HALF_OPEN
      jest.advanceTimersByTime(600);

      // Reset mock to succeed
      mockFn.mockResolvedValueOnce('success');

      // Execute successfully
      await circuitBreaker.execute();

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);

      jest.useRealTimers();
    });

    it('should transition back to OPEN on failure in HALF_OPEN', async () => {
      jest.useFakeTimers();

      mockFn.mockRejectedValue(new Error('Failure'));

      // Reach threshold
      await circuitBreaker.execute();
      await circuitBreaker.execute();
      await circuitBreaker.execute();

      // Advance to HALF_OPEN
      jest.advanceTimersByTime(600);

      // Execute and fail
      await circuitBreaker.execute();

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      jest.useRealTimers();
    });

    it('should reset to CLOSED after full timeout', async () => {
      jest.useFakeTimers();

      mockFn.mockRejectedValue(new Error('Failure'));

      // Reach threshold
      await circuitBreaker.execute();
      await circuitBreaker.execute();
      await circuitBreaker.execute();

      // Advance past reset timeout
      jest.advanceTimersByTime(1100);

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);

      jest.useRealTimers();
    });
  });

  describe('Execution', () => {
    it('should execute function in CLOSED state', async () => {
      const result = await circuitBreaker.execute();
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
    });

    it('should throw error in OPEN state', async () => {
      mockFn.mockRejectedValue(new Error('Failure'));

      // Reach threshold
      await circuitBreaker.execute();
      await circuitBreaker.execute();
      await circuitBreaker.execute();

      await expect(circuitBreaker.execute()).rejects.toThrow(
        'Circuit breaker is OPEN'
      );
    });

    it('should execute function in HALF_OPEN state', async () => {
      jest.useFakeTimers();

      mockFn.mockRejectedValue(new Error('Failure'));

      // Reach threshold
      await circuitBreaker.execute();
      await circuitBreaker.execute();
      await circuitBreaker.execute();

      // Advance to HALF_OPEN
      jest.advanceTimersByTime(600);

      // Reset mock to succeed
      mockFn.mockResolvedValueOnce('success');

      // Execute in HALF_OPEN
      const result = await circuitBreaker.execute();
      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should pass arguments to function', async () => {
      const testFn = jest.fn().mockResolvedValue('result');
      const breaker = new CircuitBreaker(testFn);

      await breaker.execute('arg1', 'arg2', 123);
      expect(testFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should handle async functions', async () => {
      const asyncFn = jest.fn().mockResolvedValue('async result');
      const breaker = new CircuitBreaker(asyncFn);

      const result = await breaker.execute();
      expect(result).toBe('async result');
    });

    it('should handle function that returns promise', async () => {
      const promiseFn = jest.fn().mockReturnValue(Promise.resolve('promise result'));
      const breaker = new CircuitBreaker(promiseFn);

      const result = await breaker.execute();
      expect(result).toBe('promise result');
    });
  });

  describe('Statistics', () => {
    it('should track success count', async () => {
      expect(circuitBreaker.getSuccessCount()).toBe(0);

      await circuitBreaker.execute();
      expect(circuitBreaker.getSuccessCount()).toBe(1);

      await circuitBreaker.execute();
      expect(circuitBreaker.getSuccessCount()).toBe(2);
    });

    it('should track failure count', async () => {
      mockFn.mockRejectedValueOnce(new Error('Failure'));

      expect(circuitBreaker.getFailureCount()).toBe(0);

      await expect(circuitBreaker.execute()).rejects.toThrow();
      expect(circuitBreaker.getFailureCount()).toBe(1);
    });

    it('should reset counts on state reset', async () => {
      mockFn.mockRejectedValueOnce(new Error('Failure'));

      await expect(circuitBreaker.execute()).rejects.toThrow();
      expect(circuitBreaker.getFailureCount()).toBe(1);

      circuitBreaker.reset();
      expect(circuitBreaker.getFailureCount()).toBe(0);
      expect(circuitBreaker.getSuccessCount()).toBe(0);
    });

    it('should return total execution count', async () => {
      expect(circuitBreaker.getTotalExecutions()).toBe(0);

      await circuitBreaker.execute();
      await circuitBreaker.execute();

      expect(circuitBreaker.getTotalExecutions()).toBe(2);
    });
  });

  describe('Configuration Updates', () => {
    it('should update threshold', () => {
      circuitBreaker.setThreshold(5);
      expect(circuitBreaker.getThreshold()).toBe(5);
    });

    it('should update reset timeout', () => {
      circuitBreaker.setResetTimeout(2000);
      expect(circuitBreaker.getResetTimeout()).toBe(2000);
    });

    it('should update half-open timeout', () => {
      circuitBreaker.setHalfOpenAfter(1000);
      expect(circuitBreaker.getHalfOpenAfter()).toBe(1000);
    });

    it('should reset to initial state', () => {
      mockFn.mockRejectedValue(new Error('Failure'));

      // Reach threshold
      await circuitBreaker.execute();
      await circuitBreaker.execute();
      await circuitBreaker.execute();

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      circuitBreaker.reset();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Event Listeners', () => {
    it('should emit state change event', async () => {
      const callback = jest.fn();
      circuitBreaker.onStateChange(callback);

      mockFn.mockRejectedValue(new Error('Failure'));

      await circuitBreaker.execute();
      await circuitBreaker.execute();
      await circuitBreaker.execute();

      expect(callback).toHaveBeenCalledWith(
        CircuitBreakerState.OPEN,
        CircuitBreakerState.CLOSED
      );
    });

    it('should emit success event', async () => {
      const callback = jest.fn();
      circuitBreaker.onSuccess(callback);

      await circuitBreaker.execute();

      expect(callback).toHaveBeenCalledWith('success');
    });

    it('should emit failure event', async () => {
      const callback = jest.fn();
      circuitBreaker.onFailure(callback);

      mockFn.mockRejectedValueOnce(new Error('Failure'));

      await expect(circuitBreaker.execute()).rejects.toThrow();

      expect(callback).toHaveBeenCalledWith(new Error('Failure'));
    });

    it('should emit reset event', async () => {
      const callback = jest.fn();
      circuitBreaker.onReset(callback);

      circuitBreaker.reset();

      expect(callback).toHaveBeenCalled();
    });

    it('should allow removing event listeners', async () => {
      const callback = jest.fn();
      circuitBreaker.onSuccess(callback);

      circuitBreaker.removeListener('success', callback);

      await circuitBreaker.execute();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Static Factory Methods', () => {
    it('should create circuit breaker with default config', () => {
      const breaker = CircuitBreaker.create(mockFn);
      expect(breaker.getThreshold()).toBe(5);
      expect(breaker.getResetTimeout()).toBe(30000);
      expect(breaker.getHalfOpenAfter()).toBe(15000);
    });

    it('should create circuit breaker for async operations', () => {
      const breaker = CircuitBreaker.forAsync(mockFn);
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });

    it('should create circuit breaker for RPC calls', () => {
      const breaker = CircuitBreaker.forRPC(mockFn, { threshold: 10 });
      expect(breaker.getThreshold()).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle function that throws synchronously', async () => {
      const syncFn = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      
      const breaker = new CircuitBreaker(syncFn);

      await expect(breaker.execute()).rejects.toThrow('Sync error');
    });

    it('should handle threshold of 1', async () => {
      const breaker = new CircuitBreaker(mockFn, { threshold: 1 });

      mockFn.mockRejectedValueOnce(new Error('Failure'));

      await expect(breaker.execute()).rejects.toThrow();
      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should handle zero threshold', async () => {
      const breaker = new CircuitBreaker(mockFn, { threshold: 0 });

      mockFn.mockRejectedValueOnce(new Error('Failure'));

      await expect(breaker.execute()).rejects.toThrow();
      // With threshold 0, should go to OPEN immediately on first failure
      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should handle very high threshold', async () => {
      const breaker = new CircuitBreaker(mockFn, { threshold: 1000 });

      for (let i = 0; i < 10; i++) {
        mockFn.mockRejectedValueOnce(new Error('Failure'));
        await expect(breaker.execute()).rejects.toThrow();
      }

      // Should still be CLOSED with high threshold
      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });
});
