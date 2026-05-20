FROM mcr.microsoft.com/devcontainers/base:bookworm

ARG MISE_VERSION=2026.5.12

# Download mise binary from GitHub release and verify checksum
RUN set -eux; \
    case "$(uname -m)" in \
      x86_64)  FILE="mise-v${MISE_VERSION}-linux-x64";   SHA256="a238972a3162d710b85b28c324372e96ca4e4b486c81fe78695000d9fbc77c48" ;; \
      aarch64) FILE="mise-v${MISE_VERSION}-linux-arm64";  SHA256="fd2d5227a8ad0b1e359c70527a8345a9ada72077f8dcbb559371653c3d95464f" ;; \
      *) echo "Unsupported arch: $(uname -m)" && exit 1 ;; \
    esac; \
    wget -O /usr/local/bin/mise \
      "https://github.com/jdx/mise/releases/download/v${MISE_VERSION}/${FILE}"; \
    echo "${SHA256}  /usr/local/bin/mise" | sha256sum -c; \
    chmod +x /usr/local/bin/mise

# Store tools in a shared location accessible to all users
ENV MISE_DATA_DIR=/usr/local/share/mise

# Pre-install all runtimes pinned in the lockfile (build context is repo root)
COPY mise.toml mise.lock /tmp/mise/
RUN cd /tmp/mise && mise install && rm -rf /tmp/mise

# Activate mise for interactive shells
RUN echo 'eval "$(mise activate bash)"' >> /home/vscode/.bashrc
