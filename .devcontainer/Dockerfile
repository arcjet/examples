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

# Store tools in a shared location accessible to all users, and put shims on PATH
# so installed tools work in non-interactive shells (CI, devcontainer postCreateCommand, etc.)
ENV MISE_DATA_DIR=/usr/local/share/mise \
    MISE_TRUSTED_CONFIG_PATHS=/workspaces \
    PATH=/usr/local/share/mise/shims:$PATH

# Pre-install all runtimes pinned in the lockfile (build context is repo root).
# The config is installed to /etc/mise/ as a system-wide default so shims work
# in any shell, even outside the workspace directory.
COPY mise.toml mise.lock /etc/mise/
RUN chmod a+r /etc/mise/mise.toml /etc/mise/mise.lock \
    && mise trust /etc/mise/mise.toml \
    && cd /etc/mise && mise install

# Activate mise for interactive shells
RUN echo 'eval "$(mise activate bash)"' >> /home/vscode/.bashrc
