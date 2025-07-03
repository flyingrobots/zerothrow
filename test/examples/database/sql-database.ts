import { Result, ok, err, ZeroError, tryR } from '@flyingrobots/zerothrow';

// Generic SQL database integration with ZeroThrow
// This example can work with any SQL driver (pg, mysql2, sqlite3, etc.)

// Generic database connection interface
interface DatabaseConnection {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ affectedRows: number }>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void>;
}

// Base repository class with Result-based error handling
export abstract class BaseRepository<T> {
  constructor(
    protected db: DatabaseConnection,
    protected tableName: string
  ) {}

  async findById(id: string | number): Promise<Result<T | null, ZeroError>> {
    return tryR(
      async () => {
        const rows = await this.db.query<T>(
          `SELECT * FROM ${this.tableName} WHERE id = ?`,
          [id]
        );
        return rows[0] || null;
      },
      (error) => this.handleDatabaseError(error, 'findById', { id })
    );
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  }): Promise<Result<T[], ZeroError>> {
    return tryR(
      async () => {
        let sql = `SELECT * FROM ${this.tableName}`;
        const params: any[] = [];

        if (options?.orderBy) {
          sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
          sql += ` LIMIT ?`;
          params.push(options.limit);
        }

        if (options?.offset) {
          sql += ` OFFSET ?`;
          params.push(options.offset);
        }

        return await this.db.query<T>(sql, params);
      },
      (error) => this.handleDatabaseError(error, 'findAll', options)
    );
  }

  async findOne(conditions: Record<string, any>): Promise<Result<T | null, ZeroError>> {
    return tryR(
      async () => {
        const keys = Object.keys(conditions);
        const _placeholders = keys.map(() => '?').join(' AND ');
        const values = Object.values(conditions);

        const sql = `SELECT * FROM ${this.tableName} WHERE ${keys.map(k => `${k} = ?`).join(' AND ')} LIMIT 1`;
        const rows = await this.db.query<T>(sql, values);
        
        return rows[0] || null;
      },
      (error) => this.handleDatabaseError(error, 'findOne', conditions)
    );
  }

  async create(data: Partial<T>): Promise<Result<T, ZeroError>> {
    return tryR(
      async () => {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');

        const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
        const result = await this.db.execute(sql, values);

        // Get the inserted record (implementation depends on the database)
        // This is a simplified example
        const insertedId = (result as any).insertId || (data as any).id;
        const inserted = await this.findById(insertedId);
        
        if (!inserted.ok || !inserted.value) {
          throw new Error('Failed to retrieve inserted record');
        }

        return inserted.value;
      },
      (error) => this.handleDatabaseError(error, 'create', data)
    );
  }

  async update(
    id: string | number,
    data: Partial<T>
  ): Promise<Result<T, ZeroError>> {
    return tryR(
      async () => {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(k => `${k} = ?`).join(', ');

        const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
        await this.db.execute(sql, [...values, id]);

        const updated = await this.findById(id);
        if (!updated.ok || !updated.value) {
          throw new Error('Failed to retrieve updated record');
        }

        return updated.value;
      },
      (error) => this.handleDatabaseError(error, 'update', { id, data })
    );
  }

  async delete(id: string | number): Promise<Result<boolean, ZeroError>> {
    return tryR(
      async () => {
        const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
        const result = await this.db.execute(sql, [id]);
        return result.affectedRows > 0;
      },
      (error) => this.handleDatabaseError(error, 'delete', { id })
    );
  }

  protected handleDatabaseError(
    error: unknown,
    operation: string,
    context?: any
  ): ZeroError {
    // Handle common SQL errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('UNIQUE constraint failed') || 
        errorMessage.includes('Duplicate entry')) {
      return new ZeroError(
        'UNIQUE_CONSTRAINT_VIOLATION',
        'A unique constraint was violated',
        { operation, context }
      );
    }

    if (errorMessage.includes('FOREIGN KEY constraint failed') ||
        errorMessage.includes('foreign key constraint fails')) {
      return new ZeroError(
        'FOREIGN_KEY_VIOLATION',
        'Foreign key constraint violated',
        { operation, context }
      );
    }

    if (errorMessage.includes('cannot be null') ||
        errorMessage.includes('NOT NULL constraint failed')) {
      return new ZeroError(
        'NULL_CONSTRAINT_VIOLATION',
        'A required field was null',
        { operation, context }
      );
    }

    return new ZeroError(
      'DATABASE_ERROR',
      `Database operation failed: ${operation}`,
      { operation, context, cause: error }
    );
  }
}

