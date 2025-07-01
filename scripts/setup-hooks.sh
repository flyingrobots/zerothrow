#!/usr/bin/env bash

# ZeroThrow Git Hooks Setup Script
# This script intelligently sets up git hooks to enforce no-throw discipline
# It respects existing setups and asks for permission before modifying anything

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Enable strict mode
set_strict_mode

# Check for Windows compatibility
if is_windows && [[ -z "$BASH_VERSION" ]]; then
    print_error "This script requires Git Bash or WSL on Windows."
    echo "Please run this script from Git Bash or Windows Subsystem for Linux."
    exit 1
fi

# Parse command line arguments
if ! parse_common_args "$@"; then
    echo "Usage: $(basename "$0") [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -q, --quiet    Suppress non-essential output"
    echo "  -v, --verbose  Show detailed output"
    echo "  -h, --help     Show this help message"
    exit 0
fi

# Get project root
PROJECT_ROOT=$(find_project_root) || exit 1
cd "$PROJECT_ROOT"
print_success "Working in project root: $PROJECT_ROOT"

if [ "$QUIET" = false ]; then
    echo "🚀 [ZeroThrow] Git Hooks Setup"
    echo "================================"
    echo
fi

# Global package manager variable
PKG_MGR=""

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