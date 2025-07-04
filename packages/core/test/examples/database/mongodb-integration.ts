import { MongoClient, Db, Collection, ObjectId, MongoError } from 'mongodb';
import { Result, ZeroThrow, ZT } from '@zerothrow/zerothrow';
const { ok, err, ZeroError } = ZeroThrow;

// MongoDB integration with ZeroThrow error handling

// Types
interface BaseDocument {
  _id?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface User extends BaseDocument {
  email: string;
  username: string;
  profile: {
    firstName: string;
    lastName: string;
    bio?: string;
  };
  settings: {
    emailNotifications: boolean;
    theme: 'light' | 'dark';
  };
}

interface Product extends BaseDocument {
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  inventory: {
    quantity: number;
    reserved: number;
  };
}

// MongoDB connection manager
export class MongoConnection {
  private client?: MongoClient;
  private db?: Db;

  constructor(
    private connectionString: string,
    private databaseName: string
  ) {}

  async connect(): Promise<Result<Db, ZeroError>> {
    return ZT.try(
      async () => {
        this.client = new MongoClient(this.connectionString);
        await this.client.connect();
        this.db = this.client.db(this.databaseName);
        return this.db;
      },
      (error) => new ZeroError(
        'MONGODB_CONNECTION_ERROR',
        'Failed to connect to MongoDB',
        { databaseName: this.databaseName, cause: error }
      )
    );
  }

  async disconnect(): Promise<Result<void, ZeroError>> {
    if (!this.client) {
      return ok(undefined);
    }

    return ZT.try(
      async () => {
        await this.client!.close();
        this.client = undefined;
        this.db = undefined;
      },
      (error) => new ZeroError(
        'MONGODB_DISCONNECT_ERROR',
        'Failed to disconnect from MongoDB',
        { cause: error }
      )
    );
  }

  getDb(): Result<Db, ZeroError> {
    if (!this.db) {
      return err(new ZeroError(
        'NOT_CONNECTED',
        'Not connected to MongoDB'
      ));
    }
    return ok(this.db);
  }
}

// Base repository for MongoDB collections
export abstract class MongoRepository<T extends BaseDocument> {
  protected collection: Collection<T>;

  constructor(
    protected db: Db,
    protected collectionName: string
  ) {
    this.collection = db.collection<T>(collectionName);
  }

  async findById(id: string | ObjectId): Promise<Result<T | null, ZeroError>> {
    return ZT.try(
      async () => {
        const objectId = typeof id === 'string' ? new ObjectId(id) : id;
        const document = await this.collection.findOne({ _id: objectId } as any);
        return document;
      },
      (error) => this.handleMongoError(error, 'findById', { id })
    );
  }

  async findOne(filter: Partial<T>): Promise<Result<T | null, ZeroError>> {
    return ZT.try(
      async () => {
        const document = await this.collection.findOne(filter as any);
        return document;
      },
      (error) => this.handleMongoError(error, 'findOne', { filter })
    );
  }

  async findMany(
    filter: Partial<T> = {},
    options?: {
      limit?: number;
      skip?: number;
      sort?: Record<string, 1 | -1>;
      projection?: Record<string, 0 | 1>;
    }
  ): Promise<Result<T[], ZeroError>> {
    return ZT.try(
      async () => {
        let cursor = this.collection.find(filter as any);

        if (options?.sort) {
          cursor = cursor.sort(options.sort);
        }
        if (options?.skip) {
          cursor = cursor.skip(options.skip);
        }
        if (options?.limit) {
          cursor = cursor.limit(options.limit);
        }
        if (options?.projection) {
          cursor = cursor.project(options.projection);
        }

        const documents = await cursor.toArray();
        return documents;
      },
      (error) => this.handleMongoError(error, 'findMany', { filter, options })
    );
  }

