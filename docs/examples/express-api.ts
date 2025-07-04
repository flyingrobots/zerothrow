/**
 * Example: Express API with ZeroThrow
 * 
 * This example demonstrates how to use ZeroThrow in a typical Express.js API,
 * including error handling, validation, and database operations.
 */

import express, { Request, Response, NextFunction } from 'express';
import { Result, ok, err, tryR, wrap, ZeroError } from '@zerothrow/zerothrow';

// Domain types
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

// Error codes
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  USER_EXISTS: 'USER_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED'
} as const;

// Validation functions
function validateEmail(email: string): Result<string, ZeroError> {
  if (!email || !email.includes('@')) {
    return err(new ZeroError(
      ErrorCodes.VALIDATION_ERROR,
      'Invalid email format',
      undefined,
      { field: 'email', value: email }
    ));
  }
  return ok(email.toLowerCase());
}

function validatePassword(password: string): Result<string, ZeroError> {
  if (!password || password.length < 8) {
    return err(new ZeroError(
      ErrorCodes.VALIDATION_ERROR,
      'Password must be at least 8 characters',
      undefined,
      { field: 'password' }
    ));
  }
  return ok(password);
}

function validateName(name: string): Result<string, ZeroError> {
  if (!name || name.trim().length < 2) {
    return err(new ZeroError(
      ErrorCodes.VALIDATION_ERROR,
      'Name must be at least 2 characters',
      undefined,
      { field: 'name', value: name }
    ));
  }
  return ok(name.trim());
}

// Service layer
class UserService {
  async createUser(input: CreateUserInput): Promise<Result<User, ZeroError>> {
    // Validate input
    const emailResult = validateEmail(input.email);
    if (emailResult.isErr) return emailResult;

    const nameResult = validateName(input.name);
    if (nameResult.isErr) return nameResult;

    const passwordResult = validatePassword(input.password);
    if (passwordResult.isErr) return passwordResult;

    // Check if user exists
    const existsResult = await this.checkUserExists(emailResult.value);
    if (existsResult.isErr) return existsResult;
    if (existsResult.value) {
      return err(new ZeroError(
        ErrorCodes.USER_EXISTS,
        'User with this email already exists',
        undefined,
        { email: emailResult.value }
      ));
    }

    // Create user in database
    return tryR(
      async () => {
        const user = await db.users.create({
          email: emailResult.value,
          name: nameResult.value,
          password: await hashPassword(passwordResult.value),
          createdAt: new Date()
        });
        return user;
      },
      (error) => wrap(
        error,
        ErrorCodes.DATABASE_ERROR,
        'Failed to create user',
        { operation: 'create', table: 'users' }
      )
    );
  }

  async getUser(id: string): Promise<Result<User, ZeroError>> {
    return tryR(
      async () => {
        const user = await db.users.findById(id);
        if (!user) {
          throw new ZeroError(
            ErrorCodes.USER_NOT_FOUND,
            'User not found',
            undefined,
            { userId: id }
          );
        }
        return user;
      },
      (error) => {
        if (error instanceof ZeroError) return error;
        return wrap(
          error,
          ErrorCodes.DATABASE_ERROR,
          'Failed to fetch user',
          { operation: 'findById', userId: id }
        );
      }
    );
  }

  async updateUser(
    id: string,
    updates: Partial<User>
  ): Promise<Result<User, ZeroError>> {
    // Get existing user
    const userResult = await this.getUser(id);
    if (userResult.isErr) return userResult;

    // Validate updates
    if (updates.email) {
      const emailResult = validateEmail(updates.email);
      if (emailResult.isErr) return emailResult;
      updates.email = emailResult.value;
    }

    if (updates.name) {
      const nameResult = validateName(updates.name);
      if (nameResult.isErr) return nameResult;
      updates.name = nameResult.value;
    }

    // Update in database
    return tryR(
      async () => {
        const updated = await db.users.update(id, updates);
        return updated;
      },
      (error) => wrap(
        error,
        ErrorCodes.DATABASE_ERROR,
        'Failed to update user',
        { operation: 'update', userId: id }
      )
    );
  }

  private async checkUserExists(email: string): Promise<Result<boolean, ZeroError>> {
    return tryR(
      async () => {
        const count = await db.users.count({ email });
        return count > 0;
      },
      (error) => wrap(
        error,
        ErrorCodes.DATABASE_ERROR,
        'Failed to check user existence',
        { operation: 'count', email }
      )
    );
  }
}

// Controller layer
class UserController {
  constructor(private userService: UserService) {}

  async createUser(req: Request, res: Response) {
    const result = await this.userService.createUser(req.body);

    if (result.isErr) {
      return this.handleError(res, result.error);
    }

    res.status(201).json({
      success: true,
      data: {
        id: result.value.id,
        email: result.value.email,
        name: result.value.name
      }
    });
  }

  async getUser(req: Request, res: Response) {
    const result = await this.userService.getUser(req.params.id);

    if (result.isErr) {
      return this.handleError(res, result.error);
    }

    res.json({
      success: true,
      data: result.value
    });
  }

  async updateUser(req: Request, res: Response) {
    const result = await this.userService.updateUser(
      req.params.id,
      req.body
    );

    if (result.isErr) {
      return this.handleError(res, result.error);
    }

    res.json({
      success: true,
      data: result.value
    });
  }

  private handleError(res: Response, error: ZeroError) {
    const statusCode = this.getStatusCode(error.code);
    const response = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.context && { details: error.context })
      }
    };

    // Log server errors
    if (statusCode >= 500) {
      console.error('Server error:', error);
    }

    res.status(statusCode).json(response);
  }

  private getStatusCode(errorCode: string): number {
    switch (errorCode) {
      case ErrorCodes.VALIDATION_ERROR:
        return 400;
      case ErrorCodes.USER_EXISTS:
        return 409;
      case ErrorCodes.USER_NOT_FOUND:
        return 404;
      case ErrorCodes.AUTHENTICATION_FAILED:
      case ErrorCodes.UNAUTHORIZED:
        return 401;
      case ErrorCodes.DATABASE_ERROR:
      default:
        return 500;
    }
  }
}

// Middleware
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Error handling middleware
function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
}

// Application setup
const app = express();
app.use(express.json());

const userService = new UserService();
const userController = new UserController(userService);

// Routes
app.post('/api/users', asyncHandler(userController.createUser.bind(userController)));
app.get('/api/users/:id', asyncHandler(userController.getUser.bind(userController)));
app.put('/api/users/:id', asyncHandler(userController.updateUser.bind(userController)));

// Error handler
app.use(errorHandler);

// Mock database
const db = {
  users: {
    create: async (data: any) => ({ id: '123', ...data }),
    findById: async (id: string) => id === '123' ? { id, email: 'test@example.com', name: 'Test User' } : null,
    update: async (id: string, data: any) => ({ id, ...data }),
    count: async (filter: any) => 0
  }
};

// Mock password hashing
async function hashPassword(password: string): Promise<string> {
  return `hashed_${password}`;
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, UserService, UserController };