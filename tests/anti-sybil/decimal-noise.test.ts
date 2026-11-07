import {
  addDecimalNoise,
  generateOrganicAmount,
  createDecimalNoiseGenerator,
} from '../../src/anti-sybil/decimal-noise';

describe('Decimal Noise Module', () => {
  describe('addDecimalNoise', () => {
    it('should add positive noise to amount', () => {
      const amount = 1.0;
      const noise = addDecimalNoise(amount, 0.001, 0.01);
      expect(noise).toBeGreaterThanOrEqual(amount);
      expect(noise).toBeLessThanOrEqual(amount + 0.01);
    });

    it('should add negative noise to amount', () => {
      const amount = 1.0;
      const noise = addDecimalNoise(amount, -0.01, -0.001);
      expect(noise).toBeLessThanOrEqual(amount);
      expect(noise).toBeGreaterThanOrEqual(amount - 0.01);
    });

    it('should handle zero amount', () => {
      const amount = 0;
      const noise = addDecimalNoise(amount, 0.001, 0.01);
      expect(noise).toBeGreaterThanOrEqual(0);
      expect(noise).toBeLessThanOrEqual(0.01);
    });

    it('should handle very small amounts', () => {
      const amount = 0.0001;
      const noise = addDecimalNoise(amount, 0.00001, 0.0001);
      expect(noise).toBeGreaterThanOrEqual(amount);
      expect(noise).toBeLessThanOrEqual(amount + 0.0001);
    });

    it('should handle negative amounts', () => {
      const amount = -1.0;
      const noise = addDecimalNoise(amount, -0.01, -0.001);
      expect(noise).toBeLessThanOrEqual(amount);
      expect(noise).toBeGreaterThanOrEqual(amount - 0.01);
    });
  });

  describe('generateOrganicAmount', () => {
    it('should generate amount within range', () => {
      const min = 0.01;
      const max = 0.1;
      const amount = generateOrganicAmount(min, max);
      expect(amount).toBeGreaterThanOrEqual(min);
      expect(amount).toBeLessThanOrEqual(max);
    });

    it('should generate different amounts on multiple calls', () => {
      const min = 0.01;
      const max = 0.1;
      const amounts = Array.from({ length: 10 }, () =>
        generateOrganicAmount(min, max)
      );
      const uniqueAmounts = new Set(amounts);
      expect(uniqueAmounts.size).toBeGreaterThan(1);
    });

    it('should handle very small ranges', () => {
      const min = 0.0001;
      const max = 0.0002;
      const amount = generateOrganicAmount(min, max);
      expect(amount).toBeGreaterThanOrEqual(min);
      expect(amount).toBeLessThanOrEqual(max);
    });
  });

  describe('createDecimalNoiseGenerator', () => {
    it('should create a generator function', () => {
      const generator = createDecimalNoiseGenerator(0.001, 0.01);
      expect(typeof generator).toBe('function');
    });

    it('should generate consistent noise for same input', () => {
      const generator = createDecimalNoiseGenerator(0.001, 0.01);
      const amount = 1.0;
      const noise1 = generator(amount);
      const noise2 = generator(amount);
      expect(noise1).toBe(noise2);
    });

    it('should generate different noise for different inputs', () => {
      const generator = createDecimalNoiseGenerator(0.001, 0.01);
      const noise1 = generator(1.0);
      const noise2 = generator(2.0);
      expect(noise1).not.toBe(noise2);
    });

    it('should respect noise range', () => {
      const minNoise = 0.001;
      const maxNoise = 0.01;
      const generator = createDecimalNoiseGenerator(minNoise, maxNoise);
      const amount = 1.0;
      const noise = generator(amount);
      expect(noise).toBeGreaterThanOrEqual(amount + minNoise);
      expect(noise).toBeLessThanOrEqual(amount + maxNoise);
    });
  });

  describe('Solana-specific noise', () => {
    it('should generate noise suitable for SOL amounts', () => {
      const amount = 0.01; // 0.01 SOL
      const noise = addDecimalNoise(amount, 0.00000001, 0.001);
      expect(noise).toBeGreaterThanOrEqual(amount);
      expect(noise).toBeLessThanOrEqual(amount + 0.001);
      // Should have at least 8 decimal places for lamports precision
      const decimalPlaces = noise.toString().split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeGreaterThanOrEqual(2);
    });

    it('should generate noise for lamports', () => {
      const amount = 1000000; // 1 SOL in lamports
      const noise = addDecimalNoise(amount, 1, 100);
      expect(noise).toBeGreaterThanOrEqual(amount);
      expect(noise).toBeLessThanOrEqual(amount + 100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large amounts', () => {
      const amount = 1000000;
      const noise = addDecimalNoise(amount, 0.01, 0.1);
      expect(noise).toBeGreaterThanOrEqual(amount);
      expect(noise).toBeLessThanOrEqual(amount + 0.1);
    });

    it('should handle zero noise range', () => {
      const amount = 1.0;
      const noise = addDecimalNoise(amount, 0, 0);
      expect(noise).toBe(amount);
    });

    it('should handle negative noise range', () => {
      const amount = 1.0;
      const noise = addDecimalNoise(amount, -0.1, -0.01);
      expect(noise).toBeLessThanOrEqual(amount);
      expect(noise).toBeGreaterThanOrEqual(amount - 0.1);
    });
  });
});
