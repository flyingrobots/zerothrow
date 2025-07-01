import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tryR, wrap, err, ok, Result, ZeroError } from '../../src/index';

// Real-world User Singleton Integration Test
interface User {
  id: string;
  username: string;
  email: string;
  preferences: UserPreferences;
  createdAt: Date;
  lastSeen: Date;
}

interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
}

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  timeout: number;
}

// Singleton pattern with Result-based initialization
class UserManager {
  private static instance: UserManager | null = null;
  private static initializationPromise: Promise<Result<UserManager, ZeroError>> | null = null;
  private static initializationError: ZeroError | null = null;
  
  private currentUser: User | null = null;
  private dbConfig: DatabaseConfig;
  private initialized: boolean = false;
  private initTime: Date;

  private constructor(config: DatabaseConfig) {
    this.dbConfig = config;
    this.initTime = new Date();
  }

  static async getInstance(config?: DatabaseConfig): Promise<Result<UserManager, ZeroError>> {
    // If already successfully initialized, return the instance
    if (UserManager.instance && UserManager.instance.initialized) {
      return ok(UserManager.instance);
    }

    // If initialization failed before, return the same error
    if (UserManager.initializationError) {
      return err(UserManager.initializationError);
    }

    // If initialization is in progress, wait for it
    if (UserManager.initializationPromise) {
      return UserManager.initializationPromise;
    }

    // Start new initialization
    UserManager.initializationPromise = UserManager.initialize(config);
    const result = await UserManager.initializationPromise;

    if (!result.ok) {
      UserManager.initializationError = result.error;
    }

    return result;
  }

  private static async initialize(config?: DatabaseConfig): Promise<Result<UserManager, ZeroError>> {
    if (!config) {
      return err(new ZeroError('CONFIG_MISSING', 'Database configuration is required for initialization'));
    }

    // Validate configuration
    const validationResult = UserManager.validateConfig(config);
    if (!validationResult.ok) {
      return validationResult;
    }

    // Create instance
    const instance = new UserManager(config);

    // Initialize database connection
    const dbResult = await instance.initializeDatabase();
    if (!dbResult.ok) {
      return err(wrap(dbResult.error, 'INIT_FAILED', 'Failed to initialize UserManager'));
    }

    // Load current user (if any)
    const userResult = await instance.loadCurrentUser();
    if (!userResult.ok && userResult.error.code !== 'NO_CURRENT_USER') {
      return err(wrap(userResult.error, 'INIT_FAILED', 'Failed to load current user'));
    }

    instance.initialized = true;
    UserManager.instance = instance;

    return ok(instance);
  }

  private static validateConfig(config: DatabaseConfig): Result<void, ZeroError> {
    if (!config.host || config.host.trim().length === 0) {
      return err(new ZeroError('INVALID_CONFIG', 'Database host is required'));
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      return err(new ZeroError('INVALID_CONFIG', 'Invalid database port', {
        port: config.port
      }));
    }

    if (!config.database || config.database.trim().length === 0) {
      return err(new ZeroError('INVALID_CONFIG', 'Database name is required'));
    }

    if (config.timeout < 0) {
      return err(new ZeroError('INVALID_CONFIG', 'Timeout must be non-negative', {
        timeout: config.timeout
      }));
    }

    return ok(undefined);
  }

  private async initializeDatabase(): Promise<Result<void, ZeroError>> {
    return tryR(
      async () => {
        // Simulate database connection
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Simulate connection failure chance
        if (Math.random() < 0.05) {
          throw new Error('Connection timeout');
        }

        // Simulate successful connection
        console.log(`Connected to ${this.dbConfig.host}:${this.dbConfig.port}/${this.dbConfig.database}`);
      },
      (e) => wrap(e, 'DB_CONNECTION_ERROR', 'Failed to connect to database', {
        config: this.dbConfig
      })
    );
  }

