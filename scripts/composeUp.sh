#!/bin/bash
# composeUp.sh
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
PROJECT_ROOT=$(dirname "$SCRIPTS_DIR")
source "$SCRIPTS_DIR/shellUtils.sh"

if ! podman info >/dev/null 2>&1; then
    error "Podman is not running. Please start Podman and try again."
    exit 1
fi

usage() {
    cat <<EOF
Usage: $0 [-i | --image <image_name>] [-t | --tag <tag>] <environment>

Arguments:
    <environment>    The environment to run the containers in (prod or dev) (default: dev)

Options:
    -i, --image <image_name>    The name of the image to use (default: maive)
    -t, --tag <tag>            The tag of the image to use (default: git rev-parse --short HEAD)
    -h, --help                 Show this help message and exit
EOF
    exit 1
}

IMAGE_NAME="maive"
TAG="$(git rev-parse --short HEAD)"

POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
    -i | --image)
        IMAGE_NAME="$2"
        shift 2
        ;;
    -t | --tag)
        TAG="$2"
        shift 2
        ;;
    -h | --help)
        usage
        ;;
    --) # end of flags
        shift
        break
        ;;
    -*)
        echo "Unknown option: $1" >&2
        usage
        ;;
    *) # Positional argument
        POSITIONAL_ARGS+=("$1")
        shift
        ;;
    esac
done

# Include any remaining args
POSITIONAL_ARGS+=("$@")
set -- "${POSITIONAL_ARGS[@]}"

# Set the environment. Pass 'dev' or 'prod' as an argument to this script.
ENVIRONMENT=${1:-dev} # Default to 'dev' if no argument is provided

if [[ "$ENVIRONMENT" != "prod" && "$ENVIRONMENT" != "dev" ]]; then
    error "Invalid environment. Please provide either 'prod' or 'dev' as an argument."
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

if [[ -z "$AWS_ACCOUNT_ID" || -z "$AWS_REGION" ]]; then
    error "AWS account ID or region not found. Please run 'aws configure' to set your AWS credentials."
    exit 1
fi

REPOSITORY_NAME="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Static
export REACT_IMAGE_NAME="$REPOSITORY_NAME/$IMAGE_NAME-react-ui:$TAG"
export R_IMAGE_NAME="$REPOSITORY_NAME/$IMAGE_NAME-r-plumber:$TAG"

# Set the application environment variables
if [ "$ENVIRONMENT" = "prod" ]; then
    export R_HOST="r-host"
    export R_PORT="8787"
elif [ "$ENVIRONMENT" = "dev" ]; then
    export R_HOST="0.0.0.0"
    export R_PORT="8787"
else
    error "Invalid environment. Exiting..."
    exit 1
fi

# Function to clean up containers on Ctrl+C
cleanup() {
    # info "Stopping containers..."
    # podman-compose down # Happens automatically
    info "Successfully stopped and removed all containers."
    exit 0
}

# Trap Ctrl+C and call the cleanup function
trap cleanup SIGINT

info "Running all containers for tag $TAG in $ENVIRONMENT environment..."

podman-compose up --build

exit 0
