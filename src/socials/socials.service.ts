import { Injectable } from '@nestjs/common';
import { LikesService } from './likes.service';
import { CommentsService } from './comments.service';

@Injectable()
export class SocialsService {
  constructor(
    private readonly likesService: LikesService,
    private readonly commentsService: CommentsService,
  ) {}

  // ========== LIKES/DISLIKES - USUARIOS REGISTRADOS ==========

  async addLike(recipeId: string, userId: string): Promise<void> {
    return this.likesService.addLike(recipeId, userId);
  }

  async removeLike(recipeId: string, userId: string): Promise<void> {
    return this.likesService.removeLike(recipeId, userId);
  }

  async addDislike(recipeId: string, userId: string): Promise<void> {
    return this.likesService.addDislike(recipeId, userId);
  }

  async removeDislike(recipeId: string, userId: string): Promise<void> {
    return this.likesService.removeDislike(recipeId, userId);
  }

  // ========== LIKES/DISLIKES - INVITADOS ==========

  async incrementLikes(recipeId: string): Promise<void> {
    return this.likesService.incrementLikes(recipeId);
  }

  async decrementLikes(recipeId: string): Promise<void> {
    return this.likesService.decrementLikes(recipeId);
  }

  async incrementDislikes(recipeId: string): Promise<void> {
    return this.likesService.incrementDislikes(recipeId);
  }

  async decrementDislikes(recipeId: string): Promise<void> {
    return this.likesService.decrementDislikes(recipeId);
  }

  // ========== CONSULTAS LIKES/DISLIKES ==========

  async getStats(recipeId: string) {
    return this.likesService.getStats(recipeId);
  }

  async getUserReaction(recipeId: string, userId: string) {
    return this.likesService.getUserReaction(recipeId, userId);
  }

  // ========== COMENTARIOS ==========

  async addComment(recipeId: string, userId: string, text: string) {
    return this.commentsService.addComment(recipeId, userId, text);
  }

  async getCommentsByRecipe(recipeId: string) {
    return this.commentsService.getCommentsByRecipe(recipeId);
  }

  async updateComment(commentId: string, text: string) {
    return this.commentsService.updateComment(commentId, text);
  }

  async deleteComment(commentId: string) {
    return this.commentsService.deleteComment(commentId);
  }

  async getCommentsByUser(userId: string) {
    return this.commentsService.getCommentsByUser(userId);
  }

  // ========== ESTADÍSTICAS COMPLETAS ==========

  async getRecipeSocialStats(recipeId: string) {
    const [stats, commentsCount] = await Promise.all([
      this.likesService.getStats(recipeId),
      this.commentsService.countCommentsByRecipe(recipeId),
    ]);

    return {
      likes: stats.likes,
      dislikes: stats.dislikes,
      commentsCount,
    };
  }
}