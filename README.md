# artma
Automatic Replication Tools for Meta-Analysis


# How to run

## Prerequisites

- Install `node`, `Python`, `R`, `Podman` (or `Docker`),
- [Set up podman](https://podman.io/docs/installation) or [Set up Docker](https://docs.docker.com/engine/install/)
- Install `podman-compose` using `brew install podman-compose`

## Building the containers

### Steps

- Initialize the podman using `podman machine start`.
- Build the local images with `npm run images:build`.
- To run the project in a development environment, execute `npm run start:dev`. For production environment, do `npm run start:prod`. This will check for all necessary images, build missing ones, and start up all relevant containers. You can check that the containers are up and running by calling `podman ps -a`.

## Accessing individual parts of the application

TBA

### Useful notes

- Remove empty images
```podman images --format "{{.ID}}: {{.Repository}}:{{.Tag}}" | grep '<none>' | awk -F: '{print $1}' | xargs -I {} podman rmi {}```

## Technical choices

### Front-end

- React with Next.js

### Back end

- Flask
- R scripts

### CI/CD

- Containers using Podman (or Docker)