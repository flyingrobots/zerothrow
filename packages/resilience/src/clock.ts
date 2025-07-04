export interface Clock {
  now(): Date
  sleep(ms: number): Promise<void>
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }

  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export class TestClock implements Clock {
  private currentTime = Date.now()
  private sleepers: Array<{
    wakeTime: number
    resolve: () => void
  }> = []

  now(): Date {
    return new Date(this.currentTime)
  }

  async sleep(ms: number): Promise<void> {
    const wakeTime = this.currentTime + ms
    return new Promise(resolve => {
      this.sleepers.push({ wakeTime, resolve })
      this.sleepers.sort((a, b) => a.wakeTime - b.wakeTime)
    })
  }

  advance(ms: number): void {
    this.currentTime += ms
    
    // Wake up sleepers
    while (this.sleepers.length > 0) {
      const nextSleeper = this.sleepers[0]
      if (nextSleeper && nextSleeper.wakeTime <= this.currentTime) {
        this.sleepers.shift()
        nextSleeper.resolve()
      } else {
        break
      }
    }
  }

  setTime(time: Date | number): void {
    this.currentTime = typeof time === 'number' ? time : time.getTime()
  }
}