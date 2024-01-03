#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh";

# Static
image_name="artma"
dockerfile_tags=("flask:Dockerfile-flask" "react:Dockerfile-react" "r:Dockerfile-r") # tag:dockerfile
package_json_path="$SCRIPTS_DIR/../package.json" # for extracting project version

# Check if jq is installed
if ! command -v jq &>/dev/null; then
    echo "jq is not installed. Please install jq to parse JSON files."
    exit 1
fi

# Extract and print the package version
version=$(jq -r '.version' "$package_json_path")

info "Building up the images for version $version"
# Iterate over Dockerfile types
for entry in "${dockerfile_tags[@]}"; do
    IFS=':' read -r key value <<< "$entry"
    new_image_tag="$image_name/$key:v$version" # e.g. artma/flask:v1
    
    # Check if the image already exists
    if ! podman images --format "{{.Repository}}:{{.Tag}}" | grep -q "$new_image_tag"; then
        info "Building $new_image_tag"
        podman build -f $value -t $new_image_tag . # $value is the dockerfile name
        success "Built $new_image_tag"
    else
        info "Image $new_image_tag already exists. Skipping build."
    fi

done

success "Image build complete!"