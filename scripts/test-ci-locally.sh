#!/bin/bash

# Script to run CI tests locally using Docker Compose
# Usage: ./scripts/test-ci-locally.sh [service-name]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Use 'docker compose' if available, otherwise 'docker-compose'
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

if [ "$1" ]; then
    # Run specific service
    echo "${BLUE}🐳 Running $1...${NC}"
    $DOCKER_COMPOSE -f docker-compose.test.yml run --rm $1
else
    # Run all services
    echo "${BLUE}🐳 Running all CI tests in parallel...${NC}"
    echo "   This simulates the exact CI environment locally!"
    echo ""
    
    # Show real-time output from all containers
    $DOCKER_COMPOSE -f docker-compose.test.yml up --abort-on-container-exit
    
    # Clean up
    $DOCKER_COMPOSE -f docker-compose.test.yml down --remove-orphans
fi