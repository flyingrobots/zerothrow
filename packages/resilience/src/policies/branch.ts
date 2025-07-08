import { type Result, ZeroThrow, ZeroError } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import type { 
  Policy, 
  ConditionalPolicy, 
  BranchPolicyOptions,
  PolicyContext,
  MutablePolicyContext,
  BranchCase
} from '../types.js'
import { MutablePolicyContext as MutableContext } from '../types.js'

export class BranchPolicyImpl extends BasePolicy implements ConditionalPolicy {
  private readonly context: MutablePolicyContext
  private readonly branches: BranchCase[]
  private readonly defaultPolicy: Policy

  constructor(options: BranchPolicyOptions) {
    super('branch')
    this.context = new MutableContext()
    this.branches = options.branches
    this.defaultPolicy = options.default
  }

  execute<T, E extends ZeroError = ZeroError>(operation: () => ZeroThrow.Async<T, E>): ZeroThrow.Async<T, E> {
    return ZeroThrow.enhance(this.executeAsync(operation))
  }

  private async executeAsync<T, E extends ZeroError = ZeroError>(operation: () => ZeroThrow.Async<T, E>): Promise<Result<T, E>> {
    const startTime = Date.now()
    
    // Find the first branch whose condition is true
    let selectedPolicy = this.defaultPolicy
    for (const branch of this.branches) {
      if (branch.condition(this.context)) {
        selectedPolicy = branch.policy
        break
      }
    }
    
    // Delegate to the selected policy
    const result = await selectedPolicy.execute(operation)
    
    const duration = Date.now() - startTime
    this.context.recordExecution(result.ok, result.ok ? undefined : result.error, duration)
    
    // SAFE_CAST: Policy base type uses ZeroError
    return result as Result<T, E>
  }

  getContext<E extends ZeroError = ZeroError>(): PolicyContext<E> {
    // SAFE_CAST: MutablePolicyContext extends PolicyContext
    return this.context as unknown as PolicyContext<E>
  }
}