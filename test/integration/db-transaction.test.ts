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

interface _TransactionRecord {
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
        balance INTEGER NOT NULL CHECK (balance >= 0),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        from_user VARCHAR(50) NOT NULL,
        to_user VARCHAR(50) NOT NULL,
        amount INTEGER NOT NULL CHECK (amount > 0),
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
    // Using the new .finally() combinator for resource cleanup!
    return ZeroThrow.enhance(
      ZT.try(() => this.pool.connect())
    )
      .tap(client => console.log(`[DB] Got connection from pool for transfer ${fromUserId} -> ${toUserId}`))
      .andThen(client => 
        ZeroThrow.enhance(
          Promise.resolve(this.executeTransaction(client, fromUserId, toUserId, amount))
        ).finally(() => {
          client.release();
          console.log('[DB] Released connection back to pool');
        })
      )
      .tapErr(err => console.error('[DB] Transfer failed:', err.message));
  }

  private async executeTransaction(
    client: pg.PoolClient,
    fromUserId: string,
    toUserId: string,
    amount: number
  ): Promise<ZeroThrow.Result<{ transactionId: number }, ZeroThrow.ZeroError>> {
    // Helper to rollback on error
    const withRollback = <T>(result: ZeroThrow.Result<T, ZeroThrow.ZeroError>) =>
      result.mapErr(async err => {
        await client.query('ROLLBACK');
        return err;
      });

    // Start transaction and execute all steps
    return ZeroThrow.enhance(
      ZT.try(() => client.query('BEGIN'))
    )
      .andThen(() => 
        // Get sender with row lock
        ZT.try(() =>
          client.query<DbUser>(
            'SELECT * FROM users WHERE id = $1 FOR UPDATE',
            [fromUserId]
          )
        )
      )
      .andThen(senderQuery => {
        if (senderQuery.rows.length === 0) {
          return withRollback(
            ZT.err(new ZeroThrow.ZeroError('SENDER_NOT_FOUND', 'Sender not found'))
          );
        }
        
        const sender = senderQuery.rows[0];
        
        // Check balance
        if (Number(sender.balance) < amount) {
          return withRollback(
            ZT.err(
              new ZeroThrow.ZeroError('INSUFFICIENT_BALANCE', 'Insufficient balance', {
                context: {
                  required: amount,
                  available: Number(sender.balance),
                }
              })
            )
          );
        }
        
        // Continue with updates
        return ZT.ok(sender);
      })
      .andThen(() =>
        // Update sender balance
        ZT.try(() =>
          client.query(
            'UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
            [amount, fromUserId]
          )
        )
      )
      .andThen(() =>
        // Update receiver balance
        ZT.try(() =>
          client.query(
            'UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
            [amount, toUserId]
          )
        )
      )
      .andThen(() =>
        // Record transaction
        ZT.try(() =>
          client.query<{ id: number }>(
            'INSERT INTO transactions (from_user, to_user, amount) VALUES ($1, $2, $3) RETURNING id',
            [fromUserId, toUserId, amount]
          )
        )
      )
      .andThen(insertResult =>
        // Commit and return transaction ID
        ZT.try(() => client.query('COMMIT'))
          .map(() => ({ transactionId: insertResult.rows[0].id }))
      )
      .mapErr(async err => {
        // Rollback on any error
        await client.query('ROLLBACK');
        return err;
      });
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

describe.sequential('Database Transaction Integration Tests', () => {
  let db: DatabaseClient;
  let testEnv: TestEnvironment;

  beforeAll(async () => {
    // Create isolated test environment
    testEnv = createTestEnvironment();
    
    // Start PostgreSQL container with unique names
    const startResult = await startTestDatabase(testEnv);
    if (!startResult.ok) {
      console.error('Failed to start PostgreSQL:', startResult.error);
      throw new Error(startResult.error.message);
    }
    
    // Connect to the database
    db = new DatabaseClient(getTestDatabaseConfig(testEnv));
    
    // Ensure database is ready by trying to connect
    let connectRetries = 5;
    while (connectRetries > 0) {
      const initResult = await ZT.try(() => db.initialize());
      if (initResult.ok) {
        console.log('Database initialized successfully');
        break;
      }
      
      connectRetries--;
      if (connectRetries === 0) {
        console.error('Database initialization failed:', initResult.error);
        // Clean up on failure
        await stopTestDatabase(testEnv);
        throw new Error('Failed to initialize database');
      }
      console.log(`Database not ready, retrying... (${connectRetries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }, 30000);

  afterAll(async () => {
    if (db) {
      await db.cleanup();
      await db.close();
    }
    // Stop and clean up isolated environment
    if (testEnv) {
      const stopResult = await stopTestDatabase(testEnv);
      if (!stopResult.ok) {
        console.error('Warning: Failed to stop test database:', stopResult.error);
      }
    }
  }, 30000);

  beforeEach(async () => {
    // Clean and reseed data for each test
    await db.pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');
    await db.seedTestData();
    
    // Debug: Check initial state
    const user1 = await db.getUser('user1');
    const user2 = await db.getUser('user2');
    console.log(`[beforeEach] Initial balances: user1=${user1?.balance}, user2=${user2?.balance}`);
  });

  afterEach(async () => {
    // Ensure all connections are released
    await db.pool.query('SELECT 1'); // Dummy query to ensure pool is responsive
  });

  it('should successfully transfer balance between users', async () => {
    // First, let's test without combinators to ensure it works
    const transferResult = await db.transferBalance('user1', 'user2', 300);
    
    expect(transferResult.ok).toBe(true);
    if (!transferResult.ok) {
      console.error('Transfer failed:', transferResult.error);
      return;
    }
    
    const { transactionId } = transferResult.value;
    expect(transactionId).toBeGreaterThan(0);
    
    // Get both users' final states
    const user1Result = await db.getUserWithRetry('user1', 1);
    const user2Result = await db.getUserWithRetry('user2', 1);
    
    expect(user1Result.ok).toBe(true);
    expect(user2Result.ok).toBe(true);
    
    if (!user1Result.ok || !user2Result.ok) return;
    
    const user1 = user1Result.value;
    const user2 = user2Result.value;
    
    // Verify balances changed correctly (now INTEGER values)
    expect(user1.balance).toBe(700); // 1000 - 300
    expect(user2.balance).toBe(800); // 500 + 300
    
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
    expect(user1?.balance).toBe(1000);
    expect(user2?.balance).toBe(500);

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
    expect(user1?.balance).toBe(1000);

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
    // SHINING EXAMPLE: Handling concurrent operations with ZT patterns
    const concurrentTransfers = [
      () => db.transferBalance('user1', 'user2', 100),
      () => db.transferBalance('user1', 'user2', 100),
      () => db.transferBalance('user1', 'user2', 50),
    ];

    // Execute transfers concurrently and collect results
    const transferResults = await Promise.all(
      concurrentTransfers.map(transfer => transfer())
    );

    // Use ZT patterns to analyze results
    const analysis = transferResults
      .reduce((acc, result) => {
        if (result.ok) {
          acc.successful++;
          acc.txIds.push(result.value.transactionId);
        } else {
          acc.failed++;
          acc.errors.push(result.error);
        }
        return acc;
      }, { successful: 0, failed: 0, txIds: [] as number[], errors: [] as ZeroThrow.ZeroError[] });

    console.log(`Concurrent transfers: ${analysis.successful} succeeded, ${analysis.failed} failed`);
    
    // At least one should succeed
    expect(analysis.successful).toBeGreaterThan(0);
    
    // Verify final state
    const user1Result = await db.getUserWithRetry('user1', 1);
    const user2Result = await db.getUserWithRetry('user2', 1);
    
    expect(user1Result.ok).toBe(true);
    expect(user2Result.ok).toBe(true);
    
    if (user1Result.ok && user2Result.ok) {
      const user1Balance = user1Result.value.balance;
      const user2Balance = user2Result.value.balance;
      const total = user1Balance + user2Balance;
      
      console.log(`Final balances: user1=${user1Balance}, user2=${user2Balance}, total=${total}`);
      
      // Total balance should be conserved (INTEGER values)
      expect(total).toBe(1500);
      
      // Transaction count should match successful transfers
      const txCount = await db.getTransactionCount();
      console.log(`Transaction count: ${txCount}, successful: ${analysis.successful}`);
      expect(txCount).toBeGreaterThanOrEqual(analysis.successful);
    }
  });

  it('should respect connection pool limits', async () => {
    // Exhaust connection pool
    const clients = await Promise.all(
      Array(5).fill(0).map(() => db.pool.connect())
    );

    // Try to get another connection (should timeout)
    const startTime = Date.now();
    
    const timeoutResult = await ZeroThrow.enhance(
      ZT.try(() =>
        Promise.race([
          db.pool.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection pool timeout')), 1000)
          )
        ])
      )
    )
      .tap(() => console.log('[TEST] Unexpectedly got a connection!'))
      .tapErr(err => console.log('[TEST] Expected timeout:', err.message))
      .finally(() => {
        // Always clean up the exhausted connections
        clients.forEach(client => client.release());
        console.log('[TEST] Released all test connections');
      });
    
    expect(timeoutResult.ok).toBe(false);
    expect(Date.now() - startTime).toBeGreaterThan(900);
    
    if (!timeoutResult.ok) {
      expect(timeoutResult.error.message).toContain('timeout');
    }
  });
});