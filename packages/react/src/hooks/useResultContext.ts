import { useContext, createContext, type Context } from 'react'
import { ZT, type Result } from '@zerothrow/core'

export class ContextError extends Error {
  readonly code = 'CONTEXT_NOT_FOUND' as const
  readonly contextName: string
  
  constructor(contextName: string) {
    super(`useResultContext: Context "${contextName}" not found. Did you forget to wrap your component in a provider?`)
    this.name = 'ContextError'
    this.contextName = contextName
  }
}

/**
 * A Result-based version of React's useContext hook.
 * 
 * Instead of throwing when context is not available, this hook returns
 * a Result that can be pattern matched for safe error handling.
 * 
 * @example
 * ```tsx
 * const ThemeContext = createContext<Theme | undefined>(undefined)
 * 
 * function MyComponent() {
 *   const themeResult = useResultContext(ThemeContext)
 *   
 *   return themeResult.match({
 *     ok: (theme) => <div style={{ color: theme.primary }}>Themed</div>,
 *     err: (error) => <div>No theme provider found</div>
 *   })
 * }
 * ```
 */
export function useResultContext<T>(
  context: Context<T | undefined>,
  options?: {
    /** Custom context name for better error messages */
    contextName?: string
  }
): Result<T, Error> {
  const value = useContext(context)
  
  if (value === undefined) {
    const contextName = options?.contextName || context.displayName || 'Unknown'
    return ZT.err(new ContextError(contextName))
  }
  
  return ZT.ok(value)
}

/**
 * A Result-based version of React's useContext hook that handles null values.
 * 
 * This variant treats both undefined and null as missing context values.
 * 
 * @example
 * ```tsx
 * const AuthContext = createContext<User | null>(null)
 * 
 * function Profile() {
 *   const userResult = useResultContextNullable(AuthContext)
 *   
 *   return userResult.match({
 *     ok: (user) => <div>Welcome {user.name}</div>,
 *     err: () => <div>Please log in</div>
 *   })
 * }
 * ```
 */
export function useResultContextNullable<T>(
  context: Context<T | undefined | null>,
  options?: {
    /** Custom context name for better error messages */
    contextName?: string
  }
): Result<T, Error> {
  const value = useContext(context)
  
  if (value === undefined || value === null) {
    const contextName = options?.contextName || context.displayName || 'Unknown'
    return ZT.err(new ContextError(contextName))
  }
  
  return ZT.ok(value)
}

/**
 * Creates a Result-based context with a companion hook.
 * 
 * This helper creates both a Context and a custom hook that uses
 * useResultContext internally, providing a complete solution for
 * Result-based context patterns.
 * 
 * @example
 * ```tsx
 * const { Provider, useContext } = createResultContext<UserSettings>('UserSettings')
 * 
 * // In your app
 * <Provider value={settings}>
 *   <App />
 * </Provider>
 * 
 * // In a component
 * function Profile() {
 *   const settingsResult = useContext()
 *   
 *   return settingsResult.match({
 *     ok: (settings) => <div>{settings.name}</div>,
 *     err: () => <div>No settings available</div>
 *   })
 * }
 * ```
 */
export function createResultContext<T>(contextName: string) {
  const Context = createContext<T | undefined>(undefined)
  Context.displayName = contextName
  
  return {
    Provider: Context.Provider,
    useContext: () => useResultContext(Context, { contextName }),
    Context
  }
}