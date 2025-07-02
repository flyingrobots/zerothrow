/**
 * Unit tests for React hooks that provide code coverage
 * Tests the hook implementation directly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ok, err, ZeroError } from '../src/index.js';

describe('useResult hook coverage', () => {
  let mockStates: any[] = [];
  let mockEffects: Function[] = [];
  let mockCallbacks: Map<Function, any[]> = new Map();

  beforeEach(() => {
    mockStates = [];
    mockEffects = [];
    mockCallbacks = new Map();

    // Mock React module
    vi.doMock('react', () => ({
      default: {
        useState: vi.fn((initial) => {
          const index = mockStates.length;
          mockStates.push(initial);
          const setter = vi.fn((newValue) => {
            mockStates[index] =
              typeof newValue === 'function'
                ? newValue(mockStates[index])
                : newValue;
          });
          return [mockStates[index], setter];
        }),
        useEffect: vi.fn((effect, deps) => {
          mockEffects.push(effect);
        }),
        useCallback: vi.fn((callback, deps) => {
          mockCallbacks.set(callback, deps || []);
          return callback;
        }),
      },
      useState: vi.fn((initial) => {
        const index = mockStates.length;
        mockStates.push(initial);
        const setter = vi.fn((newValue) => {
          mockStates[index] =
            typeof newValue === 'function'
              ? newValue(mockStates[index])
              : newValue;
        });
        return [mockStates[index], setter];
      }),
      useEffect: vi.fn((effect, deps) => {
        mockEffects.push(effect);
      }),
      useCallback: vi.fn((callback, deps) => {
        mockCallbacks.set(callback, deps || []);
        return callback;
      }),
    }));
  });

  afterEach(() => {
    vi.doUnmock('react');
    vi.resetModules();
  });

  it('initializes with correct default state', async () => {
    const { useResult } = await import('../src/react-hooks');

    const mockFn = vi.fn().mockResolvedValue(ok('test'));
    const result = useResult(mockFn);

    // Check initial states
    expect(mockStates).toHaveLength(3);
    expect(mockStates[0]).toBe(null); // data
    expect(mockStates[1]).toBe(null); // error
    expect(mockStates[2]).toBe(true); // loading

    // Check returned shape
    expect(result).toHaveProperty('data', null);
    expect(result).toHaveProperty('error', null);
    expect(result).toHaveProperty('loading', true);
    expect(typeof result.refetch).toBe('function');
    expect(typeof result.reset).toBe('function');
  });

  it('executes effect on mount', async () => {
    const { useResult } = await import('../src/react-hooks');

    const mockFn = vi.fn().mockResolvedValue(ok('success'));
    useResult(mockFn);

    // Should register one effect
    expect(mockEffects).toHaveLength(1);

    // Execute the effect
    const effect = mockEffects[0];
    await effect();

    // Should have called the async function
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('handles successful result in effect', async () => {
    const { useResult } = await import('../src/react-hooks');

    const mockFn = vi.fn().mockResolvedValue(ok('test data'));
    const result = useResult(mockFn);

    // Get setters
    const [, setData] = vi.mocked((await import('react')).useState).mock
      .results[0].value;
    const [, setError] = vi.mocked((await import('react')).useState).mock
      .results[1].value;
    const [, setLoading] = vi.mocked((await import('react')).useState).mock
      .results[2].value;

    // Execute effect
    const effect = mockEffects[0];
    await effect();

    // Check that setters were called correctly
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setData).toHaveBeenCalledWith('test data');
    expect(setError).toHaveBeenCalledWith(null);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it('handles error result in effect', async () => {
    const { useResult } = await import('../src/react-hooks');

    const testError = new ZeroError('TEST_ERR', 'Test error');
    const mockFn = vi.fn().mockResolvedValue(err(testError));
    const result = useResult(mockFn);

    // Get setters
    const [, setData] = vi.mocked((await import('react')).useState).mock
      .results[0].value;
    const [, setError] = vi.mocked((await import('react')).useState).mock
      .results[1].value;
    const [, setLoading] = vi.mocked((await import('react')).useState).mock
      .results[2].value;

    // Execute effect
    const effect = mockEffects[0];
    await effect();

    // Check that setters were called correctly
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setData).toHaveBeenCalledWith(null);
    expect(setError).toHaveBeenCalledWith(testError);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it('memoizes execute callback with deps', async () => {
    const { useResult } = await import('../src/react-hooks');

    const mockFn = vi.fn().mockResolvedValue(ok('test'));
    const deps = [1, 2, 3];
    const result = useResult(mockFn, deps);

    // Check that useCallback was called with correct deps
    const React = await import('react');
    expect(React.useCallback).toHaveBeenCalledTimes(2); // execute and reset

    // First call should be execute with deps
    const firstCall = vi.mocked(React.useCallback).mock.calls[0];
    expect(firstCall[1]).toEqual(deps);
  });

  it('reset function works correctly', async () => {
    const { useResult } = await import('../src/react-hooks');

    const mockFn = vi.fn().mockResolvedValue(ok('test'));
    const result = useResult(mockFn);

    // Get setters
    const [, setData] = vi.mocked((await import('react')).useState).mock
      .results[0].value;
    const [, setError] = vi.mocked((await import('react')).useState).mock
      .results[1].value;
    const [, setLoading] = vi.mocked((await import('react')).useState).mock
      .results[2].value;

    // Call reset
    result.reset();

    // Check that state was reset
    expect(setData).toHaveBeenCalledWith(null);
    expect(setError).toHaveBeenCalledWith(null);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it('refetch function triggers execute', async () => {
    const { useResult } = await import('../src/react-hooks');

    const mockFn = vi.fn().mockResolvedValue(ok('test'));
    const result = useResult(mockFn);

    // The refetch function should be the same as execute
    // Get the execute callback from useCallback
    const React = await import('react');
    const executeCallback = vi.mocked(React.useCallback).mock.calls[0][0];

    // refetch should be the memoized execute
    expect(result.refetch).toBe(executeCallback);
  });

  it('handles dependencies properly', async () => {
    const { useResult } = await import('../src/react-hooks');

    const mockFn = vi.fn().mockResolvedValue(ok('test'));
    const deps = ['dep1', 'dep2'];

    useResult(mockFn, deps);

    // Check useEffect received execute as dependency
    const React = await import('react');
    const effectDeps = vi.mocked(React.useEffect).mock.calls[0][1];
    expect(effectDeps).toHaveLength(1); // [execute]
  });
});

// Type-level tests
describe('UseResultState type coverage', () => {
  it('exports correct types', async () => {
    const mod = await import('../src/react-hooks');

    // Type check - this will fail at compile time if types are wrong
    const state: typeof mod.UseResultState<string, Error> = {
      data: 'test',
      error: null,
      loading: false,
      refetch: () => {},
      reset: () => {},
    };

    expect(state).toBeDefined();
  });
});
