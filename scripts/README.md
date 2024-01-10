# Scripts

This folder contains a number of scripts necessary for continuous integration and automatic procedures related to this project. Here is an explanation of some of the crucial scripts in this folder:

## `composeUp.sh`

Automate the process of setting up and running a multi-container Docker application in different environments (development or production). The script handles environment settings, checks for Docker images, and manages container orchestration using `podman-compose`.

#### Prerequisites
- Ensure you have `bash`, `npm`, `podman-compose`, and Docker installed.
- The script assumes the presence of `.env` file and other scripts (`shellUtils.sh`, `setenv.sh`) in the project structure.

#### Usage
1. **Running the Script:**
   - Navigate to the directory containing `composeUp.sh`.
   - Run the script using the command:
     ```bash
     ./composeUp.sh [environment]
     ```
     Replace `[environment]` with either `dev` for development or `prod` for production. If omitted, it defaults to `dev`.

2. **Environment Argument:**
   - The script accepts one argument to set the environment:
     - `dev`: Development environment.
     - `prod`: Production environment.

3. **Behavior:**
   - **Environment Setup:** The script sources environmental variables and settings based on the specified environment.
   - **Image Check and Build:**
     - Checks if required Docker images (`FLASK_IMAGE_NAME`, `REACT_IMAGE_NAME`, `R_IMAGE_NAME`) are available.
     - If any images are missing, it offers to build them depending on the `BUILD_*_IMAGE` environment variables or user confirmation.
   - **Containers Management:**
     - Uses `podman-compose` to manage containers.
     - Includes a cleanup function to stop and remove all containers if the script is interrupted (e.g., via Ctrl+C).

4. **Important Variables:**
   - `REPOSITORY_NAME`, `IMAGE_NAME`: Used to define Docker image names.
   - `BUILD_FLASK_IMAGE`, `BUILD_REACT_IMAGE`, `BUILD_R_IMAGE`: Control whether to build specific images.

#### Important Notes
- Ensure the `.env` file is correctly set up in the project root directory.
- The script will exit with an error if the `.env` file is missing or required Docker images are not available and not built.
- This script is intended for use with projects using Flask, React, and R with Docker.

#### Troubleshooting
- **Permission Denied:** Make sure the script has execution permissions (`chmod +x composeUp.sh`).
- **Missing `.env` File:** Verify the `.env` file's presence in the project root.
- **Docker Image Errors:** Ensure Docker is running and the required images are correctly named in the `.env` file.

## `renameImages.sh`

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

## `bumpVersion.sh`

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

## `buildImages.sh`

This script builds Docker images for the artma project. It retrieves the package version, 
iterates over different Dockerfile types, and builds the corresponding images if they 
don't already exist. The images are tagged with the version number and stored locally. 
The script uses the `shellUtils.sh` script for utility functions.

Usage: `./buildImages.sh`

