import Fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { Result, ok, err, ZeroError, tryR } from '@zerothrow/zerothrow';

// Fastify API example with ZeroThrow

// Types
interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
}

interface CreateTaskDto {
  title: string;
  description?: string;
}

interface UpdateTaskDto {
  title?: string;
  description?: string;
  completed?: boolean;
}

// Task service with Result-based error handling
class TaskService {
  private tasks: Map<string, Task> = new Map();

  async getAllTasks(): Promise<Result<Task[], ZeroError>> {
    return ok(Array.from(this.tasks.values()));
  }

  async getTask(id: string): Promise<Result<Task, ZeroError>> {
    const task = this.tasks.get(id);
    if (!task) {
      return err(new ZeroError(
        'TASK_NOT_FOUND',
        `Task with id ${id} not found`,
        { taskId: id }
      ));
    }
    return ok(task);
  }

  async createTask(data: CreateTaskDto): Promise<Result<Task, ZeroError>> {
    // Validate
    if (!data.title || data.title.trim().length === 0) {
      return err(new ZeroError(
        'VALIDATION_ERROR',
        'Task title is required',
        { field: 'title' }
      ));
    }

    const task: Task = {
      id: `task_${Date.now()}`,
      title: data.title.trim(),
      description: data.description?.trim() || '',
      completed: false,
      createdAt: new Date()
    };

    this.tasks.set(task.id, task);
    return ok(task);
  }

  async updateTask(id: string, data: UpdateTaskDto): Promise<Result<Task, ZeroError>> {
    const taskResult = await this.getTask(id);
    if (!taskResult.ok) {
      return taskResult;
    }

    const task = taskResult.value;
    const updated: Task = {
      ...task,
      title: data.title?.trim() || task.title,
      description: data.description?.trim() ?? task.description,
      completed: data.completed ?? task.completed
    };

    this.tasks.set(id, updated);
    return ok(updated);
  }

  async deleteTask(id: string): Promise<Result<void, ZeroError>> {
    if (!this.tasks.has(id)) {
      return err(new ZeroError(
        'TASK_NOT_FOUND',
        `Task with id ${id} not found`,
        { taskId: id }
      ));
    }
    
    this.tasks.delete(id);
    return ok(undefined);
  }

  async searchTasks(query: string): Promise<Result<Task[], ZeroError>> {
    return tryR(() => {
      const lowercaseQuery = query.toLowerCase();
      const results = Array.from(this.tasks.values()).filter(task =>
        task.title.toLowerCase().includes(lowercaseQuery) ||
        task.description.toLowerCase().includes(lowercaseQuery)
      );
      return results;
    }, (error) => new ZeroError(
      'SEARCH_ERROR',
      'Failed to search tasks',
      { query, cause: error }
    ));
  }
}

// Fastify plugin for Result handling
async function resultPlugin(fastify: FastifyInstance) {
  // Add a decorator to handle Results
  fastify.decorateReply('sendResult', function<T>(
    this: FastifyReply,
    result: Result<T, ZeroError>
  ) {
    if (result.ok) {
      return this.send({
        success: true,
        data: result.value
      });
    } else {
      const error = result.error;
      const statusCode = getStatusCode(error.code);
      
      return this.status(statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.context && { context: error.context })
        }
      });
    }
  });
}

function getStatusCode(code: string | number | symbol): number {
  const codeStr = String(code);
  switch (codeStr) {
    case 'TASK_NOT_FOUND':
      return 404;
    case 'VALIDATION_ERROR':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    default:
      return 500;
  }
}

// Schema definitions for validation
const createTaskSchema = {
  type: 'object',
  required: ['title'],
  properties: {
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' }
  }
};

const updateTaskSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    completed: { type: 'boolean' }
  }
};

