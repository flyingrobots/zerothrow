import { describe, it, expect } from 'vitest'
import { createStateMachine } from '../src/index.js'

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
  Reset
}

describe('State Machine Triggers', () => {
  it('should create and use triggers', () => {
    const { machine, triggers } = createStateMachine<State, Event>()
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
      .createTrigger('startLoading')
        .from(State.Idle)
        .to(State.Loading)
        .on(Event.Start)
      .createTrigger('completeLoading')
        .from(State.Loading)
        .to(State.Success)
        .on(Event.Complete)
      .createTrigger('failLoading')
        .from(State.Loading)
        .to(State.Error)
        .on(Event.Fail)
      .createTrigger('reset')
        .from(State.Success)
        .to(State.Idle)
        .on(Event.Reset)
      .buildWithTriggers()
    
    // Get triggers
    const startTrigger = triggers.get('startLoading')!
    const completeTrigger = triggers.get('completeLoading')!
    const failTrigger = triggers.get('failLoading')!
    
    // Initially only start trigger should be available
    expect(startTrigger.canTrigger()).toBe(true)
    expect(completeTrigger.canTrigger()).toBe(false)
    expect(failTrigger.canTrigger()).toBe(false)
    
    // Use trigger to start loading
    expect(startTrigger.trigger()).toBe(true)
    expect(machine.is(State.Loading)).toBe(true)
    
    // Now loading triggers should be available
    expect(startTrigger.canTrigger()).toBe(false)
    expect(completeTrigger.canTrigger()).toBe(true)
    expect(failTrigger.canTrigger()).toBe(true)
    
    // Complete loading
    expect(completeTrigger.trigger()).toBe(true)
    expect(machine.is(State.Success)).toBe(true)
  })
  
  it('should handle WeakRef correctly', () => {
    let { machine, triggers } = createStateMachine<State, Event>()
      .initialState(State.Idle)
      .addTransition(Event.Start)
        .from(State.Idle)
        .to(State.Loading)
      .createTrigger('start')
        .from(State.Idle)
        .to(State.Loading)
        .on(Event.Start)
      .buildWithTriggers()
    
    const trigger = triggers.get('start')!
    
    // Trigger should work while machine exists
    expect(trigger.isAlive()).toBe(true)
    expect(trigger.canTrigger()).toBe(true)
    
    // Clear machine reference
    machine = null as any
    
    // Force garbage collection (if available)
    if (global.gc) {
      global.gc()
      
      // After GC, trigger should detect machine is gone
      expect(trigger.isAlive()).toBe(false)
      expect(trigger.canTrigger()).toBe(false)
      expect(trigger.trigger()).toBe(false)
    }
  })
  
  it('should create triggers from machine instance', () => {
    const machine = createStateMachine<State, Event>()
      .initialState(State.Idle)
      .addTransition(Event.Start)
        .from(State.Idle)
        .to(State.Loading)
      .build()
    
    // Create trigger directly from machine
    const trigger = machine.createTrigger()
      .from(State.Idle)
      .to(State.Loading)
      .on(Event.Start)
      .build()
    
    expect(trigger.canTrigger()).toBe(true)
    expect(trigger.trigger()).toBe(true)
    expect(machine.is(State.Loading)).toBe(true)
  })
  
  it('should get available triggers', () => {
    const { machine, triggers } = createStateMachine<State, Event>()
      .initialState(State.Idle)
      .addTransition(Event.Start)
        .from(State.Idle)
        .to(State.Loading)
      .addTransition(Event.Complete)
        .from(State.Loading)
        .to(State.Success)
      .createTrigger('start')
        .from(State.Idle)
        .to(State.Loading)
        .on(Event.Start)
      .createTrigger('complete')
        .from(State.Loading)
        .to(State.Success)
        .on(Event.Complete)
      .buildWithTriggers()
    
    // Initially only 'start' is available
    const available1 = triggers.getAvailable()
    expect(available1.length).toBe(1)
    expect(available1[0][0]).toBe('start')
    
    // After starting, only 'complete' is available
    machine.send(Event.Start)
    const available2 = triggers.getAvailable()
    expect(available2.length).toBe(1)
    expect(available2[0][0]).toBe('complete')
  })
})