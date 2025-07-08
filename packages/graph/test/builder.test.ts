import { describe, it, expect } from 'vitest'
import { createStateMachine, stateMachine } from '../src/index.js'

enum State {
  Idle,
  Loading,
  Success,
  Error
}

enum Event {
  Start,
  Complete,
  Fail,
  Reset,
  Retry
}

describe('State Machine Builder', () => {
  it('should build a state machine with fluent API', () => {
    const machine = createStateMachine<State, Event>()
      .initialState(State.Idle)
      .addTransition(Event.Start)
        .from(State.Idle)
        .to(State.Loading)
      .addTransition(Event.Complete)
        .from(State.Loading)
        .to(State.Success)
      .addTransition(Event.Fail)
        .from(State.Loading)
        .to(State.Error)
      .addTransition(Event.Reset)
        .from(State.Success)
        .to(State.Idle)
      .addTransition(Event.Reset)
        .from(State.Error)
        .to(State.Idle)
      .build()

    expect(machine.is(State.Idle)).toBe(true)
    
    expect(machine.send(Event.Start)).toBe(true)
    expect(machine.is(State.Loading)).toBe(true)
    
    expect(machine.send(Event.Complete)).toBe(true)
    expect(machine.is(State.Success)).toBe(true)
    
    expect(machine.send(Event.Reset)).toBe(true)
    expect(machine.is(State.Idle)).toBe(true)
  })

  it('should build with natural language style', () => {
    const machine = stateMachine<State, Event>()
      .startingAt(State.Idle)
      .where(State.Idle).on(Event.Start).leadsTo(State.Loading)
      .where(State.Loading).on(Event.Complete).leadsTo(State.Success)
      .where(State.Loading).on(Event.Fail).leadsTo(State.Error)
      .where(State.Success).on(Event.Reset).leadsTo(State.Idle)
      .where(State.Error).on(Event.Reset).leadsTo(State.Idle)
      .where(State.Error).on(Event.Retry).leadsTo(State.Loading)
      .create()

    expect(machine.is(State.Idle)).toBe(true)
    
    // Test a full cycle
    expect(machine.send(Event.Start)).toBe(true)
    expect(machine.send(Event.Fail)).toBe(true)
    expect(machine.is(State.Error)).toBe(true)
    expect(machine.send(Event.Retry)).toBe(true)
    expect(machine.is(State.Loading)).toBe(true)
  })
})