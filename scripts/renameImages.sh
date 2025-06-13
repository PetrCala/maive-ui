#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

# Static
PROJECT_NAME="maive"
IMAGE_NAMES=("react-ui" "r-plumber")
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

# Call the function to get the package version
IMAGE_TAG=$(git rev-parse --short HEAD)

info "Renaming existing images to tag $IMAGE_TAG"
# Iterate over image names
for ENTRY in "${IMAGE_NAMES[@]}"; do
    NEW_IMAGE_TAG="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-$ENTRY:$IMAGE_TAG" # e.g. 1234567890.dkr.ecr.us-east-1.amazonaws.com/maive-react-ui:1234567890

    # List all versions of the image
    IMAGE_VERSIONS=$(podman images --format "{{.Repository}}:{{.Tag}}" | grep "$ENTRY:" | sort -r)

    # Check if there are any versions of the image
    if [ -n "$IMAGE_VERSIONS" ]; then
        LATEST_IMAGE_TAG=$(echo "$IMAGE_VERSIONS" | head -n 1)

        # Rename the latest version to NEW_IMAGE_TAG if it's not already the latest
        if [ "$LATEST_IMAGE_TAG" != "$NEW_IMAGE_TAG" ]; then
            podman tag "$LATEST_IMAGE_TAG" "$NEW_IMAGE_TAG"
            info "Renamed $LATEST_IMAGE_TAG to $NEW_IMAGE_TAG"
            IMAGE_VERSIONS=$(podman images --format "{{.Repository}}:{{.Tag}}" | grep "$ENTRY:" | sort -r) # update
        else
            info "Latest image $LATEST_IMAGE_TAG already has the correct version"
        fi

        # Delete all but the latest version
        for IMAGE in $(echo "$IMAGE_VERSIONS" | tail -n +2); do
            podman rmi "$IMAGE" >/dev/null
            info "Deleted old version $IMAGE"
        done
    else
        info "No existing images found for $NEW_IMAGE_TAG".
        info "You can build the current image versions using 'npm run images:build'"
    fi

done

success "Image renaming complete!"
