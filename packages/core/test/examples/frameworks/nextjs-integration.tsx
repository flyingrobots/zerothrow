// Next.js Integration Guide for ZeroThrow

import { Result, ZeroThrow, ZT } from '@zerothrow/zerothrow';
const { ok, err, ZeroError } = ZeroThrow;
import { NextRequest, NextResponse } from 'next/server';
import { GetServerSideProps, GetStaticProps as _GetStaticProps } from 'next';
import { useEffect, useState } from 'react';

// ============================================
// 1. API Routes (App Router - app/api/*)
// ============================================

// app/api/users/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const result = await getUserById(params.id);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: getStatusCode(result.error.code) }
    );
  }
  
  return NextResponse.json(result.value);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const bodyResult = await parseRequestBody(request);
  if (!bodyResult.ok) {
    return NextResponse.json(
      { error: bodyResult.error.message },
      { status: 400 }
    );
  }

  const updateResult = await updateUser(params.id, bodyResult.value);
  if (!updateResult.ok) {
    return NextResponse.json(
      { error: updateResult.error.message },
      { status: getStatusCode(updateResult.error.code) }
    );
  }

  return NextResponse.json(updateResult.value);
}

// Helper to parse request body with error handling
async function parseRequestBody<T>(request: NextRequest): Promise<Result<T, ZeroError>> {
  return ZT.try(
    async () => {
      const body = await request.json();
      return body as T;
    },
    (error) => new ZeroError(
      'INVALID_REQUEST_BODY',
      'Failed to parse request body',
      { cause: error }
    )
  );
}

// ============================================
// 2. Server Components (App Router)
// ============================================

// app/users/[id]/page.tsx
interface PageProps {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function UserPage({ params }: PageProps) {
  const userResult = await getUserById(params.id);
  
  if (!userResult.ok) {
    return <ErrorPage error={userResult.error} />;
  }

  const postsResult = await getUserPosts(params.id);
  
  return (
    <div>
      <UserProfile user={userResult.value} />
      {postsResult.ok ? (
        <PostsList posts={postsResult.value} />
      ) : (
        <ErrorMessage error={postsResult.error} />
      )}
    </div>
  );
}

// Error component
function ErrorPage({ error }: { error: ZeroError }) {
  const isNotFound = error.code === 'USER_NOT_FOUND';
  
  return (
    <div className="error-container">
      <h1>{isNotFound ? '404 - User Not Found' : 'Error'}</h1>
      <p>{error.message}</p>
      {process.env.NODE_ENV === 'development' && (
        <pre>{JSON.stringify(error.context, null, 2)}</pre>
      )}
    </div>
  );
}

// ============================================
// 3. Client Components with Data Fetching
// ============================================

// app/components/UserDashboard.tsx
'use client';

export function UserDashboard({ userId: _userId }: { userId: string }) {
  const [result, setResult] = useState<Result<UserData, ZeroError> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData(_userId).then(result => {
      setResult(result);
      setLoading(false);
    });
  }, [_userId]);

  if (loading) return <LoadingSpinner />;
  if (!result) return null;
  
  if (!result.ok) {
    return <ErrorDisplay error={result.error} onRetry={() => window.location.reload()} />;
  }

  return <DashboardContent data={result.value} />;
}

