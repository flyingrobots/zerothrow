/**
 * Package Dependency Graph - Replaces hardcoded RELEASE_PHASES
 * Uses @zerothrow/graph to dynamically analyze package dependencies
 */

import { Graph, GraphIterator } from '@zerothrow/graph'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { ZT } from '@zerothrow/core'

// Graph states for package release process
enum PackageState {
  Unreleased = 0,
  Building = 1, 
  Released = 2,
  Failed = 3
}

// Events that trigger state transitions
enum ReleaseEvent {
  StartBuild = 0,
  BuildSuccess = 1,
  BuildFailure = 2,
  Reset = 3
}

interface PackageNode {
  name: string
  dependencies: Set<string>
  localVersion: string
  npmVersion: string
  needsPublish: boolean
}

export class PackageDependencyGraph {
  private graph: Graph<PackageState, ReleaseEvent>
  private packages = new Map<string, PackageNode>()
  private packageStates = new Map<string, GraphIterator<PackageState, ReleaseEvent>>()
  private nameToId = new Map<string, number>()
  private idToName = new Map<number, string>()
  private nextId = 0

  constructor() {
    // Build the release state machine
    this.graph = new Graph<PackageState, ReleaseEvent>()
      .addEdge(PackageState.Unreleased, PackageState.Building, ReleaseEvent.StartBuild)
      .addEdge(PackageState.Building, PackageState.Released, ReleaseEvent.BuildSuccess)
      .addEdge(PackageState.Building, PackageState.Failed, ReleaseEvent.BuildFailure)
      .addEdge(PackageState.Failed, PackageState.Building, ReleaseEvent.StartBuild)
      .addEdge(PackageState.Released, PackageState.Unreleased, ReleaseEvent.Reset)
      .addEdge(PackageState.Failed, PackageState.Unreleased, ReleaseEvent.Reset)
  }

  /**
   * Scan packages directory and build dependency graph from package.json files
   */
  scanPackages(): void {
    const packagesDir = join(process.cwd(), 'packages')
    
    const scanResult = ZT.try(() => {
      const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

      for (const dir of packageDirs) {
        const packageJsonPath = join(packagesDir, dir, 'package.json')
        
        const readResult = ZT.try(() => {
          const content = readFileSync(packageJsonPath, 'utf-8')
          return JSON.parse(content)
        })

        if (readResult.ok) {
          const pkg = readResult.value
          this.addPackage(pkg.name, pkg)
        }
      }
    })

    if (!scanResult.ok) {
      throw new Error(`Failed to scan packages: ${scanResult.error.message}`)
    }
  }

  /**
   * Add a package to the dependency graph
   */
  private addPackage(name: string, packageJson: any): void {
    // Extract ZeroThrow dependencies from peerDependencies
    const dependencies = new Set<string>()
    
    if (packageJson.peerDependencies) {
      for (const dep of Object.keys(packageJson.peerDependencies)) {
        if (dep.startsWith('@zerothrow/')) {
          dependencies.add(dep)
        }
      }
    }

    const packageNode: PackageNode = {
      name,
      dependencies,
      localVersion: packageJson.version,
      npmVersion: 'unknown', // Will be filled by version check
      needsPublish: false     // Will be filled by version check
    }

    this.packages.set(name, packageNode)
    
    // Assign numeric ID for graph operations
    const id = this.nextId++
    this.nameToId.set(name, id)
    this.idToName.set(id, name)
    
    // Initialize package state machine
    const iterator = new GraphIterator(this.graph, PackageState.Unreleased)
    this.packageStates.set(name, iterator)
  }

  /**
   * Calculate optimal release order using topological sort
   * Returns packages grouped by phase (packages in same phase can be released in parallel)
   */
  getOptimalReleaseOrder(): string[][] {
    const phases: string[][] = []
    const visited = new Set<string>()
    const inProgress = new Set<string>()

    // Keep adding phases until all packages are released
    while (visited.size < this.packages.size) {
      const currentPhase: string[] = []
      
      // Find packages that can be released in this phase
      for (const [packageName, packageNode] of this.packages) {
        if (visited.has(packageName)) continue
        
        // Check if all dependencies are satisfied
        const canRelease = this.canReleasePackage(packageName, visited)
        
        if (canRelease) {
          currentPhase.push(packageName)
          inProgress.add(packageName)
        }
      }
      
      if (currentPhase.length === 0) {
        // Circular dependency or other issue
        const remaining = Array.from(this.packages.keys()).filter(name => !visited.has(name))
        throw new Error(`Cannot resolve release order for packages: ${remaining.join(', ')}. Possible circular dependency.`)
      }
      
      // Mark all packages in current phase as visited
      for (const packageName of currentPhase) {
        visited.add(packageName)
        inProgress.delete(packageName)
      }
      
      phases.push(currentPhase)
    }

    return phases
  }

