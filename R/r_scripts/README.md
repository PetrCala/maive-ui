# R scripts folder

### Package installation inside the container

- To install new packages, simply add them to the `r-packages.txt` file.
  - *Explanation:* This file is later used in the Docker to install these from the most adequate repository (possibly P3M). Each package name gets prepended with `r-cran-` and is then installed on the Docker Ubuntu environment using `apt-get`.
- For packages not identifiable like this, I set up the `r-packages-extra.R` script that can be used in the Dockerfile like this:

    ```Dockerfile
    RUN Rscript packages/r-packages-extra.R
    ```

    For now, this option is disabled.


### Accessing environmental variables

- Environmental variables should be placed inside the `.Renviron` file at the R project root `r_scripts`. You can access these using `Sys.getenv()`, such as:

  ```R
  print(Sys.getenv("R_LIBS"))
  ```