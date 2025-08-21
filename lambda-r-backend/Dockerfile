# Lambda R Backend Dockerfile
FROM public.ecr.aws/lambda/provided:al2

# Install system dependencies
RUN yum update -y && \
    yum install -y \
    R \
    R-devel \
    gcc \
    gcc-c++ \
    make \
    libpng-devel \
    libjpeg-devel \
    libtiff-devel \
    cairo-devel \
    pango-devel \
    libcurl-devel \
    openssl-devel \
    libxml2-devel \
    && yum clean all

# Set R environment variables
ENV R_HOME=/usr/lib64/R
ENV PATH=$PATH:$R_HOME/bin

# Install R packages
RUN R -e "install.packages(c('jsonlite', 'cli', 'clubSandwich', 'varhandle', 'pracma', 'sandwich', 'metafor', 'base64enc'), repos='https://cran.rstudio.com/')"

# Copy R scripts
COPY index.R ${LAMBDA_TASK_ROOT}
COPY maive_model.R ${LAMBDA_TASK_ROOT}
COPY funnel_plot.R ${LAMBDA_TASK_ROOT}

# Copy MAIVE package (assuming it's available)
# You may need to install this from your private repository
# COPY maive_*.tar.gz ${LAMBDA_TASK_ROOT}
# RUN R CMD INSTALL maive_*.tar.gz

# Set the handler
CMD ["index.handler"]
