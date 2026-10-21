# remi-ms-socials

Microservicio social (interacciones) de Remi Recetas.

## Tecnologías

- NestJS
- TypeScript
- RabbitMQ / microservicios
- Jest

## Estructura

```
📄 README.md
📄 eslint.config.mjs
📄 nest-cli.json
📄 package-lock.json
📄 package.json
📁 src
📁 test
📄 tsconfig.build.json
📄 tsconfig.json
```

## Cómo ejecutarlo

```bash
npm install
npm run start:dev
npm start
npm run build
npm run test
```

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores (el `.env` real no se versiona):

- `RABBITMQ_URL`
- `REDIS_HOST`
- `REDIS_PORT`

## Autoría

Proyecto académico/profesional desarrollado en equipo; este repositorio forma parte del portafolio de [Florencia Peña Sepúlveda](https://github.com/florenciaPenaSepulveda).
