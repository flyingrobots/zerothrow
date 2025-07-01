#!/usr/bin/env bash

# ZeroThrow Common Utilities
# Shared functions for all ZeroThrow scripts

# Strict mode
set_strict_mode() {
    set -euo pipefail
}

# Global variables for modes
QUIET=${QUIET:-false}
VERBOSE=${VERBOSE:-false}

# Setup colors based on terminal support
setup_colors() {
    if [[ -t 1 ]]; then
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        RED='\033[0;31m'
        BLUE='\033[0;34m'
        NC='\033[0m' # No Color
    else
        GREEN=''; YELLOW=''; RED=''; BLUE=''; NC=''
    fi
}

# Print functions
print_success() {
    [ "$QUIET" = true ] && return
    echo -e "${GREEN}✓${NC} [ZeroThrow] $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} [ZeroThrow] $1"
}

print_error() {
    echo -e "${RED}✗${NC} [ZeroThrow] $1" >&2
}

print_info() {
    [ "$QUIET" = true ] && return
    echo -e "${BLUE}ℹ${NC} [ZeroThrow] $1"
}

print_verbose() {
    [ "$VERBOSE" = true ] && echo -e "[ZeroThrow] $1"
}

# User confirmation prompt
ask_confirmation() {
    local prompt="$1"
    local default="${2:-n}"
    
    # In quiet mode, use defaults
    if [ "$QUIET" = true ]; then
        print_verbose "Auto-selecting default for: $prompt"
        [ "$default" = "y" ]
        return
    fi
    
    local yn_prompt="[y/N]"
    [[ "$default" = "y" ]] && yn_prompt="[Y/n]"
    
    read -p "$prompt $yn_prompt " -n 1 -r answer
    echo
    
    [[ -z "$answer" ]] && answer="$default"
    [[ "$answer" =~ ^[Yy]$ ]]
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Platform detection
is_windows() {
    [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]
}

is_macos() {
    [[ "$OSTYPE" == "darwin"* ]]
}

is_linux() {
    [[ "$OSTYPE" == "linux-gnu"* ]]
}

# Find project root (with git and package.json)
find_project_root() {
    local dir="$PWD"
    
    # First, find the git repository root
    local git_root
    git_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
        print_error "Not in a git repository"
        return 1
    }
    
    # Check if git root has package.json
    if [[ -f "$git_root/package.json" ]]; then
        echo "$git_root"
        return 0
    fi
    
    # Look for package.json from current dir up to git root
    while [[ "$dir" != "/" && "$dir" != "$git_root" ]]; do
        if [[ -f "$dir/package.json" ]]; then
            echo "$dir"
            return 0
        fi
        dir=$(dirname "$dir")
    done
    
    print_error "Could not find package.json in git repository"
    return 1
}

# Package manager detection
detect_package_manager() {
    local has_npm=false
    local has_yarn=false
    local has_pnpm=false
    local count=0
    
    [[ -f "package-lock.json" ]] && has_npm=true && ((count++))
    [[ -f "yarn.lock" ]] && has_yarn=true && ((count++))
    [[ -f "pnpm-lock.yaml" ]] && has_pnpm=true && ((count++))
    
    # If only one lockfile exists, use that
    if [[ $count -eq 1 ]]; then
        $has_pnpm && echo "pnpm" && return
        $has_yarn && echo "yarn" && return
        echo "npm" && return
    fi
    
    # If multiple or none, prompt user (unless in quiet mode)
    if [[ "$QUIET" = true ]]; then
        echo "npm"  # Default to npm in quiet mode
        return
    fi
    
    if [[ $count -gt 1 ]]; then
        print_warning "Multiple lockfiles detected! This may indicate inconsistent dependency tooling."
        echo "Consider cleaning up unused lockfiles to avoid dependency conflicts."
        echo
    else
        print_warning "No lockfile detected, choosing package manager"
    fi
    
    echo "Which package manager do you want to use?"
    echo "1) npm"
    echo "2) yarn" 
    echo "3) pnpm"
    echo
    read -p "Enter your choice (1-3): " -n 1 -r
    echo
    
    case $REPLY in
        1) echo "npm" ;;
        2) echo "yarn" ;;
        3) echo "pnpm" ;;
        *) echo "npm" ;; # Default
    esac
}

# Get package manager commands
get_install_cmd() {
    case ${PKG_MGR:-npm} in
        yarn) echo "yarn add --dev" ;;
        pnpm) echo "pnpm add -D" ;;
        *) echo "npm install --save-dev" ;;
    esac
}

get_run_cmd() {
    local script="$1"
    case ${PKG_MGR:-npm} in
        yarn) echo "yarn $script" ;;
        pnpm) echo "pnpm $script" ;;
        *) echo "npm run $script" ;;
    esac
}

get_exec_cmd() {
    local cmd="$1"
    case ${PKG_MGR:-npm} in
        yarn) echo "yarn dlx $cmd" ;;
        pnpm) echo "pnpm dlx $cmd" ;;
        *) echo "npx $cmd" ;;
    esac
}

# Parse common command line arguments
parse_common_args() {
    for arg in "$@"; do
        case $arg in
            --quiet|-q)
                QUIET=true
                ;;
            --verbose|-v)
                VERBOSE=true
                ;;
            --help|-h)
                return 1  # Caller should handle help
                ;;
        esac
    done
    return 0
}

# Docker utilities
docker_available() {
    command_exists docker && docker info >/dev/null 2>&1
}

# Clean up Docker resources
docker_cleanup() {
    local image_name="$1"
    docker rmi "$image_name" >/dev/null 2>&1 || true
}

# Initialize colors on source
setup_colors