#!/bin/bash
# setenv.sh

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh";

if [ "$1" == "dev" ]; then
    cp .env.dev .env
    info "Runtime environment set to development."
elif [ "$1" == "prod" ]; then
    cp .env.prod .env
    info "Runtime environment set to production."
else
    error "Incorrect environment value provided to '$0': $1"
    error "Usage: $0 [dev|prod]"
    exit 1
fi