// Create Fastify server
export async function createServer() {
  const fastify = Fastify({
    logger: true
  });

  // Register plugins
  await fastify.register(resultPlugin);

  // Create service instance
  const taskService = new TaskService();

  // Routes
  fastify.get('/tasks', async (_request, reply) => {
    const result = await taskService.getAllTasks();
    return reply.sendResult(result);
  });

  fastify.get<{
    Params: { id: string }
  }>('/tasks/:id', async (request, reply) => {
    const result = await taskService.getTask(request.params.id);
    return reply.sendResult(result);
  });

  fastify.post<{
    Body: CreateTaskDto
  }>('/tasks', {
    schema: {
      body: createTaskSchema
    }
  }, async (request, reply) => {
    const result = await taskService.createTask(request.body);
    return reply.status(201).sendResult(result);
  });

  fastify.put<{
    Params: { id: string },
    Body: UpdateTaskDto
  }>('/tasks/:id', {
    schema: {
      body: updateTaskSchema
    }
  }, async (request, reply) => {
    const result = await taskService.updateTask(request.params.id, request.body);
    return reply.sendResult(result);
  });

  fastify.delete<{
    Params: { id: string }
  }>('/tasks/:id', async (request, reply) => {
    const result = await taskService.deleteTask(request.params.id);
    if (result.ok) {
      return reply.sendResult(ok({ message: 'Task deleted successfully' }));
    }
    return reply.sendResult(result);
  });

  fastify.get<{
    Querystring: { q: string }
  }>('/tasks/search', async (request, reply) => {
    const query = request.query.q;
    if (!query) {
      return reply.sendResult(err(new ZeroError(
        'VALIDATION_ERROR',
        'Search query is required',
        { field: 'q' }
      )));
    }
    
    const result = await taskService.searchTasks(query);
    return reply.sendResult(result);
  });

  // Error handler for uncaught errors
  fastify.setErrorHandler(async (error, _request, reply) => {
    fastify.log.error(error);
    
    const zeroError = new ZeroError(
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      { cause: error }
    );
    
    return reply.status(500).send({
      success: false,
      error: {
        code: zeroError.code,
        message: zeroError.message
      }
    });
  });

  return fastify;
}

// Authentication hook example
export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const validateAuth = (): Result<{ userId: string }, ZeroError> => {
    const auth = request.headers.authorization;
    
    if (!auth) {
      return err(new ZeroError(
        'UNAUTHORIZED',
        'Authorization header required'
      ));
    }

    if (!auth.startsWith('Bearer ')) {
      return err(new ZeroError(
        'INVALID_TOKEN',
        'Invalid token format'
      ));
    }

    const token = auth.substring(7);
    
    // Mock token validation
    if (token === 'expired') {
      return err(new ZeroError(
        'TOKEN_EXPIRED',
        'Token has expired'
      ));
    }

    return ok({ userId: 'user_123' });
  };

  const result = validateAuth();
  if (!result.ok) {
    return reply.status(401).send({
      success: false,
      error: {
        code: result.error.code,
        message: result.error.message
      }
    });
  }

  // Attach user to request
  request.user = result.value;
}

// Rate limiting with Result
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const requests = new Map<string, number[]>();

  return async (
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<Result<void, ZeroError>> => {
    const ip = request.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get request timestamps for this IP
    const timestamps = requests.get(ip) || [];
    const recentRequests = timestamps.filter(t => t > windowStart);

    if (recentRequests.length >= maxRequests) {
      return err(new ZeroError(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests',
        { 
          limit: maxRequests,
          window: windowMs,
          retryAfter: windowStart + windowMs - now
        }
      ));
    }

    // Add current request
    recentRequests.push(now);
    requests.set(ip, recentRequests);

    // Cleanup old entries every 100 requests
    if (requests.size > 100) {
      for (const [key, times] of requests.entries()) {
        const recent = times.filter(t => t > windowStart);
        if (recent.length === 0) {
          requests.delete(key);
        } else {
          requests.set(key, recent);
        }
      }
    }

    return ok(undefined);
  };
}

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyReply {
    sendResult<T>(result: Result<T, ZeroError>): FastifyReply;
  }
  interface FastifyRequest {
    user?: { userId: string };
  }
}

// Example usage
if (require.main === module) {
  const start = async () => {
    try {
      const server = await createServer();
      await server.listen({ port: 3000, host: '0.0.0.0' });
      console.log('Server listening on http://localhost:3000');
    } catch (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  };
  start();
}