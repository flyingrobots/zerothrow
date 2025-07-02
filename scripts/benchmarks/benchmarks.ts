
import { performance } from 'node:perf_hooks'

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

const ITER = 1_000_000

console.log('Running benchmark...')

const t0 = performance.now()
for (let i = 0; i < ITER; i++) throwCatch(i)
const t1 = performance.now()

for (let i = 0; i < ITER; i++) resultPattern(i)
const t2 = performance.now()

console.log(`throw/catch: ${(t1 - t0).toFixed(2)}ms`)
console.log(`result: ${(t2 - t1).toFixed(2)}ms`)
