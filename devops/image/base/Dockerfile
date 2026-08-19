# OCI labels — GitHub uses source to link the package to the repo
LABEL org.opencontainers.image.source="https://github.com/bennettxxbb/Oldowan"
LABEL org.opencontainers.image.description="Oldowan devops base image"
LABEL org.opencontainers.image.licenses="MIT"

FROM debian

# Buildah — build OCI images without a daemon (used by the Docker build workflow)
RUN apt update \
    && apt install -y buildah
