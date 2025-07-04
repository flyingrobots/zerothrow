import { PrismaClient, Prisma } from '@prisma/client';
import { Result, ok, err, ZeroError, tryR } from '@zerothrow/zerothrow';

// Prisma integration with ZeroThrow error handling

// Initialize Prisma client
const prisma = new PrismaClient();

// Types (based on a typical Prisma schema)
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Post {
  id: string;
  title: string;
  content: string;
  published: boolean;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

// User repository with Result-based error handling
export class UserRepository {
  async findById(id: string): Promise<Result<User | null, ZeroError>> {
    return tryR(
      async () => {
        const user = await prisma.user.findUnique({
          where: { id }
        });
        return user;
      },
      (error) => this.handlePrismaError(error, 'findById', { id })
    );
  }

  async findByEmail(email: string): Promise<Result<User | null, ZeroError>> {
    return tryR(
      async () => {
        const user = await prisma.user.findUnique({
          where: { email }
        });
        return user;
      },
      (error) => this.handlePrismaError(error, 'findByEmail', { email })
    );
  }

  async create(data: {
    email: string;
    name: string;
  }): Promise<Result<User, ZeroError>> {
    return tryR(
      async () => {
        const user = await prisma.user.create({
          data
        });
        return user;
      },
      (error) => this.handlePrismaError(error, 'create', data)
    );
  }

  async update(
    id: string,
    data: Partial<{ email: string; name: string }>
  ): Promise<Result<User, ZeroError>> {
    return tryR(
      async () => {
        const user = await prisma.user.update({
          where: { id },
          data
        });
        return user;
      },
      (error) => this.handlePrismaError(error, 'update', { id, ...data })
    );
  }

  async delete(id: string): Promise<Result<User, ZeroError>> {
    return tryR(
      async () => {
        const user = await prisma.user.delete({
          where: { id }
        });
        return user;
      },
      (error) => this.handlePrismaError(error, 'delete', { id })
    );
  }

  async findMany(params?: {
    skip?: number;
    take?: number;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<Result<User[], ZeroError>> {
    return tryR(
      async () => {
        const users = await prisma.user.findMany(params);
        return users;
      },
      (error) => this.handlePrismaError(error, 'findMany', params)
    );
  }

  private handlePrismaError(
    error: unknown,
    operation: string,
    context?: any
  ): ZeroError {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle specific Prisma errors
      switch (error.code) {
        case 'P2002':
          return new ZeroError(
            'UNIQUE_CONSTRAINT_VIOLATION',
            'A unique constraint was violated',
            { operation, fields: error.meta?.target, context }
          );
        case 'P2025':
          return new ZeroError(
            'RECORD_NOT_FOUND',
            'Record not found',
            { operation, context }
          );
        case 'P2003':
          return new ZeroError(
            'FOREIGN_KEY_CONSTRAINT_VIOLATION',
            'Foreign key constraint failed',
            { operation, field: error.meta?.field_name, context }
          );
        default:
          return new ZeroError(
            'DATABASE_ERROR',
            `Database error: ${error.message}`,
            { operation, code: error.code, context }
          );
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return new ZeroError(
        'VALIDATION_ERROR',
        'Invalid data provided',
        { operation, message: error.message, context }
      );
    }

    return new ZeroError(
      'UNKNOWN_DATABASE_ERROR',
      'An unknown database error occurred',
      { operation, cause: error, context }
    );
  }
}

// Post repository
export class PostRepository {
  async create(data: {
    title: string;
    content: string;
    authorId: string;
    published?: boolean;
  }): Promise<Result<Post, ZeroError>> {
    return tryR(
      async () => {
        const post = await prisma.post.create({
          data: {
            title: data.title,
            content: data.content,
            published: data.published ?? false,
            author: {
              connect: { id: data.authorId }
            }
          }
        });
        return post;
      },
      (error) => this.handlePrismaError(error, 'create', data)
    );
  }

  async findById(id: string): Promise<Result<Post | null, ZeroError>> {
    return tryR(
      async () => {
        const post = await prisma.post.findUnique({
          where: { id },
          include: {
            author: true
          }
        });
        return post;
      },
      (error) => this.handlePrismaError(error, 'findById', { id })
    );
  }

  async findByAuthor(
    authorId: string,
    params?: {
      skip?: number;
      take?: number;
      publishedOnly?: boolean;
    }
  ): Promise<Result<Post[], ZeroError>> {
    return tryR(
      async () => {
        const posts = await prisma.post.findMany({
          where: {
            authorId,
            ...(params?.publishedOnly && { published: true })
          },
          skip: params?.skip,
          take: params?.take,
          orderBy: { createdAt: 'desc' }
        });
        return posts;
      },
      (error) => this.handlePrismaError(error, 'findByAuthor', { authorId, ...params })
    );
  }

  async publish(id: string): Promise<Result<Post, ZeroError>> {
    return tryR(
      async () => {
        const post = await prisma.post.update({
          where: { id },
          data: { published: true }
        });
        return post;
      },
      (error) => this.handlePrismaError(error, 'publish', { id })
    );
  }

  private handlePrismaError(
    error: unknown,
    operation: string,
    context?: any
  ): ZeroError {
    // Reuse the error handling logic
    const userRepo = new UserRepository();
    return (userRepo as any).handlePrismaError(error, operation, context);
  }
}

// Transaction example
export async function createUserWithPost(
  userData: { email: string; name: string },
  postData: { title: string; content: string }
): Promise<Result<{ user: User; post: Post }, ZeroError>> {
  return tryR(
    async () => {
      const result = await prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: userData
        });

        // Create post
        const post = await tx.post.create({
          data: {
            ...postData,
            authorId: user.id
          }
        });

        return { user, post };
      });

      return result;
    },
    (error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return new ZeroError(
          'TRANSACTION_FAILED',
          'Failed to create user with post',
          { userData, postData, prismaCode: error.code }
        );
      }
      return new ZeroError(
        'TRANSACTION_ERROR',
        'Transaction failed',
        { cause: error }
      );
    }
  );
}

