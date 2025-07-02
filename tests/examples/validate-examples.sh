#!/bin/bash

set -e

echo "🚀 Validating ZeroThrow examples..."
echo "================================================"

# Change to examples directory
cd "$(dirname "$0")"

# Function to validate example and capture result
validate_example() {
    local dir=$1
    local description=$2
    
    echo ""
    echo "🧪 Validating $description..."
    echo "----------------------------------------"
    
    if [ ! -d "$dir" ]; then
        echo "❌ Directory $dir not found"
        return 1
    fi
    
    cd "$dir"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo "❌ package.json not found in $dir"
        cd ..
        return 1
    fi
    
    
    # Check if test files exist
    if ls *.test.* 1> /dev/null 2>&1; then
        echo "✅ Test files found"
    else
        echo "❌ No test files found in $dir"
        cd ..
        return 1
    fi
    
    # Check if vitest config exists
    if [ -f "vitest.config.ts" ]; then
        echo "✅ Vitest config found"
    else
        echo "❌ vitest.config.ts not found in $dir"
        cd ..
        return 1
    fi
    
    # Check if tsconfig exists
    if [ -f "tsconfig.json" ]; then
        echo "✅ TypeScript config found"
    else
        echo "❌ tsconfig.json not found in $dir"
        cd ..
        return 1
    fi
    
    echo "✅ $description validation passed"
    cd ..
    return 0
}

# Track results
declare -a failed_examples=()

# Validate each example
validate_example "react" "React Examples" || failed_examples+=("React")
validate_example "node" "Node.js Examples" || failed_examples+=("Node.js")
validate_example "database" "Database Examples" || failed_examples+=("Database")
validate_example "async-patterns" "Async Patterns" || failed_examples+=("Async Patterns")
validate_example "frameworks" "Framework Examples" || failed_examples+=("Frameworks")


# Check if run script exists
if [ -f "run-all-examples.sh" ]; then
    echo "✅ run-all-examples.sh found"
else
    echo "❌ run-all-examples.sh not found"
    failed_examples+=("Run Script")
fi

# Summary
echo ""
echo "================================================"
echo "📊 VALIDATION SUMMARY"
echo "================================================"

if [ ${#failed_examples[@]} -eq 0 ]; then
    echo "🎉 All examples validation passed!"
    echo ""
    echo "Examples are ready for type checking:"
    echo "  • React Examples: Complete with React component types"
    echo "  • Node.js Examples: Express and Fastify API types"
    echo "  • Database Examples: SQL integration types"
    echo "  • Async Patterns: Comprehensive async pattern types"
    echo "  • Framework Examples: Next.js and Remix pattern types"
    echo ""
    echo "To run type checking on examples:"
    echo "  npm run test:examples"
    exit 0
else
    echo "❌ The following validations failed:"
    for example in "${failed_examples[@]}"; do
        echo "   - $example"
    done
    echo ""
    echo "Please check the validation details above."
    exit 1
fi