// Transaction manager
export class TransactionManager {
  constructor(private db: DatabaseConnection) {}

  async executeInTransaction<T>(
    operations: (db: DatabaseConnection) => Promise<Result<T, ZeroError>>
  ): Promise<Result<T, ZeroError>> {
    await this.db.beginTransaction();

    try {
      const result = await operations(this.db);
      
      if (!result.ok) {
        await this.db.rollback();
        return result;
      }

      await this.db.commit();
      return result;
    } catch (error) {
      await this.db.rollback();
      return err(new ZeroError(
        'TRANSACTION_ERROR',
        'Transaction failed',
        { cause: error }
      ));
    }
  }
}

// Example: User repository implementation
interface User {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export class UserRepository extends BaseRepository<User> {
  constructor(db: DatabaseConnection) {
    super(db, 'users');
  }

  async findByEmail(email: string): Promise<Result<User | null, ZeroError>> {
    return this.findOne({ email });
  }

  async findByUsername(username: string): Promise<Result<User | null, ZeroError>> {
    return this.findOne({ username });
  }

  async createUser(data: {
    email: string;
    username: string;
    password_hash: string;
  }): Promise<Result<User, ZeroError>> {
    // Check for existing user
    const existingByEmail = await this.findByEmail(data.email);
    if (!existingByEmail.ok) return err(existingByEmail.error);
    
    if (existingByEmail.value) {
      return err(new ZeroError(
        'EMAIL_EXISTS',
        'User with this email already exists',
        { email: data.email }
      ));
    }

    const existingByUsername = await this.findByUsername(data.username);
    if (!existingByUsername.ok) return err(existingByUsername.error);
    
    if (existingByUsername.value) {
      return err(new ZeroError(
        'USERNAME_EXISTS',
        'User with this username already exists',
        { username: data.username }
      ));
    }

    return this.create({
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    });
  }
}

// Query builder for complex queries
export class SqlQueryBuilder {
  private selectClause: string[] = ['*'];
  private fromClause: string = '';
  private joinClauses: string[] = [];
  private whereConditions: string[] = [];
  private groupByColumns: string[] = [];
  private havingConditions: string[] = [];
  private orderByClause: string = '';
  private limitValue?: number;
  private offsetValue?: number;
  private params: any[] = [];

  select(...columns: string[]): this {
    this.selectClause = columns.length > 0 ? columns : ['*'];
    return this;
  }

  from(table: string): this {
    this.fromClause = table;
    return this;
  }

  join(table: string, on: string): this {
    this.joinClauses.push(`JOIN ${table} ON ${on}`);
    return this;
  }

  leftJoin(table: string, on: string): this {
    this.joinClauses.push(`LEFT JOIN ${table} ON ${on}`);
    return this;
  }

  where(condition: string, ...params: any[]): this {
    this.whereConditions.push(condition);
    this.params.push(...params);
    return this;
  }

  groupBy(...columns: string[]): this {
    this.groupByColumns = columns;
    return this;
  }

