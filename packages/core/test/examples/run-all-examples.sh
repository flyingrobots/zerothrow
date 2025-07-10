#!/bin/bash

set -e

echo "🚀 Running TypeScript type checks on all ZeroThrow examples..."
echo "================================================"

# Change to examples directory
cd "$(dirname "$0")"

# Function to run type check and capture result
run_typecheck() {
    local dir=$1
    local description=$2
    
    echo ""
    echo "🔍 Type checking $description..."
    echo "----------------------------------------"
    
    cd "$dir"
    
    if pnpm exec tsc --noEmit; then
        echo "✅ $description type check passed"
        cd ..
        return 0
    else
        echo "❌ $description type check failed"
        cd ..
        return 1
    fi
}

# Track results
declare -a failed_examples=()

# Run type check for each example
run_typecheck "react" "React Examples" || failed_examples+=("React")
run_typecheck "node" "Node.js Examples" || failed_examples+=("Node.js")
run_typecheck "database" "Database Examples" || failed_examples+=("Database")
run_typecheck "async-patterns" "Async Patterns" || failed_examples+=("Async Patterns")
run_typecheck "frameworks" "Framework Examples" || failed_examples+=("Frameworks")

# Summary
echo ""
echo "================================================"
echo "📊 SUMMARY"
echo "================================================"

if [ ${#failed_examples[@]} -eq 0 ]; then
    echo "🎉 All examples passed type checking!"
    exit 0
else
    echo "❌ The following examples failed type checking:"
    for example in "${failed_examples[@]}"; do
        echo "   - $example"
    done
    echo ""
    echo "Please check the logs above for details."
    exit 1
fi