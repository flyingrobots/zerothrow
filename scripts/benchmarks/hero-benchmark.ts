import { performance } from 'node:perf_hooks'
// No imports needed for this simple benchmark

// Colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

console.clear()
console.log(`
${c.cyan}╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║              ${c.yellow}⚡ ZEROTHROW HERO BENCHMARK ⚡${c.cyan}                       ║
║                                                                   ║
║          The benchmark that started it all...                     ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝${c.reset}
`)

const ITERATIONS = 1_000_000

// The original benchmark functions
function throwCatch(i: number) {
  try {
    throw new Error('fail ' + i)
  } catch {
    return false
  }
}

function resultPattern(i: number) {
  return { ok: false, error: 'fail ' + i }
}

console.log(`${c.dim}Running ${ITERATIONS.toLocaleString()} iterations...${c.reset}\n`)

// Progress animation
let progress = 0
const totalSteps = 20
const progressInterval = setInterval(() => {
  process.stdout.write(`\r${c.dim}Progress: [${c.green}${'█'.repeat(progress)}${c.dim}${'░'.repeat(totalSteps - progress)}${c.dim}]${c.reset}`)
  progress = (progress + 1) % (totalSteps + 1)
}, 100)

// Run benchmarks
const t0 = performance.now()
for (let i = 0; i < ITERATIONS; i++) throwCatch(i)
const t1 = performance.now()

for (let i = 0; i < ITERATIONS; i++) resultPattern(i)
const t2 = performance.now()

clearInterval(progressInterval)
process.stdout.write('\r' + ' '.repeat(50) + '\r') // Clear progress bar

const throwTime = t1 - t0
const resultTime = t2 - t1
const speedup = throwTime / resultTime

// Create visual comparison
const maxBarWidth = 50
const throwBar = '█'.repeat(maxBarWidth)
const resultBar = '█'.repeat(Math.round(resultTime / throwTime * maxBarWidth))

console.log(`
${c.bright}RESULTS:${c.reset}
${'═'.repeat(70)}

${c.red}throw/catch${c.reset}  ${c.red}${throwBar}${c.reset}
              ${throwTime.toFixed(2)}ms

${c.green}Result${c.reset}       ${c.green}${resultBar}${c.reset}
              ${resultTime.toFixed(2)}ms

${'═'.repeat(70)}
`)

// Speedup visualization
const speedupDisplay = `${speedup.toFixed(0)}x`
const padding = ' '.repeat(Math.floor((70 - speedupDisplay.length - 8) / 2))

console.log(`
${padding}${c.bright}${c.yellow}Result is ${speedupDisplay} FASTER!${c.reset}
`)

// ASCII art speedometer
const angle = Math.min(speedup / 150 * Math.PI, Math.PI)
const needleX = Math.round(25 + Math.cos(Math.PI - angle) * 20)
// const needleY = Math.round(10 - Math.sin(Math.PI - angle) * 8) // Not used in ASCII art

console.log(`
${c.dim}                    SPEEDOMETER${c.reset}
${c.dim}        0x                             150x${c.reset}
${c.dim}     ╭─────────────────────────────────────╮${c.reset}
${c.dim}     │${c.reset}${' '.repeat(needleX - 6)}${c.bright}${c.yellow}◆${c.reset}${' '.repeat(43 - needleX)}${c.dim}│${c.reset}
${c.dim}     │  ╱                               ╲  │${c.reset}
${c.dim}     │ ╱                                 ╲ │${c.reset}
${c.dim}     │╱                                   ╲│${c.reset}
${c.dim}     ╰─────────────────────────────────────╯${c.reset}
`)

// Fun facts
console.log(`
${c.bright}${c.blue}FUN FACTS:${c.reset}
${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.cyan}▸${c.reset} In the time it takes throw/catch to process ${c.red}1${c.reset} error,
  Result can process ${c.green}${Math.round(speedup)}${c.reset} errors!

${c.cyan}▸${c.reset} If throw/catch were a ${c.red}🐌 snail${c.reset} (0.03 mph),
  Result would be a ${c.green}🚄 bullet train${c.reset} (${(0.03 * speedup).toFixed(0)} mph)!

${c.cyan}▸${c.reset} Processing ${c.yellow}10 million${c.reset} errors:
  ${c.dim}throw/catch:${c.reset} ${c.red}${(throwTime * 10).toFixed(1)} seconds${c.reset}
  ${c.dim}Result:${c.reset}      ${c.green}${(resultTime * 10).toFixed(1)} seconds${c.reset}
  ${c.dim}Time saved:${c.reset}  ${c.bright}${c.yellow}${((throwTime - resultTime) * 10).toFixed(1)} seconds!${c.reset}
`)

console.log(`
${c.dim}═══════════════════════════════════════════════════════════════════${c.reset}
${c.bright}ZeroThrow${c.reset} - ${c.green}Fast${c.reset}, ${c.blue}Type-Safe${c.reset}, ${c.magenta}Composable${c.reset} Error Handling
${c.dim}───────────────────────────────────────────────────────────────────${c.reset}
`)