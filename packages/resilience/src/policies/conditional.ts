import { ZeroThrow, ZeroError } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import type { 
  Policy, 
  ConditionalPolicy, 
  ConditionalPolicyOptions,
  PolicyContext,
  MutablePolicyContext
} from '../types.js'
import { MutablePolicyContext as MutableContext } from '../types.js'

export class ConditionalPolicyImpl extends BasePolicy implements ConditionalPolicy {
  private readonly context: MutablePolicyContext
  private readonly condition: (context: PolicyContext) => boolean
  private readonly whenTrue: Policy
  private readonly whenFalse: Policy

  constructor(options: ConditionalPolicyOptions) {
    super('conditional')
    this.context = new MutableContext()
    this.condition = options.condition
    this.whenTrue = options.whenTrue
    this.whenFalse = options.whenFalse
  }

  execute<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): ZeroThrow.Async<T, E> {
    return ZeroThrow.enhance(this.executeAsync(operation))
  }

  private async executeAsync<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): Promise<ZeroThrow.Result<T, E>> {
    const startTime = Date.now()
    const selectedPolicy = this.condition(this.context) ? this.whenTrue : this.whenFalse
    
    const result = await selectedPolicy.execute(operation)
    
    const duration = Date.now() - startTime
    this.context.recordExecution(result.ok, result.ok ? undefined : result.error, duration)
    
    // SAFE_CAST: Policy base type uses ZeroError
    return result as ZeroThrow.Result<T, E>
  }

  getContext<E extends ZeroError = ZeroError>(): PolicyContext<E> {
    // SAFE_CAST: MutablePolicyContext extends PolicyContext
    return this.context as unknown as PolicyContext<E>
  }
}