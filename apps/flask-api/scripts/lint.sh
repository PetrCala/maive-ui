#!/bin/bash

# Run lint
# Invocation: ./scripts/lint.sh

pylint --rcfile .pylintrc app tests
