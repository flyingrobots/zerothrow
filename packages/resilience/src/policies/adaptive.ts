import { type Result } from '@zerothrow/core'
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

  async execute<T>(operation: () => Promise<T>): Promise<Result<T, Error>> {
    const startTime = Date.now()
    
    // During warmup, use the first policy
    // We validate in constructor that policies.length > 0
    const selectedPolicy = this.context.executionCount < this.warmupPeriod
      ? this.policies[0] as Policy
      : this.selector(this.context)
    
    const result = await selectedPolicy.execute(operation)
    
    const duration = Date.now() - startTime
    this.context.recordExecution(result.ok, result.ok ? undefined : result.error, duration)
    
    return result
  }

  getContext(): PolicyContext {
    return this.context
  }
}