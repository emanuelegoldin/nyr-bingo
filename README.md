# Ney Year Resolution Bingo

[![Latest release](https://img.shields.io/github/v/release/emanuelegoldin/nyr-bingo?sort=semver)](https://github.com/emanuelegoldin/nyr-bingo/releases/latest)
[![Tests](https://github.com/emanuelegoldin/nyr-bingo/actions/workflows/tests.yml/badge.svg?branch=dev)](https://github.com/emanuelegoldin/nyr-bingo/actions/workflows/tests.yml)
[![CI / Release](https://github.com/emanuelegoldin/nyr-bingo/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/emanuelegoldin/nyr-bingo/actions/workflows/main.yml)
[![Next.js build](https://github.com/emanuelegoldin/nyr-bingo/actions/workflows/nextjs-app-build.yml/badge.svg)](https://github.com/emanuelegoldin/nyr-bingo/actions/workflows/nextjs-app-build.yml)
[![WS server build](https://github.com/emanuelegoldin/nyr-bingo/actions/workflows/websocket-server-build.yml/badge.svg)](https://github.com/emanuelegoldin/nyr-bingo/actions/workflows/websocket-server-build.yml)
[![Last commit](https://img.shields.io/github/last-commit/emanuelegoldin/nyr-bingo/dev)](https://github.com/emanuelegoldin/nyr-bingo/commits/dev)

Stay focused on your goals while competing with your friends with our New Year Resolutions Bingo

## Requirements
<!-- TODO: Add versions -->
For the Next.js app and the WebSocket server:

- Node
- TypeScript
- pnpm

We provide a simple Development Container configuration in `.devcontainer/devcontainer.json`

To launch the application:

- Docker CE

## Start the Application

Configure the environmental variables in the .env file (copy `.env.example` and rename it) and the docker-compose file, if needed.

From the root folder of the project:

```sh
docker compose up -d
```
