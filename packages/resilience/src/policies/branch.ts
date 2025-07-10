import { type Result } from '@zerothrow/core'
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

  async execute<T>(operation: () => Promise<T>): Promise<Result<T, Error>> {
    const startTime = Date.now()
    
    // Find the first branch whose condition is true
    let selectedPolicy = this.defaultPolicy
    for (const branch of this.branches) {
      if (branch.condition(this.context)) {
        selectedPolicy = branch.policy
        break
      }
    }
    
    const result = await selectedPolicy.execute(operation)
    
    const duration = Date.now() - startTime
    this.context.recordExecution(result.ok, result.ok ? undefined : result.error, duration)
    
    return result
  }

  getContext(): PolicyContext {
    return this.context
  }
}