// Client-side fetch with Result
async function fetchUserData(_userId: string): Promise<Result<UserData, ZeroError>> {
  return ZT.try(
    async () => {
      const response = await fetch(`/api/users/${_userId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }
      
      return await response.json();
    },
    (error) => new ZeroError(
      'FETCH_ERROR',
      'Failed to fetch user data',
      { userId: _userId, cause: error }
    )
  );
}

// ============================================
// 4. Server Actions (App Router)
// ============================================

// app/actions/user-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createUserAction(
  formData: FormData
): Promise<Result<{ userId: string }, ZeroError>> {
  const parseResult = parseUserFormData(formData);
  if (!parseResult.ok) {
    return err(parseResult.error);
  }

  const createResult = await createUser(parseResult.value);
  if (!createResult.ok) {
    return err(createResult.error);
  }

  // Revalidate the users list
  revalidatePath('/users');
  
  // Note: Can't use redirect in a Result-returning function
  // Handle redirect in the component instead
  return ok({ userId: createResult.value.id });
}

export async function updateUserAction(
  userId: string,
  formData: FormData
): Promise<Result<void, ZeroError>> {
  const parseResult = parseUserFormData(formData);
  if (!parseResult.ok) {
    return err(parseResult.error);
  }

  const updateResult = await updateUser(userId, parseResult.value);
  if (!updateResult.ok) {
    return err(updateResult.error);
  }

  revalidatePath(`/users/${userId}`);
  return ok(undefined);
}

// Form component using server actions
'use client';

import { useFormState, useFormStatus } from 'react-dom';

export function CreateUserForm() {
  const [state, formAction] = useFormState(
    async (prevState: any, formData: FormData) => {
      const result = await createUserAction(formData);
      
      if (!result.ok) {
        return { error: result.error.message };
      }
      
      // Handle successful creation
      return { success: true, userId: result.value.userId };
    },
    { error: null, success: false, userId: null }
  );

  if (state.success && state.userId) {
    redirect(`/users/${state.userId}`);
  }

  return (
    <form action={formAction}>
      {state.error && (
        <div className="error-message">{state.error}</div>
      )}
      
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Creating...' : 'Create User'}
    </button>
  );
}

// ============================================
// 5. Middleware
// ============================================

// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const authResult = await validateAuth(request);
  
  if (!authResult.ok) {
    // Redirect to login or return error
    if (authResult.error.code === 'UNAUTHORIZED') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    return NextResponse.json(
      { error: authResult.error.message },
      { status: 401 }
    );
  }

  // Add user info to headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', authResult.value.userId);
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: '/api/protected/:path*',
};

// ============================================
// 6. Pages Router (Legacy)
// ============================================

// pages/api/users/[id].ts (Pages Router API)
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  
  if (req.method === 'GET') {
    const result = await getUserById(id as string);
    
    if (!result.ok) {
      return res.status(getStatusCode(result.error.code)).json({
        error: result.error.message
      });
    }
    
    return res.status(200).json(result.value);
  }
  
  res.setHeader('Allow', ['GET']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

// pages/users/[id].tsx (Pages Router SSR)
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!;
  
  const userResult = await getUserById(id as string);
  
  if (!userResult.ok) {
    if (userResult.error.code === 'USER_NOT_FOUND') {
      return { notFound: true };
    }
    
    return {
      props: {
        error: {
          code: userResult.error.code,
          message: userResult.error.message
        }
      }
    };
  }
  
  return {
    props: {
      user: userResult.value
    }
  };
};

// ============================================
// 7. Error Handling Utilities
// ============================================

// utils/error-handling.ts
export function getStatusCode(errorCode: string | symbol | number): number {
  const codeMap: Record<string, number> = {
    'USER_NOT_FOUND': 404,
    'UNAUTHORIZED': 401,
    'FORBIDDEN': 403,
    'VALIDATION_ERROR': 400,
    'RATE_LIMIT_EXCEEDED': 429,
    'INTERNAL_ERROR': 500,
  };
  
  return codeMap[String(errorCode)] || 500;
}

// Custom error page component
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const zeroError = error instanceof ZeroError 
    ? error 
    : new ZeroError('UNEXPECTED_ERROR', error.message);
  
  return (
    <div className="error-page">
      <h2>Something went wrong!</h2>
      <p>{zeroError.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// ============================================
// 8. Data Fetching Patterns
// ============================================

// Parallel data fetching in server components
async function _DashboardPage() {
  // Fetch all data in parallel
  const [_userResult, _statsResult, _notificationsResult] = await Promise.all([
    getUser(),
    getUserStats(),
    getUserNotifications(),
  ]);

  // Handle critical vs optional data
  if (!_userResult.ok) {
    return <ErrorPage error={_userResult.error} />;
  }

  return (
    <DashboardLayout user={_userResult.value}>
      {_statsResult.ok && <StatsWidget stats={_statsResult.value} />}
      {_notificationsResult.ok && (
        <NotificationsList notifications={_notificationsResult.value} />
      )}
    </DashboardLayout>
  );
}

// Custom hook for client-side data fetching
export function useAsyncData<T>(
  fetcher: () => Promise<Result<T, ZeroError>>,
  deps: any[] = []
) {
  const [state, setState] = useState<{
    loading: boolean;
    result: Result<T, ZeroError> | null;
  }>({
    loading: true,
    result: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setState({ loading: true, result: null });
      
      const result = await fetcher();
      
      if (!cancelled) {
        setState({ loading: false, result });
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, deps);

  return state;
}

// ============================================
// Mock implementations
// ============================================

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserData {
  profile: User;
  settings: any;
}

interface Post {
  id: string;
  title: string;
  content: string;
}

// Mock functions
async function getUserById(id: string): Promise<Result<User, ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (id === 'invalid') {
    return err(new ZeroError('USER_NOT_FOUND', 'User not found', { userId: id }));
  }
  
  return ok({
    id,
    name: 'John Doe',
    email: 'john@example.com'
  });
}

async function getUserPosts(_userId: string): Promise<Result<Post[], ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return ok([
    { id: '1', title: 'First Post', content: 'Content' }
  ]);
}

async function createUser(data: any): Promise<Result<User, ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return ok({
    id: `user_${Date.now()}`,
    name: data.name,
    email: data.email
  });
}

async function updateUser(id: string, data: any): Promise<Result<User, ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return ok({
    id,
    name: data.name || 'Updated Name',
    email: data.email || 'updated@example.com'
  });
}

async function validateAuth(request: NextRequest): Promise<Result<{ userId: string }, ZeroError>> {
  const token = request.headers.get('authorization');
  
  if (!token) {
    return err(new ZeroError('UNAUTHORIZED', 'No auth token provided'));
  }
  
  return ok({ userId: 'user_123' });
}

function parseUserFormData(formData: FormData): Result<any, ZeroError> {
  const name = formData.get('name');
  const email = formData.get('email');
  
  if (!name || !email) {
    return err(new ZeroError('VALIDATION_ERROR', 'Missing required fields'));
  }
  
  return ok({ name, email });
}

function getUser(): Promise<Result<User, ZeroError>> {
  return getUserById('123');
}

function getUserStats(): Promise<Result<any, ZeroError>> {
  return Promise.resolve(ok({ visits: 100 }));
}

function getUserNotifications(): Promise<Result<any[], ZeroError>> {
  return Promise.resolve(ok([]));
}

// Component stubs
function UserProfile({ user }: { user: User }) {
  return <div>User: {user.name}</div>;
}

function PostsList({ posts }: { posts: Post[] }) {
  return <div>Posts: {posts.length}</div>;
}

function ErrorMessage({ error }: { error: ZeroError }) {
  return <div>Error: {error.message}</div>;
}

function LoadingSpinner() {
  return <div>Loading...</div>;
}

function ErrorDisplay({ error, onRetry }: { error: ZeroError; onRetry: () => void }) {
  return (
    <div>
      <p>Error: {error.message}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
}

function DashboardContent({ data: _data }: { data: UserData }) {
  return <div>Dashboard</div>;
}

function DashboardLayout({ user: _user, children }: { user: User; children: React.ReactNode }) {
  return <div>{children}</div>;
}

function StatsWidget({ stats: _stats }: { stats: any }) {
  return <div>Stats</div>;
}

function NotificationsList({ notifications: _notifications }: { notifications: any[] }) {
  return <div>Notifications</div>;
}