# Remi Recetas · Servicio social

[![CI](https://github.com/florenciaPenaSepulveda/remi-ms-socials/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/florenciaPenaSepulveda/remi-ms-socials/actions/workflows/ci.yml)

Microservicio de **Remi Recetas** que guarda los me gusta, los no me gusta y los comentarios de las recetas. No expone HTTP: escucha mensajes en una cola de RabbitMQ y responde al [gateway](https://github.com/florenciaPenaSepulveda/remi-gateway). Hecho con NestJS 11 y Redis.

## Repositorios del sistema

| Repositorio | Función |
|---|---|
| [remi-gateway](https://github.com/florenciaPenaSepulveda/remi-gateway) | API HTTP pública, autenticación y enrutamiento |
| [remi-ms-users](https://github.com/florenciaPenaSepulveda/remi-ms-users) | Usuarios, inicio de sesión y tokens |
| [remi-ms-recetas](https://github.com/florenciaPenaSepulveda/remi-ms-recetas) | Recetas e ingredientes |
| [remi-ms-tags](https://github.com/florenciaPenaSepulveda/remi-ms-tags) | Etiquetas de las recetas |
| **remi-ms-socials** (este) | Me gusta y comentarios |
| [remi-frontend](https://github.com/florenciaPenaSepulveda/remi-frontend) | Aplicación web en React |

## Modelo de datos en Redis

| Clave | Tipo | Contenido |
|---|---|---|
| `recipe:{id}:likes` | set | Usuarios a los que les gusta la receta |
| `recipe:{id}:dislikes` | set | Usuarios a los que no les gusta |
| `comment:{id}` | hash | Comentario: `id`, `recipeId`, `userId`, `text`, `createdAt` y `updatedAt` |
| `recipe:{id}:comments` | sorted set | Comentarios de una receta, ordenados por fecha |
| `user:{id}:comments` | sorted set | Comentarios de una persona, ordenados por fecha |

Los contadores se obtienen contando los miembros del set, no se guardan aparte, así que no pueden desincronizarse. Una persona tiene como máximo una reacción por receta: cambiar de me gusta a no me gusta mueve el voto en una sola transacción. No necesita módulos de Redis: sirve un Redis estándar.

## Mensajes que atiende

| Patrón | Datos | Respuesta |
|---|---|---|
| `add_like`, `remove_like`, `add_dislike`, `remove_dislike` | `recipeId`, `userId` | `{ likes, dislikes, reaction }` |
| `get_recipe_stats` | `recipeId` | `{ likes, dislikes }` |
| `get_user_reaction` | `recipeId`, `userId` | `like`, `dislike` o `null` |
| `get_recipes_stats` | `recipeIds`, `userId` opcional | Mapa receta → totales, comentarios y reacción de quien consulta |
| `get_recipe_social_stats` | `recipeId` | `{ likes, dislikes, commentsCount }` |
| `add_comment` | `recipeId`, `userId`, `text` | Comentario |
| `get_comments_by_recipe` | `recipeId`, `limit`, `offset` | `{ items, total, limit, offset }`, los más nuevos primero |
| `get_comments_by_user` | `userId`, `limit`, `offset` | Misma forma |
| `update_comment` | `commentId`, `userId`, `text` | Comentario actualizado |
| `delete_comment` | `commentId`, `userId` | `{ id, deleted }` |
| `purge_recipe_social` | `recipeId` | Borra reacciones y comentarios de una receta eliminada |

Solo quien escribió un comentario puede editarlo o eliminarlo (403 en caso contrario). Los comentarios admiten de 1 a 1000 caracteres, las páginas hasta 100 elementos (50 por defecto) y se rechazan los campos que no correspondan. Los errores viajan como `{ status, message }` y el gateway los convierte en respuestas HTTP.

Las reacciones requieren una persona identificada: ya no existen los contadores anónimos de invitados, que cualquiera podía inflar sin límite.

## Requisitos

- Node.js 24 (ver `.nvmrc`).
- Redis y RabbitMQ. El `docker-compose.yml` del gateway los levanta.

## Puesta en marcha

```bash
cp .env.example .env
npm ci
npm run start:dev
```

| Variable | Descripción | Por defecto |
|---|---|---|
| `REDIS_URL` | Conexión a Redis | `redis://localhost:6379` |
| `AMQP_URI` | Conexión a RabbitMQ | `amqp://localhost:5672` |
| `SOCIALS_QUEUE` | Cola que escucha | `socials_queue` |

## Pruebas

```bash
npm test
npm run test:cov
npm run lint
```

Las pruebas levantan el servicio completo (validación y errores incluidos) sobre transporte TCP y lo consultan como lo haría el gateway; necesitan un Redis en `REDIS_URL` (por defecto `redis://localhost:6380/14`, la base 14) y la vacían antes de cada prueba, así que no la apuntes a una base con datos. El CI ejecuta lint, compilación y pruebas con cobertura.

## Docker

```bash
docker build -t remi-ms-socials .
docker run --env-file .env remi-ms-socials
```

## Autoría

Proyecto desarrollado en equipo durante la carrera. Esta copia forma parte del portafolio de [Florencia Peña Sepúlveda](https://github.com/florenciaPenaSepulveda), que la revisó, corrigió y documentó.