  async create(data: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<Result<T, ZeroError>> {
    return ZT.try(
      async () => {
        const now = new Date();
        const document = {
          ...data,
          createdAt: now,
          updatedAt: now
        } as T;

        const result = await this.collection.insertOne(document as any);
        
        if (!result.acknowledged) {
          throw new Error('Insert not acknowledged');
        }

        document._id = result.insertedId;
        return document;
      },
      (error) => this.handleMongoError(error, 'create', { data })
    );
  }

  async update(
    id: string | ObjectId,
    updates: Partial<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Result<T | null, ZeroError>> {
    return ZT.try(
      async () => {
        const objectId = typeof id === 'string' ? new ObjectId(id) : id;
        const result = await this.collection.findOneAndUpdate(
          { _id: objectId } as any,
          { 
            $set: {
              ...updates,
              updatedAt: new Date()
            }
          },
          { returnDocument: 'after' }
        );

        return result;
      },
      (error) => this.handleMongoError(error, 'update', { id, updates })
    );
  }

  async delete(id: string | ObjectId): Promise<Result<boolean, ZeroError>> {
    return ZT.try(
      async () => {
        const objectId = typeof id === 'string' ? new ObjectId(id) : id;
        const result = await this.collection.deleteOne({ _id: objectId } as any);
        return result.deletedCount > 0;
      },
      (error) => this.handleMongoError(error, 'delete', { id })
    );
  }

  async count(filter: Partial<T> = {}): Promise<Result<number, ZeroError>> {
    return ZT.try(
      async () => {
        const count = await this.collection.countDocuments(filter as any);
        return count;
      },
      (error) => this.handleMongoError(error, 'count', { filter })
    );
  }

  async createMany(documents: Array<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>): Promise<Result<T[], ZeroError>> {
    return ZT.try(
      async () => {
        const now = new Date();
        const docsWithTimestamps = documents.map(doc => ({
          ...doc,
          createdAt: now,
          updatedAt: now
        })) as T[];

        const result = await this.collection.insertMany(docsWithTimestamps as any);
        
        if (!result.acknowledged) {
          throw new Error('Bulk insert not acknowledged');
        }

        // Add inserted IDs to documents
        Object.values(result.insertedIds).forEach((id, index) => {
          docsWithTimestamps[index]._id = id;
        });

        return docsWithTimestamps;
      },
      (error) => this.handleMongoError(error, 'createMany', { count: documents.length })
    );
  }

  protected handleMongoError(
    error: unknown,
    operation: string,
    context?: any
  ): ZeroError {
    if (error instanceof MongoError) {
      // Handle specific MongoDB errors
      if (error.code === 11000) {
        // Duplicate key error
        const field = error.message.match(/index: (\w+)_/)?.[1] || 'unknown';
        return new ZeroError(
          'DUPLICATE_KEY',
          'Duplicate key error',
          { operation, field, context }
        );
      }

      if (error.name === 'ValidationError') {
        return new ZeroError(
          'VALIDATION_ERROR',
          'Document validation failed',
          { operation, message: error.message, context }
        );
      }

      return new ZeroError(
        'MONGODB_ERROR',
        `MongoDB error: ${error.message}`,
        { operation, code: error.code, context }
      );
    }

    return new ZeroError(
      'DATABASE_ERROR',
      'Database operation failed',
      { operation, cause: error, context }
    );
  }
}

// User repository
export class UserRepository extends MongoRepository<User> {
  constructor(db: Db) {
    super(db, 'users');
    
    // Create indexes
    this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    await this.collection.createIndex({ email: 1 }, { unique: true });
    await this.collection.createIndex({ username: 1 }, { unique: true });
    await this.collection.createIndex({ createdAt: -1 });
  }

  async findByEmail(email: string): Promise<Result<User | null, ZeroError>> {
    return this.findOne({ email } as any);
  }

  async findByUsername(username: string): Promise<Result<User | null, ZeroError>> {
    return this.findOne({ username } as any);
  }

  async updateSettings(
    userId: string | ObjectId,
    settings: Partial<User['settings']>
  ): Promise<Result<User | null, ZeroError>> {
    return ZT.try(
      async () => {
        const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
        const result = await this.collection.findOneAndUpdate(
          { _id: objectId },
          { 
            $set: {
              'settings': settings,
              updatedAt: new Date()
            }
          },
          { returnDocument: 'after' }
        );

        return result;
      },
      (error) => this.handleMongoError(error, 'updateSettings', { userId, settings })
    );
  }

  async searchUsers(
    searchText: string,
    options?: { limit?: number; skip?: number }
  ): Promise<Result<User[], ZeroError>> {
    return ZT.try(
      async () => {
        const cursor = this.collection.find({
          $or: [
            { username: { $regex: searchText, $options: 'i' } },
            { 'profile.firstName': { $regex: searchText, $options: 'i' } },
            { 'profile.lastName': { $regex: searchText, $options: 'i' } }
          ]
        });

        if (options?.skip) cursor.skip(options.skip);
        if (options?.limit) cursor.limit(options.limit);

        return await cursor.toArray();
      },
      (error) => this.handleMongoError(error, 'searchUsers', { searchText, options })
    );
  }
}

// Product repository with aggregation examples
export class ProductRepository extends MongoRepository<Product> {
  constructor(db: Db) {
    super(db, 'products');
    this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    await this.collection.createIndex({ name: 'text', description: 'text' });
    await this.collection.createIndex({ category: 1, price: -1 });
    await this.collection.createIndex({ tags: 1 });
  }

  async findByCategory(
    category: string,
    options?: {
      minPrice?: number;
      maxPrice?: number;
      inStock?: boolean;
    }
  ): Promise<Result<Product[], ZeroError>> {
    return ZT.try(
      async () => {
        const filter: any = { category };

        if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
          filter.price = {};
          if (options.minPrice !== undefined) filter.price.$gte = options.minPrice;
          if (options.maxPrice !== undefined) filter.price.$lte = options.maxPrice;
        }

        if (options?.inStock) {
          filter['inventory.quantity'] = { $gt: 0 };
        }

        return await this.collection.find(filter).toArray();
      },
      (error) => this.handleMongoError(error, 'findByCategory', { category, options })
    );
  }

  async updateInventory(
    productId: string | ObjectId,
    quantityChange: number
  ): Promise<Result<Product | null, ZeroError>> {
    return ZT.try(
      async () => {
        const objectId = typeof productId === 'string' ? new ObjectId(productId) : productId;
        
        const result = await this.collection.findOneAndUpdate(
          { 
            _id: objectId,
            'inventory.quantity': { $gte: -quantityChange } // Ensure no negative inventory
          },
          {
            $inc: { 'inventory.quantity': quantityChange },
            $set: { updatedAt: new Date() }
          },
          { returnDocument: 'after' }
        );

        if (!result) {
          throw new Error('Insufficient inventory or product not found');
        }

        return result;
      },
      (error) => this.handleMongoError(error, 'updateInventory', { productId, quantityChange })
    );
  }

  async getCategoryStats(): Promise<Result<Array<{
    category: string;
    count: number;
    avgPrice: number;
    totalValue: number;
  }>, ZeroError>> {
    return ZT.try(
      async () => {
        const pipeline = [
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              avgPrice: { $avg: '$price' },
              totalValue: { $sum: { $multiply: ['$price', '$inventory.quantity'] } }
            }
          },
          {
            $project: {
              category: '$_id',
              count: 1,
              avgPrice: { $round: ['$avgPrice', 2] },
              totalValue: { $round: ['$totalValue', 2] },
              _id: 0
            }
          },
          {
            $sort: { totalValue: -1 }
          }
        ];

        const results = await this.collection.aggregate(pipeline).toArray();
        return results as any;
      },
      (error) => this.handleMongoError(error, 'getCategoryStats')
    );
  }
}

