// ============================================
// BOTAIRDROP - Decimal Noise Generator
// Adds random noise to amounts to avoid detection
// ============================================

/**
 * DecimalNoiseGenerator class
 * Generates amounts with random decimal noise for anti-Sybil
 */
export class DecimalNoiseGenerator {
  private static readonly MIN_NOISE = 0.00000001;
  private static readonly MAX_NOISE = 0.001;

  /**
   * Adds random noise to an amount
   * @param amount Base amount
   * @param precision Number of decimal places (default: 8)
   * @returns Amount with noise
   */
  static addNoise(amount: number, precision: number = 8): number {
    const noise = this.generateNoise();
    const noisyAmount = amount + noise;
    return parseFloat(noisyAmount.toFixed(precision));
  }

  /**
   * Generates random noise
   * @returns Random noise value
   */
  static generateNoise(): number {
    const magnitude = Math.random() * (this.MAX_NOISE - this.MIN_NOISE) + this.MIN_NOISE;
    const sign = Math.random() > 0.5 ? 1 : -1;
    return sign * magnitude;
  }

  /**
   * Generates a random amount with noise
   * @param min Minimum amount
   * @param max Maximum amount
   * @param precision Number of decimal places (default: 8)
   * @returns Random amount with noise
   */
  static generateRandomAmount(
    min: number,
    max: number,
    precision: number = 8
  ): number {
    const base = Math.random() * (max - min) + min;
    return this.addNoise(base, precision);
  }

  /**
   * Generates organic amounts for multiple wallets
   * @param count Number of amounts to generate
   * @param baseAmount Base amount
   * @param variation Variation percentage (default: 0.1 = 10%)
   * @returns Array of amounts with noise
   */
  static generateOrganicAmounts(
    count: number,
    baseAmount: number,
    variation: number = 0.1
  ): number[] {
    const amounts: number[] = [];
    for (let i = 0; i < count; i++) {
      const baseVariation = (Math.random() * 2 - 1) * variation * baseAmount;
      const amount = baseAmount + baseVariation;
      amounts.push(this.addNoise(amount));
    }
    return amounts;
  }

  /**
   * Generates amounts with Solana-specific noise
   * @param count Number of amounts
   * @param baseLamports Base amount in lamports
   * @returns Array of amounts in lamports with noise
   */
  static generateSolanaAmounts(count: number, baseLamports: number): number[] {
    const amounts: number[] = [];
    for (let i = 0; i < count; i++) {
      const noiseLamports = Math.floor(Math.random() * 1000) - 500; // ±500 lamports
      const amount = baseLamports + noiseLamports;
      amounts.push(Math.max(0, amount));
    }
    return amounts;
  }

  /**
   * Adds noise to a Solana amount in lamports
   * @param lamports Base amount in lamports
   * @returns Amount in lamports with noise
   */
  static addLamportsNoise(lamports: number): number {
    const noise = Math.floor(Math.random() * 1000) - 500; // ±500 lamports
    return Math.max(0, lamports + noise);
  }

  /**
   * Generates noise based on a seed for reproducibility
   * @param amount Base amount
   * @param seed Seed for reproducibility
   * @param precision Number of decimal places
   * @returns Amount with noise
   */
  static addNoiseWithSeed(
    amount: number,
    seed: string,
    precision: number = 8
  ): number {
    // Simple seed-based random
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const random = Math.abs(hash) % 1000 / 1000;
    const noise = (random * 2 - 1) * this.MAX_NOISE;
    const noisyAmount = amount + noise;
    return parseFloat(noisyAmount.toFixed(precision));
  }

  /**
   * Generates amounts with controlled noise range
   * @param amount Base amount
   * @param minNoise Minimum noise
   * @param maxNoise Maximum noise
   * @param precision Number of decimal places
   * @returns Amount with noise
   */
  static addControlledNoise(
    amount: number,
    minNoise: number,
    maxNoise: number,
    precision: number = 8
  ): number {
    const magnitude = Math.random() * (maxNoise - minNoise) + minNoise;
    const sign = Math.random() > 0.5 ? 1 : -1;
    const noise = sign * magnitude;
    const noisyAmount = amount + noise;
    return parseFloat(noisyAmount.toFixed(precision));
  }
}
