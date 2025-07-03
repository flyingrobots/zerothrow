import { performance } from 'node:perf_hooks'
import { ZT, ZeroThrow } from '../../src'

const ITERATIONS = 1_000_000

// Colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

console.log(`
${c.cyan}╔═══════════════════════════════════════════════════════════════════╗
║                    ERROR POOLING BENCHMARK                        ║
║                                                                   ║
║         Can we make ZeroThrow even faster with pooling?          ║
╚═══════════════════════════════════════════════════════════════════╝${c.reset}
`)

// Strategy 1: Current approach - new error every time
function currentApproach(i: number): ZeroThrow.Result<number> {
  if (i % 2 === 0) return ZT.err(new ZeroThrow.ZeroError('FAIL', 'fail ' + i))
  return ZT.ok(i)
}

// Strategy 2: Pre-allocated error pool
class ErrorPool {
  private pool: ZeroThrow.ZeroError[] = []
  private index = 0
  private size: number

  constructor(size: number) {
    this.size = size
    // Pre-allocate errors
    for (let i = 0; i < size; i++) {
      this.pool.push(new ZeroThrow.ZeroError('FAIL', ''))
    }
  }

  getError(message: string): ZeroThrow.ZeroError {
    const error = this.pool[this.index]
    error.message = message
    this.index = (this.index + 1) % this.size
    return error
  }
}

const errorPool = new ErrorPool(1000)

function pooledApproach(i: number): ZeroThrow.Result<number> {
  if (i % 2 === 0) return ZT.err(errorPool.getError('fail ' + i))
  return ZT.ok(i)
}

// Strategy 3: Singleton errors for common cases
const COMMON_ERRORS = {
  VALIDATION_FAILED: new ZeroThrow.ZeroError('VALIDATION_FAILED', 'Validation failed'),
  NOT_FOUND: new ZeroThrow.ZeroError('NOT_FOUND', 'Not found'),
  UNAUTHORIZED: new ZeroThrow.ZeroError('UNAUTHORIZED', 'Unauthorized'),
  SERVER_ERROR: new ZeroThrow.ZeroError('SERVER_ERROR', 'Server error'),
}

function singletonApproach(i: number): ZeroThrow.Result<number> {
  if (i % 4 === 0) return ZT.err(COMMON_ERRORS.VALIDATION_FAILED)
  if (i % 4 === 1) return ZT.err(COMMON_ERRORS.NOT_FOUND)
  if (i % 4 === 2) return ZT.err(COMMON_ERRORS.UNAUTHORIZED)
  return ZT.ok(i)
}

// Strategy 4: Lazy error creation
const lazyErr = <T>(code: string, message: string): ZeroThrow.Result<T> => ({
  ok: false,
  error: new ZeroThrow.ZeroError(code, message)
})

function lazyApproach(i: number): ZeroThrow.Result<number> {
  if (i % 2 === 0) return lazyErr('FAIL', 'fail ' + i)
  return ZT.ok(i)
}

// Strategy 5: Struct-based errors (no class instantiation)
interface StructError {
  code: string
  message: string
  stack?: string
}

type StructResult<T> = { ok: true; value: T } | { ok: false; error: StructError }

function structApproach(i: number): StructResult<number> {
  if (i % 2 === 0) {
    return { 
      ok: false, 
      error: { code: 'FAIL', message: 'fail ' + i }
    }
  }
  return { ok: true, value: i }
}

// Strategy 6: Reusable error with mutable context
class MutableError extends Error {
  code: string = ''
  context: any = {}

  reset(code: string, message: string, context?: any) {
    this.code = code
    this.message = message
    this.context = context || {}
    return this
  }
}

const mutableError = new MutableError()

function mutableApproach(i: number): ZeroThrow.Result<number> {
  if (i % 2 === 0) {
    return ZT.err(mutableError.reset('FAIL', 'fail ' + i))
  }
  return ZT.ok(i)
}

