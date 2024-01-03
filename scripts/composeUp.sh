#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh";

repository_name="localhost"
image_name="artma"
package_version=$(get_package_version)

# Static
export FLASK_IMAGE_NAME="$repository_name/$image_name/flask:v$package_version"
export REACT_IMAGE_NAME="$repository_name/$image_name/react:v$package_version"
export R_IMAGE_NAME="$repository_name/$image_name/r:v$package_version"

# Check if images exist
image_names=("$FLASK_IMAGE_NAME" "$REACT_IMAGE_NAME" "$R_IMAGE_NAME")
missing_images=()

for image_name in "${image_names[@]}"; do
    if ! image_exists "$image_name" | grep -q "true" >/dev/null; then
        missing_images+=("$image_name")
    fi
done

if [[ ${#missing_images[@]} -gt 0 ]]; then
    error "Some of the local images are missing: ${missing_images[*]}. Please run 'npm run containers:build' first."
    exit 1
fi

info "Running images for version $package_version"

podman-compose up
# podman-compose -f docker-compose.yml up --build # alternative