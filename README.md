# artma
Automatic Replication Tools for Meta-Analysis


# How to run

## Prerequisites

- Install `node`, `Python`, `R`, `Podman` (or `Docker`),
- [Set up podman](https://podman.io/docs/installation) or [Set up Docker](https://docs.docker.com/engine/install/)

## Building the containers

### Steps

- Initialize the podman using `podman machine start`.
- Build the local images with `npm run containers:build`.
- Run `npm run containers:run` to call `podman-compose up` and compose up all the images through the `docker-compose.yml` file.

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