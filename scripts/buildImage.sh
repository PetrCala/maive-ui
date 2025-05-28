#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

if [[ -z "$1" ]]; then
    error "You must provide either an image name to rebuild, or 'all' to rebuild all images."
    exit 1
fi

# Static
BUILD_KEY="$1"
PROJECT_NAME="maive"
IMAGE_NAMES=("flask-api" "react-ui" "r-plumber")
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

if [[ -z "$AWS_ACCOUNT_ID" || -z "$AWS_REGION" ]]; then
    error "AWS account ID or region not found. Please run 'aws configure' to set your AWS credentials."
    exit 1
fi

# Call the function to get the package version
IMAGE_TAG=$(git rev-parse --short HEAD)

function buildImage() {
    IMAGE_KEY=$1
    IMAGE_FOLDER=$2
    OTHER_ARG=$3

    NEW_IMAGE_TAG="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-$IMAGE_KEY:$IMAGE_TAG" # e.g. 1234567890.dkr.ecr.us-east-1.amazonaws.com/maive-flask-api:1234567890

    if [ "$OTHER_ARG" == "force-rebuild" ]; then
        info "Deleting $NEW_IMAGE_TAG"
        podman rmi "$NEW_IMAGE_TAG" || true
    fi

    # Check if the image already exists
    if ! image_exists "$NEW_IMAGE_TAG" | grep -q "true" >/dev/null; then
        info "Building $NEW_IMAGE_TAG"
        podman build -t "$NEW_IMAGE_TAG" "$IMAGE_FOLDER"
    else
        info "Image $NEW_IMAGE_TAG already exists. Skipping build."
    fi
}

if [[ "$BUILD_KEY" == "all" ]]; then
    info "Building up all images for tag $IMAGE_TAG"
fi

IMAGE_BUILT=false

for ENTRY in "${IMAGE_NAMES[@]}"; do
    FOLDER_PATH="./apps/$ENTRY/"
    if [[ "$ENTRY" == "$BUILD_KEY" || "$BUILD_KEY" == "all" ]]; then
        buildImage "$ENTRY" "$FOLDER_PATH" "$2"
        IMAGE_BUILT=true
    fi
done

if [ $IMAGE_BUILT == false ]; then
    error "Could not find the image $IMAGE_KEY"
    exit 1
fi

success "Done building images!"
