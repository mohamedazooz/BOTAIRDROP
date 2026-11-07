// Jest setup file
import { configure } from '@testing-library/react';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.RPC_URL = 'https://api.devnet.solana.com';
process.env.JITO_RPC_URL = 'https://jito-rpc.com';
process.env.PROXY_ENABLED = 'false';
process.env.CAPTCHA_ENABLED = 'false';
process.env.LOG_LEVEL = 'silent';

// Configure testing library
configure({ testIdAttribute: 'data-testid' });

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console.error and console.warn during tests
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        waitFor: (condition: () => boolean, timeout?: number) => Promise<void>;
        delay: (ms: number) => Promise<void>;
      };
    }
  }
}

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range [${min}, ${max}]`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range [${min}, ${max}], but it was ${received}`,
        pass: false,
      };
    }
  },
});

// Test utilities
global.testUtils = {
  waitFor: async (condition: () => boolean, timeout = 5000) => {
    const startTime = Date.now();
    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  },
  delay: async (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
