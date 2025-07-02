/**
 * Memory profiling utilities for zerothrow Result types
 */

interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
}

interface MemoryProfile {
  name: string;
  iterations: number;
  before: MemorySnapshot;
  after: MemorySnapshot;
  delta: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  perIteration: {
    heapUsed: number;
  };
}

export class MemoryProfiler {
  private profiles: MemoryProfile[] = [];

  private takeSnapshot(): MemorySnapshot {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      timestamp: Date.now()
    };
  }

  async profile<T>(
    name: string,
    iterations: number,
    fn: () => T | Promise<T>
  ): Promise<MemoryProfile> {
    // Warm up
    for (let i = 0; i < 10; i++) {
      await fn();
    }

    const before = this.takeSnapshot();
    
    for (let i = 0; i < iterations; i++) {
      await fn();
    }

    const after = this.takeSnapshot();

    const profile: MemoryProfile = {
      name,
      iterations,
      before,
      after,
      delta: {
        heapUsed: after.heapUsed - before.heapUsed,
        heapTotal: after.heapTotal - before.heapTotal,
        external: after.external - before.external,
        arrayBuffers: after.arrayBuffers - before.arrayBuffers
      },
      perIteration: {
        heapUsed: (after.heapUsed - before.heapUsed) / iterations
      }
    };

    this.profiles.push(profile);
    return profile;
  }

  getProfiles(): MemoryProfile[] {
    return this.profiles;
  }

  generateReport(): string {
    const report = ['Memory Profile Report', '=' .repeat(50), ''];

    for (const profile of this.profiles) {
      report.push(`Test: ${profile.name}`);
      report.push(`Iterations: ${profile.iterations.toLocaleString()}`);
      report.push(`Total heap delta: ${this.formatBytes(profile.delta.heapUsed)}`);
      report.push(`Per iteration: ${this.formatBytes(profile.perIteration.heapUsed)}`);
      report.push('');
    }

    return report.join('\n');
  }

  private formatBytes(bytes: number): string {
    const sign = bytes < 0 ? '-' : '+';
    const abs = Math.abs(bytes);
    
    if (abs < 1024) return `${sign}${abs} B`;
    if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(2)} KB`;
    return `${sign}${(abs / (1024 * 1024)).toFixed(2)} MB`;
  }
}

// Memory leak detector
export class MemoryLeakDetector {
  private samples: number[] = [];
  private interval: NodeJS.Timeout | null = null;

  start(intervalMs: number = 100): void {
    this.samples = [];
    this.interval = setInterval(() => {
      this.samples.push(process.memoryUsage().heapUsed);
    }, intervalMs);
  }

  stop(): { leaked: boolean; trend: number; samples: number[] } {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.samples.length < 10) {
      return { leaked: false, trend: 0, samples: this.samples };
    }

    // Calculate linear regression to detect trend
    const n = this.samples.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = this.samples.reduce((a, b) => a + b, 0);
    const sumXY = this.samples.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const leaked = slope > 1000; // Consider it a leak if growing > 1KB per sample

    return {
      leaked,
      trend: slope,
      samples: this.samples
    };
  }
}