# Remi Recetas · Servicio social

[![CI](https://github.com/florenciaPenaSepulveda/remi-ms-socials/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/florenciaPenaSepulveda/remi-ms-socials/actions/workflows/ci.yml)

Microservicio de **Remi Recetas** que guarda lo que hace la comunidad alrededor de las recetas: puntuaciones, comentarios, el recetario personal (listas), lo que cada persona cocinó y el impacto contra el desperdicio. No expone HTTP: escucha mensajes en una cola de RabbitMQ y responde al [gateway](https://github.com/florenciaPenaSepulveda/remi-gateway). Hecho con NestJS 11 y Redis.

## Inicio rápido

Necesita: Redis y RabbitMQ (`docker compose up -d` en `remi-gateway`).

```bash
cp .env.example .env
npm ci
npm run start:dev
npm test
```

39 pruebas, 99 % de cobertura.

## Repositorios del sistema

| Repositorio | Función |
|---|---|
| [remi-gateway](https://github.com/florenciaPenaSepulveda/remi-gateway) | API HTTP pública, autenticación y enrutamiento |
| [remi-ms-users](https://github.com/florenciaPenaSepulveda/remi-ms-users) | Usuarios, inicio de sesión y tokens |
| [remi-ms-recetas](https://github.com/florenciaPenaSepulveda/remi-ms-recetas) | Recetas e ingredientes |
| [remi-ms-tags](https://github.com/florenciaPenaSepulveda/remi-ms-tags) | Etiquetas de las recetas |
| **remi-ms-socials** (este) | Puntuaciones, comentarios, recetario e impacto |
| [remi-frontend](https://github.com/florenciaPenaSepulveda/remi-frontend) | Aplicación web en React |

## Qué guarda

- **Puntuaciones** de 1 a 5, una por persona y receta. Cambiarla reemplaza la anterior. Alimentan el promedio de la receta y la reputación de quien la creó.
- **Reputación de creadores:** promedio de todas sus recetas, cantidad de puntuaciones y cuántas veces *otras* personas cocinaron sus recetas.
- **Recetario:** cada persona tiene una lista de favoritas (se crea sola) y hasta 19 listas propias de hasta 200 recetas.
- **Lo que cociné:** cada registro guarda la receta, la fecha, una nota opcional, los gramos aprovechados y si se usaron ingredientes de la despensa.
- **Impacto de la comunidad:** comidas cocinadas, las hechas con la despensa y los gramos aprovechados.
- **Comentarios** de las recetas.

## Modelo de datos en Redis

| Clave | Tipo | Contenido |
|---|---|---|
| `recipe:{id}:ratings` | hash | Puntuación de cada persona (`userId` → estrellas) |
| `creator:{id}` | hash | `ratingSum`, `ratingCount` y `cookedByOthers` del creador |
| `user:{id}:lists` | sorted set | Listas de una persona |
| `user:{id}:list-default`, `user:{id}:list-names` | string, set | Lista de favoritas y nombres usados (únicos sin distinguir mayúsculas ni tildes) |
| `list:{id}`, `list:{id}:recipes` | hash, sorted set | Datos de la lista y sus recetas por fecha de agregado |
| `recipe:{id}:saves` | contador | En cuántas listas está la receta |
| `cooked:{id}`, `user:{id}:cooked` | hash, sorted set | Registros de recetas cocinadas |
| `cooked-day:{userId}:{recipeId}:{día}` | string con expiración | Impide registrar la misma receta dos veces el mismo día |
| `recipe:{id}:cooked`, `recipe:{id}:cookedOthers` | contador | Veces cocinada, y por otras personas |
| `user:{id}:stats`, `impact` | hash | Recetas cocinadas y gramos de una persona; impacto global |
| `comment:{id}`, `recipe:{id}:comments`, `user:{id}:comments` | hash, sorted sets | Comentarios |

Las puntuaciones se guardan y se corrigen con scripts Lua, así el promedio del creador no se desfasa aunque dos personas puntúen a la vez; el resto de los cambios que tocan varias claves usan transacciones. No necesita módulos de Redis: sirve un Redis estándar.

## Mensajes que atiende

| Patrón | Datos | Respuesta |
|---|---|---|
| `rate_recipe` | `recipeId`, `userId`, `authorId`, `stars` | `{ average, count, myRating }` |
| `unrate_recipe` | `recipeId`, `userId`, `authorId` | Mismo resumen |
| `get_recipes_stats` | `recipeIds`, `userId` opcional | Mapa receta → promedio, puntuaciones, tu puntuación, veces cocinada, guardada y comentarios |
| `get_recipe_social_stats` | `recipeId` | Lo mismo para una receta |
| `get_creators_stats` | `userIds` | Mapa creador → `{ average, ratings, cookedByOthers }` |
| `get_lists`, `get_list` | `userId` (y `listId`) | Listas con sus `recipeIds`; las favoritas primero |
| `create_list`, `rename_list`, `delete_list` | `userId`, `listId`, `name` | La lista, o `{ id, deleted }` |
| `add_to_list`, `remove_from_list` | `userId`, `listId`, `recipeId` | La lista actualizada |
| `mark_cooked` | `recipeId`, `userId`, `authorId`, `grams`, `usedPantry`, `note` | El registro; 409 si ya se registró hoy |
| `get_cooked_history` | `userId`, `limit`, `offset` | `{ items, total, limit, offset }`, lo más reciente primero |
| `get_user_stats` | `userId` | `{ cooked, grams }` |
| `get_impact` | — | `{ cooked, pantryCooked, grams }` |
| `add_comment`, `update_comment`, `delete_comment` | ver validaciones | Comentario |
| `get_comments_by_recipe`, `get_comments_by_user` | `recipeId` o `userId`, `limit`, `offset` | `{ items, total, limit, offset }` |
| `purge_recipe_social` | `recipeId`, `authorId` | Borra puntuaciones, comentarios y contadores de una receta eliminada y corrige la reputación del creador |

El servicio confía en que el gateway le entrega identidades ya autenticadas. Aun así valida todo: puntuaciones enteras de 1 a 5, nombres de lista de 1 a 40 caracteres, comentarios de 1 a 1000, notas de hasta 300, páginas de hasta 100 y rechaza los campos que no corresponden. Solo la persona dueña de una lista o de un comentario puede modificarlos (403). Los errores viajan como `{ status, message }` y el gateway los convierte en respuestas HTTP.

Se retiraron los me gusta y no me gusta y los contadores anónimos de invitados: una puntuación dice mucho más y los contadores abiertos se podían inflar sin límite.

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