// Transaction support
export async function transferInventory(
  db: Db,
  fromProductId: string,
  toProductId: string,
  quantity: number
): Promise<Result<void, ZeroError>> {
  const session = db.client.startSession();

  return ZT.try(
    async () => {
      await session.withTransaction(async () => {
        const products = db.collection<Product>('products');

        // Decrease inventory from source product
        const decreaseResult = await products.updateOne(
          { 
            _id: new ObjectId(fromProductId),
            'inventory.quantity': { $gte: quantity }
          },
          {
            $inc: { 'inventory.quantity': -quantity },
            $set: { updatedAt: new Date() }
          },
          { session }
        );

        if (decreaseResult.modifiedCount === 0) {
          throw new Error('Insufficient inventory in source product');
        }

        // Increase inventory in destination product
        const increaseResult = await products.updateOne(
          { _id: new ObjectId(toProductId) },
          {
            $inc: { 'inventory.quantity': quantity },
            $set: { updatedAt: new Date() }
          },
          { session }
        );

        if (increaseResult.modifiedCount === 0) {
          throw new Error('Destination product not found');
        }
      });
    },
    (error) => new ZeroError(
      'TRANSFER_FAILED',
      'Failed to transfer inventory',
      { fromProductId, toProductId, quantity, cause: error }
    )
  ).finally(() => {
    session.endSession();
  });
}

