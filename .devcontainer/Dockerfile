FROM mcr.microsoft.com/devcontainers/python:3.11

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN curl -L "https://github.com/chrispahm/gams-ide/releases/download/v0.0.92-alpha/gams-ide-0.0.92.vsix" -o /tmp/gams-ide.vsix

USER vscode