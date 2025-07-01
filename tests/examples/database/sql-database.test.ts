import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseRepository, SqlQueryBuilder } from './sql-database';
import { ok, err, ZeroError } from '@flyingrobots/zerothrow';

// Mock database connection for testing
class MockDatabaseConnection {
  private data: Map<string, any[]> = new Map();
  private lastInsertId = 1;

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    // Simple mock implementation for testing
    if (sql.includes('SELECT * FROM users WHERE id = ?')) {
      const id = params?.[0];
      const users = this.data.get('users') || [];
      const user = users.find(u => u.id === id);
      return user ? [user] : [];
    }
    
    if (sql.includes('SELECT * FROM users')) {
      return this.data.get('users') || [];
    }

    return [];
  }

  async execute(sql: string, params?: any[]): Promise<{ affectedRows: number }> {
    if (sql.includes('INSERT INTO users')) {
      const users = this.data.get('users') || [];
      const newUser = {
        id: this.lastInsertId++,
        name: params?.[0],
        email: params?.[1]
      };
      users.push(newUser);
      this.data.set('users', users);
      return { affectedRows: 1, insertId: newUser.id } as any;
    }

    if (sql.includes('UPDATE users')) {
      const users = this.data.get('users') || [];
      const id = params?.[params.length - 1];
      const userIndex = users.findIndex(u => u.id === id);
      if (userIndex >= 0) {
        users[userIndex] = { ...users[userIndex], name: params?.[0], email: params?.[1] };
        this.data.set('users', users);
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }

    if (sql.includes('DELETE FROM users')) {
      const users = this.data.get('users') || [];
      const id = params?.[0];
      const initialLength = users.length;
      const filteredUsers = users.filter(u => u.id !== id);
      this.data.set('users', filteredUsers);
      return { affectedRows: initialLength - filteredUsers.length };
    }

    return { affectedRows: 0 };
  }

  async beginTransaction(): Promise<void> {
    // Mock implementation
  }

  async commit(): Promise<void> {
    // Mock implementation
  }

  async rollback(): Promise<void> {
    // Mock implementation
  }

  async close(): Promise<void> {
    this.data.clear();
  }

  // Helper for tests
  setData(table: string, data: any[]) {
    this.data.set(table, data);
  }

  getData(table: string) {
    return this.data.get(table) || [];
  }
}

interface TestUser {
  id: number;
  name: string;
  email: string;
}

class TestUserRepository extends BaseRepository<TestUser> {
  constructor(db: MockDatabaseConnection) {
    super(db as any, 'users');
  }
}

describe('SQL Database Integration', () => {
  let mockDb: MockDatabaseConnection;
  let userRepo: TestUserRepository;

  beforeEach(() => {
    mockDb = new MockDatabaseConnection();
    userRepo = new TestUserRepository(mockDb);
  });

  afterEach(async () => {
    await mockDb.close();
  });

  describe('BaseRepository', () => {
    describe('findById', () => {
      it('should return user when found', async () => {
        // Setup test data
        mockDb.setData('users', [
          { id: 1, name: 'John Doe', email: 'john@example.com' }
        ]);

        const result = await userRepo.findById(1);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual({
            id: 1,
            name: 'John Doe',
            email: 'john@example.com'
          });
        }
      });

      it('should return null when user not found', async () => {
        const result = await userRepo.findById(999);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBeNull();
        }
      });
    });

    describe('create', () => {
      it('should create new user successfully', async () => {
        const userData = {
          name: 'Jane Doe',
          email: 'jane@example.com'
        };

        const result = await userRepo.create(userData);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(expect.objectContaining({
            id: expect.any(Number),
            name: userData.name,
            email: userData.email
          }));
        }

        // Verify data was persisted
        const users = mockDb.getData('users');
        expect(users).toHaveLength(1);
        expect(users[0]).toEqual(expect.objectContaining(userData));
      });
    });

    describe('update', () => {
      it('should update existing user', async () => {
        // Setup existing user
        mockDb.setData('users', [
          { id: 1, name: 'John Doe', email: 'john@example.com' }
        ]);

        const updateData = {
          name: 'John Updated',
          email: 'john.updated@example.com'
        };

        const result = await userRepo.update(1, updateData);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(expect.objectContaining({
            id: 1,
            name: updateData.name,
            email: updateData.email
          }));
        }
      });
    });

    describe('delete', () => {
      it('should delete existing user', async () => {
        // Setup existing user
        mockDb.setData('users', [
          { id: 1, name: 'John Doe', email: 'john@example.com' }
        ]);

        const result = await userRepo.delete(1);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(true);
        }

        // Verify user was deleted
        const users = mockDb.getData('users');
        expect(users).toHaveLength(0);
      });

      it('should return false when trying to delete non-existent user', async () => {
        const result = await userRepo.delete(999);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(false);
        }
      });
    });

    describe('findAll', () => {
      it('should return all users', async () => {
        const testUsers = [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Doe', email: 'jane@example.com' }
        ];
        mockDb.setData('users', testUsers);

        const result = await userRepo.findAll();

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(testUsers);
        }
      });

      it('should return empty array when no users exist', async () => {
        const result = await userRepo.findAll();

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual([]);
        }
      });
    });
  });

  describe('SqlQueryBuilder', () => {
    it('should build simple SELECT query', () => {
      const query = new SqlQueryBuilder()
        .select('id', 'name')
        .from('users')
        .build();

      expect(query.sql).toBe('SELECT id, name FROM users');
      expect(query.params).toEqual([]);
    });

    it('should build query with WHERE clause', () => {
      const query = new SqlQueryBuilder()
        .select('*')
        .from('users')
        .where('age > ?', 18)
        .where('status = ?', 'active')
        .build();

      expect(query.sql).toBe('SELECT * FROM users WHERE age > ? AND status = ?');
      expect(query.params).toEqual([18, 'active']);
    });

    it('should build query with JOIN', () => {
      const query = new SqlQueryBuilder()
        .select('u.name', 'p.title')
        .from('users u')
        .join('posts p', 'p.user_id = u.id')
        .build();

      expect(query.sql).toBe('SELECT u.name, p.title FROM users u JOIN posts p ON p.user_id = u.id');
    });

    it('should build query with ORDER BY and LIMIT', () => {
      const query = new SqlQueryBuilder()
        .select('*')
        .from('users')
        .orderBy('created_at', 'DESC')
        .limit(10)
        .offset(20)
        .build();

      expect(query.sql).toBe('SELECT * FROM users ORDER BY created_at DESC LIMIT 10 OFFSET 20');
    });

    it('should build complex query with all clauses', () => {
      const query = new SqlQueryBuilder()
        .select('u.id', 'u.name', 'COUNT(p.id) as post_count')
        .from('users u')
        .leftJoin('posts p', 'p.user_id = u.id')
        .where('u.active = ?', true)
        .groupBy('u.id', 'u.name')
        .having('COUNT(p.id) > ?', 5)
        .orderBy('post_count', 'DESC')
        .limit(10)
        .build();

      expect(query.sql).toBe(
        'SELECT u.id, u.name, COUNT(p.id) as post_count FROM users u LEFT JOIN posts p ON p.user_id = u.id WHERE u.active = ? GROUP BY u.id, u.name HAVING COUNT(p.id) > ? ORDER BY post_count DESC LIMIT 10'
      );
      expect(query.params).toEqual([true, 5]);
    });
  });
});