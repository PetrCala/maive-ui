# artma
Automatic Replication Tools for Meta-Analysis


# How to run

## Prerequisites

- Install `node`, `Python`, `R`, `Podman` (or `Docker`),

## Building the containers

To build and run your containers, navigate to your project directory in the terminal and use the command `docker-compose up --build`. This will build the images as per the Dockerfiles and start the containers as defined in the `docker-compose.yml`.


## Technical choices

### Front-end

- React with Next.js

### Back end

- Flask
- R scripts

### CI/CD

- Containers using Podman (or Docker)