  /**
   * Check if a package can be released (all dependencies are satisfied)
   */
  canReleasePackage(packageName: string, releasedPackages: Set<string>): boolean {
    const packageNode = this.packages.get(packageName)
    if (!packageNode) return false

    // Check if all dependencies are already released
    for (const dependency of packageNode.dependencies) {
      if (!releasedPackages.has(dependency)) {
        return false
      }
    }

    // Check state machine - can we start building?
    const iterator = this.packageStates.get(packageName)
    return iterator?.can(ReleaseEvent.StartBuild) ?? false
  }

  /**
   * Start building a package (transition to Building state)
   */
  startBuilding(packageName: string): boolean {
    const iterator = this.packageStates.get(packageName)
    if (!iterator) return false
    
    const newState = iterator.go(ReleaseEvent.StartBuild)
    return newState === PackageState.Building
  }

  /**
   * Mark package as successfully released
   */
  markReleased(packageName: string): boolean {
    const iterator = this.packageStates.get(packageName)
    if (!iterator) return false
    
    const newState = iterator.go(ReleaseEvent.BuildSuccess) 
    return newState === PackageState.Released
  }

  /**
   * Mark package as failed
   */
  markFailed(packageName: string): boolean {
    const iterator = this.packageStates.get(packageName)
    if (!iterator) return false
    
    const newState = iterator.go(ReleaseEvent.BuildFailure)
    return newState === PackageState.Failed
  }

  /**
   * Get current state of a package
   */
  getPackageState(packageName: string): PackageState | undefined {
    const iterator = this.packageStates.get(packageName)
    return iterator?.current
  }

  /**
   * Reset all packages to unreleased state
   */
  reset(): void {
    for (const iterator of this.packageStates.values()) {
      iterator.go(ReleaseEvent.Reset)
    }
  }

  /**
   * Get all packages with their dependency info
   */
  getAllPackages(): Map<string, PackageNode> {
    return new Map(this.packages)
  }

  /**
   * Update package version information
   */
  updatePackageVersions(packageName: string, localVersion: string, npmVersion: string): void {
    const packageNode = this.packages.get(packageName)
    if (packageNode) {
      packageNode.localVersion = localVersion
      packageNode.npmVersion = npmVersion
      packageNode.needsPublish = localVersion !== npmVersion && npmVersion !== 'unpublished'
    }
  }

  /**
   * Detect circular dependencies in the package graph
   */
  detectCircularDependencies(): string[] {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const cycles: string[] = []

    const dfs = (packageName: string, path: string[]): void => {
      visited.add(packageName)
      recursionStack.add(packageName)

      const packageNode = this.packages.get(packageName)
      if (packageNode) {
        for (const dependency of packageNode.dependencies) {
          if (this.packages.has(dependency)) {
            if (!visited.has(dependency)) {
              dfs(dependency, [...path, dependency])
            } else if (recursionStack.has(dependency)) {
              // Found cycle
              const cycleStart = path.indexOf(dependency)
              const cycle = path.slice(cycleStart).join(' -> ') + ' -> ' + dependency
              cycles.push(cycle)
            }
          }
        }
      }

      recursionStack.delete(packageName)
    }

    for (const packageName of this.packages.keys()) {
      if (!visited.has(packageName)) {
        dfs(packageName, [packageName])
      }
    }

    return cycles
  }

  /**
   * Generate a visualization of the dependency graph in DOT format
   */
  toDot(): string {
    const lines = ['digraph PackageDependencies {']
    
    // Add nodes
    for (const [packageName, packageNode] of this.packages) {
      const state = this.getPackageState(packageName)
      const color = state === PackageState.Released ? 'green' : 
                   state === PackageState.Building ? 'yellow' :
                   state === PackageState.Failed ? 'red' : 'white'
      
      const label = packageName.replace('@zerothrow/', '')
      lines.push(`  "${label}" [fillcolor=${color}, style=filled];`)
    }
    
    // Add edges
    for (const [packageName, packageNode] of this.packages) {
      const fromLabel = packageName.replace('@zerothrow/', '')
      for (const dependency of packageNode.dependencies) {
        const toLabel = dependency.replace('@zerothrow/', '')
        lines.push(`  "${toLabel}" -> "${fromLabel}";`)
      }
    }
    
    lines.push('}')
    return lines.join('\n')
  }
}