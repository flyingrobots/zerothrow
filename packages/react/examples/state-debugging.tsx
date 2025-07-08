/**
 * @file Advanced State Debugging Example
 * 
 * This example demonstrates how to use the new state introspection features
 * to debug and monitor Result-based React hooks.
 */

import React, { useState } from 'react'
import { ZT, useResult, ResultDevTools, type Result } from '@zerothrow/react'

// Simulate API responses with different outcomes
const simulateApiCall = async (shouldFail = false, delay = 1000): Promise<Result<string, Error>> => {
  await new Promise(resolve => setTimeout(resolve, delay))
  
  if (shouldFail) {
    return ZT.err(new Error('API call failed'))
  }
  
  return ZT.ok(`Data fetched at ${new Date().toLocaleTimeString()}`)
}

// Component demonstrating granular loading states
function LoadingStateDemo() {
  const [shouldFail, setShouldFail] = useState(false)
  
  const { result, loading, loadingState, state, reload, introspect } = useResult(
    () => simulateApiCall(shouldFail),
    { 
      immediate: false,
      introspection: {
        name: 'ApiDataFetch',
        historyLimit: 10,
        trackMetrics: true
      }
    }
  )

  const getLoadingMessage = () => {
    switch (loadingState.type) {
      case 'idle':
        return 'Ready to fetch data'
      case 'pending':
        return `Loading... (started ${Math.round((Date.now() - loadingState.startedAt) / 1000)}s ago)`
      case 'refreshing':
        return 'Refreshing data...'
      case 'retrying':
        return `Retrying... (attempt ${loadingState.attempt}/${loadingState.maxAttempts})`
      case 'success':
        return `✅ Success (took ${loadingState.duration}ms)`
      case 'error':
        return `❌ Error (${loadingState.error.message})`
      default:
        return 'Unknown state'
    }
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '10px' }}>
      <h3>Loading State Demo</h3>
      
      {/* Controls */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={reload} disabled={loading}>
          {loading ? 'Loading...' : 'Fetch Data'}
        </button>
        <label style={{ marginLeft: '20px' }}>
          <input
            type="checkbox"
            checked={shouldFail}
            onChange={(e) => setShouldFail(e.target.checked)}
          />
          Simulate failure
        </label>
      </div>

      {/* State Information */}
      <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        <div><strong>Status:</strong> {getLoadingMessage()}</div>
        <div><strong>State Flags:</strong></div>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>Idle: {state.idle ? '✅' : '❌'}</li>
          <li>Executing: {state.executing ? '✅' : '❌'}</li>
          <li>Retrying: {state.retrying ? '✅' : '❌'}</li>
          <li>Settled: {state.settled ? '✅' : '❌'}</li>
          <li>Attempt: {state.attempt}</li>
        </ul>
      </div>

      {/* Result Display */}
      {result && (
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: result.isOk() ? '#e8f5e8' : '#f5e8e8', borderRadius: '4px' }}>
          {result.match({
            ok: (data) => <div><strong>Data:</strong> {data}</div>,
            err: (error) => <div><strong>Error:</strong> {error.message}</div>
          })}
        </div>
      )}

      {/* Metrics (when introspection is enabled) */}
      {introspect && (
        <div style={{ marginTop: '15px' }}>
          <h4>Metrics</h4>
          <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            <div>Total Requests: {introspect.metrics.totalRequests}</div>
            <div>Success Rate: {(introspect.metrics.successRate * 100).toFixed(1)}%</div>
            <div>Average Duration: {introspect.metrics.averageDuration}ms</div>
            <div>Renders: {introspect.debug.renderCount}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// Component demonstrating retry behavior
function RetryDemo() {
  const [failureCount, setFailureCount] = useState(2)
  let attemptCount = 0

  const { result, loadingState, state, reload, introspect } = useResult(
    async () => {
      attemptCount++
      if (attemptCount <= failureCount) {
        return ZT.err(new Error(`Attempt ${attemptCount} failed`))
      }
      return ZT.ok(`Success on attempt ${attemptCount}`)
    },
    { 
      immediate: false,
      introspection: {
        name: 'RetryExample',
        historyLimit: 20
      }
    }
  )

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '10px' }}>
      <h3>Retry Behavior Demo</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => { attemptCount = 0; reload(); }}>
          Start Request (fail {failureCount} times)
        </button>
        <label style={{ marginLeft: '20px' }}>
          Failures before success:
          <input
            type="number"
            value={failureCount}
            onChange={(e) => setFailureCount(parseInt(e.target.value) || 0)}
            min="0"
            max="5"
            style={{ width: '50px', marginLeft: '5px' }}
          />
        </label>
      </div>

      {/* Current State */}
      <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        <div><strong>Current Attempt:</strong> {state.attempt}</div>
        <div><strong>Is Retrying:</strong> {state.isRetrying ? 'Yes' : 'No'}</div>
        {loadingState.type === 'retrying' && (
          <div><strong>Next Retry:</strong> {new Date(loadingState.nextRetryAt).toLocaleTimeString()}</div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: result.isOk() ? '#e8f5e8' : '#f5e8e8', borderRadius: '4px' }}>
          {result.match({
            ok: (data) => <div>✅ {data}</div>,
            err: (error) => <div>❌ {error.message}</div>
          })}
        </div>
      )}

      {/* History */}
      {introspect && introspect.history.length > 0 && (
        <div style={{ marginTop: '15px' }}>
          <h4>Request History</h4>
          <div style={{ maxHeight: '150px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
            {introspect.history.slice().reverse().map((entry, index) => (
              <div
                key={index}
                style={{
                  padding: '5px 10px',
                  borderBottom: index < introspect.history.length - 1 ? '1px solid #eee' : 'none',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{entry.state.isOk() ? '✅' : '❌'} {entry.trigger}</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                {entry.duration && (
                  <div style={{ color: '#666', fontSize: '10px' }}>
                    {entry.duration}ms
                    {entry.attempt && ` (attempt ${entry.attempt})`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Component demonstrating comparison between old and new API
function BackwardCompatibilityDemo() {
  const [showNew, setShowNew] = useState(true)

  // Old API usage (still works)
  const oldApi = useResult(() => simulateApiCall(false, 500))

  // New API usage with introspection
  const newApi = useResult(
    () => simulateApiCall(false, 500),
    { introspection: { name: 'NewApiDemo' } }
  )

  const currentApi = showNew ? newApi : oldApi

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '10px' }}>
      <h3>Backward Compatibility Demo</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setShowNew(!showNew)}>
          Switch to {showNew ? 'Old' : 'New'} API
        </button>
        <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>
          Currently showing: {showNew ? 'New' : 'Old'} API
        </span>
      </div>

      {/* Common properties (both APIs) */}
      <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        <div><strong>Loading:</strong> {currentApi.loading ? 'Yes' : 'No'}</div>
        <div><strong>Result:</strong> {currentApi.result?.isOk() ? 'Success' : 'Error/None'}</div>
        
        {/* New API only properties */}
        {showNew && 'loadingState' in currentApi && (
          <>
            <div><strong>Loading State:</strong> {currentApi.loadingState.type}</div>
            <div><strong>State Flags:</strong> idle={currentApi.state.idle ? 'true' : 'false'}, executing={currentApi.state.executing ? 'true' : 'false'}</div>
            {currentApi.introspect && (
              <div><strong>Metrics:</strong> {currentApi.introspect.metrics.totalRequests} requests, {(currentApi.introspect.metrics.successRate * 100).toFixed(1)}% success rate</div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e8f5ff', borderRadius: '4px', fontSize: '14px' }}>
        <strong>Note:</strong> The {showNew ? 'new' : 'old'} API {showNew ? 'provides enhanced state information while maintaining' : 'maintains'} full backward compatibility.
        {showNew ? ' All existing code continues to work unchanged.' : ' Upgrade to the new API for enhanced debugging capabilities.'}
      </div>
    </div>
  )
}

// Main demo application
export default function StateDebuggingExample() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Advanced State Introspection Demo</h1>
      <p>
        This example demonstrates the new state introspection features for Result-based React hooks.
        These features provide granular visibility into loading states, retry behavior, and performance metrics.
      </p>

      <LoadingStateDemo />
      <RetryDemo />
      <BackwardCompatibilityDemo />

      {/* DevTools component (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <ResultDevTools 
          position="bottom-right" 
          defaultOpen={true}
          theme="auto"
        />
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '8px' }}>
        <h3>💡 Try This</h3>
        <ul>
          <li>Click the "Fetch Data" button and watch the loading states change</li>
          <li>Toggle "Simulate failure" to see error handling</li>
          <li>Try the retry demo with different failure counts</li>
          <li>Open the DevTools panel (bottom-right) to see all hook states</li>
          <li>Compare the old vs new API to see backward compatibility</li>
        </ul>
      </div>
    </div>
  )
}