import { performance } from 'node:perf_hooks'
import { ok, err, wrap, Result, ZeroError } from '../../src'

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
}

// Benchmark result type
interface BenchResult {
  name: string
  throwTime: number
  resultTime: number
  iterations: number
}

// Visual bar chart
function drawBar(value: number, maxValue: number, width: number, color: string): string {
  const percentage = value / maxValue
  const filled = Math.round(percentage * width)
  const empty = width - filled
  
  const blocks = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']
  const fullBlocks = Math.floor(filled)
  const partialBlock = (filled - fullBlocks) * blocks.length
  const partialIndex = Math.floor(partialBlock)
  
  let bar = color
  bar += '█'.repeat(Math.max(0, fullBlocks))
  if (partialIndex > 0 && fullBlocks < width && fullBlocks >= 0) {
    bar += blocks[partialIndex]
  }
  const emptyCount = Math.max(0, empty - (partialIndex > 0 ? 1 : 0))
  bar += colors.dim + '░'.repeat(emptyCount) + colors.reset
  
  return bar
}

// Format time with unit
function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// Calculate speedup
function getSpeedup(throwTime: number, resultTime: number): string {
  const speedup = throwTime / resultTime
  if (speedup > 1) {
    return `${colors.green}${speedup.toFixed(1)}x faster${colors.reset}`
  } else {
    return `${colors.red}${(1/speedup).toFixed(1)}x slower${colors.reset}`
  }
}

// Draw comparison visualization
function drawComparison(result: BenchResult) {
  console.log(`\n${colors.bright}${colors.cyan}▶ ${result.name}${colors.reset}`)
  console.log(`${colors.dim}  ${result.iterations.toLocaleString()} iterations${colors.reset}`)
  console.log()
  
  const maxTime = Math.max(result.throwTime, result.resultTime)
  const barWidth = 40
  
  // throw/catch bar
  const throwBar = drawBar(result.throwTime, maxTime, barWidth, colors.red)
  const throwLabel = `throw/catch ${throwBar} ${formatTime(result.throwTime)}`
  console.log(`  ${throwLabel}`)
  
  // Result bar
  const resultBar = drawBar(result.resultTime, maxTime, barWidth, colors.green)
  const resultLabel = `Result      ${resultBar} ${formatTime(result.resultTime)}`
  console.log(`  ${resultLabel}`)
  
  // Speedup
  console.log(`  ${colors.dim}└─${colors.reset} ${getSpeedup(result.throwTime, result.resultTime)}`)
}

// ASCII art header
function drawHeader() {
  console.clear()
  console.log(colors.cyan + `
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   ███████╗███████╗██████╗  ██████╗ ████████╗██╗  ██╗██████╗     ║
║   ╚══███╔╝██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝██║  ██║██╔══██╗    ║
║     ███╔╝ █████╗  ██████╔╝██║   ██║   ██║   ███████║██████╔╝    ║
║    ███╔╝  ██╔══╝  ██╔══██╗██║   ██║   ██║   ██╔══██║██╔══██╗    ║
║   ███████╗███████╗██║  ██║╚██████╔╝   ██║   ██║  ██║██║  ██║    ║
║   ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝    ║
║                                                                  ║
║            ${colors.yellow}⚡ Performance Benchmarks Dashboard ⚡${colors.cyan}                ║
╚══════════════════════════════════════════════════════════════════╝
` + colors.reset)
}

// Performance summary box
function drawSummary(results: BenchResult[]) {
  const totalThrow = results.reduce((sum, r) => sum + r.throwTime, 0)
  const totalResult = results.reduce((sum, r) => sum + r.resultTime, 0)
  const avgSpeedup = totalThrow / totalResult
  
  console.log(`
${colors.bright}${colors.blue}┌─────────────────────────────────────────┐
│           PERFORMANCE SUMMARY           │
├─────────────────────────────────────────┤${colors.reset}
│ Total throw/catch time: ${colors.red}${formatTime(totalThrow).padEnd(15)}${colors.reset}│
│ Total Result time:      ${colors.green}${formatTime(totalResult).padEnd(15)}${colors.reset}│
│ Average speedup:        ${colors.bright}${colors.yellow}${avgSpeedup.toFixed(1)}x${colors.reset}${' '.repeat(13)}│
${colors.bright}${colors.blue}└─────────────────────────────────────────┘${colors.reset}`)
}

// Animated progress bar
async function runWithProgress(name: string, fn: () => Promise<BenchResult>): Promise<BenchResult> {
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let i = 0
  
  process.stdout.write(`\n${colors.dim}Running ${name}... ${spinner[0]}${colors.reset}`)
  
  const interval = setInterval(() => {
    process.stdout.write(`\r${colors.dim}Running ${name}... ${spinner[++i % spinner.length]}${colors.reset}`)
  }, 80)
  
  const result = await fn()
  
  clearInterval(interval)
  process.stdout.write(`\r${colors.green}✓${colors.reset} ${name} complete!${' '.repeat(20)}\n`)
  
  return result
}

