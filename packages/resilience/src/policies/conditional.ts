import { type Result } from '@zerothrow/core'
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

  async execute<T>(operation: () => Promise<T>): Promise<Result<T, Error>> {
    const startTime = Date.now()
    const selectedPolicy = this.condition(this.context) ? this.whenTrue : this.whenFalse
    
    const result = await selectedPolicy.execute(operation)
    
    const duration = Date.now() - startTime
    this.context.recordExecution(result.ok, result.ok ? undefined : result.error, duration)
    
    return result
  }

  getContext(): PolicyContext {
    return this.context
  }
}