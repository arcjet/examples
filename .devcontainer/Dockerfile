FROM mcr.microsoft.com/devcontainers/base:bookworm

# Install mise to a system-wide location
RUN curl https://mise.run | MISE_INSTALL_PATH=/usr/local/bin sh

# Store tools in a shared location accessible to all users
ENV MISE_DATA_DIR=/usr/local/share/mise

# Pre-install all runtimes pinned in the lockfile (build context is repo root)
COPY mise.toml mise.lock /tmp/mise/
RUN cd /tmp/mise && mise install && rm -rf /tmp/mise

# Activate mise for interactive shells
RUN echo 'eval "$(mise activate bash)"' >> /home/vscode/.bashrc
