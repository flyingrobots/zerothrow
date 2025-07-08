import { describe, it, expect, vi } from 'vitest'
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

describe('State Machine Hooks', () => {
  it('should fire transition-specific hooks', () => {
    const onLoadingToSuccess = vi.fn()
    const onLoadingToError = vi.fn()
    const onAnyTransition = vi.fn()
    
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
      // Add hooks
      .onTransition(State.Loading, State.Success, onLoadingToSuccess)
      .onTransition(State.Loading, State.Error, onLoadingToError)
      .onAnyTransition(onAnyTransition)
      .build()
    
    // Start loading
    machine.send(Event.Start)
    expect(onAnyTransition).toHaveBeenCalledWith(State.Idle, State.Loading, Event.Start)
    expect(onLoadingToSuccess).not.toHaveBeenCalled()
    
    // Complete successfully
    machine.send(Event.Complete)
    expect(onLoadingToSuccess).toHaveBeenCalledWith(State.Loading, State.Success, Event.Complete)
    expect(onLoadingToError).not.toHaveBeenCalled()
    expect(onAnyTransition).toHaveBeenCalledTimes(2)
  })
  
  it('should support before/after hooks', () => {
    const beforeStart = vi.fn()
    const afterStart = vi.fn()
    const onEnterLoading = vi.fn()
    const onExitLoading = vi.fn()
    
    const machine = createStateMachine<State, Event>()
      .initialState(State.Idle)
      .addTransition(Event.Start)
        .from(State.Idle)
        .to(State.Loading)
      .addTransition(Event.Complete)
        .from(State.Loading)
        .to(State.Success)
      // Specific transition hooks
      .beforeTransition(State.Idle, State.Loading, beforeStart)
      .afterTransition(State.Idle, State.Loading, afterStart)
      // State-based hooks
      .onEnterState(State.Loading, onEnterLoading)
      .onExitState(State.Loading, onExitLoading)
      .build()
    
    // Start loading
    machine.send(Event.Start)
    expect(beforeStart).toHaveBeenCalledWith(State.Idle, State.Loading, Event.Start)
    expect(afterStart).toHaveBeenCalledWith(State.Idle, State.Loading, Event.Start)
    expect(onEnterLoading).toHaveBeenCalledWith(State.Idle, Event.Start)
    
    // Complete
    machine.send(Event.Complete)
    expect(onExitLoading).toHaveBeenCalledWith(State.Success, Event.Complete)
  })
  
  it('should call hooks in the correct order', () => {
    const calls: string[] = []
    
    const machine = createStateMachine<State, Event>()
      .initialState(State.Idle)
      .addTransition(Event.Start)
        .from(State.Idle)
        .to(State.Loading)
      .beforeTransition(State.Idle, State.Loading, () => calls.push('before'))
      .onTransition(State.Idle, State.Loading, () => calls.push('transition'))
      .afterTransition(State.Idle, State.Loading, () => calls.push('after'))
      .onAnyTransition(() => calls.push('global'))
      .build()
    
    machine.send(Event.Start)
    
    expect(calls).toEqual(['before', 'transition', 'global', 'after'])
  })
})