// Service layer example
export class ProductService {
  constructor(
    private productRepo: ProductRepository,
    private db: Db
  ) {}

  async purchaseProduct(
    productId: string,
    quantity: number
  ): Promise<Result<{ product: Product; totalPrice: number }, ZeroError>> {
    // Start a session for transaction
    const session = this.db.client.startSession();

    return ZT.try(
      async () => {
        let result: { product: Product; totalPrice: number } | null = null;

        await session.withTransaction(async () => {
          // Get product and check availability
          const productResult = await this.productRepo.findById(productId);
          if (!productResult.ok) throw productResult.error;
          if (!productResult.value) throw new Error('Product not found');

          const product = productResult.value;
          
          if (product.inventory.quantity < quantity) {
            throw new Error('Insufficient inventory');
          }

          // Update inventory
          const updateResult = await this.productRepo.updateInventory(productId, -quantity);
          if (!updateResult.ok) throw updateResult.error;
          if (!updateResult.value) throw new Error('Failed to update inventory');

          result = {
            product: updateResult.value,
            totalPrice: product.price * quantity
          };
        });

        if (!result) {
          throw new Error('Transaction completed but no result');
        }

        return result;
      },
      (error) => new ZeroError(
        'PURCHASE_FAILED',
        'Failed to complete purchase',
        { productId, quantity, cause: error }
      )
    ).finally(() => {
      session.endSession();
    });
  }
}

// Example usage
export async function example() {
  const connection = new MongoConnection('mongodb://localhost:27017', 'myapp');
  
  const connectResult = await connection.connect();
  if (!connectResult.ok) {
    console.error('Failed to connect:', connectResult.error);
    return;
  }

  const db = connectResult.value;
  const userRepo = new UserRepository(db);
  const productRepo = new ProductRepository(db);
  const productService = new ProductService(productRepo, db);

  // Create a user
  const userResult = await userRepo.create({
    email: 'john@example.com',
    username: 'johndoe',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      bio: 'Software developer'
    },
    settings: {
      emailNotifications: true,
      theme: 'dark'
    }
  });

  if (userResult.ok) {
    console.log('User created:', userResult.value);
  }

  // Create products
  const productsResult = await productRepo.createMany([
    {
      name: 'Laptop',
      description: 'High-performance laptop',
      price: 999.99,
      category: 'Electronics',
      tags: ['computers', 'portable'],
      inventory: { quantity: 50, reserved: 0 }
    },
    {
      name: 'Mouse',
      description: 'Wireless mouse',
      price: 29.99,
      category: 'Electronics',
      tags: ['accessories', 'wireless'],
      inventory: { quantity: 200, reserved: 0 }
    }
  ]);

  if (productsResult.ok) {
    console.log(`Created ${productsResult.value.length} products`);
  }

  // Get category statistics
  const statsResult = await productRepo.getCategoryStats();
  if (statsResult.ok) {
    console.log('Category stats:', statsResult.value);
  }

  // Purchase a product
  if (productsResult.ok && productsResult.value.length > 0) {
    const purchaseResult = await productService.purchaseProduct(
      productsResult.value[0]._id!.toString(),
      2
    );
    
    if (purchaseResult.ok) {
      console.log('Purchase successful:', purchaseResult.value);
    }
  }

  // Cleanup
  await connection.disconnect();
}