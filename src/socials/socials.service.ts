import { Injectable } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CookbookService } from './cookbook.service';
import { CookedService } from './cooked.service';
import { RatingsService } from './ratings.service';

@Injectable()
export class SocialsService {
  constructor(
    private readonly ratings: RatingsService,
    private readonly comments: CommentsService,
    private readonly cookbook: CookbookService,
    private readonly cooked: CookedService,
  ) {}

  async getStatsOfRecipes(recipeIds: string[], userId?: string) {
    const [puntuaciones, cocinadas, guardadas, comentarios] = await Promise.all(
      [
        this.ratings.resumenes(recipeIds, userId),
        this.cooked.cookedCounts(recipeIds),
        this.cookbook.savedCounts(recipeIds),
        this.comments.countByRecipes(recipeIds),
      ],
    );
    return Object.fromEntries(
      recipeIds.map((id) => [
        id,
        {
          ...puntuaciones[id],
          cookedCount: cocinadas[id],
          savedCount: guardadas[id],
          commentsCount: comentarios[id],
        },
      ]),
    );
  }

  async purgeRecipe(recipeId: string, authorId: string) {
    const puntuaciones = await this.ratings.purge(recipeId, authorId);
    const comentarios = await this.comments.purge(recipeId);
    return {
      recipeId,
      ...puntuaciones,
      commentsRemoved: comentarios.commentsRemoved,
    };
  }
}
