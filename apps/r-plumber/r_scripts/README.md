# R scripts folder

## How R is hosted and accessed

- We use [Plumber](https://www.rplumber.io) to expose an API endpoint to the rest of the containers.
- This is set up in the project root `host.R` file, which is then being called in the R dockerfile, setting up the API endpoint.
- To make calls to the endpoint, either `curl` or access the relevant address, for exmple:

  ```bash
  curl "http://localhost:8787/echo?msg=hello" # Returns {"msg":["The message is: 'hello'"]}
  ```

## Package installation inside the container

- To install new packages, simply add them to the `r-packages.txt` file.
  - _Explanation:_ This file is later used in the Docker to install these from the most adequate repository (possibly P3M). Each package name gets prepended with `r-cran-` and is then installed on the Docker Ubuntu environment using `apt-get`.
- For packages not identifiable like this, I set up the `r-packages-extra.R` script that can be used in the Dockerfile like this:

  ```Dockerfile
  RUN Rscript packages/r-packages-extra.R
  ```

  For now, this option is disabled.

## Accessing packages inside the container

- By default, during the image build, the packages are installed using `apt-get` into the `/usr/lib/R/site-library` path.
- Given that the container, by default, recognizes only two default package paths, `/usr/lib/R/site-library` and `/usr/local/lib/R/site-library`, the installation path is served to the environment through the `.Renviron` file at the R project root `r_scripts`. Without this configuration, the install packages would not be available to the scripts.

## Accessing environmental variables

- Environmental variables should be placed inside the `.Renviron` file. Further, they are provided through the `docker-compose.yml`. You can access these using `Sys.getenv()`, such as:

  ```R
  print(Sys.getenv("R_LIBS")) # Served from .Renviron
  print(Sys.getenv("R_HOST")) # Served from docker-compose.yml
  print(Sys.getenv("R_PORT")) # Served from docker-compose.yml
  ```
