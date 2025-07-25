#!/bin/bash

# Source: Expensify (under MIT license)
# Link: https://github.com/Expensify/App/blob/main/scripts/shellUtils.sh

# Check if GREEN has already been defined
if [ -z "${GREEN+x}" ]; then
  declare -r GREEN=$'\e[1;32m'
fi

# Check if RED has already been defined
if [ -z "${RED+x}" ]; then
  declare -r RED=$'\e[1;31m'
fi

# Check if BLUE has already been defined
if [ -z "${BLUE+x}" ]; then
  declare -r BLUE=$'\e[1;34m'
fi

# Check if TITLE has already been defined
if [ -z "${TITLE+x}" ]; then
  declare -r TITLE=$'\e[1;4;34m'
fi

# Check if RESET has already been defined
if [ -z "${RESET+x}" ]; then
  declare -r RESET=$'\e[0m'
fi

function success {
  echo "🎉 $GREEN$1$RESET"
}

function error {
  echo "💥 $RED$1$RESET"
}

function info {
  echo "$BLUE$1$RESET"
}

function title {
  printf "\n%s%s%s\n" "$TITLE" "$1" "$RESET"
}

function assert_equal {
  if [[ "$1" != "$2" ]]; then
    error "Assertion failed: $1 is not equal to $2"
    exit 1
  else
    success "Assertion passed: $1 is equal to $1"
  fi
}

# Usage: join_by_string <delimiter> ...strings
# example: join_by_string ' + ' 'string 1' 'string 2'
# example: join_by_string ',' "${ARRAY_OF_STRINGS[@]}"
function join_by_string {
  local separator="$1"
  shift
  local first="$1"
  shift
  printf "%s" "$first" "${@/#/$separator}"
}

# Usage: get_abs_path <path>
# Will make a path absolute, resolving any relative paths
# example: get_abs_path "./foo/bar"
get_abs_path() {
  local the_path=$1
  local -a path_elements
  IFS='/' read -ra path_elements <<<"$the_path"

  # If the path is already absolute, start with an empty string.
  # We'll prepend the / later when reconstructing the path.
  if [[ "$the_path" = /* ]]; then
    abs_path=""
  else
    abs_path="$(pwd)"
  fi

  # Handle each path element
  for element in "${path_elements[@]}"; do
    if [ "$element" = "." ] || [ -z "$element" ]; then
      continue
    elif [ "$element" = ".." ]; then
      # Remove the last element from abs_path
      abs_path=$(dirname "$abs_path")
    else
      # Append element to the absolute path
      abs_path="${abs_path}/${element}"
    fi
  done

  # Remove any trailing '/'
  while [[ $abs_path == */ ]]; do
    abs_path=${abs_path%/}
  done

  # Special case for root
  [ -z "$abs_path" ] && abs_path="/"

  # Special case to remove any starting '//' when the input path was absolute
  abs_path=${abs_path/#\/\//\/}

  echo "$abs_path"
}

function get_package_version {
  # Check if jq is installed
  if ! command -v jq &>/dev/null; then
    echo "jq is not installed. Please install jq to parse JSON files."
    exit 1
  fi

  local package_json_path=$(get_abs_path "./package.json")

  if [ ! -f "$package_json_path" ]; then
    error "Package JSON file not found under this path: $package_json_path"
    error "Please make sure this script is placed in the ./scripts folder."
    exit 1
  fi

  local version=$(jq -r '.version' "$package_json_path")
  echo "$version"
}

# Check whether an image tag exists. Return True if the image exists, False otherwise.
#
# Example usage:
#   my_image="localhost/maive/react-ui:v1"
#   if image_exists $my_image; then
#     echo "Image exists"
#   else
#     echo "Image does not exist"
#   fi
function image_exists {
  local tag="$1"
  if podman images --format "{{.Repository}}:{{.Tag}}" | grep -q "$tag"; then
    echo true
  else
    echo false
  fi
}
