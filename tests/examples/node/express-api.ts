import express, { Request, Response, NextFunction } from 'express';
import { Result, ok, err, ZeroError, tryR } from '@flyingrobots/zerothrow';

// Example Express API with ZeroThrow for error handling

// Types
interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateUserDto {
  name: string;
  email: string;
}

// Mock database operations that return Results
class UserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<Result<User, ZeroError>> {
    const user = this.users.get(id);
    if (!user) {
      return err(new ZeroError(
        'USER_NOT_FOUND',
        `User with id ${id} not found`,
        { userId: id }
      ));
    }
    return ok(user);
  }

  async findByEmail(email: string): Promise<Result<User | null, ZeroError>> {
    const user = Array.from(this.users.values()).find(u => u.email === email);
    return ok(user || null);
  }

  async create(data: CreateUserDto): Promise<Result<User, ZeroError>> {
    // Check if email already exists
    const existing = await this.findByEmail(data.email);
    if (!existing.ok) {
      return err(existing.error);
    }
    
    if (existing.value) {
      return err(new ZeroError(
        'EMAIL_EXISTS',
        'User with this email already exists',
        { email: data.email }
      ));
    }

    const user: User = {
      id: `user_${Date.now()}`,
      ...data
    };

    this.users.set(user.id, user);
    return ok(user);
  }

  async update(id: string, data: Partial<CreateUserDto>): Promise<Result<User, ZeroError>> {
    const userResult = await this.findById(id);
    if (!userResult.ok) {
      return userResult;
    }

    const user = userResult.value;
    
    // If email is being updated, check for conflicts
    if (data.email && data.email !== user.email) {
      const existingResult = await this.findByEmail(data.email);
      if (!existingResult.ok) {
        return err(existingResult.error);
      }
      if (existingResult.value) {
        return err(new ZeroError(
          'EMAIL_EXISTS',
          'User with this email already exists',
          { email: data.email }
        ));
      }
    }

    const updatedUser = { ...user, ...data };
    this.users.set(id, updatedUser);
    return ok(updatedUser);
  }

  async delete(id: string): Promise<Result<void, ZeroError>> {
    if (!this.users.has(id)) {
      return err(new ZeroError(
        'USER_NOT_FOUND',
        `User with id ${id} not found`,
        { userId: id }
      ));
    }
    this.users.delete(id);
    return ok(undefined);
  }
}

// Service layer that uses the repository
class UserService {
  constructor(private repo: UserRepository) {}

  async createUser(data: CreateUserDto): Promise<Result<User, ZeroError>> {
    // Validate input
    const validationResult = this.validateUserData(data);
    if (!validationResult.ok) {
      return validationResult;
    }

    // Create user
    return await this.repo.create(data);
  }

  private validateUserData(data: CreateUserDto): Result<void, ZeroError> {
    if (!data.name || data.name.trim().length < 2) {
      return err(new ZeroError(
        'VALIDATION_ERROR',
        'Name must be at least 2 characters long',
        { field: 'name', value: data.name }
      ));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return err(new ZeroError(
        'VALIDATION_ERROR',
        'Invalid email format',
        { field: 'email', value: data.email }
      ));
    }

    return ok(undefined);
  }
}

// Express middleware for handling Results
function resultHandler<T>(
  handler: (req: Request, res: Response) => Promise<Result<T, ZeroError>>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await handler(req, res);
    
    if (result.ok) {
      res.json({ success: true, data: result.value });
    } else {
      const error = result.error;
      const statusCode = getStatusCodeForError(error.code);
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          context: error.context
        }
      });
    }
  };
}

function getStatusCodeForError(code: string | number | symbol): number {
  const codeStr = String(code);
  switch (codeStr) {
    case 'USER_NOT_FOUND':
      return 404;
    case 'EMAIL_EXISTS':
    case 'VALIDATION_ERROR':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    default:
      return 500;
  }
}

// Create Express app
export function createApp() {
  const app = express();
  app.use(express.json());

  const userRepo = new UserRepository();
  const userService = new UserService(userRepo);

  // Routes
  app.get('/users/:id', resultHandler(async (req) => {
    return await userRepo.findById(req.params.id);
  }));

  app.post('/users', resultHandler(async (req) => {
    return await userService.createUser(req.body);
  }));

  app.put('/users/:id', resultHandler(async (req) => {
    return await userRepo.update(req.params.id, req.body);
  }));

  app.delete('/users/:id', resultHandler(async (req) => {
    const result = await userRepo.delete(req.params.id);
    if (result.ok) {
      return ok({ message: 'User deleted successfully' });
    }
    return result;
  }));

  // Global error handler for unexpected errors
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unexpected error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      }
    });
  });

  return app;
}

// Example with authentication middleware
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const validateToken = (token: string): Result<{ userId: string }, ZeroError> => {
    // Mock token validation
    if (!token || !token.startsWith('Bearer ')) {
      return err(new ZeroError(
        'INVALID_TOKEN',
        'Invalid authentication token format'
      ));
    }

    const tokenValue = token.substring(7);
    if (tokenValue === 'invalid') {
      return err(new ZeroError(
        'TOKEN_EXPIRED',
        'Authentication token has expired'
      ));
    }

    return ok({ userId: 'user_123' });
  };

  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }

  const result = validateToken(token);
  if (!result.ok) {
    return res.status(401).json({
      success: false,
      error: {
        code: result.error.code,
        message: result.error.message
      }
    });
  }

  // Attach user info to request
  (req as any).user = result.value;
  next();
}

// Example usage
if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}