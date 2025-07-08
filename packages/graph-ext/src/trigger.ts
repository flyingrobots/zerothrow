/**
 * @file Transition trigger API for state machines
 */

import type { StateMachine } from './index.js'

/**
 * A trigger represents a specific transition that can be executed
 * Uses WeakRef to prevent memory leaks if triggers outlive the machine
 */
export class TransitionTrigger<TState extends number, TEvent extends number> {
  private machineRef: WeakRef<StateMachine<TState, TEvent>>
  
  constructor(
    machine: StateMachine<TState, TEvent>,
    private fromState: TState,
    private toState: TState,
    private event: TEvent
  ) {
    this.machineRef = new WeakRef(machine)
  }

  /**
   * Get the machine if it still exists
   */
  private getMachine(): StateMachine<TState, TEvent> | undefined {
    return this.machineRef.deref()
  }

  /**
   * Check if this transition can currently be triggered
   */
  canTrigger(): boolean {
    const machine = this.getMachine()
    if (!machine) return false
    return machine.is(this.fromState) && machine.can(this.event)
  }

  /**
   * Trigger the transition if valid
   * Returns true if the transition was successful
   */
  trigger(): boolean {
    const machine = this.getMachine()
    if (!machine || !this.canTrigger()) {
      return false
    }
    return machine.send(this.event)
  }

  /**
   * Trigger the transition, throwing if invalid
   */
  triggerOrThrow(): void {
    const machine = this.getMachine()
    if (!machine) {
      throw new Error('State machine has been garbage collected')
    }
    
    if (!this.canTrigger()) {
      throw new Error(
        `Cannot transition from ${this.fromState} to ${this.toState} - ` +
        `current state is ${machine.getState()}`
      )
    }
    machine.send(this.event)
  }

  /**
   * Get metadata about this trigger
   */
  get from(): TState {
    return this.fromState
  }

  get to(): TState {
    return this.toState
  }

  get event(): TEvent {
    return this.event
  }

  /**
   * Check if the machine is currently in the source state for this trigger
   */
  isReady(): boolean {
    const machine = this.getMachine()
    return machine ? machine.is(this.fromState) : false
  }
  
  /**
   * Check if the machine is still alive
   */
  isAlive(): boolean {
    return this.getMachine() !== undefined
  }
}

/**
 * Builder for creating transition triggers
 */
export class TriggerBuilder<TState extends number, TEvent extends number> {
  private fromState?: TState
  private toState?: TState
  private event?: TEvent

  constructor(private machine: StateMachine<TState, TEvent>) {}

  from(state: TState): this {
    this.fromState = state
    return this
  }

  to(state: TState): this {
    this.toState = state
    return this
  }

  on(event: TEvent): this {
    this.event = event
    return this
  }

  build(): TransitionTrigger<TState, TEvent> {
    if (this.fromState === undefined || this.toState === undefined || this.event === undefined) {
      throw new Error('Incomplete trigger definition - must specify from, to, and event')
    }

    // Validate that this is a valid transition
    const transitions = (this.machine as any).transitions
    if (!transitions[this.fromState] || transitions[this.fromState][this.event] !== this.toState) {
      throw new Error(
        `Invalid trigger: no transition from ${this.fromState} to ${this.toState} on event ${this.event}`
      )
    }

    return new TransitionTrigger(this.machine, this.fromState, this.toState, this.event)
  }
}

/**
 * Collection of triggers for common patterns
 */
export class TriggerCollection<TState extends number, TEvent extends number> {
  private triggers = new Map<string, TransitionTrigger<TState, TEvent>>()

  add(name: string, trigger: TransitionTrigger<TState, TEvent>): this {
    this.triggers.set(name, trigger)
    return this
  }

  get(name: string): TransitionTrigger<TState, TEvent> | undefined {
    return this.triggers.get(name)
  }

  /**
   * Get all triggers that can currently be triggered
   */
  getAvailable(): Array<[string, TransitionTrigger<TState, TEvent>]> {
    return Array.from(this.triggers.entries()).filter(([_, trigger]) => trigger.canTrigger())
  }

  /**
   * Create a proxy object with triggers as methods
   */
  asObject(): Record<string, () => boolean> {
    const obj: Record<string, () => boolean> = {}
    for (const [name, trigger] of this.triggers) {
      obj[name] = () => trigger.trigger()
    }
    return obj
  }
}