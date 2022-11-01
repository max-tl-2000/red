# import base image
FROM registry.corp.reva.tech/ubuntu-18.04:latest

EXPOSE 3000 3030 3040 3070 3080 3500 4000

ENTRYPOINT ["./run.sh", "-e", "dev"]

HEALTHCHECK --interval=30s --timeout=5s --retries=1 CMD ./healthCheck.sh

WORKDIR /src

COPY ./red-dist /src

# install dependencies
RUN export PYTHON=/usr/bin/python2.7 && ./configure.sh --production

# Preventing creation of additional layer to save time on build. Each additional layer takes 20 seconds to create...
#CMD ["-e", "dev"]
