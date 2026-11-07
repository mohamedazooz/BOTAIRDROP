import {
  retry,
  retryWithBackoff,
  createRetryDecorator,
  RetryConfig,
} from '../../src/utils/retry';

describe('Retry Module', () => {
  describe('retry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retry(fn, 3);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      const result = await retry(fn, 3);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(retry(fn, 3)).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should pass arguments to function', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      await retry(fn, 3, 'arg1', 'arg2', 123);
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should use custom delay', async () => {
      jest.useFakeTimers();

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success');

      const promise = retry(fn, 2, undefined, 100);

      // Advance time by delay
      jest.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should use custom shouldRetry function', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Retryable'))
        .mockResolvedValueOnce('success');

      const shouldRetry = (error: Error) => {
        return error.message === 'Retryable';
      };

      const result = await retry(fn, 3, undefined, undefined, shouldRetry);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Non-retryable'));

      const shouldRetry = (error: Error) => {
        return error.message === 'Retryable';
      };

      await expect(retry(fn, 3, undefined, undefined, shouldRetry)).rejects.toThrow(
        'Non-retryable'
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryWithBackoff', () => {
    it('should use exponential backoff', async () => {
      jest.useFakeTimers();

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitter: false,
      });

      // First retry after 100ms
      jest.advanceTimersByTime(100);
      // Second retry after 200ms
      jest.advanceTimersByTime(200);

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('should apply jitter to delay', async () => {
      jest.useFakeTimers();

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitter: true,
      });

      // With jitter, delay will be between 50-150ms
      jest.advanceTimersByTime(150);

      const result = await promise;
      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should respect max delay', async () => {
      jest.useFakeTimers();

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 200,
        backoffMultiplier: 10,
        jitter: false,
      });

      // First retry after 100ms
      jest.advanceTimersByTime(100);
      // Second retry after 200ms (capped at maxDelay)
      jest.advanceTimersByTime(200);

      const result = await promise;
      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 3,
          initialDelay: 10,
          maxDelay: 100,
          backoffMultiplier: 2,
        })
      ).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use custom shouldRetry function', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Retryable'))
        .mockResolvedValueOnce('success');

      const shouldRetry = (error: Error) => {
        return error.message === 'Retryable';
      };

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
        shouldRetry,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to function', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
      }, 'arg1', 'arg2');

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('createRetryDecorator', () => {
    it('should create a decorator function', () => {
      const config: RetryConfig = {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitter: false,
      };

      const decorator = createRetryDecorator(config);
      expect(typeof decorator).toBe('function');
    });

    it('should wrap function with retry logic', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success');

      const config: RetryConfig = {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      };

      const decorated = createRetryDecorator(config)(fn);
      const result = await decorated();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle async functions', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('async success');

      const config: RetryConfig = {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      };

      const decorated = createRetryDecorator(config)(fn);
      const result = await decorated();

      expect(result).toBe('async success');
    });

    it('should pass through function name', () => {
      const fn = jest.fn().mockResolvedValue('success');
      (fn as any).name = 'myFunction';

      const config: RetryConfig = {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      };

      const decorated = createRetryDecorator(config)(fn);
      expect((decorated as any).name).toBe('myFunction');
    });

    it('should preserve function context', async () => {
      const context = { value: 42 };
      const fn = jest.fn().mockImplementation(function (this: any) {
        return this.value;
      });

      const config: RetryConfig = {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      };

      const decorated = createRetryDecorator(config)(fn);
      const result = await decorated.call(context);

      expect(result).toBe(42);
    });
  });

  describe('Default Config', () => {
    it('should use default maxRetries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        retryWithBackoff(fn, {})
      ).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(5); // Default is 5
    });

    it('should use default initialDelay', async () => {
      jest.useFakeTimers();

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, { maxRetries: 2 });

      // Default initialDelay is 1000ms
      jest.advanceTimersByTime(1000);

      const result = await promise;
      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should use default maxDelay', async () => {
      jest.useFakeTimers();

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 10,
      });

      // First retry after 100ms
      jest.advanceTimersByTime(100);
      // Second retry after 1000ms (capped at default maxDelay of 30000ms)
      jest.advanceTimersByTime(1000);

      const result = await promise;
      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should use default backoffMultiplier', async () => {
      jest.useFakeTimers();

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 100,
      });

      // First retry after 100ms
      jest.advanceTimersByTime(100);
      // Second retry after 200ms (100 * 2)
      jest.advanceTimersByTime(200);

      const result = await promise;
      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should use default jitter', async () => {
      jest.useFakeTimers();

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelay: 100,
      });

      // With default jitter=true, delay will be between 50-150ms
      jest.advanceTimersByTime(150);

      const result = await promise;
      expect(result).toBe('success');

      jest.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle function that succeeds immediately', async () => {
      const fn = jest.fn().mockResolvedValue('immediate success');
      const result = await retry(fn, 3);
      expect(result).toBe('immediate success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle maxRetries of 0', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Failure'));

      await expect(retry(fn, 0)).rejects.toThrow('Failure');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle maxRetries of 1', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Failure'));

      await expect(retry(fn, 1)).rejects.toThrow('Failure');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle negative maxRetries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Failure'));

      await expect(retry(fn, -1)).rejects.toThrow('Failure');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle function that throws different errors', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockResolvedValueOnce('success');

      const result = await retry(fn, 4);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should handle shouldRetry returning false', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Failure'));

      const shouldRetry = () => false;

      await expect(retry(fn, 3, undefined, undefined, shouldRetry)).rejects.toThrow(
        'Failure'
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle shouldRetry throwing error', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Failure'));

      const shouldRetry = () => {
        throw new Error('Should retry error');
      };

      await expect(retry(fn, 3, undefined, undefined, shouldRetry)).rejects.toThrow(
        'Should retry error'
      );
    });
  });
});
