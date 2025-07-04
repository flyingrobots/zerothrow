import { Result, ok, err, ZeroError, tryR } from '@zerothrow/zerothrow';

// HTTP client with ZeroThrow error handling

interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

interface HttpResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

// HTTP client class with Result-based error handling
export class HttpClient {
  constructor(
    private baseUrl: string = '',
    private defaultHeaders: Record<string, string> = {}
  ) {}

  async request<T = any>(
    url: string,
    options: HttpRequestOptions = {}
  ): Promise<Result<HttpResponse<T>, ZeroError>> {
    const fullUrl = this.baseUrl ? `${this.baseUrl}${url}` : url;
    const { 
      method = 'GET', 
      headers = {}, 
      body, 
      timeout = 30000,
      retries = 0 
    } = options;

    // Retry logic
    let lastError: ZeroError | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await this.performRequest<T>(fullUrl, {
        method,
        headers: { ...this.defaultHeaders, ...headers },
        body,
        timeout
      });

      if (result.ok) {
        return result;
      }

      lastError = result.error;
      
      // Don't retry on client errors (4xx)
      if (result.error.context?.status && result.error.context.status >= 400 && result.error.context.status < 500) {
        return result;
      }

      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return err(lastError || new ZeroError('REQUEST_FAILED', 'Request failed'));
  }

  private async performRequest<T>(
    url: string,
    options: Required<Omit<HttpRequestOptions, 'retries'>>
  ): Promise<Result<HttpResponse<T>, ZeroError>> {
    return tryR(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout);

      try {
        const response = await fetch(url, {
          method: options.method,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let data: T;
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text() as any;
        }

        if (!response.ok) {
          throw new ZeroError(
            'HTTP_ERROR',
            `HTTP ${response.status}: ${response.statusText}`,
            {
              status: response.status,
              statusText: response.statusText,
              url,
              data
            }
          );
        }

        return {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          data
        };
      } finally {
        clearTimeout(timeoutId);
      }
    }, (error) => {
      if (error instanceof ZeroError) {
        return error;
      }
      
      // Handle different error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return new ZeroError(
            'REQUEST_TIMEOUT',
            `Request timed out after ${options.timeout}ms`,
            { url, timeout: options.timeout }
          );
        }
        
        if (error.message.includes('Failed to fetch')) {
          return new ZeroError(
            'NETWORK_ERROR',
            'Network error occurred',
            { url, cause: error }
          );
        }
      }

      return new ZeroError(
        'REQUEST_FAILED',
        'Request failed with unknown error',
        { url, cause: error }
      );
    });
  }

  // Convenience methods
  async get<T = any>(
    url: string, 
    options?: Omit<HttpRequestOptions, 'method' | 'body'>
  ): Promise<Result<HttpResponse<T>, ZeroError>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(
    url: string,
    body?: any,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>
  ): Promise<Result<HttpResponse<T>, ZeroError>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  async put<T = any>(
    url: string,
    body?: any,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>
  ): Promise<Result<HttpResponse<T>, ZeroError>> {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  async delete<T = any>(
    url: string,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>
  ): Promise<Result<HttpResponse<T>, ZeroError>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

// API client example using HttpClient
interface User {
  id: number;
  name: string;
  email: string;
}

interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export class ApiClient {
  private http: HttpClient;

  constructor(baseUrl: string, apiKey?: string) {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    this.http = new HttpClient(baseUrl, headers);
  }

  async getUser(id: number): Promise<Result<User, ZeroError>> {
    const result = await this.http.get<User>(`/users/${id}`);
    
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.data);
  }

  async createUser(userData: Omit<User, 'id'>): Promise<Result<User, ZeroError>> {
    const result = await this.http.post<User>('/users', userData);
    
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.data);
  }

  async getUserPosts(userId: number): Promise<Result<Post[], ZeroError>> {
    const result = await this.http.get<Post[]>(`/users/${userId}/posts`);
    
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.data);
  }

  async updateUser(id: number, updates: Partial<User>): Promise<Result<User, ZeroError>> {
    const result = await this.http.put<User>(`/users/${id}`, updates);
    
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.data);
  }

  async deleteUser(id: number): Promise<Result<void, ZeroError>> {
    const result = await this.http.delete(`/users/${id}`);
    
    if (!result.ok) {
      return err(result.error);
    }

    return ok(undefined);
  }
}

// Batch request helper
export async function batchRequests<T>(
  requests: Array<() => Promise<Result<T, ZeroError>>>,
  options: {
    concurrency?: number;
    stopOnError?: boolean;
  } = {}
): Promise<Result<T[], ZeroError[]>> {
  const { concurrency = 5, stopOnError = false } = options;
  const results: T[] = [];
  const errors: ZeroError[] = [];
  
  // Process in chunks
  for (let i = 0; i < requests.length; i += concurrency) {
    const chunk = requests.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(request => request())
    );

    for (const result of chunkResults) {
      if (result.ok) {
        results.push(result.value);
      } else {
        errors.push(result.error);
        if (stopOnError) {
          return err(errors);
        }
      }
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok(results);
}

// GraphQL client example
export class GraphQLClient {
  private http: HttpClient;

  constructor(endpoint: string, headers?: Record<string, string>) {
    this.http = new HttpClient('', headers);
    this.endpoint = endpoint;
  }

  private endpoint: string;

  async query<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<Result<T, ZeroError>> {
    const result = await this.http.post(this.endpoint, {
      query,
      variables
    });

    if (!result.ok) {
      return err(result.error);
    }

    const response = result.value.data;
    
    if (response.errors && response.errors.length > 0) {
      return err(new ZeroError(
        'GRAPHQL_ERROR',
        'GraphQL query failed',
        { errors: response.errors, query, variables }
      ));
    }

    return ok(response.data as T);
  }

  async mutation<T = any>(
    mutation: string,
    variables?: Record<string, any>
  ): Promise<Result<T, ZeroError>> {
    return this.query<T>(mutation, variables);
  }
}

// Example usage
export async function example() {
  // Basic HTTP client
  const http = new HttpClient();
  
  const result = await http.get('https://api.example.com/data', {
    timeout: 5000,
    retries: 3
  });

  if (result.ok) {
    console.log('Data:', result.value.data);
    console.log('Status:', result.value.status);
  } else {
    console.error('Request failed:', result.error.message);
    console.error('Error code:', result.error.code);
  }

  // API client usage
  const api = new ApiClient('https://jsonplaceholder.typicode.com');
  
  const userResult = await api.getUser(1);
  if (userResult.ok) {
    console.log('User:', userResult.value);
    
    const postsResult = await api.getUserPosts(userResult.value.id);
    if (postsResult.ok) {
      console.log(`User has ${postsResult.value.length} posts`);
    }
  }

  // Batch requests
  const userIds = [1, 2, 3, 4, 5];
  const batchResult = await batchRequests(
    userIds.map(id => () => api.getUser(id)),
    { concurrency: 2 }
  );

  if (batchResult.ok) {
    console.log(`Fetched ${batchResult.value.length} users`);
  } else {
    console.error(`Failed to fetch some users:`, batchResult.error);
  }

  // GraphQL example
  const graphql = new GraphQLClient('https://api.example.com/graphql');
  
  const gqlResult = await graphql.query<{ user: User }>(`
    query GetUser($id: ID!) {
      user(id: $id) {
        id
        name
        email
      }
    }
  `, { id: '1' });

  if (gqlResult.ok) {
    console.log('GraphQL user:', gqlResult.value.user);
  }
}