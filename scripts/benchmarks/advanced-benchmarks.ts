import { performance } from 'node:perf_hooks'
import { ok, err, wrap, Result, ZeroError } from '../src'

const ITERATIONS = 100_000

// Benchmark runner helper
function bench(name: string, fn: () => void | Promise<void>): number {
  const start = performance.now()
  fn()
  const end = performance.now()
  const time = end - start
  console.log(`${name}: ${time.toFixed(2)}ms`)
  return time
}

async function benchAsync(name: string, fn: () => Promise<void>): Promise<number> {
  const start = performance.now()
  await fn()
  const end = performance.now()
  const time = end - start
  console.log(`${name}: ${time.toFixed(2)}ms`)
  return time
}

console.log('🚀 ZeroThrow Advanced Benchmarks')
console.log('================================\n')

// 1. Simple error handling (baseline)
console.log('1️⃣  Simple Error Handling (1M iterations)')
console.log('─────────────────────────────────────────')

function throwCatchSimple(i: number) {
  try {
    if (i % 2 === 0) throw new Error('fail ' + i)
    return i
  } catch (e) {
    return -1
  }
}

function resultSimple(i: number): Result<number> {
  if (i % 2 === 0) return err(new ZeroError('FAIL', 'fail ' + i))
  return ok(i)
}

bench('throw/catch', () => {
  for (let i = 0; i < ITERATIONS * 10; i++) throwCatchSimple(i)
})

bench('Result pattern', () => {
  for (let i = 0; i < ITERATIONS * 10; i++) resultSimple(i)
})

console.log()

// 2. Nested error handling (3 levels deep)
console.log('2️⃣  Nested Error Handling (3 levels)')
console.log('───────────────────────────────────')

function nestedThrow(i: number) {
  try {
    try {
      try {
        if (i % 10 === 0) throw new Error('deep error')
        return i * 2
      } catch {
        throw new Error('wrapped: ' + (e as Error).message)
      }
    } catch {
      throw new Error('double wrapped: ' + (e as Error).message)
    }
  } catch (e) {
    return null
  }
}

function nestedResult(i: number): Result<number> {
  const r1 = i % 10 === 0 
    ? err(new ZeroError('DEEP_ERR', 'deep error')) 
    : ok(i * 2)
  
  if (!r1.ok) {
    const r2 = err(wrap(r1.error, 'WRAPPED', 'wrapped error'))
    const r3 = err(wrap(r2.error, 'DOUBLE_WRAPPED', 'double wrapped error'))
    return r3
  }
  
  return r1
}

bench('nested throw/catch', () => {
  for (let i = 0; i < ITERATIONS; i++) nestedThrow(i)
})

bench('nested Result', () => {
  for (let i = 0; i < ITERATIONS; i++) nestedResult(i)
})

console.log()

// 3. Error context propagation
console.log('3️⃣  Error Context Propagation')
console.log('────────────────────────────')

interface UserContext {
  userId: string
  action: string
  timestamp: number
  [key: string]: unknown // Add index signature for ErrorContext compatibility
}

function throwWithContext(userId: string) {
  try {
    throw new Error('User not found')
  } catch (e) {
    const error = e as Error
    // Manually building context string
    error.message = `${error.message} (userId: ${userId}, action: fetch, timestamp: ${Date.now()})`
    throw error
  }
}

function resultWithContext(userId: string): Result<void> {
  const context: UserContext = {
    userId,
    action: 'fetch',
    timestamp: Date.now()
  }
  return err(new ZeroError('USER_NOT_FOUND', 'User not found', { context }))
}

bench('throw with manual context', () => {
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      throwWithContext('user' + i)
    } catch {
      // Handle error
    }
  }
})

bench('Result with typed context', () => {
  for (let i = 0; i < ITERATIONS; i++) {
    const r = resultWithContext('user' + i)
    if (!r.ok) {
      // Access r.error.context with full type safety
    }
  }
})

console.log()

// 4. Async error handling
console.log('4️⃣  Async Error Handling')
console.log('───────────────────────')

async function asyncThrow(i: number): Promise<number> {
  try {
    await Promise.resolve()
    if (i % 2 === 0) throw new Error('async fail')
    return i
  } catch (e) {
    return -1
  }
}

async function asyncResult(i: number): Promise<Result<number>> {
  await Promise.resolve()
  if (i % 2 === 0) return err(new ZeroError('ASYNC_FAIL', 'async fail'))
  return ok(i)
}

await benchAsync('async throw/catch', async () => {
  const promises: Promise<number>[] = []
  for (let i = 0; i < ITERATIONS / 10; i++) {
    promises.push(asyncThrow(i))
  }
  await Promise.all(promises)
})

await benchAsync('async Result', async () => {
  const promises: Promise<Result<number>>[] = []
  for (let i = 0; i < ITERATIONS / 10; i++) {
    promises.push(asyncResult(i))
  }
  await Promise.all(promises)
})

console.log()

// 5. Array processing with early bailout
console.log('5️⃣  Array Processing with Early Bailout')
console.log('──────────────────────────────────────')

function processArrayThrow(items: number[]): number[] {
  const results: number[] = []
  try {
    for (const item of items) {
      if (item < 0) throw new Error('negative number')
      results.push(item * 2)
    }
    return results
  } catch (e) {
    return []
  }
}

function processArrayResult(items: number[]): Result<number[]> {
  const results: number[] = []
  for (const item of items) {
    if (item < 0) {
      return err(new ZeroError('NEGATIVE_NUMBER', 'negative number', { 
        context: { item, index: results.length }
      }))
    }
    results.push(item * 2)
  }
  return ok(results)
}

const testArrays = Array.from({ length: 1000 }, () => 
  Array.from({ length: 100 }, () => Math.random() > 0.1 ? Math.floor(Math.random() * 100) : -1)
)

bench('array throw/catch', () => {
  for (const arr of testArrays) {
    processArrayThrow(arr)
  }
})

bench('array Result', () => {
  for (const arr of testArrays) {
    processArrayResult(arr)
  }
})

console.log()

// 6. Memory usage comparison
console.log('6️⃣  Memory Usage Comparison')
console.log('─────────────────────────')

const beforeThrow = process.memoryUsage().heapUsed
const throwErrors: Error[] = []
for (let i = 0; i < 10000; i++) {
  throwErrors.push(new Error(`Error ${i} with some context data`))
}
const afterThrow = process.memoryUsage().heapUsed

const beforeResult = process.memoryUsage().heapUsed
const resultErrors: ZeroError[] = []
for (let i = 0; i < 10000; i++) {
  resultErrors.push(new ZeroError('ERR_CODE', `Error ${i}`, { 
    context: { index: i, data: 'some context data' }
  }))
}
const afterResult = process.memoryUsage().heapUsed

console.log(`Error objects (10k): ${((afterThrow - beforeThrow) / 1024 / 1024).toFixed(2)} MB`)
console.log(`ZeroError objects (10k): ${((afterResult - beforeResult) / 1024 / 1024).toFixed(2)} MB`)

console.log('\n✅ Benchmarks complete!')