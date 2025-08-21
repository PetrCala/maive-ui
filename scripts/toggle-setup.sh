#!/bin/bash

# Script to toggle between secure and minimal setups
# Usage: ./scripts/toggle-setup.sh [secure|minimal]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VARS_FILE="$PROJECT_ROOT/terraform/stacks/prod-runtime/variables.tf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show current setup
show_current_setup() {
    print_status "Current setup configuration:"
    
    if [ -f "$VARS_FILE" ]; then
        current_value=$(grep -A 1 'variable "use_secure_setup"' "$VARS_FILE" | grep "default" | sed 's/.*default.*= *//' | tr -d ' ')
        if [ "$current_value" = "true" ]; then
            print_success "Current setup: SECURE (ALB + WAF + Enhanced Security)"
            print_status "Cost: ~$18/month additional"
            print_status "Security: High (WAF, rate limiting, DDoS protection)"
        else
            print_success "Current setup: MINIMAL (Direct ECS Access)"
            print_status "Cost: ~$0/month additional"
            print_status "Security: Basic (direct internet access)"
        fi
    else
        print_error "Variables file not found: $VARS_FILE"
        exit 1
    fi
}

# Function to switch to secure setup
switch_to_secure() {
    print_status "Switching to SECURE setup..."
    
    if [ -f "$VARS_FILE" ]; then
        # Update the default value to true
        sed -i.bak 's/default.*=.*false/default = true/' "$VARS_FILE"
        rm -f "${VARS_FILE}.bak"
        
        print_success "Switched to SECURE setup!"
        print_status "Next steps:"
        print_status "1. Run: cd terraform/stacks/prod-runtime && terragrunt plan"
        print_status "2. Review the plan to see ALB, WAF, and security group changes"
        print_status "3. Run: terragrunt apply"
        print_status "4. Access UI via: npm run cloud:ui-url"
    else
        print_error "Variables file not found: $VARS_FILE"
        exit 1
    fi
}

# Function to switch to minimal setup
switch_to_minimal() {
    print_status "Switching to MINIMAL setup..."
    
    if [ -f "$VARS_FILE" ]; then
        # Update the default value to false
        sed -i.bak 's/default.*=.*true/default = false/' "$VARS_FILE"
        rm -f "${VARS_FILE}.bak"
        
        print_success "Switched to MINIMAL setup!"
        print_status "Next steps:"
        print_status "1. Run: cd terraform/stacks/prod-runtime && terragrunt plan"
        print_status "2. Review the plan to see ALB, WAF, and security group removals"
        print_status "3. Run: terragrunt apply"
        print_status "4. Access UI via: npm run cloud:ui-ecs"
    else
        print_error "Variables file not found: $VARS_FILE"
        exit 1
    fi
}

# Main script logic
main() {
    print_status "MAIVE UI Setup Toggle Script"
    echo
    
    case "${1:-}" in
        "secure")
            switch_to_secure
            ;;
        "minimal")
            switch_to_minimal
            ;;
        "status"|"")
            show_current_setup
            ;;
        *)
            print_error "Invalid option: $1"
            echo
            print_status "Usage: $0 [secure|minimal|status]"
            echo
            print_status "Options:"
            print_status "  secure  - Switch to secure setup (ALB + WAF + Enhanced Security)"
            print_status "  minimal - Switch to minimal setup (Direct ECS Access)"
            print_status "  status  - Show current setup (default)"
            echo
            print_status "Examples:"
            print_status "  $0 secure   # Switch to secure setup"
            print_status "  $0 minimal  # Switch to minimal setup"
            print_status "  $0 status   # Show current setup"
            exit 1
            ;;
    esac
    
    echo
    print_status "Setup toggle complete!"
}
