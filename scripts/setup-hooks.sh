#!/usr/bin/env bash

# ZeroThrow Git Hooks Setup Script
# This script intelligently sets up git hooks to enforce no-throw discipline
# It respects existing setups and asks for permission before modifying anything

set -euo pipefail

# Check for Windows compatibility
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    # Check if we're in a proper bash environment
    if [[ -z "$BASH_VERSION" ]]; then
        echo "[ZeroThrow] Error: This script requires Git Bash or WSL on Windows."
        echo "Please run this script from Git Bash or Windows Subsystem for Linux."
        exit 1
    fi
fi

# Parse command line arguments
QUIET=false
VERBOSE=false
for arg in "$@"; do
    case $arg in
        --quiet|-q)
            QUIET=true
            ;;
        --verbose|-v)
            VERBOSE=true
            ;;
        --help|-h)
            echo "Usage: $(basename $0) [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -q, --quiet    Suppress non-essential output"
            echo "  -v, --verbose  Show detailed output"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
    esac
done

# Colors for output (only if terminal supports it)
if [[ -t 1 ]]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    NC='\033[0m' # No Color
else
    GREEN=''; YELLOW=''; RED=''; NC=''
fi

# Helper functions
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

print_verbose() {
    [ "$VERBOSE" = true ] && echo -e "[ZeroThrow] $1"
}

# Find the project root (where package.json is AND git repo root)
find_project_root() {
    local dir="$PWD"
    
    # First, find the git repository root
    local git_root=$(git rev-parse --show-toplevel 2>/dev/null)
    if [ -z "$git_root" ]; then
        return 1
    fi
    
    # Now look for package.json starting from current dir up to git root
    while [ "$dir" != "/" ]; do
        if [ -f "$dir/package.json" ]; then
            # Make sure this directory is within the git repo
            if [[ "$dir" == "$git_root"* ]]; then
                # Prefer the git root if it has package.json
                if [ -f "$git_root/package.json" ]; then
                    echo "$git_root"
                else
                    echo "$dir"
                fi
                return 0
            fi
        fi
        # Stop at git root - don't go beyond it
        if [ "$dir" = "$git_root" ]; then
            break
        fi
        dir=$(dirname "$dir")
    done
    
    return 1
}

# Get project root
PROJECT_ROOT=$(find_project_root)
if [ -z "$PROJECT_ROOT" ]; then
    print_error "Could not find project root (needs both package.json and .git directory)"
    exit 1
fi

# Change to project root
cd "$PROJECT_ROOT"
print_success "Working in project root: $PROJECT_ROOT"

if [ "$QUIET" = false ]; then
    echo "🚀 [ZeroThrow] Git Hooks Setup"
    echo "================================"
    echo
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect package manager from lockfiles
detect_package_manager() {
    local has_npm=false
    local has_yarn=false
    local has_pnpm=false
    local count=0
    
    if [ -f "package-lock.json" ]; then
        has_npm=true
        ((count++))
    fi
    if [ -f "yarn.lock" ]; then
        has_yarn=true
        ((count++))
    fi
    if [ -f "pnpm-lock.yaml" ]; then
        has_pnpm=true
        ((count++))
    fi
    
    # If only one lockfile exists, use that
    if [ $count -eq 1 ]; then
        if [ "$has_pnpm" = true ]; then
            echo "pnpm"
        elif [ "$has_yarn" = true ]; then
            echo "yarn"
        else
            echo "npm"
        fi
        return
    fi
    
    # If multiple or none, prompt user
    if [ $count -gt 1 ]; then
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
        *) echo "npm" ;; # Default to npm
    esac
}

# Global package manager variable
PKG_MGR=""

# Get package manager install command
get_install_cmd() {
    case $PKG_MGR in
        yarn) echo "yarn add --dev" ;;
        pnpm) echo "pnpm add -D" ;;
        *) echo "npm install --save-dev" ;;
    esac
}