// Batch operations
export async function batchCreateUsers(
  usersData: Array<{ email: string; name: string }>
): Promise<Result<number, ZeroError[]>> {
  const errors: ZeroError[] = [];
  let successCount = 0;

  // Process in batches to avoid overwhelming the database
  const batchSize = 100;
  for (let i = 0; i < usersData.length; i += batchSize) {
    const batch = usersData.slice(i, i + batchSize);
    
    const result = await tryR(
      async () => {
        const count = await prisma.user.createMany({
          data: batch,
          skipDuplicates: true
        });
        return count.count;
      },
      (error) => new ZeroError(
        'BATCH_CREATE_ERROR',
        `Failed to create batch ${i / batchSize + 1}`,
        { batchIndex: i, error }
      )
    );

    if (result.ok) {
      successCount += result.value;
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok(successCount);
}

// Query builder helper
export class QueryBuilder<_T> {
  private whereClause: any = {};
  private orderByClause: any = {};
  private skipValue?: number;
  private takeValue?: number;

  where(conditions: any): this {
    this.whereClause = { ...this.whereClause, ...conditions };
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByClause[field] = direction;
    return this;
  }

  skip(value: number): this {
    this.skipValue = value;
    return this;
  }

  take(value: number): this {
    this.takeValue = value;
    return this;
  }

  build() {
    return {
      where: this.whereClause,
      orderBy: this.orderByClause,
      skip: this.skipValue,
      take: this.takeValue
    };
  }
}

// Service layer example
export class UserService {
  constructor(
    private userRepo: UserRepository,
    private postRepo: PostRepository
  ) {}

  async registerUser(
    email: string,
    name: string
  ): Promise<Result<User, ZeroError>> {
    // Check if email already exists
    const existingResult = await this.userRepo.findByEmail(email);
    if (!existingResult.ok) {
      return err(existingResult.error);
    }

    if (existingResult.value) {
      return err(new ZeroError(
        'EMAIL_ALREADY_EXISTS',
        'A user with this email already exists',
        { email }
      ));
    }

    // Create the user
    return await this.userRepo.create({ email, name });
  }

  async getUserProfile(userId: string): Promise<Result<{
    user: User;
    postCount: number;
    recentPosts: Post[];
  }, ZeroError>> {
    // Get user
    const userResult = await this.userRepo.findById(userId);
    if (!userResult.ok) {
      return err(userResult.error);
    }

    if (!userResult.value) {
      return err(new ZeroError(
        'USER_NOT_FOUND',
        'User not found',
        { userId }
      ));
    }

    // Get user's posts
    const postsResult = await this.postRepo.findByAuthor(userId, {
      take: 5,
      publishedOnly: true
    });

    if (!postsResult.ok) {
      return err(postsResult.error);
    }

    return ok({
      user: userResult.value,
      postCount: postsResult.value.length,
      recentPosts: postsResult.value
    });
  }
}

// Example usage
export async function example() {
  const userRepo = new UserRepository();
  const postRepo = new PostRepository();
  const userService = new UserService(userRepo, postRepo);

  // Register a user
  const registerResult = await userService.registerUser(
    'john@example.com',
    'John Doe'
  );

  if (!registerResult.ok) {
    console.error('Registration failed:', registerResult.error.message);
    return;
  }

  console.log('User registered:', registerResult.value);

  // Create a post for the user
  const postResult = await postRepo.create({
    title: 'My First Post',
    content: 'Hello, world!',
    authorId: registerResult.value.id,
    published: true
  });

  if (postResult.ok) {
    console.log('Post created:', postResult.value);
  }

  // Get user profile
  const profileResult = await userService.getUserProfile(registerResult.value.id);
  if (profileResult.ok) {
    console.log('User profile:', profileResult.value);
  }

  // Cleanup
  await prisma.$disconnect();
}