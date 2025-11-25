import { Injectable, OnModuleInit } from '@nestjs/common';
import { Repository } from 'redis-om';
import { RedisService } from '../redis/redis.service';
import { commentSchema, Comment } from './schemas/comment.schema';

@Injectable()
export class CommentsService implements OnModuleInit {
  private repository: Repository;

  constructor(private readonly redis: RedisService) {}

  async onModuleInit() {
    this.repository = this.redis.getClient().fetchRepository(commentSchema);
    await this.repository.createIndex();
  }

  async addComment(recipeId: string, userId: string, text: string): Promise<Comment> {
    const entity = await this.repository.save({
      recipeId,
      userId,
      text,
      createdAt: new Date().toISOString(),
    });

    return {
      id: entity.entityId,
      recipeId: entity.recipeId as string,
      userId: entity.userId as string,
      text: entity.text as string,
      createdAt: entity.createdAt as string,
    };
  }

  async getCommentsByRecipe(recipeId: string): Promise<Comment[]> {
    const entities = await this.repository
      .search()
      .where('recipeId')
      .equals(recipeId)
      .return.all();

    return entities.map((e) => ({
      id: e.entityId,
      recipeId: e.recipeId as string,
      userId: e.userId as string,
      text: e.text as string,
      createdAt: e.createdAt as string,
    }));
  }

  async getComment(commentId: string): Promise<Comment | null> {
    const e = await this.repository.fetch(commentId);
    if (!e.entityId) return null;

    return {
      id: e.entityId,
      recipeId: e.recipeId as string,
      userId: e.userId as string,
      text: e.text as string,
      createdAt: e.createdAt as string,
    };
  }

  async updateComment(commentId: string, text: string): Promise<Comment | null> {
    const e = await this.repository.fetch(commentId);
    if (!e.entityId) return null;

    e.text = text;
    await this.repository.save(e);

    return {
      id: e.entityId,
      recipeId: e.recipeId as string,
      userId: e.userId as string,
      text: e.text as string,
      createdAt: e.createdAt as string,
    };
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.repository.remove(commentId);
  }

  async getCommentsByUser(userId: string): Promise<Comment[]> {
    const entities = await this.repository
      .search()
      .where('userId')
      .equals(userId)
      .return.all();

    return entities.map((e) => ({
      id: e.entityId,
      recipeId: e.recipeId as string,
      userId: e.userId as string,
      text: e.text as string,
      createdAt: e.createdAt as string,
    }));
  }

  async countCommentsByRecipe(recipeId: string): Promise<number> {
    const comments = await this.getCommentsByRecipe(recipeId);
    return comments.length;
  }
}
