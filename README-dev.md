<div align="center">
    <h1>
        <a href="https://spuriousprecision.com">
        MAIVE - Developer's guide
        </a>
    </h1>
</div>

#### Table of Contents

- [Deploying the application](#deploying-the-application)
  - [Initial deploy to cloud](#initial-deploy-to-cloud)
  - [Deploying the app stack](#deploying-the-app-stack)
- [How to run locally](#how-to-run-locally)
  - [Prerequisites](#prerequisites)
  - [Steps](#steps)
  - [Notes](#notes)
- [Handling images containers](#handling-images-containers)
  - [Scripts](#scripts)
- [Useful notes](#useful-notes)
  - [Technical choices](#technical-choices)
    - [Front-end](#front-end)
    - [Back end](#back-end)
    - [CI/CD](#cicd)
- [Creating new releases](#creating-new-releases)
- [Useful resources](#useful-resources)

# Deploying the application

We use AWS to host the application. To host the application, please [create an AWS account](https://aws.amazon.com/) first, install [AWS CLI](https://aws.amazon.com/cli/), and log in to your account in your console.

We also recommend you [create a profile](https://docs.aws.amazon.com/cli/v1/userguide/cli-configure-files.html) for your account.

## Initial deploy to cloud

Before the application stack can be deployed, you must first deploy the infra foundation:

1. Make sure you are logged in to the account you want to deploy the resources for. Confirm this by calling `aws sts get-caller-identity`.
1. Run `npm run init-cloud`. This will deploy the foundation infrastructure such as S3, ECR, VPC, etc.

## Deploying the app stack

The applications are built and deployed automatically upno each pull request to the `release` branch. To release a new (or initial) version of the app, simply open a pull request against the `release` branch and follow the instructions.

# How to run locally

## Prerequisites

- Install `node`, `Python`, `R`, `Podman` (or `Docker`),
- [Set up podman](https://podman.io/docs/installation) or [Set up Docker](https://docs.docker.com/engine/install/)
- Install `podman-compose` using `brew install podman-compose`

## Steps

- Initialize the podman using `podman machine start`.
- Run `npm run start:dev`. This will build all necessary images, and start up relevant containers in a development environment. For production environment, execute `npm run start:prod` instead.
- Individual parts of the application can be accessed from your browser or from the terminal under these domains:
  - **React application:** `127.0.0.1:3000`
  - **Flask application:** `127.0.0.1:8080`
  - **R:** `127.0.0.1:8787`

## Notes

- You can check that the containers are up and running by calling `podman ps -a` from another terminal instance.
- Upon pressing Ctrl+C in the terminal instance where the `start:dev` command was executed, all of the running containers will be gracefully shut down and deleted.
- Any images built during the process will remain present. You can check the list of these images by running `podman images`. Remove these using `podman rmi [image-name]`, or `podman rmi -a`, which will remove all images.
- You can also access any of the containers by using `localhost` as the host name, such as `localhost:3000` for the React application.

# Handling images containers

## Scripts

There are several pre-defined node scripts which should help you work with images and containers. All of these can be executed using `npm run [script-name]`Here is a list of some of them:

- `images:build`: Builds the Docker images only if they don't already exist.
- `images:rebuild`: Forces the rebuild of all Docker images.
- `images:rebuild-<image-tag>`: Force the rebuild of a single Docker image (specified by `<image-tag>`). E.g., `bun run images:rebuild-react` rebuilds the React image.
- `images:rename`: Renames all existing images to match the current project version.
- `start:dev`: Builds any missing images and starts up all containers in a development environment. Upon Ctrl+C, all of the containers will be gracefully shut down and deleted.
- `start:prod`: Very similar to `start:dev`, but builds and starts the containers in a production environment.
- `stop`: Stops and removes all existing containers.

# Useful notes

- Remove empty images

  ```bash
  podman images --format "{{.ID}}: {{.Repository}}:{{.Tag}}" | grep '<none>' | awk -F: '{print $1}' | xargs -I {} podman rmi {}
  ```

- Get logs of a container that is running in a detached mode

  ```bash
  podman logs -f <container-name>
  ```

## Technical choices

### Front-end

- React with Next.js

### Back end

- Flask
- R API endpoint through [Plumber](https://www.rplumber.io)

### CI/CD

- Containers using Podman (or Docker)

# Creating new releases

All infrastructure is built and deployed to AWS through the `release.yml` workflow.

You can trigger this by opening a PR against the `master` branch and tagging it with the `release` label. Upon successful merge, the `release.yml` workflow will be triggered.

If you want to build a new specific semver verison, pass the relevant label, i.e. `v-build`, `v-patch`, `v-minor`, or `v-major`.

To open the release PR automatically, call `npm run release`, and optionally pass the --semver flag with the desired semver level.

As admin, can also close the PRs automatically using `npm run mergePR`.

# Useful resources

- [Retro-board GH repo](https://github.com/antoinejaussoin/retro-board/blob/develop/docker-compose.yml) - For integrating PostgreSQL into the project
