import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

export interface Cocinada {
  id: string;
  recipeId: string;
  userId: string;
  at: string;
  grams: number;
  usedPantry: boolean;
  note?: string;
}

const claveDeHistorial = (userId: string) => `user:${userId}:cooked`;
const claveDeCocinada = (id: string) => `cooked:${id}`;
const claveDeUsuario = (userId: string) => `user:${userId}:stats`;
const claveDeCreador = (authorId: string) => `creator:${authorId}`;
const IMPACTO = 'impact';
const UN_DIA = 86400;

const aCocinada = (datos: Record<string, string>): Cocinada => ({
  id: datos.id,
  recipeId: datos.recipeId,
  userId: datos.userId,
  at: datos.at,
  grams: Number(datos.grams),
  usedPantry: datos.usedPantry === '1',
  ...(datos.note ? { note: datos.note } : {}),
});

@Injectable()
export class CookedService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async markCooked(datos: {
    recipeId: string;
    userId: string;
    authorId: string;
    grams: number;
    usedPantry: boolean;
    note?: string;
  }) {
    const dia = new Date().toISOString().slice(0, 10);
    const marca = await this.redis.set(
      `cooked-day:${datos.userId}:${datos.recipeId}:${dia}`,
      '1',
      'EX',
      UN_DIA,
      'NX',
    );
    if (!marca) {
      throw new RpcException({
        status: 409,
        message: 'Ya registraste esta receta como cocinada hoy',
      });
    }
    const ahora = new Date();
    const entrada: Cocinada = {
      id: randomUUID(),
      recipeId: datos.recipeId,
      userId: datos.userId,
      at: ahora.toISOString(),
      grams: datos.usedPantry ? datos.grams : 0,
      usedPantry: datos.usedPantry,
      ...(datos.note ? { note: datos.note } : {}),
    };
    const transaccion = this.redis
      .multi()
      .hset(claveDeCocinada(entrada.id), {
        ...entrada,
        usedPantry: entrada.usedPantry ? '1' : '0',
      })
      .zadd(claveDeHistorial(datos.userId), ahora.getTime(), entrada.id)
      .incr(`recipe:${datos.recipeId}:cooked`)
      .hincrby(claveDeUsuario(datos.userId), 'cooked', 1)
      .hincrby(IMPACTO, 'cooked', 1);
    if (entrada.usedPantry) {
      transaccion
        .hincrby(IMPACTO, 'pantryCooked', 1)
        .hincrby(IMPACTO, 'grams', entrada.grams)
        .hincrby(claveDeUsuario(datos.userId), 'grams', entrada.grams);
    }
    if (datos.userId !== datos.authorId) {
      transaccion
        .incr(`recipe:${datos.recipeId}:cookedOthers`)
        .hincrby(claveDeCreador(datos.authorId), 'cookedByOthers', 1);
    }
    await transaccion.exec();
    return entrada;
  }

  async history(userId: string, limit = 50, offset = 0) {
    const [total, ids] = await Promise.all([
      this.redis.zcard(claveDeHistorial(userId)),
      this.redis.zrevrange(
        claveDeHistorial(userId),
        offset,
        offset + limit - 1,
      ),
    ]);
    const pipeline = this.redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(claveDeCocinada(id)));
    const respuestas = (await pipeline.exec()) ?? [];
    const items = respuestas.flatMap(([, datos]) => {
      const fila = datos as Record<string, string>;
      return fila?.id ? [aCocinada(fila)] : [];
    });
    return { items, total, limit, offset };
  }

  async cookedCounts(recipeIds: string[]): Promise<Record<string, number>> {
    if (!recipeIds.length) {
      return {};
    }
    const pipeline = this.redis.pipeline();
    recipeIds.forEach((id) => pipeline.get(`recipe:${id}:cooked`));
    const respuestas = (await pipeline.exec()) ?? [];
    return Object.fromEntries(
      recipeIds.map((id, i) => [id, Number(respuestas[i][1] ?? 0)]),
    );
  }

  async userStats(userId: string) {
    const datos = await this.redis.hgetall(claveDeUsuario(userId));
    return {
      cooked: Number(datos.cooked ?? 0),
      grams: Number(datos.grams ?? 0),
    };
  }

  async impact() {
    const datos = await this.redis.hgetall(IMPACTO);
    return {
      cooked: Number(datos.cooked ?? 0),
      pantryCooked: Number(datos.pantryCooked ?? 0),
      grams: Number(datos.grams ?? 0),
    };
  }
}
