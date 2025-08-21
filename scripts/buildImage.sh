#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

usage() {
    cat <<EOF
Usage: $0 [-f | --force-rebuild] [-t | --tag <tag>] <image_name>

Options:
    -f, --force-rebuild        Force rebuild the image
    -t, --tag <tag>            The tag of the image to use (default: git rev-parse --short HEAD)
    -h, --help                 Show this help message and exit
EOF
    exit 1
}

FORCE_REBUILD=false
TAG="$(git rev-parse --short HEAD)"

POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
    -f | --force-rebuild)
        FORCE_REBUILD=true
        shift
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

if [[ -z "$1" ]]; then
    error "You must provide either an image name to rebuild, or 'all' to rebuild all images."
    exit 1
fi

# Static
BUILD_KEY="$1"
PROJECT_NAME="maive"
IMAGE_NAMES=("react-ui" "lambda-r-backend")
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

if [[ -z "$AWS_ACCOUNT_ID" || -z "$AWS_REGION" ]]; then
    error "AWS account ID or region not found. Please run 'aws configure' to set your AWS credentials."
    exit 1
fi

function buildImage() {
    IMAGE_KEY=$1
    IMAGE_FOLDER=$2

    IMAGE_URL="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-$IMAGE_KEY:$TAG"

    if [ "$FORCE_REBUILD" == true ]; then
        info "Deleting $IMAGE_URL"
        podman rmi "$IMAGE_URL" || true
    fi

    # Check if the image already exists
    if ! image_exists "$IMAGE_URL" | grep -q "true" >/dev/null; then
        info "Building $IMAGE_URL"
        podman build -t "$IMAGE_URL" "$IMAGE_FOLDER"
    else
        info "Image $IMAGE_URL already exists. Skipping build."
    fi
}

if [[ "$BUILD_KEY" == "all" ]]; then
    info "Building up all images for tag $TAG"
fi

IMAGE_BUILT=false

for ENTRY in "${IMAGE_NAMES[@]}"; do
    # Determine folder path based on image type
    if [[ "$ENTRY" == "lambda-r-backend" ]]; then
        FOLDER_PATH="./lambda-r-backend/"
    else
        FOLDER_PATH="./apps/$ENTRY/"
    fi
    
    if [[ "$ENTRY" == "$BUILD_KEY" || "$BUILD_KEY" == "all" ]]; then
        buildImage "$ENTRY" "$FOLDER_PATH"
        IMAGE_BUILT=true
    fi
done

if [ $IMAGE_BUILT == false ]; then
    error "Could not find the image $IMAGE_KEY"
    exit 1
fi

success "Image built: $IMAGE_URL"
