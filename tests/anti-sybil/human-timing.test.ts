import {
  gaussianDelay,
  poissonDelay,
  exponentialDelay,
  createHumanTimingGenerator,
  TimeProfile,
} from '../../src/anti-sybil/human-timing';

describe('Human Timing Module', () => {
  describe('Gaussian Distribution', () => {
    it('should generate delays around mean', async () => {
      const mean = 5000;
      const stdDev = 1000;
      const delays = [];
      
      for (let i = 0; i < 100; i++) {
        const delay = await gaussianDelay(mean, stdDev);
        delays.push(delay);
      }
      
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      expect(avgDelay).toBeCloseTo(mean, -2);
    });

    it('should respect min and max bounds', async () => {
      const mean = 5000;
      const stdDev = 1000;
      const min = 3000;
      const max = 7000;
      
      for (let i = 0; i < 10; i++) {
        const delay = await gaussianDelay(mean, stdDev, min, max);
        expect(delay).toBeGreaterThanOrEqual(min);
        expect(delay).toBeLessThanOrEqual(max);
      }
    });

    it('should generate positive delays', async () => {
      const mean = 5000;
      const stdDev = 1000;
      const delay = await gaussianDelay(mean, stdDev);
      expect(delay).toBeGreaterThan(0);
    });
  });

  describe('Poisson Distribution', () => {
    it('should generate positive delays', async () => {
      const lambda = 10;
      const delay = await poissonDelay(lambda);
      expect(delay).toBeGreaterThanOrEqual(0);
    });

    it('should generate delays with correct mean', async () => {
      const lambda = 10;
      const delays = [];
      
      for (let i = 0; i < 100; i++) {
        const delay = await poissonDelay(lambda);
        delays.push(delay);
      }
      
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      expect(avgDelay).toBeCloseTo(lambda * 1000, -1);
    });

    it('should respect min and max bounds', async () => {
      const lambda = 10;
      const min = 5000;
      const max = 15000;
      
      for (let i = 0; i < 10; i++) {
        const delay = await poissonDelay(lambda, min, max);
        expect(delay).toBeGreaterThanOrEqual(min);
        expect(delay).toBeLessThanOrEqual(max);
      }
    });
  });

  describe('Exponential Distribution', () => {
    it('should generate positive delays', async () => {
      const lambda = 0.1;
      const delay = await exponentialDelay(lambda);
      expect(delay).toBeGreaterThanOrEqual(0);
    });

    it('should generate delays with correct mean', async () => {
      const lambda = 0.1;
      const expectedMean = 1 / lambda * 1000;
      const delays = [];
      
      for (let i = 0; i < 100; i++) {
        const delay = await exponentialDelay(lambda);
        delays.push(delay);
      }
      
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      expect(avgDelay).toBeCloseTo(expectedMean, -1);
    });

    it('should respect min and max bounds', async () => {
      const lambda = 0.1;
      const min = 1000;
      const max = 20000;
      
      for (let i = 0; i < 10; i++) {
        const delay = await exponentialDelay(lambda, min, max);
        expect(delay).toBeGreaterThanOrEqual(min);
        expect(delay).toBeLessThanOrEqual(max);
      }
    });
  });

  describe('Human Timing Generator', () => {
    it('should create a generator with default profile', () => {
      const generator = createHumanTimingGenerator();
      expect(typeof generator).toBe('function');
    });

    it('should create a generator with custom profile', () => {
      const profile: TimeProfile = {
        meanDelay: 5000,
        stdDev: 1000,
        distribution: 'gaussian',
        minDelay: 1000,
        maxDelay: 10000,
      };
      const generator = createHumanTimingGenerator(profile);
      expect(typeof generator).toBe('function');
    });

    it('should generate delays using gaussian distribution', async () => {
      const profile: TimeProfile = {
        meanDelay: 5000,
        stdDev: 1000,
        distribution: 'gaussian',
        minDelay: 1000,
        maxDelay: 10000,
      };
      const generator = createHumanTimingGenerator(profile);
      const delay = await generator();
      expect(delay).toBeGreaterThanOrEqual(profile.minDelay);
      expect(delay).toBeLessThanOrEqual(profile.maxDelay);
    });

    it('should generate delays using poisson distribution', async () => {
      const profile: TimeProfile = {
        meanDelay: 10000,
        stdDev: 2000,
        distribution: 'poisson',
        minDelay: 5000,
        maxDelay: 15000,
      };
      const generator = createHumanTimingGenerator(profile);
      const delay = await generator();
      expect(delay).toBeGreaterThanOrEqual(profile.minDelay);
      expect(delay).toBeLessThanOrEqual(profile.maxDelay);
    });

    it('should generate delays using exponential distribution', async () => {
      const profile: TimeProfile = {
        meanDelay: 5000,
        stdDev: 1000,
        distribution: 'exponential',
        minDelay: 1000,
        maxDelay: 10000,
      };
      const generator = createHumanTimingGenerator(profile);
      const delay = await generator();
      expect(delay).toBeGreaterThanOrEqual(profile.minDelay);
      expect(delay).toBeLessThanOrEqual(profile.maxDelay);
    });

    it('should respect time-based profiles', async () => {
      const morningProfile: TimeProfile = {
        meanDelay: 3000,
        stdDev: 500,
        distribution: 'gaussian',
        minDelay: 1000,
        maxDelay: 5000,
      };
      
      const eveningProfile: TimeProfile = {
        meanDelay: 8000,
        stdDev: 1500,
        distribution: 'gaussian',
        minDelay: 5000,
        maxDelay: 10000,
      };
      
      const profiles = [
        { start: '06:00', end: '12:00', profile: morningProfile },
        { start: '12:00', end: '18:00', profile: eveningProfile },
        { start: '18:00', end: '06:00', profile: morningProfile },
      ];
      
      const generator = createHumanTimingGenerator(morningProfile, profiles);
      const delay = await generator();
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(10000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero mean', async () => {
      const delay = await gaussianDelay(0, 1000, 0, 10000);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(10000);
    });

    it('should handle very small stdDev', async () => {
      const mean = 5000;
      const stdDev = 0.1;
      const delay = await gaussianDelay(mean, stdDev);
      expect(delay).toBeCloseTo(mean, -1);
    });

    it('should handle very large stdDev', async () => {
      const mean = 5000;
      const stdDev = 10000;
      const delay = await gaussianDelay(mean, stdDev, 0, 20000);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(20000);
    });

    it('should handle min > max by clamping', async () => {
      const mean = 5000;
      const stdDev = 1000;
      const min = 10000;
      const max = 1000;
      const delay = await gaussianDelay(mean, stdDev, min, max);
      // Should clamp to max
      expect(delay).toBeLessThanOrEqual(10000);
    });
  });
});
