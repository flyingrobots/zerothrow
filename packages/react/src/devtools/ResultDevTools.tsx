/**
 * @file Development tools component for Result state debugging
 */

import React, { useState, useEffect } from 'react'
import type { IntrospectionData } from '../hooks/useStateIntrospection.js'

/**
 * Position options for the DevTools panel
 */
export type DevToolsPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

/**
 * Theme options for the DevTools panel
 */
export type DevToolsTheme = 'light' | 'dark' | 'auto'

/**
 * Props for the ResultDevTools component
 */
export interface ResultDevToolsProps {
  /**
   * Position of the floating panel
   * @default 'bottom-right'
   */
  position?: DevToolsPosition
  
  /**
   * Whether the panel starts open
   * @default false
   */
  defaultOpen?: boolean
  
  /**
   * Theme for the panel
   * @default 'auto'
   */
  theme?: DevToolsTheme
  
  /**
   * Maximum height of the panel
   * @default '400px'
   */
  maxHeight?: string
}

/**
 * Global registry for Result state introspection data
 */
interface DevToolsRegistry {
  [key: string]: IntrospectionData<unknown, Error>
}

/**
 * Development tools component that provides a floating panel for debugging
 * Result hook states across the application.
 * 
 * @example
 * ```tsx
 * // In your app root (development only)
 * function App() {
 *   return (
 *     <>
 *       <YourApp />
 *       {process.env.NODE_ENV === 'development' && (
 *         <ResultDevTools position="bottom-right" defaultOpen />
 *       )}
 *     </>
 *   )
 * }
 * ```
 */
export function ResultDevTools({
  position = 'bottom-right',
  defaultOpen = false,
  theme = 'auto',
  maxHeight = '400px'
}: ResultDevToolsProps): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [registry, setRegistry] = useState<DevToolsRegistry>({})
  const [selectedHook, setSelectedHook] = useState<string | null>(null)
  
  // Only render in development
  if (process.env['NODE_ENV'] !== 'development') {
    return null
  }
  
  // Set up global DevTools registry
  useEffect(() => {
    const devTools = {
      register: (name: string, data: IntrospectionData<unknown, Error>) => {
        setRegistry(prev => ({ ...prev, [name]: data }))
      },
      unregister: (name: string) => {
        setRegistry(prev => {
          const next = { ...prev }
          delete next[name]
          return next
        })
      }
    }
    
    if (typeof window !== 'undefined') {
      window.__ZEROTHROW_DEVTOOLS__ = devTools
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__ZEROTHROW_DEVTOOLS__
      }
    }
  }, [])
  
  const getPositionStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
      fontFamily: 'monospace',
      fontSize: '12px'
    }
    
    switch (position) {
      case 'top-left':
        return { ...baseStyles, top: '20px', left: '20px' }
      case 'top-right':
        return { ...baseStyles, top: '20px', right: '20px' }
      case 'bottom-left':
        return { ...baseStyles, bottom: '20px', left: '20px' }
      case 'bottom-right':
        return { ...baseStyles, bottom: '20px', right: '20px' }
      default:
        return { ...baseStyles, bottom: '20px', right: '20px' }
    }
  }
  
  const getThemeStyles = (): React.CSSProperties => {
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    
    return {
      backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
      color: isDark ? '#ffffff' : '#000000',
      border: `1px solid ${isDark ? '#444' : '#ccc'}`,
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
    }
  }
  
  const formatDuration = (duration: number): string => {
    if (duration < 1000) return `${duration}ms`
    return `${(duration / 1000).toFixed(1)}s`
  }
  
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString()
  }
  
  const getStatusColor = (data: IntrospectionData<unknown, Error>): string => {
    if (data.loading.type === 'error') return '#ef4444'
    if (data.loading.type === 'success') return '#10b981'
    if (data.loading.type === 'pending' || data.loading.type === 'refreshing') return '#3b82f6'
    if (data.loading.type === 'retrying') return '#f59e0b'
    return '#6b7280'
  }
  
  const hookNames = Object.keys(registry)
  const selectedData = selectedHook ? registry[selectedHook] : null
  
  return (
    <div style={getPositionStyles()}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            ...getThemeStyles(),
            padding: '8px 12px',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '20px'
          }}
        >
          🛠️ ZT DevTools ({hookNames.length})
        </button>
      ) : (
        <div
          style={{
            ...getThemeStyles(),
            width: '350px',
            maxHeight,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#eee'}`
            }}
          >
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
              🛠️ ZeroThrow DevTools
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                color: 'inherit'
              }}
            >
              ✕
            </button>
          </div>
          
          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {hookNames.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                No Result hooks with introspection enabled
              </div>
            ) : (
              <>
                {/* Hook List */}
                <div style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>
                    Active Hooks ({hookNames.length})
                  </h4>
                  {hookNames.map(name => {
                    const data = registry[name]
                    const isSelected = selectedHook === name
                    return (
                      <div
                        key={name}
                        onClick={() => setSelectedHook(isSelected ? null : name)}
                        style={{
                          padding: '6px 8px',
                          margin: '2px 0',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: isSelected 
                            ? (theme === 'dark' ? '#374151' : '#f3f4f6')
                            : 'transparent',
                          border: `1px solid ${isSelected && data ? getStatusColor(data) : 'transparent'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>
                          {name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: data ? getStatusColor(data) : '#6b7280'
                            }}
                          />
                          <span style={{ fontSize: '10px', color: '#6b7280' }}>
                            {data?.loading.type || 'unknown'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                {/* Selected Hook Details */}
                {selectedData && (
                  <div
                    style={{
                      borderTop: `1px solid ${theme === 'dark' ? '#444' : '#eee'}`,
                      padding: '12px'
                    }}
                  >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>
                      {selectedHook} Details
                    </h4>
                    
                    {/* Current State */}
                    <div style={{ marginBottom: '12px' }}>
                      <strong>State:</strong> {selectedData.loading.type}
                      {selectedData.flags.executing && (
                        <span style={{ color: '#3b82f6', marginLeft: '8px' }}>
                          (executing)
                        </span>
                      )}
                      {selectedData.flags.retrying && (
                        <span style={{ color: '#f59e0b', marginLeft: '8px' }}>
                          (retrying)
                        </span>
                      )}
                    </div>
                    
                    {/* Metrics */}
                    <div style={{ marginBottom: '12px' }}>
                      <div><strong>Success Rate:</strong> {(selectedData.metrics.successRate * 100).toFixed(1)}%</div>
                      <div><strong>Total Requests:</strong> {selectedData.metrics.totalRequests}</div>
                      <div><strong>Avg Duration:</strong> {formatDuration(selectedData.metrics.averageDuration)}</div>
                      <div><strong>Renders:</strong> {selectedData.debug.renderCount}</div>
                    </div>
                    
                    {/* Recent History */}
                    {selectedData.history.length > 0 && (
                      <div>
                        <strong>Recent History:</strong>
                        <div style={{ maxHeight: '120px', overflow: 'auto', marginTop: '4px' }}>
                          {selectedData.history.slice(-5).reverse().map((entry, index) => (
                            <div
                              key={index}
                              style={{
                                padding: '4px',
                                margin: '2px 0',
                                borderRadius: '2px',
                                backgroundColor: theme === 'dark' ? '#374151' : '#f9fafb',
                                fontSize: '10px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{entry.state.ok ? '✅' : '❌'} {entry.trigger}</span>
                                <span>{formatTimestamp(entry.timestamp)}</span>
                              </div>
                              {entry.duration && (
                                <div style={{ color: '#6b7280' }}>
                                  {formatDuration(entry.duration)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}