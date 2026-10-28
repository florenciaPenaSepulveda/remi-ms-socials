import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CommentsService } from './comments.service';
import { CookbookService } from './cookbook.service';
import { CookedService } from './cooked.service';
import {
  AddCommentMessage,
  CreateListMessage,
  CreatorsStatsMessage,
  DeleteCommentMessage,
  ListMessage,
  ListRecipeMessage,
  MarkCookedMessage,
  PurgeMessage,
  RateMessage,
  RecipeCommentsMessage,
  RecipeIdMessage,
  RecipesStatsMessage,
  RenameListMessage,
  UnrateMessage,
  UpdateCommentMessage,
  UserCommentsMessage,
  UserHistoryMessage,
  UserIdMessage,
} from './dto/social.dto';
import { RatingsService } from './ratings.service';
import { SocialsService } from './socials.service';

@Controller()
export class SocialsController {
  constructor(
    private readonly socials: SocialsService,
    private readonly ratings: RatingsService,
    private readonly comments: CommentsService,
    private readonly cookbook: CookbookService,
    private readonly cooked: CookedService,
  ) {}

  @MessagePattern({ cmd: 'rate_recipe' })
  rate(@Payload() { recipeId, userId, authorId, stars }: RateMessage) {
    return this.ratings.rate(recipeId, userId, authorId, stars);
  }

  @MessagePattern({ cmd: 'unrate_recipe' })
  unrate(@Payload() { recipeId, userId, authorId }: UnrateMessage) {
    return this.ratings.unrate(recipeId, userId, authorId);
  }

  @MessagePattern({ cmd: 'get_recipes_stats' })
  getRecipesStats(@Payload() { recipeIds, userId }: RecipesStatsMessage) {
    return this.socials.getStatsOfRecipes(recipeIds, userId);
  }

  @MessagePattern({ cmd: 'get_creators_stats' })
  getCreatorsStats(@Payload() { userIds }: CreatorsStatsMessage) {
    return this.ratings.creatorStats(userIds);
  }

  @MessagePattern({ cmd: 'purge_recipe_social' })
  purgeRecipe(@Payload() { recipeId, authorId }: PurgeMessage) {
    return this.socials.purgeRecipe(recipeId, authorId);
  }

  @MessagePattern({ cmd: 'add_comment' })
  addComment(@Payload() { recipeId, userId, text }: AddCommentMessage) {
    return this.comments.addComment(recipeId, userId, text);
  }

  @MessagePattern({ cmd: 'get_comments_by_recipe' })
  getCommentsByRecipe(
    @Payload() { recipeId, limit, offset }: RecipeCommentsMessage,
  ) {
    return this.comments.getCommentsByRecipe(recipeId, limit, offset);
  }

  @MessagePattern({ cmd: 'get_comments_by_user' })
  getCommentsByUser(@Payload() { userId, limit, offset }: UserCommentsMessage) {
    return this.comments.getCommentsByUser(userId, limit, offset);
  }

  @MessagePattern({ cmd: 'update_comment' })
  updateComment(@Payload() { commentId, userId, text }: UpdateCommentMessage) {
    return this.comments.updateComment(commentId, userId, text);
  }

  @MessagePattern({ cmd: 'delete_comment' })
  deleteComment(@Payload() { commentId, userId }: DeleteCommentMessage) {
    return this.comments.deleteComment(commentId, userId);
  }

  @MessagePattern({ cmd: 'get_lists' })
  getLists(@Payload() { userId }: UserIdMessage) {
    return this.cookbook.getLists(userId);
  }

  @MessagePattern({ cmd: 'get_list' })
  getList(@Payload() { userId, listId }: ListMessage) {
    return this.cookbook.getList(userId, listId);
  }

  @MessagePattern({ cmd: 'create_list' })
  createList(@Payload() { userId, name }: CreateListMessage) {
    return this.cookbook.create(userId, name);
  }

  @MessagePattern({ cmd: 'rename_list' })
  renameList(@Payload() { userId, listId, name }: RenameListMessage) {
    return this.cookbook.rename(userId, listId, name);
  }

  @MessagePattern({ cmd: 'delete_list' })
  deleteList(@Payload() { userId, listId }: ListMessage) {
    return this.cookbook.remove(userId, listId);
  }

  @MessagePattern({ cmd: 'add_to_list' })
  addToList(@Payload() { userId, listId, recipeId }: ListRecipeMessage) {
    return this.cookbook.add(userId, listId, recipeId);
  }

  @MessagePattern({ cmd: 'remove_from_list' })
  removeFromList(@Payload() { userId, listId, recipeId }: ListRecipeMessage) {
    return this.cookbook.removeRecipe(userId, listId, recipeId);
  }

  @MessagePattern({ cmd: 'mark_cooked' })
  markCooked(@Payload() datos: MarkCookedMessage) {
    return this.cooked.markCooked(datos);
  }

  @MessagePattern({ cmd: 'get_cooked_history' })
  getCookedHistory(@Payload() { userId, limit, offset }: UserHistoryMessage) {
    return this.cooked.history(userId, limit, offset);
  }

  @MessagePattern({ cmd: 'get_user_stats' })
  getUserStats(@Payload() { userId }: UserIdMessage) {
    return this.cooked.userStats(userId);
  }

  @MessagePattern({ cmd: 'get_impact' })
  getImpact() {
    return this.cooked.impact();
  }

  @MessagePattern({ cmd: 'get_recipe_social_stats' })
  async getRecipeSocialStats(@Payload() { recipeId }: RecipeIdMessage) {
    const mapa = await this.socials.getStatsOfRecipes([recipeId]);
    return mapa[recipeId];
  }
}
