import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

export type Reaccion = 'like' | 'dislike' | null;

export interface ResumenDeReacciones {
  likes: number;
  dislikes: number;
  reaction: Reaccion;
}

const claveDeLikes = (recipeId: string) => `recipe:${recipeId}:likes`;
const claveDeDislikes = (recipeId: string) => `recipe:${recipeId}:dislikes`;

@Injectable()
export class LikesService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async addLike(recipeId: string, userId: string) {
    await this.redis
      .multi()
      .srem(claveDeDislikes(recipeId), userId)
      .sadd(claveDeLikes(recipeId), userId)
      .exec();
    return this.resumen(recipeId, userId);
  }

  async removeLike(recipeId: string, userId: string) {
    await this.redis.srem(claveDeLikes(recipeId), userId);
    return this.resumen(recipeId, userId);
  }

  async addDislike(recipeId: string, userId: string) {
    await this.redis
      .multi()
      .srem(claveDeLikes(recipeId), userId)
      .sadd(claveDeDislikes(recipeId), userId)
      .exec();
    return this.resumen(recipeId, userId);
  }

  async removeDislike(recipeId: string, userId: string) {
    await this.redis.srem(claveDeDislikes(recipeId), userId);
    return this.resumen(recipeId, userId);
  }

  async getStats(recipeId: string) {
    const [likes, dislikes] = await Promise.all([
      this.redis.scard(claveDeLikes(recipeId)),
      this.redis.scard(claveDeDislikes(recipeId)),
    ]);
    return { likes, dislikes };
  }

  async getUserReaction(recipeId: string, userId: string): Promise<Reaccion> {
    const [leGusta, noLeGusta] = await Promise.all([
      this.redis.sismember(claveDeLikes(recipeId), userId),
      this.redis.sismember(claveDeDislikes(recipeId), userId),
    ]);
    if (leGusta === 1) {
      return 'like';
    }
    return noLeGusta === 1 ? 'dislike' : null;
  }

  async getStatsOfRecipes(
    recipeIds: string[],
    userId?: string,
  ): Promise<Record<string, ResumenDeReacciones>> {
    if (!recipeIds.length) {
      return {};
    }
    const pipeline = this.redis.pipeline();
    for (const id of recipeIds) {
      pipeline.scard(claveDeLikes(id));
      pipeline.scard(claveDeDislikes(id));
      if (userId) {
        pipeline.sismember(claveDeLikes(id), userId);
        pipeline.sismember(claveDeDislikes(id), userId);
      }
    }
    const respuestas = (await pipeline.exec()) ?? [];
    const porReceta = userId ? 4 : 2;
    return Object.fromEntries(
      recipeIds.map((id, i) => {
        const [likes, dislikes, leGusta, noLeGusta] = respuestas
          .slice(i * porReceta, (i + 1) * porReceta)
          .map(([, valor]) => Number(valor));
        let reaction: Reaccion = null;
        if (leGusta === 1) {
          reaction = 'like';
        } else if (noLeGusta === 1) {
          reaction = 'dislike';
        }
        return [id, { likes, dislikes, reaction }];
      }),
    );
  }

  async purge(recipeId: string) {
    await this.redis.del(claveDeLikes(recipeId), claveDeDislikes(recipeId));
  }

  private async resumen(
    recipeId: string,
    userId: string,
  ): Promise<ResumenDeReacciones> {
    const [stats, reaction] = await Promise.all([
      this.getStats(recipeId),
      this.getUserReaction(recipeId, userId),
    ]);
    return { ...stats, reaction };
  }
}