  having(condition: string, ...params: any[]): this {
    this.havingConditions.push(condition);
    this.params.push(...params);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByClause = `${column} ${direction}`;
    return this;
  }

  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  build(): { sql: string; params: any[] } {
    let sql = `SELECT ${this.selectClause.join(', ')}`;
    
    if (this.fromClause) {
      sql += ` FROM ${this.fromClause}`;
    }

    if (this.joinClauses.length > 0) {
      sql += ` ${this.joinClauses.join(' ')}`;
    }

    if (this.whereConditions.length > 0) {
      sql += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    if (this.groupByColumns.length > 0) {
      sql += ` GROUP BY ${this.groupByColumns.join(', ')}`;
    }

    if (this.havingConditions.length > 0) {
      sql += ` HAVING ${this.havingConditions.join(' AND ')}`;
    }

    if (this.orderByClause) {
      sql += ` ORDER BY ${this.orderByClause}`;
    }

    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, params: this.params };
  }
}

// Connection pool manager
export class ConnectionPool {
  private connections: DatabaseConnection[] = [];
  private available: DatabaseConnection[] = [];

  constructor(
    private createConnection: () => Promise<DatabaseConnection>,
    private maxConnections: number = 10
  ) {}

  async getConnection(): Promise<Result<DatabaseConnection, ZeroError>> {
    if (this.available.length > 0) {
      const conn = this.available.pop()!;
      return ok(conn);
    }

    if (this.connections.length < this.maxConnections) {
      return tryR(
        async () => {
          const conn = await this.createConnection();
          this.connections.push(conn);
          return conn;
        },
        (error) => new ZeroError(
          'CONNECTION_ERROR',
          'Failed to create database connection',
          { cause: error }
        )
      );
    }

    return err(new ZeroError(
      'POOL_EXHAUSTED',
      'Connection pool exhausted',
      { maxConnections: this.maxConnections }
    ));
  }

  releaseConnection(conn: DatabaseConnection): void {
    if (this.connections.includes(conn)) {
      this.available.push(conn);
    }
  }

  async closeAll(): Promise<Result<void, ZeroError>> {
    const errors: ZeroError[] = [];

    for (const conn of this.connections) {
      const result = await tryR(
        () => conn.close(),
        (error) => new ZeroError(
          'CLOSE_ERROR',
          'Failed to close connection',
          { cause: error }
        )
      );

      if (!result.ok) {
        errors.push(result.error);
      }
    }

    if (errors.length > 0) {
      return err(new ZeroError(
        'POOL_CLOSE_ERROR',
        'Failed to close some connections',
        { errors }
      ));
    }

    this.connections = [];
    this.available = [];
    return ok(undefined);
  }
}

// Example usage
export async function example(db: DatabaseConnection) {
  const userRepo = new UserRepository(db);
  const txManager = new TransactionManager(db);

  // Create a user within a transaction
  const result = await txManager.executeInTransaction(async (_txDb) => {
    const userResult = await userRepo.createUser({
      email: 'john@example.com',
      username: 'johndoe',
      password_hash: 'hashed_password'
    });

    if (!userResult.ok) {
      return userResult;
    }

    // Create related data...
    // If any operation fails, the transaction will be rolled back

    return userResult;
  });

  if (result.ok) {
    console.log('User created:', result.value);
  } else {
    console.error('Failed to create user:', result.error);
  }

  // Complex query example
  const query = new SqlQueryBuilder()
    .select('u.id', 'u.username', 'COUNT(p.id) as post_count')
    .from('users u')
    .leftJoin('posts p', 'p.user_id = u.id')
    .where('u.created_at > ?', new Date('2024-01-01'))
    .groupBy('u.id', 'u.username')
    .having('COUNT(p.id) > ?', 5)
    .orderBy('post_count', 'DESC')
    .limit(10);

  const { sql, params } = query.build();
  const topUsersResult = await tryR(
    () => db.query(sql, params),
    (error) => new ZeroError('QUERY_ERROR', 'Failed to get top users', { sql, params, cause: error })
  );

  if (topUsersResult.ok) {
    console.log('Top users:', topUsersResult.value);
  }
}