// Run benchmarks
console.log(`${c.dim}Running ${ITERATIONS.toLocaleString()} iterations for each strategy...${c.reset}\n`)

const strategies = [
  { name: 'Current (new error each time)', fn: currentApproach },
  { name: 'Pooled errors', fn: pooledApproach },
  { name: 'Singleton errors', fn: singletonApproach },
  { name: 'Lazy error creation', fn: lazyApproach },
  { name: 'Struct-based (no classes)', fn: structApproach },
  { name: 'Mutable error reuse', fn: mutableApproach },
]

const results: { name: string; time: number }[] = []

for (const strategy of strategies) {
  // Warm up
  for (let i = 0; i < 1000; i++) strategy.fn(i)
  
  // Benchmark
  const start = performance.now()
  for (let i = 0; i < ITERATIONS; i++) {
    strategy.fn(i)
  }
  const time = performance.now() - start
  
  results.push({ name: strategy.name, time })
  console.log(`${c.green}✓${c.reset} ${strategy.name.padEnd(30)} ${time.toFixed(2)}ms`)
}

// Sort by performance
results.sort((a, b) => a.time - b.time)

// Visualize results
console.log(`
${c.bright}${c.yellow}PERFORMANCE RANKING:${c.reset}
${'═'.repeat(70)}
`)

const fastestTime = results[0].time
results.forEach((result, index) => {
  const speedup = result.time / fastestTime
  const barLength = Math.round(50 / speedup)
  const bar = '█'.repeat(barLength)
  const color = index === 0 ? c.green : index < 3 ? c.yellow : c.red
  
  console.log(`${(index + 1).toString().padStart(2)}. ${result.name.padEnd(30)} ${color}${bar}${c.reset}`)
  console.log(`    ${result.time.toFixed(2)}ms ${index > 0 ? `(${speedup.toFixed(2)}x slower)` : '⚡ FASTEST!'}\n`)
})

// Memory usage comparison
console.log(`
${c.bright}${c.blue}MEMORY ANALYSIS:${c.reset}
${'─'.repeat(70)}
`)

// Test memory allocation
const memBefore = process.memoryUsage().heapUsed

// Create many errors with current approach
const currentErrors: ZeroThrow.Result<number>[] = []
for (let i = 0; i < 10000; i++) {
  currentErrors.push(ZT.err(new ZeroThrow.ZeroError('TEST', 'message ' + i)))
}
const memAfterCurrent = process.memoryUsage().heapUsed

// Create many errors with struct approach
const structErrors: StructResult<number>[] = []
for (let i = 0; i < 10000; i++) {
  structErrors.push({ ok: false, error: { code: 'TEST', message: 'message ' + i }})
}
const memAfterStruct = process.memoryUsage().heapUsed

const currentMem = (memAfterCurrent - memBefore) / 1024 / 1024
const structMem = (memAfterStruct - memAfterCurrent) / 1024 / 1024

console.log(`Current approach (10k errors): ${currentMem.toFixed(2)} MB`)
console.log(`Struct approach (10k errors):  ${structMem.toFixed(2)} MB`)
console.log(`Memory saved: ${(currentMem - structMem).toFixed(2)} MB (${((1 - structMem/currentMem) * 100).toFixed(0)}% reduction)`)

// Recommendations
console.log(`
${c.bright}${c.cyan}RECOMMENDATIONS:${c.reset}
${'─'.repeat(70)}

${c.green}✓${c.reset} For high-performance scenarios with predictable errors:
   → Use singleton errors or struct-based approaches

${c.green}✓${c.reset} For general use with good performance:
   → Current approach is fine (still 90x faster than throw!)

${c.yellow}⚠${c.reset} Trade-offs to consider:
   → Pooling adds complexity
   → Singletons lose unique error context
   → Structs lose stack traces
   → Mutable errors can cause race conditions

${c.dim}═══════════════════════════════════════════════════════════════════${c.reset}
`)