// Benchmark functions
async function benchmarkSimple(): Promise<BenchResult> {
  const ITERATIONS = 1_000_000
  
  function throwCatch(i: number) {
    try {
      if (i % 2 === 0) throw new Error('fail')
      return i
    } catch {
      return -1
    }
  }
  
  function resultPattern(i: number): Result<number> {
    if (i % 2 === 0) return err(new ZeroError('FAIL', 'fail'))
    return ok(i)
  }
  
  const t0 = performance.now()
  for (let i = 0; i < ITERATIONS; i++) throwCatch(i)
  const t1 = performance.now()
  
  for (let i = 0; i < ITERATIONS; i++) resultPattern(i)
  const t2 = performance.now()
  
  return {
    name: 'Simple Error Handling',
    throwTime: t1 - t0,
    resultTime: t2 - t1,
    iterations: ITERATIONS
  }
}

async function benchmarkNested(): Promise<BenchResult> {
  const ITERATIONS = 100_000
  
  function nestedThrow(i: number) {
    try {
      try {
        try {
          if (i % 10 === 0) throw new Error('deep')
          return i * 2
        } catch {
          throw new Error('wrapped: ' + (e as Error).message)
        }
      } catch {
        throw new Error('double: ' + (e as Error).message)
      }
    } catch {
      return null
    }
  }
  
  function nestedResult(i: number): Result<number> {
    const r1 = i % 10 === 0 
      ? err(new ZeroError('DEEP', 'deep')) 
      : ok(i * 2)
    
    if (!r1.ok) {
      const r2 = err(wrap(r1.error, 'WRAPPED', 'wrapped'))
      const r3 = err(wrap(r2.error, 'DOUBLE', 'double'))
      return r3
    }
    
    return r1
  }
  
  const t0 = performance.now()
  for (let i = 0; i < ITERATIONS; i++) nestedThrow(i)
  const t1 = performance.now()
  
  for (let i = 0; i < ITERATIONS; i++) nestedResult(i)
  const t2 = performance.now()
  
  return {
    name: 'Nested Error Handling (3 levels)',
    throwTime: t1 - t0,
    resultTime: t2 - t1,
    iterations: ITERATIONS
  }
}

async function benchmarkContext(): Promise<BenchResult> {
  const ITERATIONS = 100_000
  
  function throwWithContext(userId: string) {
    try {
      throw new Error(`User not found (userId: ${userId}, timestamp: ${Date.now()})`)
    } catch {
      return null
    }
  }
  
  function resultWithContext(userId: string): Result<void> {
    return err(new ZeroError('USER_NOT_FOUND', 'User not found', {
      context: { userId, timestamp: Date.now() }
    }))
  }
  
  const t0 = performance.now()
  for (let i = 0; i < ITERATIONS; i++) throwWithContext('user' + i)
  const t1 = performance.now()
  
  for (let i = 0; i < ITERATIONS; i++) resultWithContext('user' + i)
  const t2 = performance.now()
  
  return {
    name: 'Error Context Propagation',
    throwTime: t1 - t0,
    resultTime: t2 - t1,
    iterations: ITERATIONS
  }
}

// Main
async function main() {
  drawHeader()
  
  const benchmarks = [
    { name: 'simple operations', fn: benchmarkSimple },
    { name: 'nested errors', fn: benchmarkNested },
    { name: 'context propagation', fn: benchmarkContext }
  ]
  
  const results: BenchResult[] = []
  
  for (const bench of benchmarks) {
    const result = await runWithProgress(bench.name, bench.fn)
    results.push(result)
    drawComparison(result)
  }
  
  drawSummary(results)
  
  // Final visualization
  console.log(`
${colors.bright}${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                         SPEEDUP CHART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`)
  
  results.forEach(r => {
    const speedup = r.throwTime / r.resultTime
    const maxBar = 50
    // Use a different scale for speedup visualization
    const barLength = speedup > 1 
      ? Math.min(speedup * 5, maxBar) 
      : Math.min((1 / speedup) * 5, maxBar)
    const bar = drawBar(barLength, maxBar, maxBar, speedup > 1 ? colors.green : colors.red)
    const label = speedup > 1 
      ? `${speedup.toFixed(1)}x faster` 
      : `${(1/speedup).toFixed(1)}x slower`
    console.log(`${r.name.padEnd(35)} ${bar} ${label}`)
  })
  
  console.log(`
${colors.dim}════════════════════════════════════════════════════════════════════${colors.reset}
${colors.bright}ZeroThrow${colors.reset} - ${colors.yellow}Banish throw to the Phantom Zone${colors.reset} ${colors.green}✓${colors.reset}
`)
}

main().catch(console.error)