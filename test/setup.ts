import { beforeAll, afterAll } from 'vitest';

// Simple seedable random number generator (Linear Congruential Generator)
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    // LCG parameters from Numerical Recipes
    this.seed = (this.seed * 1664525 + 1013904223) % 2147483647;
    return this.seed / 2147483647;
  }
}

// Store original Math.random
const originalRandom = Math.random;
let seededRandom: SeededRandom;

beforeAll(() => {
  // Use a fixed seed for deterministic tests
  // Seed 42 gives first random > 0.05 to avoid connection failures
  seededRandom = new SeededRandom(42);
  
  // Override Math.random only during tests
  Math.random = () => seededRandom.next();
});

afterAll(() => {
  // Restore original Math.random after all tests
  Math.random = originalRandom;
});