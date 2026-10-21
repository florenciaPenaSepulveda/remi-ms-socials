import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LikesService implements OnModuleInit {
  private redisClient: any;

  constructor(private readonly redis: RedisService) {}

  async onModuleInit() {
    this.redisClient = this.redis.getClient().redis;
  }

  // ========== USUARIOS REGISTRADOS ==========

  async addLike(recipeId: string, userId: string): Promise<void> {
    const userKey = `recipe:${recipeId}:likes:users`;
    const dislikeUserKey = `recipe:${recipeId}:dislikes:users`;
    
    // Verificar si ya tiene like
    const hasLike = await this.redisClient.sismember(userKey, userId);
    if (hasLike === 1) return;

    // Si tenía dislike, removerlo
    const hasDislike = await this.redisClient.sismember(dislikeUserKey, userId);
    if (hasDislike === 1) {
      await this.redisClient.srem(dislikeUserKey, userId);
      await this.redisClient.decr(`recipe:${recipeId}:dislikes`);
    }

    // Agregar like
    await this.redisClient.sadd(userKey, userId);
    await this.redisClient.incr(`recipe:${recipeId}:likes`);
  }

  async removeLike(recipeId: string, userId: string): Promise<void> {
    const userKey = `recipe:${recipeId}:likes:users`;
    const removed = await this.redisClient.srem(userKey, userId);
    
    if (removed === 1) {
      await this.redisClient.decr(`recipe:${recipeId}:likes`);
    }
  }

  async addDislike(recipeId: string, userId: string): Promise<void> {
    const userKey = `recipe:${recipeId}:dislikes:users`;
    const likeUserKey = `recipe:${recipeId}:likes:users`;
    
    // Verificar si ya tiene dislike
    const hasDislike = await this.redisClient.sismember(userKey, userId);
    if (hasDislike === 1) return;

    // Si tenía like, removerlo
    const hasLike = await this.redisClient.sismember(likeUserKey, userId);
    if (hasLike === 1) {
      await this.redisClient.srem(likeUserKey, userId);
      await this.redisClient.decr(`recipe:${recipeId}:likes`);
    }

    // Agregar dislike
    await this.redisClient.sadd(userKey, userId);
    await this.redisClient.incr(`recipe:${recipeId}:dislikes`);
  }

  async removeDislike(recipeId: string, userId: string): Promise<void> {
    const userKey = `recipe:${recipeId}:dislikes:users`;
    const removed = await this.redisClient.srem(userKey, userId);
    
    if (removed === 1) {
      await this.redisClient.decr(`recipe:${recipeId}:dislikes`);
    }
  }

  // ========== INVITADOS ==========

  async incrementLikes(recipeId: string): Promise<void> {
    await this.redisClient.incr(`recipe:${recipeId}:likes`);
  }

  async decrementLikes(recipeId: string): Promise<void> {
    const current = await this.getLikesCount(recipeId);
    if (current > 0) {
      await this.redisClient.decr(`recipe:${recipeId}:likes`);
    }
  }

  async incrementDislikes(recipeId: string): Promise<void> {
    await this.redisClient.incr(`recipe:${recipeId}:dislikes`);
  }

  async decrementDislikes(recipeId: string): Promise<void> {
    const current = await this.getDislikesCount(recipeId);
    if (current > 0) {
      await this.redisClient.decr(`recipe:${recipeId}:dislikes`);
    }
  }

  // ========== CONSULTAS ==========

  async getLikesCount(recipeId: string): Promise<number> {
    const count = await this.redisClient.get(`recipe:${recipeId}:likes`);
    return count ? parseInt(count, 10) : 0;
  }

  async getDislikesCount(recipeId: string): Promise<number> {
    const count = await this.redisClient.get(`recipe:${recipeId}:dislikes`);
    return count ? parseInt(count, 10) : 0;
  }

  async getStats(recipeId: string): Promise<{ likes: number; dislikes: number }> {
    const [likes, dislikes] = await Promise.all([
      this.getLikesCount(recipeId),
      this.getDislikesCount(recipeId),
    ]);
    return { likes, dislikes };
  }

  async userHasLiked(recipeId: string, userId: string): Promise<boolean> {
    const userKey = `recipe:${recipeId}:likes:users`;
    return (await this.redisClient.sismember(userKey, userId)) === 1;
  }

  async userHasDisliked(recipeId: string, userId: string): Promise<boolean> {
    const userKey = `recipe:${recipeId}:dislikes:users`;
    return (await this.redisClient.sismember(userKey, userId)) === 1;
  }

  async getUserReaction(recipeId: string, userId: string): Promise<'like' | 'dislike' | null> {
    const [hasLike, hasDislike] = await Promise.all([
      this.userHasLiked(recipeId, userId),
      this.userHasDisliked(recipeId, userId),
    ]);
    
    if (hasLike) return 'like';
    if (hasDislike) return 'dislike';
    return null;
  }
}
