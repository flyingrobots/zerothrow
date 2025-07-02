import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tryR, wrap, err, ok, Result, ZeroError } from '../../src/index.js';

// Real-world Database Transaction Integration Test
interface DbUser {
  id: string;
  name: string;
  email: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DbTransaction {
  id: string;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

interface DbConnection {
  beginTransaction: () => Promise<DbTransaction>;
  query: <T>(sql: string, params?: any[]) => Promise<T>;
  release: () => void;
}

class DatabaseClient {
  private pool: DbConnection[] = [];
  private maxConnections: number = 5;
  private activeConnections: number = 0;

  async getConnection(): Promise<Result<DbConnection, ZeroError>> {
    if (this.activeConnections >= this.maxConnections) {
      return err(
        new ZeroError('POOL_EXHAUSTED', 'No available database connections', {
          context: {
            maxConnections: this.maxConnections,
            activeConnections: this.activeConnections,
          },
        })
      );
    }

    return tryR(
      async () => {
        this.activeConnections++;
        const mockConnection: DbConnection = {
          beginTransaction: vi.fn(async () => ({
            id: `txn-${Date.now()}`,
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
          })),
          query: vi.fn(),
          release: vi.fn(() => {
            this.activeConnections--;
          }),
        };
        this.pool.push(mockConnection);
        return mockConnection;
      },
      (e) =>
        wrap(e, 'CONNECTION_ERROR', 'Failed to acquire database connection')
    );
  }

  async transferBalance(
    fromUserId: string,
    toUserId: string,
    amount: number
  ): Promise<Result<void, ZeroError>> {
    const connResult = await this.getConnection();
    if (!connResult.ok) {
      return connResult;
    }

    const conn = connResult.value;
    let transaction: DbTransaction | null = null;

    try {
      // Begin transaction
      const txnResult = await tryR(
        () => conn.beginTransaction(),
        (e) => wrap(e, 'TRANSACTION_START_ERROR', 'Failed to begin transaction')
      );

      if (!txnResult.ok) {
        conn.release();
        return txnResult;
      }

      transaction = txnResult.value;

      // Get sender's current balance
      const senderResult = await tryR(
        () =>
          conn.query<DbUser>('SELECT * FROM users WHERE id = ? FOR UPDATE', [
            fromUserId,
          ]),
        (e) =>
          wrap(e, 'QUERY_ERROR', 'Failed to fetch sender', {
            userId: fromUserId,
          })
      );

      if (!senderResult.ok) {
        await transaction.rollback();
        conn.release();
        return senderResult;
      }

      const sender = senderResult.value as any; // Mock returns single user

      // Check sufficient balance
      if (sender.balance < amount) {
        await transaction.rollback();
        conn.release();
        return err(
          new ZeroError(
            'INSUFFICIENT_BALANCE',
            'Sender has insufficient balance',
            {
              context: {
                userId: fromUserId,
                currentBalance: sender.balance,
                requestedAmount: amount,
              },
            }
          )
        );
      }

      // Update sender balance
      const updateSenderResult = await tryR(
        () =>
          conn.query(
            'UPDATE users SET balance = balance - ?, updatedAt = NOW() WHERE id = ?',
            [amount, fromUserId]
          ),
        (e) =>
          wrap(e, 'UPDATE_ERROR', 'Failed to update sender balance', {
            userId: fromUserId,
          })
      );

      if (!updateSenderResult.ok) {
        await transaction.rollback();
        conn.release();
        return updateSenderResult;
      }

      // Update receiver balance
      const updateReceiverResult = await tryR(
        () =>
          conn.query(
            'UPDATE users SET balance = balance + ?, updatedAt = NOW() WHERE id = ?',
            [amount, toUserId]
          ),
        (e) =>
          wrap(e, 'UPDATE_ERROR', 'Failed to update receiver balance', {
            userId: toUserId,
          })
      );

      if (!updateReceiverResult.ok) {
        await transaction.rollback();
        conn.release();
        return updateReceiverResult;
      }

      // Insert transaction record
      const recordResult = await tryR(
        () =>
          conn.query(
            'INSERT INTO transactions (fromUserId, toUserId, amount, status, createdAt) VALUES (?, ?, ?, ?, NOW())',
            [fromUserId, toUserId, amount, 'completed']
          ),
        (e) => wrap(e, 'INSERT_ERROR', 'Failed to record transaction')
      );

      if (!recordResult.ok) {
        await transaction.rollback();
        conn.release();
        return recordResult;
      }

      // Commit transaction
      const commitResult = await tryR(
        () => transaction!.commit(),
        (e) => wrap(e, 'COMMIT_ERROR', 'Failed to commit transaction')
      );

      conn.release();

      if (!commitResult.ok) {
        return commitResult;
      }

      return ok(undefined);
    } catch (error) {
      // This catch should never execute if all code uses tryR properly
      if (transaction) {
        await transaction.rollback();
      }
      conn.release();
      return err(
        wrap(error, 'UNEXPECTED_ERROR', 'Unexpected error in transfer')
      );
    }
  }

  async getUserWithRetry(
    userId: string,
    maxRetries: number = 3
  ): Promise<Result<DbUser, ZeroError>> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const connResult = await this.getConnection();
      if (!connResult.ok) {
        if (attempt === maxRetries) {
          return connResult;
        }
        await this.delay(100 * attempt);
        continue;
      }

      const conn = connResult.value;
      const queryResult = await tryR(
        () => conn.query<DbUser>('SELECT * FROM users WHERE id = ?', [userId]),
        (e) =>
          wrap(e, 'QUERY_ERROR', `Query failed on attempt ${attempt}`, {
            userId,
            attempt,
          })
      );

      conn.release();

      if (queryResult.ok) {
        return queryResult;
      }

      if (attempt < maxRetries) {
        await this.delay(100 * attempt);
      }
    }

    return err(
      new ZeroError('RETRY_EXHAUSTED', 'Failed to get user after all retries', {
        userId,
        maxRetries,
      })
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

describe('Database Transaction Integration Tests', () => {
  let db: DatabaseClient;

  beforeEach(() => {
    db = new DatabaseClient();
  });

  it('should successfully transfer balance between users', async () => {
    const mockConn = {
      beginTransaction: vi.fn(async () => ({
        id: 'txn-123',
        commit: vi.fn(async () => {}),
        rollback: vi.fn(async () => {}),
      })),
      query: vi
        .fn()
        .mockResolvedValueOnce({ id: 'user1', balance: 1000 }) // Sender query
        .mockResolvedValueOnce({ affectedRows: 1 }) // Update sender
        .mockResolvedValueOnce({ affectedRows: 1 }) // Update receiver
        .mockResolvedValueOnce({ insertId: 'txn-record-1' }), // Insert transaction
      release: vi.fn(),
    };

    // Mock getConnection to return our mock connection
    vi.spyOn(db as any, 'getConnection').mockResolvedValueOnce(ok(mockConn));

    const result = await db.transferBalance('user1', 'user2', 500);

    expect(result.ok).toBe(true);
    expect(mockConn.query).toHaveBeenCalledTimes(4);
    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('should rollback transaction on insufficient balance', async () => {
    const mockTxn = {
      id: 'txn-123',
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    };

    const mockConn = {
      beginTransaction: vi.fn(async () => mockTxn),
      query: vi.fn().mockResolvedValueOnce({ id: 'user1', balance: 100 }), // Insufficient balance
      release: vi.fn(),
    };

    vi.spyOn(db as any, 'getConnection').mockResolvedValueOnce(ok(mockConn));

    const result = await db.transferBalance('user1', 'user2', 500);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INSUFFICIENT_BALANCE');
      expect(result.error.context).toMatchObject({
        userId: 'user1',
        currentBalance: 100,
        requestedAmount: 500,
      });
    }
    expect(mockTxn.rollback).toHaveBeenCalled();
    expect(mockTxn.commit).not.toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('should handle connection pool exhaustion', async () => {
    // Simulate max connections reached
    (db as any).activeConnections = 5;

    const result = await db.transferBalance('user1', 'user2', 100);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('POOL_EXHAUSTED');
      expect(result.error.context).toMatchObject({
        maxConnections: 5,
        activeConnections: 5,
      });
    }
  });

  it('should rollback on query errors', async () => {
    const mockTxn = {
      id: 'txn-123',
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    };

    const mockConn = {
      beginTransaction: vi.fn(async () => mockTxn),
      query: vi
        .fn()
        .mockResolvedValueOnce({ id: 'user1', balance: 1000 })
        .mockRejectedValueOnce(new Error('Database error')), // Fail on update
      release: vi.fn(),
    };

    vi.spyOn(db as any, 'getConnection').mockResolvedValueOnce(ok(mockConn));

    const result = await db.transferBalance('user1', 'user2', 500);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UPDATE_ERROR');
    }
    expect(mockTxn.rollback).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('should retry on connection failures', async () => {
    const mockConn = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ id: 'user1', name: 'John', balance: 1000 }),
      release: vi.fn(),
    };

    vi.spyOn(db as any, 'getConnection')
      .mockResolvedValueOnce(
        err(new ZeroError('CONNECTION_ERROR', 'Connection failed'))
      )
      .mockResolvedValueOnce(
        err(new ZeroError('CONNECTION_ERROR', 'Connection failed'))
      )
      .mockResolvedValueOnce(ok(mockConn));

    const result = await db.getUserWithRetry('user1', 3);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ id: 'user1', name: 'John' });
    }
  });
});
