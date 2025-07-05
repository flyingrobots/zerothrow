#!/bin/bash
# Test the fix functionality

echo "Testing zt publish ready --fix on zt-cli package..."
echo ""
echo "This will auto-fix:"
echo "- sideEffects = false"
echo "- platform field"
echo "- dev field"  
echo "- author format"
echo "- engines.node"
echo "- remove devDependencies"
echo "- repository directory"
echo ""
echo "And prompt for:"
echo "- CHANGELOG.md creation"
echo "- README updates"
echo "- Missing description"
echo ""

# Run the command
npm run dev -- publish ready --package zt-cli --fix --verbose