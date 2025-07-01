#!/bin/bash

set -e

echo "🚀 Running all ZeroThrow examples..."
echo "================================================"

# Change to examples directory
cd "$(dirname "$0")"

# Function to run example and capture result
run_example() {
    local service=$1
    local description=$2
    
    echo ""
    echo "🧪 Testing $description..."
    echo "----------------------------------------"
    
    if docker compose run --rm "$service"; then
        echo "✅ $description tests passed"
        return 0
    else
        echo "❌ $description tests failed"
        return 1
    fi
}

# Build all images
echo "🔨 Building Docker images..."
docker compose build

# Track results
declare -a failed_examples=()

# Run each example
run_example "react-examples" "React Examples" || failed_examples+=("React")
run_example "node-examples" "Node.js Examples" || failed_examples+=("Node.js")
run_example "database-examples" "Database Examples" || failed_examples+=("Database")
run_example "async-patterns" "Async Patterns" || failed_examples+=("Async Patterns")
run_example "framework-examples" "Framework Examples" || failed_examples+=("Frameworks")

# Summary
echo ""
echo "================================================"
echo "📊 SUMMARY"
echo "================================================"

if [ ${#failed_examples[@]} -eq 0 ]; then
    echo "🎉 All examples passed successfully!"
    exit 0
else
    echo "❌ The following examples failed:"
    for example in "${failed_examples[@]}"; do
        echo "   - $example"
    done
    echo ""
    echo "Please check the logs above for details."
    exit 1
fi