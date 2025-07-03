import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ok, err } from '@flyingrobots/zerothrow';
import { useAsyncResult, UserProfile } from './useAsyncResult.js';

// Mock the fetchUser function
const mockFetchUser = vi.fn();

// Test component that uses useAsyncResult
function TestComponent() {
  const { result: _result, loading, execute, data, error } = useAsyncResult(
    async () => mockFetchUser()
  );

  return (
    <div>
      <button onClick={execute}>Execute</button>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error.message}</div>}
      {data && <div data-testid="data">{JSON.stringify(data)}</div>}
    </div>
  );
}

describe('useAsyncResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle successful async operation', async () => {
    const testData = { id: '1', name: 'John', email: 'john@test.com' };
    mockFetchUser.mockResolvedValue(ok(testData));

    render(<TestComponent />);
    
    const executeButton = screen.getByText('Execute');
    await userEvent.click(executeButton);

    // Should show loading state
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Wait for async operation to complete
    await waitFor(() => {
      expect(screen.getByTestId('data')).toBeInTheDocument();
    });

    expect(screen.getByTestId('data')).toHaveTextContent(JSON.stringify(testData));
    expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('should handle async operation error', async () => {
    const error = new Error('Test error');
    mockFetchUser.mockResolvedValue(err(error));

    render(<TestComponent />);
    
    const executeButton = screen.getByText('Execute');
    await userEvent.click(executeButton);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Test error');
    expect(screen.queryByTestId('data')).not.toBeInTheDocument();
  });

  it('should handle thrown exceptions', async () => {
    mockFetchUser.mockRejectedValue(new Error('Thrown error'));

    render(<TestComponent />);
    
    const executeButton = screen.getByText('Execute');
    await userEvent.click(executeButton);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Thrown error');
  });
});

describe('UserProfile component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch globally
    global.fetch = vi.fn();
  });

  it('should render user profile when data loads successfully', async () => {
    const userData = { id: '1', name: 'John Doe', email: 'john@test.com' };
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(userData)
    });

    render(<UserProfile userId="1" />);

    // Should show loading initially
    expect(screen.getByText('Loading user...')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('john@test.com')).toBeInTheDocument();
    expect(screen.queryByText('Loading user...')).not.toBeInTheDocument();
  });

  it('should show error when fetch fails', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    render(<UserProfile userId="invalid" />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Failed to fetch user: Not Found/)).toBeInTheDocument();
  });

  it('should show error when network fails', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<UserProfile userId="1" />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });
});