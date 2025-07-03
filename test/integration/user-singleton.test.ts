import { describe, it, expect, beforeEach } from 'vitest';
import { ZT } from '../../src/index.js';

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
  private static initializationPromise: Promise<
    ZT.Result<UserManager, ZT.Error>
  > | null = null;
  private static initializationError: ZT.Error | null = null;

  private currentUser: User | null = null;
  private dbConfig: DatabaseConfig;
  private initialized: boolean = false;
  private initTime: Date;

  // Test control: set to true to simulate connection failure
  static simulateConnectionFailure: boolean = false;
  static simulateUserLoadFailure: boolean = false;
  static simulateUpdateFailure: boolean = false;

  private constructor(config: DatabaseConfig) {
    this.dbConfig = config;
    this.initTime = new Date();
  }

  static async getInstance(
    config?: DatabaseConfig
  ): Promise<ZT.Result<UserManager, ZT.Error>> {
    // If already successfully initialized, return the instance
    if (UserManager.instance && UserManager.instance.initialized) {
      return ZT.ok(UserManager.instance);
    }

    // If initialization failed before, return the same error
    if (UserManager.initializationError) {
      return ZT.err(UserManager.initializationError);
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

  private static async initialize(
    config?: DatabaseConfig
  ): Promise<ZT.Result<UserManager, ZT.Error>> {
    if (!config) {
      return ZT.err(
        new ZT.Error(
          'CONFIG_MISSING',
          'Database configuration is required for initialization'
        )
      );
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
      return ZT.err(
        ZT.wrap(dbResult.error, 'INIT_FAILED', 'Failed to initialize UserManager')
      );
    }

    // Load current user (if any)
    const userResult = await instance.loadCurrentUser();
    if (!userResult.ok && userResult.error.code !== 'NO_CURRENT_USER') {
      return ZT.err(
        ZT.wrap(userResult.error, 'INIT_FAILED', 'Failed to load current user')
      );
    }

    instance.initialized = true;
    UserManager.instance = instance;

    return ZT.ok(instance);
  }

  private static validateConfig(
    config: DatabaseConfig
  ): ZT.Result<void, ZT.Error> {
    if (!config.host || config.host.trim().length === 0) {
      return ZT.err(new ZT.Error('INVALID_CONFIG', 'Database host is required'));
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      return ZT.err(
        new ZT.Error('INVALID_CONFIG', 'Invalid database port', {
          port: config.port,
        })
      );
    }

    if (!config.database || config.database.trim().length === 0) {
      return ZT.err(new ZT.Error('INVALID_CONFIG', 'Database name is required'));
    }

    if (config.timeout < 0) {
      return ZT.err(
        new ZT.Error('INVALID_CONFIG', 'Timeout must be non-negative', {
          timeout: config.timeout,
        })
      );
    }

    return ZT.ok(undefined);
  }

  private async initializeDatabase(): Promise<ZT.Result<void, ZT.Error>> {
    return ZT.tryR(
      async () => {
        // Simulate database connection
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Controlled failure for testing
        if (UserManager.simulateConnectionFailure) {
          throw new Error('Connection timeout');
        }

        // Simulate successful connection
        console.log(
          `Connected to ${this.dbConfig.host}:${this.dbConfig.port}/${this.dbConfig.database}`
        );
      },
      (e) =>
        ZT.wrap(e, 'DB_CONNECTION_ERROR', 'Failed to connect to database', {
          config: this.dbConfig,
        })
    );
  }

  private async loadCurrentUser(): Promise<ZT.Result<User, ZT.Error>> {
    return ZT.tryR(
      async () => {
        // Simulate loading user from session/cache
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Controlled user load for testing
        if (UserManager.simulateUserLoadFailure) {
          throw new Error('No current user');
        }

        const user: User = {
          id: 'user-singleton',
          username: 'singleton_user',
          email: 'singleton@example.com',
          preferences: {
            theme: 'dark',
            language: 'en',
            notifications: true,
          },
          createdAt: new Date('2024-01-01'),
          lastSeen: new Date(),
        };

        this.currentUser = user;
        return user;
      },
      (e) => {
        if (e.message === 'No current user') {
          return new ZT.Error(
            'NO_CURRENT_USER',
            'No user currently logged in'
          );
        }
        return ZT.wrap(e, 'USER_LOAD_ERROR', 'Failed to load current user');
      }
    );
  }

  async login(
    username: string,
    password: string
  ): Promise<ZT.Result<User, ZT.Error>> {
    if (!this.initialized) {
      return ZT.err(
        new ZT.Error('NOT_INITIALIZED', 'UserManager not initialized')
      );
    }

    return ZT.tryR(
      async () => {
        // Simulate authentication
        await new Promise((resolve) => setTimeout(resolve, 100));

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
            notifications: false,
          },
          createdAt: new Date(),
          lastSeen: new Date(),
        };

        this.currentUser = user;
        return user;
      },
      (e) => ZT.wrap(e, 'LOGIN_ERROR', 'Login failed', { username })
    );
  }

  async updatePreferences(
    preferences: Partial<UserPreferences>
  ): Promise<ZT.Result<User, ZT.Error>> {
    if (!this.initialized) {
      return ZT.err(
        new ZT.Error('NOT_INITIALIZED', 'UserManager not initialized')
      );
    }

    if (!this.currentUser) {
      return ZT.err(new ZT.Error('NO_USER', 'No user logged in'));
    }

    return ZT.tryR(
      async () => {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 50));

        if (UserManager.simulateUpdateFailure) {
          throw new Error('Update failed');
        }

        this.currentUser.preferences = {
          ...this.currentUser.preferences,
          ...preferences,
        };

        return this.currentUser;
      },
      (e) =>
        ZT.wrap(e, 'UPDATE_ERROR', 'Failed to update preferences', { preferences })
    );
  }

  getCurrentUser(): ZT.Result<User, ZT.Error> {
    if (!this.initialized) {
      return ZT.err(
        new ZT.Error('NOT_INITIALIZED', 'UserManager not initialized')
      );
    }

    if (!this.currentUser) {
      return ZT.err(new ZT.Error('NO_USER', 'No user logged in'));
    }

    return ZT.ok(this.currentUser);
  }

  static reset(): void {
    UserManager.instance = null;
    UserManager.initializationPromise = null;
    UserManager.initializationError = null;
    UserManager.simulateConnectionFailure = false;
    UserManager.simulateUserLoadFailure = false;
    UserManager.simulateUpdateFailure = false;
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
      timeout: 5000,
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
      timeout: 5000,
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
      timeout: 5000,
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
      timeout: 5000,
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
      timeout: 5000,
    };

    // Launch multiple concurrent initialization attempts
    const promises = Array.from({ length: 10 }, () =>
      UserManager.getInstance(config)
    );

    const results = await Promise.all(promises);

    // All should succeed
    results.forEach((result) => {
      expect(result.ok).toBe(true);
    });

    // All should return the same instance
    const instances = results.filter((r) => r.ok).map((r) => (r as any).value);

    const firstInstance = instances[0];
    instances.forEach((instance) => {
      expect(instance).toBe(firstInstance);
    });
  });

  it('should handle user login and preference updates', async () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      timeout: 5000,
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
      notifications: true,
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
      timeout: 5000,
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

  it('should handle database connection failure during initialization', async () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      timeout: 5000,
    };

    // Simulate connection failure
    UserManager.simulateConnectionFailure = true;

    const result = await UserManager.getInstance(config);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INIT_FAILED');
      expect(result.error.cause?.code).toBe('DB_CONNECTION_ERROR');
    }
  });

  it('should handle update failures gracefully', async () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      timeout: 5000,
    };

    const managerResult = await UserManager.getInstance(config);
    expect(managerResult.ok).toBe(true);
    if (!managerResult.ok) return;

    const manager = managerResult.value;

    // Login first
    const loginResult = await manager.login('testuser', 'password123');
    expect(loginResult.ok).toBe(true);

    // Simulate update failure
    UserManager.simulateUpdateFailure = true;

    const updateResult = await manager.updatePreferences({
      theme: 'dark',
    });

    expect(updateResult.ok).toBe(false);
    if (!updateResult.ok) {
      expect(updateResult.error.code).toBe('UPDATE_ERROR');
      expect(updateResult.error.message).toContain(
        'Failed to update preferences'
      );
    }
  });
});
