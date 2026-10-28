import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

export interface ResumenDePuntuacion {
  average: number;
  count: number;
  myRating: number | null;
}

const claveDePuntuaciones = (recipeId: string) => `recipe:${recipeId}:ratings`;
const claveDeCreador = (authorId: string) => `creator:${authorId}`;

const GUARDAR_PUNTUACION = `
local anterior = redis.call('HGET', KEYS[1], ARGV[1])
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
if anterior then
  redis.call('HINCRBY', KEYS[2], 'ratingSum', tonumber(ARGV[2]) - tonumber(anterior))
else
  redis.call('HINCRBY', KEYS[2], 'ratingSum', tonumber(ARGV[2]))
  redis.call('HINCRBY', KEYS[2], 'ratingCount', 1)
end
return 1
`;

const QUITAR_PUNTUACION = `
local anterior = redis.call('HGET', KEYS[1], ARGV[1])
if anterior then
  redis.call('HDEL', KEYS[1], ARGV[1])
  redis.call('HINCRBY', KEYS[2], 'ratingSum', -tonumber(anterior))
  redis.call('HINCRBY', KEYS[2], 'ratingCount', -1)
end
return 1
`;

const redondear = (valor: number) => Math.round(valor * 10) / 10;

@Injectable()
export class RatingsService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async rate(
    recipeId: string,
    userId: string,
    authorId: string,
    stars: number,
  ) {
    await this.redis.eval(
      GUARDAR_PUNTUACION,
      2,
      claveDePuntuaciones(recipeId),
      claveDeCreador(authorId),
      userId,
      stars,
    );
    return this.resumen(recipeId, userId);
  }

  async unrate(recipeId: string, userId: string, authorId: string) {
    await this.redis.eval(
      QUITAR_PUNTUACION,
      2,
      claveDePuntuaciones(recipeId),
      claveDeCreador(authorId),
      userId,
    );
    return this.resumen(recipeId, userId);
  }

  async resumen(
    recipeId: string,
    userId?: string,
  ): Promise<ResumenDePuntuacion> {
    const resumenes = await this.resumenes([recipeId], userId);
    return resumenes[recipeId];
  }

  async resumenes(
    recipeIds: string[],
    userId?: string,
  ): Promise<Record<string, ResumenDePuntuacion>> {
    if (!recipeIds.length) {
      return {};
    }
    const pipeline = this.redis.pipeline();
    recipeIds.forEach((id) => {
      pipeline.hvals(claveDePuntuaciones(id));
      if (userId) {
        pipeline.hget(claveDePuntuaciones(id), userId);
      }
    });
    const respuestas = (await pipeline.exec()) ?? [];
    const porReceta = userId ? 2 : 1;
    return Object.fromEntries(
      recipeIds.map((id, i) => {
        const valores = ((respuestas[i * porReceta][1] ?? []) as string[]).map(
          Number,
        );
        const mia = userId ? respuestas[i * porReceta + 1][1] : null;
        const suma = valores.reduce((a, b) => a + b, 0);
        return [
          id,
          {
            average: valores.length ? redondear(suma / valores.length) : 0,
            count: valores.length,
            myRating: mia ? Number(mia) : null,
          },
        ];
      }),
    );
  }

  async creatorStats(authorIds: string[]) {
    if (!authorIds.length) {
      return {};
    }
    const pipeline = this.redis.pipeline();
    authorIds.forEach((id) => pipeline.hgetall(claveDeCreador(id)));
    const respuestas = (await pipeline.exec()) ?? [];
    return Object.fromEntries(
      authorIds.map((id, i) => {
        const datos = (respuestas[i][1] ?? {}) as Record<string, string>;
        const suma = Number(datos.ratingSum ?? 0);
        const cantidad = Number(datos.ratingCount ?? 0);
        return [
          id,
          {
            average: cantidad ? redondear(suma / cantidad) : 0,
            ratings: cantidad,
            cookedByOthers: Number(datos.cookedByOthers ?? 0),
          },
        ];
      }),
    );
  }

  async purge(recipeId: string, authorId: string) {
    const puntuaciones = await this.redis.hvals(claveDePuntuaciones(recipeId));
    const suma = puntuaciones.map(Number).reduce((a, b) => a + b, 0);
    const otros = Number(
      (await this.redis.get(`recipe:${recipeId}:cookedOthers`)) ?? 0,
    );
    const transaccion = this.redis.multi();
    if (puntuaciones.length) {
      transaccion
        .hincrby(claveDeCreador(authorId), 'ratingSum', -suma)
        .hincrby(claveDeCreador(authorId), 'ratingCount', -puntuaciones.length);
    }
    if (otros) {
      transaccion.hincrby(claveDeCreador(authorId), 'cookedByOthers', -otros);
    }
    transaccion.del(
      claveDePuntuaciones(recipeId),
      `recipe:${recipeId}:cooked`,
      `recipe:${recipeId}:cookedOthers`,
      `recipe:${recipeId}:saves`,
    );
    await transaccion.exec();
    return { ratingsRemoved: puntuaciones.length };
  }
}
