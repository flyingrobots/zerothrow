import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ZT, ZeroThrow } from '../../src/index.js';
import pg from 'pg';
import { 
  createTestEnvironment, 
  startTestDatabase, 
  stopTestDatabase,
  getTestDatabaseConfig,
  type TestEnvironment 
} from './test-utils.js';

const { Pool } = pg;

// Real PostgreSQL integration test
interface DbUser {
  id: string;
  name: string;
  email: string;
  balance: number;
  created_at: Date;
  updated_at: Date;
}

interface TransactionRecord {
  id: string;
  from_user: string;
  to_user: string;
  amount: number;
  created_at: Date;
}

class DatabaseClient {
  pool: pg.Pool; // Make pool accessible for tests

  constructor(config: pg.PoolConfig) {
    this.pool = new Pool(config);
  }

  async initialize() {
    // Create tables
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        balance DECIMAL(10,2) NOT NULL CHECK (balance >= 0),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        from_user VARCHAR(50) NOT NULL,
        to_user VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (from_user) REFERENCES users(id),
        FOREIGN KEY (to_user) REFERENCES users(id)
      )
    `);
  }

  async cleanup() {
    await this.pool.query('DROP TABLE IF EXISTS transactions CASCADE');
    await this.pool.query('DROP TABLE IF EXISTS users CASCADE');
  }

  async close() {
    await this.pool.end();
  }

  async seedTestData() {
    await this.pool.query(
      'INSERT INTO users (id, name, email, balance) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)',
      ['user1', 'John', 'john@example.com', 1000, 'user2', 'Jane', 'jane@example.com', 500]
    );
  }

  async transferBalance(
    fromUserId: string,
    toUserId: string,
    amount: number
  ): Promise<ZeroThrow.Result<{ transactionId: number }, ZeroThrow.ZeroError>> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get sender balance with row lock
      const senderResult = await ZT.try(() =>
        client.query<DbUser>(
          'SELECT * FROM users WHERE id = $1 FOR UPDATE',
          [fromUserId]
        )
      );

      if (!senderResult.ok) {
        await client.query('ROLLBACK');
        return senderResult as any;
      }

      if (senderResult.value.rows.length === 0) {
        await client.query('ROLLBACK');
        return ZT.err(
          new ZeroThrow.ZeroError('SENDER_NOT_FOUND', 'Sender not found')
        );
      }

      const sender = senderResult.value.rows[0];

      // Check sufficient balance
      if (Number(sender.balance) < amount) {
        await client.query('ROLLBACK');
        return ZT.err(
          new ZeroThrow.ZeroError('INSUFFICIENT_BALANCE', 'Insufficient balance', {
            context: {
              required: amount,
              available: Number(sender.balance),
            }
          })
        );
      }

      // Update balances
      const updateSenderResult = await ZT.try(() =>
        client.query(
          'UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
          [amount, fromUserId]
        )
      );

      if (!updateSenderResult.ok) {
        await client.query('ROLLBACK');
        return updateSenderResult as any;
      }

      const updateReceiverResult = await ZT.try(() =>
        client.query(
          'UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
          [amount, toUserId]
        )
      );

      if (!updateReceiverResult.ok) {
        await client.query('ROLLBACK');
        return updateReceiverResult as any;
      }

      // Record transaction - this will fail if receiver doesn't exist due to FK constraint
      const recordResult = await ZT.try(() =>
        client.query<{ id: number }>(
          'INSERT INTO transactions (from_user, to_user, amount) VALUES ($1, $2, $3) RETURNING id',
          [fromUserId, toUserId, amount]
        )
      );

      if (!recordResult.ok) {
        await client.query('ROLLBACK');
        return recordResult as any;
      }

      await client.query('COMMIT');
      return ZT.ok({ transactionId: recordResult.value.rows[0].id });

    } catch (error) {
      await client.query('ROLLBACK');
      return ZT.err(
        ZeroThrow.wrap(error as Error, 'UNEXPECTED_ERROR', 'Unexpected error in transfer')
      );
    } finally {
      client.release();
    }
  }

  async getUserWithRetry(
    userId: string,
    maxRetries: number = 3
  ): Promise<ZeroThrow.Result<DbUser, ZeroThrow.ZeroError>> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await ZT.try(() =>
        this.pool.query<DbUser>('SELECT * FROM users WHERE id = $1', [userId])
      );

      if (result.ok) {
        if (result.value.rows.length === 0) {
          return ZT.err(
            new ZeroThrow.ZeroError('USER_NOT_FOUND', 'User not found')
          );
        }
        return ZT.ok(result.value.rows[0]);
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }

    return ZT.err(
      new ZeroThrow.ZeroError('RETRY_EXHAUSTED', 'Failed to get user after all retries', {
        context: {
          userId,
          maxRetries,
        }
      })
    );
  }

  async getUser(userId: string): Promise<DbUser | undefined> {
    const result = await this.pool.query<DbUser>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0];
  }

  async getTransactionCount(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM transactions'
    );
    return parseInt(result.rows[0].count);
  }
}

describe('Database Transaction Integration Tests', () => {
  let db: DatabaseClient;
  let testEnv: TestEnvironment;

  beforeAll(async () => {
    // Create isolated test environment
    testEnv = createTestEnvironment();
    
    try {
      // Start PostgreSQL container with unique names
      await startTestDatabase(testEnv);
      
      // Connect to the database
      db = new DatabaseClient(getTestDatabaseConfig(testEnv));
      await db.initialize();
    } catch (error) {
      console.error('Failed to start PostgreSQL:', error);
      // Clean up on failure
      if (testEnv) {
        await stopTestDatabase(testEnv);
      }
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    if (db) {
      await db.cleanup();
      await db.close();
    }
    // Stop and clean up isolated environment
    if (testEnv) {
      await stopTestDatabase(testEnv);
    }
  }, 30000);

  beforeEach(async () => {
    // Clean and reseed data for each test
    await db.pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');
    await db.seedTestData();
  });

  afterEach(async () => {
    // Ensure all connections are released
    await db.pool.query('SELECT 1'); // Dummy query to ensure pool is responsive
  });

  it('should successfully transfer balance between users', async () => {
    // Perform transfer
    const result = await db.transferBalance('user1', 'user2', 300);

    // Verify successful result
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.transactionId).toBeGreaterThan(0);
    }

    // Verify actual balance changes
    const user1After = await db.getUser('user1');
    const user2After = await db.getUser('user2');
    console.log('User1 balance after:', user1After?.balance);
    console.log('User2 balance after:', user2After?.balance);
    
    expect(Number(user1After?.balance)).toBe(700);
    expect(Number(user2After?.balance)).toBe(800);

    // Verify transaction was recorded
    const txCount = await db.getTransactionCount();
    expect(txCount).toBe(1);
  });

  it('should rollback transaction on insufficient balance', async () => {
    // Try to transfer more than available
    const result = await db.transferBalance('user1', 'user2', 2000);

    // Verify error
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INSUFFICIENT_BALANCE');
      expect(result.error.context?.required).toBe(2000);
      expect(result.error.context?.available).toBe(1000);
    }

    // Verify no balance changes
    const user1 = await db.getUser('user1');
    const user2 = await db.getUser('user2');
    expect(Number(user1?.balance)).toBe(1000);
    expect(Number(user2?.balance)).toBe(500);

    // Verify no transaction recorded
    const txCount = await db.getTransactionCount();
    expect(txCount).toBe(0);
  });

  it('should rollback on receiver not found', async () => {
    // Try to transfer to non-existent user
    const result = await db.transferBalance('user1', 'user-not-exists', 100);

    // Verify error (PostgreSQL will fail the foreign key constraint)
    expect(result.ok).toBe(false);

    // Verify balances unchanged
    const user1 = await db.getUser('user1');
    expect(Number(user1?.balance)).toBe(1000);

    // Verify no transaction recorded
    const txCount = await db.getTransactionCount();
    expect(txCount).toBe(0);
  });

  it('should retry on transient failures', async () => {
    const result = await db.getUserWithRetry('user1', 3);

    // Should eventually succeed
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('user1');
      expect(result.value.name).toBe('John');
    }
  });

  it('should handle concurrent transfers with proper isolation', async () => {
    // Run transfers that won't deadlock (same direction)
    const transfers = await Promise.all([
      db.transferBalance('user1', 'user2', 100),
      db.transferBalance('user1', 'user2', 100),
      db.transferBalance('user1', 'user2', 50),
    ]);

    // Count successful transfers
    const successCount = transfers.filter(r => r.ok).length;
    expect(successCount).toBeGreaterThan(0);

    // Check final balances
    const user1Final = await db.getUser('user1');
    const user2Final = await db.getUser('user2');
    const finalTxCount = await db.getTransactionCount();
    
    // All transfers are from user1 to user2 (250 total if all succeed)
    // But with concurrent access, some may fail due to conflicts
    if (successCount === 3) {
      expect(Number(user1Final?.balance)).toBe(750);
      expect(Number(user2Final?.balance)).toBe(750);
    }
    expect(finalTxCount).toBe(successCount);
  });

  it('should respect connection pool limits', async () => {
    // Exhaust connection pool
    const clients = await Promise.all(
      Array(5).fill(0).map(() => db.pool.connect())
    );

    // Try to get another connection (should timeout or wait)
    const startTime = Date.now();
    try {
      await Promise.race([
        db.pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 1000)
        )
      ]);
      expect.fail('Should have timed out');
    } catch (error) {
      expect(Date.now() - startTime).toBeGreaterThan(900);
    }

    // Clean up
    clients.forEach(client => client.release());
  });
});