FROM mcr.microsoft.com/devcontainers/base:bookworm

ENV DENO_INSTALL=/usr/local
RUN curl -fsSL https://deno.land/install.sh | sh -s -- v2.4.5

RUN deno --version