  private async loadCurrentUser(): Promise<Result<User, ZeroError>> {
    return tryR(
      async () => {
        // Simulate loading user from session/cache
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Simulate no current user
        const hasCurrentUser = Math.random() > 0.5;
        if (!hasCurrentUser) {
          throw new Error('No current user');
        }

        const user: User = {
          id: 'user-singleton',
          username: 'singleton_user',
          email: 'singleton@example.com',
          preferences: {
            theme: 'dark',
            language: 'en',
            notifications: true
          },
          createdAt: new Date('2024-01-01'),
          lastSeen: new Date()
        };

        this.currentUser = user;
        return user;
      },
      (e) => {
        if (e.message === 'No current user') {
          return new ZeroError('NO_CURRENT_USER', 'No user currently logged in');
        }
        return wrap(e, 'USER_LOAD_ERROR', 'Failed to load current user');
      }
    );
  }

  async login(username: string, password: string): Promise<Result<User, ZeroError>> {
    if (!this.initialized) {
      return err(new ZeroError('NOT_INITIALIZED', 'UserManager not initialized'));
    }

    return tryR(
      async () => {
        // Simulate authentication
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (username === 'error' || password === 'error') {
          throw new Error('Invalid credentials');
        }

        const user: User = {
          id: `user-${Date.now()}`,
          username,
          email: `${username}@example.com`,
          preferences: {
            theme: 'light',
            language: 'en',
            notifications: false
          },
          createdAt: new Date(),
          lastSeen: new Date()
        };

        this.currentUser = user;
        return user;
      },
      (e) => wrap(e, 'LOGIN_ERROR', 'Login failed', { username })
    );
  }

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<Result<User, ZeroError>> {
    if (!this.initialized) {
      return err(new ZeroError('NOT_INITIALIZED', 'UserManager not initialized'));
    }

    if (!this.currentUser) {
      return err(new ZeroError('NO_USER', 'No user logged in'));
    }

    return tryR(
      async () => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (Math.random() < 0.1) {
          throw new Error('Update failed');
        }

        this.currentUser.preferences = {
          ...this.currentUser.preferences,
          ...preferences
        };

        return this.currentUser;
      },
      (e) => wrap(e, 'UPDATE_ERROR', 'Failed to update preferences', { preferences })
    );
  }

  getCurrentUser(): Result<User, ZeroError> {
    if (!this.initialized) {
      return err(new ZeroError('NOT_INITIALIZED', 'UserManager not initialized'));
    }

    if (!this.currentUser) {
      return err(new ZeroError('NO_USER', 'No user logged in'));
    }

    return ok(this.currentUser);
  }

  static reset(): void {
    UserManager.instance = null;
    UserManager.initializationPromise = null;
    UserManager.initializationError = null;
  }

  getInitTime(): Date {
    return this.initTime;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

describe('User Singleton Integration Tests', () => {
  beforeEach(() => {
    UserManager.reset();
  });

  it('should successfully initialize singleton with valid config', async () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      timeout: 5000
    };

    const result = await UserManager.getInstance(config);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isInitialized()).toBe(true);
    }
  });

  it('should return the same instance on multiple calls', async () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      timeout: 5000
    };

    const result1 = await UserManager.getInstance(config);
    const result2 = await UserManager.getInstance();
    const result3 = await UserManager.getInstance();

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    expect(result3.ok).toBe(true);

    if (result1.ok && result2.ok && result3.ok) {
      expect(result1.value).toBe(result2.value);
      expect(result2.value).toBe(result3.value);
      expect(result1.value.getInitTime()).toEqual(result3.value.getInitTime());
    }
  });

  it('should handle initialization errors gracefully', async () => {
    const invalidConfig: DatabaseConfig = {
      host: '',
      port: 5432,
      database: 'test_db',
      timeout: 5000
    };

    const result = await UserManager.getInstance(invalidConfig);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_CONFIG');
      expect(result.error.message).toBe('Database host is required');
    }
  });

  it('should persist initialization error on subsequent calls', async () => {
    const invalidConfig: DatabaseConfig = {
      host: 'localhost',
      port: 99999,
      database: 'test_db',
      timeout: 5000
    };

    const result1 = await UserManager.getInstance(invalidConfig);
    const result2 = await UserManager.getInstance();
    const result3 = await UserManager.getInstance();

    expect(result1.ok).toBe(false);
    expect(result2.ok).toBe(false);
    expect(result3.ok).toBe(false);

    if (!result1.ok && !result2.ok && !result3.ok) {
      expect(result1.error).toBe(result2.error);
      expect(result2.error).toBe(result3.error);
    }
  });

  it('should handle concurrent initialization attempts', async () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      timeout: 5000
    };

    // Launch multiple concurrent initialization attempts
    const promises = Array.from({ length: 10 }, () => 
      UserManager.getInstance(config)
    );

    const results = await Promise.all(promises);

    // All should succeed
    results.forEach(result => {
      expect(result.ok).toBe(true);
    });

    // All should return the same instance
    const instances = results
      .filter(r => r.ok)
      .map(r => (r as any).value);

    const firstInstance = instances[0];
    instances.forEach(instance => {
      expect(instance).toBe(firstInstance);
    });
  });

  it('should handle user login and preference updates', async () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      timeout: 5000
    };

    const managerResult = await UserManager.getInstance(config);
    expect(managerResult.ok).toBe(true);
    if (!managerResult.ok) {
      return;
    }

    const manager = managerResult.value;

    // Login
    const loginResult = await manager.login('testuser', 'password123');
    expect(loginResult.ok).toBe(true);
    if (!loginResult.ok) {
      return;
    }

    expect(loginResult.value.username).toBe('testuser');

    // Update preferences
    const updateResult = await manager.updatePreferences({
      theme: 'dark',
      notifications: true
    });

    expect(updateResult.ok).toBe(true);
    if (updateResult.ok) {
      expect(updateResult.value.preferences.theme).toBe('dark');
      expect(updateResult.value.preferences.notifications).toBe(true);
    }

    // Get current user
    const currentUserResult = manager.getCurrentUser();
    expect(currentUserResult.ok).toBe(true);
    if (currentUserResult.ok) {
      expect(currentUserResult.value.preferences.theme).toBe('dark');
    }
  });

  it('should handle operations on uninitialized manager', async () => {
    // Create a manager instance directly (bypassing getInstance)
    const manager = new (UserManager as any)({
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      timeout: 5000
    });

    const loginResult = await manager.login('user', 'pass');
    expect(loginResult.ok).toBe(false);
    if (!loginResult.ok) {
      expect(loginResult.error.code).toBe('NOT_INITIALIZED');
    }

    const currentUserResult = manager.getCurrentUser();
    expect(currentUserResult.ok).toBe(false);
    if (!currentUserResult.ok) {
      expect(currentUserResult.error.code).toBe('NOT_INITIALIZED');
    }
  });
});

