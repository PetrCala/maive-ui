#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh";

# Static
repository_name="localhost"
image_name="artma"
dockerfile_tags=("flask:Dockerfile-flask" "react:Dockerfile-react" "r:Dockerfile-r") # tag:dockerfile

# Call the function to get the package version
version=$(get_package_version)

info "Building up the images for version $version"
# Iterate over Dockerfile types
for entry in "${dockerfile_tags[@]}"; do
    IFS=':' read -r key value <<< "$entry"
    new_image_tag="$image_name/$key:v$version" # e.g. artma/flask:v1

    if [ "$1" = "force-rebuild" ]; then
        info "Deleting $new_image_tag"
        podman rmi "$repository_name/$new_image_tag" || true
    fi

    # Check if the image already exists
    if ! image_exists "$repository_name/$new_image_tag" | grep -q "true" >/dev/null; then
        info "Building $new_image_tag"
        podman build -f "$value" -t "$repository_name/$new_image_tag" .
    else
        info "Image $new_image_tag already exists. Skipping build."
    fi

done

success "Image build complete!"