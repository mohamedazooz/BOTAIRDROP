// ============================================
// BOTAIRDROP - Human Timing Engine
// Implements human-like timing patterns for anti-Sybil
// ============================================

/**
 * HumanTimingEngine class
 * Generates human-like timing delays using various distributions
 */
export class HumanTimingEngine {
  private currentProfile: TimingProfile;

  /**
   * Timing profile for different behavioral patterns
   */
  private profiles: Map<string, TimingProfile>;

  /**
   * Creates a new HumanTimingEngine instance
   */
  constructor() {
    this.profiles = new Map([
      ['fast', { name: 'fast', mean: 1000, stdDev: 200, min: 500, max: 3000 }],
      ['normal', { name: 'normal', mean: 5000, stdDev: 1500, min: 2000, max: 10000 }],
      ['slow', { name: 'slow', mean: 15000, stdDev: 5000, min: 5000, max: 30000 }],
      ['sleep', { name: 'sleep', mean: 30000, stdDev: 10000, min: 10000, max: 60000 }],
    ]);
    this.currentProfile = this.profiles.get('normal')!;
  }

  /**
   * Sets the timing profile
   * @param profileName Profile name
   */
  setProfile(profileName: string): void {
    const profile = this.profiles.get(profileName);
    if (profile) {
      this.currentProfile = profile;
    }
  }

  /**
   * Gets the current profile
   * @returns Current timing profile
   */
  getProfile(): TimingProfile {
    return this.currentProfile;
  }

  /**
   * Generates a delay using Gaussian (Normal) distribution
   * @param mean Mean delay in ms (default: current profile mean)
   * @param stdDev Standard deviation in ms (default: current profile stdDev)
   * @returns Promise that resolves after the delay
   */
  async gaussianDelay(mean?: number, stdDev?: number): Promise<void> {
    const m = mean || this.currentProfile.mean;
    const s = stdDev || this.currentProfile.stdDev;

    // Box-Muller transform for Gaussian distribution
    let u = 1 - Math.random();
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

    let delay = m + z * s;
    delay = Math.max(this.currentProfile.min, Math.min(this.currentProfile.max, delay));

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Generates a delay using Poisson distribution
   * @param lambda Lambda parameter (default: current profile mean / 1000)
   * @returns Promise that resolves after the delay
   */
  async poissonDelay(lambda?: number): Promise<void> {
    const l = lambda || this.currentProfile.mean / 1000;

    // Poisson distribution
    let k = 0;
    let p = 1;
    const L = Math.exp(-l);

    do {
      k++;
      p *= Math.random();
    } while (p > L);

    const delay = (k - 1) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Generates a delay using Exponential distribution
   * @param lambda Lambda parameter (default: 1 / (current profile mean / 1000))
   * @returns Promise that resolves after the delay
   */
  async exponentialDelay(lambda?: number): Promise<void> {
    const l = lambda || 1 / (this.currentProfile.mean / 1000);

    // Exponential distribution
    const delay = -Math.log(1 - Math.random()) / l * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Randomly selects a distribution and generates a delay
   * @returns Promise that resolves after the delay
   */
  async humanDelay(): Promise<void> {
    const distributions = [
      () => this.gaussianDelay(),
      () => this.poissonDelay(),
      () => this.exponentialDelay(),
    ];

    const index = Math.floor(Math.random() * distributions.length);
    await distributions[index]();
  }

  /**
   * Generates a delay based on the current time of day
   * Simulates human activity patterns
   * @returns Promise that resolves after the delay
   */
  async timeBasedDelay(): Promise<void> {
    const hour = new Date().getHours();

    // Simulate human activity patterns
    if (hour >= 0 && hour < 6) {
      // Sleep hours - long delays
      this.setProfile('sleep');
    } else if (hour >= 6 && hour < 12) {
      // Morning - moderate delays
      this.setProfile('normal');
    } else if (hour >= 12 && hour < 18) {
      // Afternoon - faster
      this.setProfile('fast');
    } else {
      // Evening - slower
      this.setProfile('slow');
    }

    await this.humanDelay();
  }

  /**
   * Generates a delay with jitter (random variation)
   * @param baseDelay Base delay in ms
   * @param jitterPercentage Jitter percentage (default: 30%)
   * @returns Promise that resolves after the delay
   */
  async delayWithJitter(baseDelay: number, jitterPercentage: number = 0.3): Promise<void> {
    const jitter = (Math.random() * 2 - 1) * jitterPercentage * baseDelay;
    const delay = Math.max(0, baseDelay + jitter);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Generates a random delay within a range
   * @param min Minimum delay in ms
   * @param max Maximum delay in ms
   * @returns Promise that resolves after the delay
   */
  async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Timing profile interface
 */
export interface TimingProfile {
  name: string;
  mean: number; // ms
  stdDev: number; // ms
  min: number; // ms
  max: number; // ms
}
