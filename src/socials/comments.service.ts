import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

export interface Comment {
  id: string;
  recipeId: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaginaDeComentarios {
  items: Comment[];
  total: number;
  limit: number;
  offset: number;
}

const LIMITE_POR_DEFECTO = 50;
const claveDeComentario = (id: string) => `comment:${id}`;
const claveDeReceta = (recipeId: string) => `recipe:${recipeId}:comments`;
const claveDeUsuario = (userId: string) => `user:${userId}:comments`;

@Injectable()
export class CommentsService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async addComment(
    recipeId: string,
    userId: string,
    text: string,
  ): Promise<Comment> {
    const ahora = new Date();
    const comentario: Comment = {
      id: randomUUID(),
      recipeId,
      userId,
      text,
      createdAt: ahora.toISOString(),
    };
    await this.redis
      .multi()
      .hset(claveDeComentario(comentario.id), { ...comentario })
      .zadd(claveDeReceta(recipeId), ahora.getTime(), comentario.id)
      .zadd(claveDeUsuario(userId), ahora.getTime(), comentario.id)
      .exec();
    return comentario;
  }

  getCommentsByRecipe(recipeId: string, limit?: number, offset?: number) {
    return this.pagina(claveDeReceta(recipeId), limit, offset);
  }

  getCommentsByUser(userId: string, limit?: number, offset?: number) {
    return this.pagina(claveDeUsuario(userId), limit, offset);
  }

  async countCommentsByRecipe(recipeId: string): Promise<number> {
    return this.redis.zcard(claveDeReceta(recipeId));
  }

  async countByRecipes(recipeIds: string[]): Promise<Record<string, number>> {
    if (!recipeIds.length) {
      return {};
    }
    const pipeline = this.redis.pipeline();
    recipeIds.forEach((id) => pipeline.zcard(claveDeReceta(id)));
    const respuestas = (await pipeline.exec()) ?? [];
    return Object.fromEntries(
      recipeIds.map((id, i) => [id, Number(respuestas[i][1])]),
    );
  }

  async updateComment(
    commentId: string,
    userId: string,
    text: string,
  ): Promise<Comment> {
    const comentario = await this.delAutor(commentId, userId);
    const actualizado = {
      ...comentario,
      text,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.hset(claveDeComentario(commentId), actualizado);
    return actualizado;
  }

  async deleteComment(commentId: string, userId: string) {
    const comentario = await this.delAutor(commentId, userId);
    await this.redis
      .multi()
      .del(claveDeComentario(commentId))
      .zrem(claveDeReceta(comentario.recipeId), commentId)
      .zrem(claveDeUsuario(comentario.userId), commentId)
      .exec();
    return { id: commentId, deleted: true };
  }

  async purge(recipeId: string) {
    const ids = await this.redis.zrevrange(claveDeReceta(recipeId), 0, -1);
    const comentarios = await this.leer(ids);
    const transaccion = this.redis.multi();
    for (const comentario of comentarios) {
      transaccion
        .del(claveDeComentario(comentario.id))
        .zrem(claveDeUsuario(comentario.userId), comentario.id);
    }
    transaccion.del(claveDeReceta(recipeId));
    await transaccion.exec();
    return { recipeId, commentsRemoved: ids.length };
  }

  private async pagina(
    clave: string,
    limit = LIMITE_POR_DEFECTO,
    offset = 0,
  ): Promise<PaginaDeComentarios> {
    const [total, ids] = await Promise.all([
      this.redis.zcard(clave),
      this.redis.zrevrange(clave, offset, offset + limit - 1),
    ]);
    return { items: await this.leer(ids), total, limit, offset };
  }

  private async leer(ids: string[]): Promise<Comment[]> {
    if (!ids.length) {
      return [];
    }
    const pipeline = this.redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(claveDeComentario(id)));
    const respuestas = (await pipeline.exec()) ?? [];
    return respuestas.flatMap(([, datos]) => {
      const comentario = datos as Partial<Comment>;
      return comentario?.id ? [comentario as Comment] : [];
    });
  }

  private async delAutor(commentId: string, userId: string) {
    const [comentario] = await this.leer([commentId]);
    if (!comentario) {
      throw new RpcException({
        status: 404,
        message: 'Comentario no encontrado',
      });
    }
    if (comentario.userId !== userId) {
      throw new RpcException({
        status: 403,
        message: 'Solo quien escribió el comentario puede modificarlo',
      });
    }
    return comentario;
  }
}
