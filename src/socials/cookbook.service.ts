import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

export interface ListaDeRecetas {
  id: string;
  name: string;
  isDefault: boolean;
  count: number;
  recipeIds: string[];
}

const MAXIMO_DE_LISTAS = 20;
const MAXIMO_POR_LISTA = 200;
const NOMBRE_POR_DEFECTO = 'Favoritas';

const claveDeListas = (userId: string) => `user:${userId}:lists`;
const claveDeNombres = (userId: string) => `user:${userId}:list-names`;
const claveDeLaPredeterminada = (userId: string) =>
  `user:${userId}:list-default`;
const claveDeLista = (listId: string) => `list:${listId}`;
const claveDeRecetas = (listId: string) => `list:${listId}:recipes`;
const claveDeGuardados = (recipeId: string) => `recipe:${recipeId}:saves`;

const normalizar = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

@Injectable()
export class CookbookService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async getLists(userId: string): Promise<ListaDeRecetas[]> {
    await this.asegurarPredeterminada(userId);
    const ids = await this.redis.zrevrange(claveDeListas(userId), 0, -1);
    const listas = await Promise.all(ids.map((id) => this.leer(id)));
    return listas.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  async getList(userId: string, listId: string): Promise<ListaDeRecetas> {
    await this.delDueno(userId, listId);
    return this.leer(listId);
  }

  async create(userId: string, name: string): Promise<ListaDeRecetas> {
    await this.asegurarPredeterminada(userId);
    if ((await this.redis.zcard(claveDeListas(userId))) >= MAXIMO_DE_LISTAS) {
      throw new RpcException({
        status: 409,
        message: `Puedes tener hasta ${MAXIMO_DE_LISTAS} listas`,
      });
    }
    return this.crear(userId, name, false);
  }

  async rename(
    userId: string,
    listId: string,
    name: string,
  ): Promise<ListaDeRecetas> {
    const lista = await this.delDueno(userId, listId);
    if (normalizar(lista.name) !== normalizar(name)) {
      const reservado = await this.redis.sadd(
        claveDeNombres(userId),
        normalizar(name),
      );
      if (!reservado) {
        throw this.nombreRepetido();
      }
      await this.redis.srem(claveDeNombres(userId), normalizar(lista.name));
    }
    await this.redis.hset(claveDeLista(listId), { name });
    return this.leer(listId);
  }

  async remove(userId: string, listId: string) {
    const lista = await this.delDueno(userId, listId);
    if (lista.isDefault) {
      throw new RpcException({
        status: 400,
        message: 'La lista de favoritas no se puede eliminar',
      });
    }
    const recetas = await this.redis.zrevrange(claveDeRecetas(listId), 0, -1);
    const transaccion = this.redis.multi();
    for (const recipeId of recetas) {
      transaccion.decr(claveDeGuardados(recipeId));
    }
    transaccion
      .del(claveDeLista(listId), claveDeRecetas(listId))
      .zrem(claveDeListas(userId), listId)
      .srem(claveDeNombres(userId), normalizar(lista.name));
    await transaccion.exec();
    return { id: listId, deleted: true };
  }

  async add(userId: string, listId: string, recipeId: string) {
    await this.delDueno(userId, listId);
    const yaEsta = await this.redis.zscore(claveDeRecetas(listId), recipeId);
    if (yaEsta === null) {
      if (
        (await this.redis.zcard(claveDeRecetas(listId))) >= MAXIMO_POR_LISTA
      ) {
        throw new RpcException({
          status: 409,
          message: `Una lista admite hasta ${MAXIMO_POR_LISTA} recetas`,
        });
      }
      await this.redis
        .multi()
        .zadd(claveDeRecetas(listId), Date.now(), recipeId)
        .incr(claveDeGuardados(recipeId))
        .exec();
    }
    return this.leer(listId);
  }

  async removeRecipe(userId: string, listId: string, recipeId: string) {
    await this.delDueno(userId, listId);
    const quitadas = await this.redis.zrem(claveDeRecetas(listId), recipeId);
    if (quitadas) {
      await this.redis.decr(claveDeGuardados(recipeId));
    }
    return this.leer(listId);
  }

  async savedCounts(recipeIds: string[]): Promise<Record<string, number>> {
    if (!recipeIds.length) {
      return {};
    }
    const pipeline = this.redis.pipeline();
    recipeIds.forEach((id) => pipeline.get(claveDeGuardados(id)));
    const respuestas = (await pipeline.exec()) ?? [];
    return Object.fromEntries(
      recipeIds.map((id, i) => [
        id,
        Math.max(0, Number(respuestas[i][1] ?? 0)),
      ]),
    );
  }

  private async asegurarPredeterminada(userId: string) {
    const id = randomUUID();
    const creada = await this.redis.set(
      claveDeLaPredeterminada(userId),
      id,
      'NX',
    );
    if (creada) {
      await this.crear(userId, NOMBRE_POR_DEFECTO, true, id);
    }
  }

  private async crear(
    userId: string,
    name: string,
    isDefault: boolean,
    id = randomUUID(),
  ): Promise<ListaDeRecetas> {
    const reservado = await this.redis.sadd(
      claveDeNombres(userId),
      normalizar(name),
    );
    if (!reservado) {
      throw this.nombreRepetido();
    }
    await this.redis
      .multi()
      .hset(claveDeLista(id), {
        id,
        userId,
        name,
        isDefault: isDefault ? '1' : '0',
      })
      .zadd(claveDeListas(userId), Date.now(), id)
      .exec();
    return this.leer(id);
  }

  private async leer(listId: string): Promise<ListaDeRecetas> {
    const [datos, recipeIds] = await Promise.all([
      this.redis.hgetall(claveDeLista(listId)),
      this.redis.zrevrange(claveDeRecetas(listId), 0, -1),
    ]);
    return {
      id: datos.id,
      name: datos.name,
      isDefault: datos.isDefault === '1',
      count: recipeIds.length,
      recipeIds,
    };
  }

  private async delDueno(userId: string, listId: string) {
    const datos = await this.redis.hgetall(claveDeLista(listId));
    if (!datos.id) {
      throw new RpcException({ status: 404, message: 'Lista no encontrada' });
    }
    if (datos.userId !== userId) {
      throw new RpcException({
        status: 403,
        message: 'Solo la persona dueña de la lista puede modificarla',
      });
    }
    return {
      id: datos.id,
      name: datos.name,
      isDefault: datos.isDefault === '1',
    };
  }

  private nombreRepetido() {
    return new RpcException({
      status: 409,
      message: 'Ya tienes una lista con ese nombre',
    });
  }
}
