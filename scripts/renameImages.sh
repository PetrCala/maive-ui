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

info "Renaming existing images to version $version"
# Iterate over Dockerfile types
for entry in "${dockerfile_tags[@]}"; do
    IFS=':' read -r key value <<< "$entry"
    new_image_tag="$image_name/$key:v$version" # e.g. artma/flask:v1
    
    # List all versions of the image
    image_versions=$(podman images --format "{{.Repository}}:{{.Tag}}" | grep "$image_name/$key:" | sort -r)

    # Check if there are any versions of the image
    if [ -n "$image_versions" ]; then
        latest_image_tag=$(echo "$image_versions" | head -n 1)

        # Rename the latest version to new_image_tag if it's not already the latest
        if [ "$latest_image_tag" != "$repository_name/$new_image_tag" ]; then
            podman tag "$latest_image_tag" "$new_image_tag"
            info "Renamed $latest_image_tag to $new_image_tag"
        else
            info "Latest image $latest_image_tag already has the correct version"
        fi

        # Delete all but the latest version
        for image in $(echo "$image_versions" | tail -n +2); do
            podman rmi "$image" >/dev/null
            info "Deleted old version $image"
        done
    else
        info "No existing images found for $new_image_tag".
        info "Youcan build the current image versions using 'npm run images:build'"
    fi

done

success "Image renaming complete!"