# Project Overview

This project is a web application that allows users to create and manage resolutions for the new year. It provides a gamified bingo experience to compete with other users. It is built using React, Next.js and Typescript. It uses MariaDB for data storage.

## Folder Structure

- `database/`: Contains the initial database schema
    - `docker/Dockerfile.mariadb`: Dockerfile for the MariaDB database.
- `database-migrations/`: Contains the Flyway database migration files.
    - `docker/Dockerfile.flyway`: Dockerfile for the Flyway database migration tool.
- `nextjs`: Contains the source code for the Next.js application.
  - `src/`: Contains the source code for the Next.js application.
  - `docker/`: Contains the Docker configuration files for the project.
    - `Dockerfile.nextjs`: Dockerfile for the Next.js application.
    - `Dockerfile.nginx`: Dockerfile for the Nginx web server.
  - `public/`: Contains static assets for the frontend, such as images and stylesheets.
  - `uploads/`: Contains user-uploaded files, such as profile pictures and resolution images. Usually not relevant for development when prompted.
  - `specs/`: Contains Markdown files with specifications for the project, such as API specifications and user stories.
  - `AGENTS.md`: Contains specifications for the agents that will be used in the project, such as their roles and responsibilities.
- `nginx/`: Contains the Nginx configuration for the project.
  - `nyr-bingo_nginx.conf`: Contains the Nginx configuration, which is used to serve the frontend and backend applications.
- `ws-server/`: Websocket server for real-time behavior in the application.
  - `server.ts`: Contains the source code for the websocket server.
  - `messages/`: Contains the message definitions for the websocket communication.
- `docs/`: Contains documentation for the project.
  - `database/`: Contains descriptions of the migration files (`migrations.md`).
- `docker-compose.yml`: Contains the Docker Compose configuration for the project, which defines how the different services (Next.js application, database, etc.) are orchestrated together. Used for local development and testing. The Dockerfiles in the `docker/` directory are used to build the individual images for each service.

## Libraries and Frameworks

- Next.js for the main application (React + Typescript).
- Node.js for the websocket server.


## Coding Standards

- Use semicolons at the end of each statement.
- Define types or interfaces for complex data structures.
- Avoid using `any` type in TypeScript, unless absolutely necessary.
- Use function based components in React.
- Use arrow functions for callbacks.
- Use `const` for variables that are not reassigned, and `let` for variables that are reassigned.
- Use descriptive variable and function names that clearly indicate their purpose.
- When generating functions, provide documentation comments that explain the purpose of the function, its parameters, and its return value.
- Use consistent indentation (2 spaces) and spacing throughout the codebase.

## UI guidelines

- Reuse `nextjs/src/components/ui` components whenever possible to maintain a consistent look and feel across the application.
- Avoid single complex React components. Break them down into smaller, reusable components when possible. As a rule of thumb, if a component exceeds 300 lines of code, consider refactoring it into smaller components.

## General guidelines

- Prefer maintainability and readability over cleverness. Write code that is easy to understand and maintain.