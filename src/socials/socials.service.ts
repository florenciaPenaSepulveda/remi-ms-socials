import { Injectable } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { LikesService } from './likes.service';

@Injectable()
export class SocialsService {
  constructor(
    private readonly likesService: LikesService,
    private readonly commentsService: CommentsService,
  ) {}

  addLike(recipeId: string, userId: string) {
    return this.likesService.addLike(recipeId, userId);
  }

  removeLike(recipeId: string, userId: string) {
    return this.likesService.removeLike(recipeId, userId);
  }

  addDislike(recipeId: string, userId: string) {
    return this.likesService.addDislike(recipeId, userId);
  }

  removeDislike(recipeId: string, userId: string) {
    return this.likesService.removeDislike(recipeId, userId);
  }

  getStats(recipeId: string) {
    return this.likesService.getStats(recipeId);
  }

  getUserReaction(recipeId: string, userId: string) {
    return this.likesService.getUserReaction(recipeId, userId);
  }

  async getStatsOfRecipes(recipeIds: string[], userId?: string) {
    const [reacciones, comentarios] = await Promise.all([
      this.likesService.getStatsOfRecipes(recipeIds, userId),
      this.commentsService.countByRecipes(recipeIds),
    ]);
    return Object.fromEntries(
      recipeIds.map((id) => [
        id,
        { ...reacciones[id], commentsCount: comentarios[id] },
      ]),
    );
  }

  async getRecipeSocialStats(recipeId: string) {
    const [stats, commentsCount] = await Promise.all([
      this.likesService.getStats(recipeId),
      this.commentsService.countCommentsByRecipe(recipeId),
    ]);
    return { ...stats, commentsCount };
  }

  async purgeRecipe(recipeId: string) {
    await this.likesService.purge(recipeId);
    return this.commentsService.purge(recipeId);
  }
}
