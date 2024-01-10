# Scripts

This folder contains a number of scripts necessary for continuous integration and automatic procedures related to this project. Here is an explanation of some of the crucial scripts in this folder:

## renameImages.sh

This script is used to rename existing Docker images to a new version. It is typically used in a development environment where multiple versions of the same image are created during the development process.

The script first sets up some variables, including the repository name, image name, and Dockerfile tags. It then calls a function to get the package version.

The script then iterates over the Dockerfile tags and performs the following steps for each tag:
1. Constructs the new image tag using the image name, Dockerfile type, and version.
2. Lists all versions of the image using the `podman images` command.
3. Checks if there are any versions of the image.
4. If there are versions, it renames the latest version to the new image tag if it's not already the latest.
5. Deletes all but the latest version of the image.

If there are no existing images for a specific Dockerfile tag, the script provides a message indicating that no images were found and suggests running a command to build the current image versions.

Finally, the script outputs a success message indicating that the image renaming process is complete.

## bumpVersion.sh

Script Summary:
This script is used to bump the version of a project based on the specified version type (BUILD, PATCH, MINOR, or MAJOR).
It checks if an argument is provided, if there are unsaved changes, and if the version type is valid.
Then it executes the version bump command using a Node.js script and updates the project's version.
Finally, it commits the changes and provides instructions to push the changes to the remote repository.

Usage:
`./bumpVersion.sh [version_type]`

Arguments:
- `version_type`: The type of version bump to perform. Valid options are BUILD, PATCH, MINOR, or MAJOR.

Example:
`./bumpVersion.sh PATCH`
This will bump the project's version by incrementing the PATCH level.

Dependencies:
- Node.js: The script relies on a Node.js script located at `./.github/libs/bumpVersion.js` to perform the version bump.

Exit Codes:
- 0: Success
- 1: Error occurred during execution

Note:
- Make sure to commit or stash any unsaved changes before running this script.
- After running the script, remember to push the changes to the remote repository using `git push`.

## buildImages.sh

This script builds Docker images for the artma project. It retrieves the package version, 
iterates over different Dockerfile types, and builds the corresponding images if they 
don't already exist. The images are tagged with the version number and stored locally. 
The script uses the `shellUtils.sh` script for utility functions.

Usage: `./buildImages.sh`

