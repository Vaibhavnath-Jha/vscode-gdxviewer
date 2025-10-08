FROM mcr.microsoft.com/devcontainers/python:3.11

ENV DEBIAN_FRONTEND=noninteractive

RUN mkdir -p /home/vscode/extensions && \
    curl -L "https://github.com/chrispahm/gams-ide/releases/download/v0.0.92-alpha/gams-ide-0.0.92.vsix" \
    -o /home/vscode/extensions/gams-ide.vsix

RUN chown -R vscode:vscode /home/vscode/extensions

USER vscode