import { ZeroThrow, ZeroError } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import type { 
  Policy, 
  ConditionalPolicy, 
  AdaptivePolicyOptions,
  PolicyContext,
  MutablePolicyContext
} from '../types.js'
import { MutablePolicyContext as MutableContext } from '../types.js'

export class AdaptivePolicyImpl extends BasePolicy implements ConditionalPolicy {
  private readonly context: MutablePolicyContext
  private readonly policies: Policy[]
  private readonly selector: (context: PolicyContext) => Policy
  private readonly warmupPeriod: number

  constructor(options: AdaptivePolicyOptions) {
    super('adaptive')
    if (options.policies.length === 0) {
      throw new Error('AdaptivePolicy requires at least one policy')
    }
    this.context = new MutableContext()
    this.policies = options.policies
    this.selector = options.selector
    this.warmupPeriod = options.warmupPeriod ?? 10
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
    
    // During warmup, use the first policy
    // We validate in constructor that policies.length > 0
    const selectedPolicy = this.context.executionCount < this.warmupPeriod
      ? this.policies[0] as Policy
      : this.selector(this.context)
    
    // Delegate to the selected policy - it returns a Result
    const result = await selectedPolicy.execute(operation)
    
    // Update context based on the result
    const duration = Date.now() - startTime
    this.context.recordExecution(result.ok, result.ok ? undefined : result.error, duration)
    
    // Return the result unchanged - SAFE_CAST: Policy base type uses ZeroError
    return result as ZeroThrow.Result<T, E>
  }

  getContext<E extends ZeroError = ZeroError>(): PolicyContext<E> {
    // SAFE_CAST: MutablePolicyContext extends PolicyContext
    return this.context as unknown as PolicyContext<E>
  }
}