# Get package manager run command
get_run_cmd() {
    local script="$1"
    case $PKG_MGR in
        yarn) echo "yarn $script" ;;
        pnpm) echo "pnpm $script" ;;
        *) echo "npm run $script" ;;
    esac
}

# Get package manager exec command
get_exec_cmd() {
    local cmd="$1"
    case $PKG_MGR in
        yarn) echo "yarn dlx $cmd" ;;
        pnpm) echo "pnpm dlx $cmd" ;;
        *) echo "npx $cmd" ;;
    esac
}

# Function to ask for user confirmation
ask_confirmation() {
    local prompt="$1"
    local default="${2:-n}"
    
    # In quiet mode, use defaults
    if [ "$QUIET" = true ]; then
        print_verbose "Auto-selecting default for: $prompt"
        [ "$default" = "y" ]
        return
    fi
    
    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]"
    else
        prompt="$prompt [y/N]"
    fi
    
    read -p "$prompt " -n 1 -r
    echo
    
    if [ "$default" = "y" ]; then
        [[ ! $REPLY =~ ^[Nn]$ ]]
    else
        [[ $REPLY =~ ^[Yy]$ ]]
    fi
}

# Check for existing Husky setup
check_husky() {
    if [ -d ".husky" ] && [ -f "package.json" ] && grep -qE '"husky"\s*:' package.json 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Check for existing vanilla git hooks
check_vanilla_hooks() {
    # Check both .githooks and .git/hooks
    if [ -f ".githooks/pre-commit" ] || [ -f ".git/hooks/pre-commit" ]; then
        return 0
    else
        return 1
    fi
}

# Setup lint-staged configuration
setup_lint_staged() {
    echo "📝 Setting up lint-staged configuration..."
    
    # Check if .lintstagedrc.json already exists
    if [ -f ".lintstagedrc.json" ]; then
        print_warning "Found existing .lintstagedrc.json"
        if ask_confirmation "Do you want to update it with ZeroThrow configuration?"; then
            # Backup existing file
            cp .lintstagedrc.json .lintstagedrc.json.backup
            print_success "Backed up existing config to .lintstagedrc.json.backup"
        else
            return 0
        fi
    fi
    
    # Create lint-staged config
    cat > .lintstagedrc.json << 'EOF'
{
  "*.{ts,tsx}": ["eslint --max-warnings 0"]
}
EOF
    
    print_success "Created .lintstagedrc.json"
    
    # Add lint:staged script to package.json if it doesn't exist
    if ! grep -q '"lint:staged"' package.json; then
        # Using node to safely modify package.json
        node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.scripts = pkg.scripts || {};
        pkg.scripts['lint:staged'] = 'lint-staged';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
        "
        print_success "Added lint:staged script to package.json"
    fi
}

# Setup Husky hooks
setup_husky_hooks() {
    echo "🐕 Setting up Husky hooks..."
    
    # Check if husky is installed
    if ! grep -q "husky" package.json; then
        print_warning "Husky not found in dependencies"
        if ask_confirmation "Do you want to install husky and lint-staged?"; then
            $(get_install_cmd) husky lint-staged
            print_success "Installed husky and lint-staged"
        else
            return 1
        fi
    fi
    
    # Initialize husky if needed
    if [ ! -d ".husky" ]; then
        $(get_exec_cmd "husky init")
        print_success "Initialized husky"
    fi
    
    # Check for existing pre-commit hook
    if [ -f ".husky/pre-commit" ]; then
        print_warning "Found existing .husky/pre-commit hook"
        echo "Current content:"
        echo "---"
        cat .husky/pre-commit
        echo "---"
        echo
        
        if ask_confirmation "🐕 Husky setup detected. Wanna append our stuff to the end of that?"; then
            # Check if our command is already there
            if grep -q "lint:staged" .husky/pre-commit; then
                print_success "lint:staged is already in the pre-commit hook"
            else
                echo "" >> .husky/pre-commit
                echo "# ZeroThrow: Check for throw statements" >> .husky/pre-commit
                echo "$(get_run_cmd lint:staged)" >> .husky/pre-commit
                print_success "Added lint:staged to existing pre-commit hook"
            fi
        else
            print_warning "Skipping husky pre-commit hook modification"
            return 0
        fi
    else
        # Create new pre-commit hook
        echo "$(get_run_cmd lint:staged)" > .husky/pre-commit
        chmod +x .husky/pre-commit
        print_success "Created .husky/pre-commit hook"
    fi
    
    setup_lint_staged
}

# Setup vanilla git hooks
setup_vanilla_hooks() {
    echo "🔧 Setting up vanilla git hooks..."
    
    # Create .githooks directory
    mkdir -p .githooks
    
    # Check for existing pre-commit hook
    local hook_file=".githooks/pre-commit"
    if [ -f "$hook_file" ]; then
        print_warning "Found existing $hook_file hook"
        echo "Current content:"
        echo "---"
        head -20 "$hook_file"
        if [ $(wc -l < "$hook_file") -gt 20 ]; then
            echo "... (truncated)"
        fi
        echo "---"
        echo
        
        if grep -q "ZeroThrow" "$hook_file"; then
            print_success "ZeroThrow hook is already installed"
            return 0
        fi
        
        if ask_confirmation "Do you want to append to the end of your existing hooks?"; then
                # Append our hook
                cat >> "$hook_file" << EOF

# ZeroThrow: Check for throw statements
echo "[ZeroThrow] Running git hook..."
$(get_run_cmd lint) --silent
EC=\$?
if [ \$EC -ne 0 ]; then
  echo "[ZeroThrow] Commit REJECTED!! ESLint errors detected:"
  echo "────────────────────────────────────────────────"
  $(get_run_cmd lint) 2>&1 | head -n 20
  echo "────────────────────────────────────────────────"
  echo "[ZeroThrow] Fix these errors and try again."
  exit \$EC
fi

echo "[ZeroThrow] All clear; commit allowed."
EOF
                print_success "Appended ZeroThrow checks to existing pre-commit hook"
            fi
        else
            print_warning "Skipping vanilla hook modification"
            return 0
        fi
    else
        # Create new pre-commit hook
        cat > "$hook_file" << EOF
#!/usr/bin/env bash

# ZeroThrow: Check for throw statements
echo "[ZeroThrow] Running git hook..."
$(get_run_cmd lint) --silent
EC=\$?
if [ \$EC -ne 0 ]; then
  echo "[ZeroThrow] Commit REJECTED!! ESLint errors detected:"
  echo "────────────────────────────────────────────────"
  $(get_run_cmd lint) 2>&1 | head -n 20
  echo "────────────────────────────────────────────"
  echo "[ZeroThrow] Fix these errors and try again."
  exit \$EC
fi

echo "[ZeroThrow] All clear; commit allowed."
EOF
        chmod +x "$hook_file"
        print_success "Created $hook_file hook"
    fi
    
    # Configure Git to use .githooks directory
    git config core.hooksPath .githooks
    print_success "Configured Git to use .githooks directory"
}

# Main setup flow
main() {
    # Detect package manager
    PKG_MGR=$(detect_package_manager)
    print_success "Using package manager: $PKG_MGR"
    [ "$QUIET" = false ] && echo
    
    # Check if lint script exists in package.json
    if ! grep -q '"lint"' package.json; then
        print_warning "No 'lint' script found in package.json"
        if ask_confirmation "Would you like me to add a basic ESLint script?"; then
            # Check if it's a TypeScript project
            local lint_cmd="eslint"
            if [ -f "tsconfig.json" ]; then
                lint_cmd="eslint . --ext .ts,.tsx"
            else
                lint_cmd="eslint . --ext .js,.jsx"
            fi
            
            # Add lint script using Node
            node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            pkg.scripts = pkg.scripts || {};
            pkg.scripts.lint = '$lint_cmd';
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
            "
            print_success "Added lint script to package.json"
        else
            print_error "A lint script is required for git hooks to work"
            echo "Please add it manually:"
            echo '  "scripts": { "lint": "eslint" }'
            exit 1
        fi
    fi
    
    # Check if ESLint is installed
    if ! command -v eslint >/dev/null 2>&1 && ! $(get_exec_cmd eslint) --version >/dev/null 2>&1; then
        print_warning "ESLint not found"
        if ask_confirmation "Would you like to install ESLint?"; then
            echo "Installing ESLint..."
            $(get_install_cmd) eslint
            print_success "Installed ESLint"
            
            # Also offer to install TypeScript ESLint plugins if this is a TS project
            if [ -f "tsconfig.json" ]; then
                if ask_confirmation "TypeScript project detected. Install @typescript-eslint plugins too?"; then
                    $(get_install_cmd) @typescript-eslint/parser @typescript-eslint/eslint-plugin
                    print_success "Installed TypeScript ESLint plugins"
                fi
            fi
        else
            print_error "ESLint is required for git hooks to work"
            echo "Please install it manually:"
            echo "  $(get_install_cmd) eslint"
            exit 1
        fi
    fi
    
    # Check for ESLint configuration
    if ! ls .eslintrc* eslint.config.* 2>/dev/null | grep -q .; then
        print_warning "No ESLint configuration found"
        if ask_confirmation "Would you like to create a basic ESLint config that forbids throw?"; then
            # Detect ESLint version to determine config format
            local eslint_version=$($(get_exec_cmd eslint) --version 2>/dev/null | grep -oE '[0-9]+' | head -1)
            
            if [ "$eslint_version" -ge 9 ] 2>/dev/null; then
                # ESLint v9+ uses flat config
                cat > eslint.config.js << 'EOF'
export default [
  {
    rules: {
      "no-throw-literal": "error",
      "@flyingrobots/zerothrow/no-throw": "error"
    }
  }
];
EOF
                print_success "Created eslint.config.js for ESLint v9+"
            else
                # ESLint v8 and below use .eslintrc
                cat > .eslintrc.json << 'EOF'
{
  "rules": {
    "no-throw-literal": "error",
    "@flyingrobots/zerothrow/no-throw": "error"
  }
}
EOF
                print_success "Created .eslintrc.json"
            fi
        fi
    fi
    
    # Detect existing setup
    if check_husky; then
        print_success "Detected Husky setup"
        setup_husky_hooks
    elif check_vanilla_hooks; then
        print_success "Detected existing git hooks"
        setup_vanilla_hooks
    else
        # No existing hooks, ask user preference
        if [ "$QUIET" = true ]; then
            # Default to vanilla hooks in quiet mode
            print_verbose "No hooks detected, defaulting to vanilla hooks"
            setup_vanilla_hooks
        else
            echo "No existing git hooks detected."
            echo
            echo "Which setup would you prefer?"
            echo "1) Husky + lint-staged (recommended for teams)"
            echo "2) Vanilla git hooks (no dependencies)"
            echo
            read -p "Enter your choice (1 or 2): " -n 1 -r
            echo
            
            case $REPLY in
                1)
                    setup_husky_hooks
                    ;;
                2)
                    setup_vanilla_hooks
                    ;;
                *)
                    print_error "Invalid choice"
                    exit 1
                    ;;
            esac
        fi
    fi
    
    [ "$QUIET" = false ] && echo
    echo -e "\n${GREEN}✨ ZeroThrow setup complete!${NC}"
    if [ "$QUIET" = false ]; then
        echo "Your commits will now be checked for throw statements."
        echo "For more information, see: docs/githooks.md"
    fi
}

# Run main function
main