// Performance benchmarks for singleton pattern
describe('Singleton Performance Benchmarks', () => {
  beforeEach(() => {
    UserManager.reset();
  });

  it('should demonstrate efficient singleton access', async () => {
    // Ensure clean state
    UserManager.reset();
    
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      timeout: 5000
    };

    // Initialize once
    const initResult = await UserManager.getInstance(config);
    
    expect(initResult.ok).toBe(true);

    const iterations = 10000;

    // Benchmark singleton access
    const singletonStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = await UserManager.getInstance();
      if (result.ok) {
        const user = result.value.getCurrentUser();
      }
    }
    const singletonTime = performance.now() - singletonStart;

    // Benchmark direct object creation (for comparison)
    const directStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const obj = { getCurrentUser: () => ({ ok: false }) };
      const user = obj.getCurrentUser();
    }
    const directTime = performance.now() - directStart;

    console.log(`\n=== Singleton Access Performance ===`);
    console.log(`Singleton access: ${singletonTime.toFixed(2)}ms`);
    console.log(`Direct creation: ${directTime.toFixed(2)}ms`);
    console.log(`Singleton overhead: ${((singletonTime / directTime) - 1).toFixed(2)}x`);

    // Singleton should have acceptable overhead (async operations make timing unpredictable)
    expect(singletonTime).toBeLessThan(directTime * 100);
  });
});