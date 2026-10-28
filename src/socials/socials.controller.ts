import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AddCommentMessage,
  DeleteCommentMessage,
  ReactionMessage,
  RecipeCommentsMessage,
  RecipeIdMessage,
  RecipesStatsMessage,
  UpdateCommentMessage,
  UserCommentsMessage,
} from './dto/social.dto';
import { CommentsService } from './comments.service';
import { SocialsService } from './socials.service';

@Controller()
export class SocialsController {
  constructor(
    private readonly socialsService: SocialsService,
    private readonly commentsService: CommentsService,
  ) {}

  @MessagePattern({ cmd: 'add_like' })
  addLike(@Payload() { recipeId, userId }: ReactionMessage) {
    return this.socialsService.addLike(recipeId, userId);
  }

  @MessagePattern({ cmd: 'remove_like' })
  removeLike(@Payload() { recipeId, userId }: ReactionMessage) {
    return this.socialsService.removeLike(recipeId, userId);
  }

  @MessagePattern({ cmd: 'add_dislike' })
  addDislike(@Payload() { recipeId, userId }: ReactionMessage) {
    return this.socialsService.addDislike(recipeId, userId);
  }

  @MessagePattern({ cmd: 'remove_dislike' })
  removeDislike(@Payload() { recipeId, userId }: ReactionMessage) {
    return this.socialsService.removeDislike(recipeId, userId);
  }

  @MessagePattern({ cmd: 'get_recipe_stats' })
  getStats(@Payload() { recipeId }: RecipeIdMessage) {
    return this.socialsService.getStats(recipeId);
  }

  @MessagePattern({ cmd: 'get_user_reaction' })
  getUserReaction(@Payload() { recipeId, userId }: ReactionMessage) {
    return this.socialsService.getUserReaction(recipeId, userId);
  }

  @MessagePattern({ cmd: 'get_recipes_stats' })
  getRecipesStats(@Payload() { recipeIds, userId }: RecipesStatsMessage) {
    return this.socialsService.getStatsOfRecipes(recipeIds, userId);
  }

  @MessagePattern({ cmd: 'get_recipe_social_stats' })
  getRecipeSocialStats(@Payload() { recipeId }: RecipeIdMessage) {
    return this.socialsService.getRecipeSocialStats(recipeId);
  }

  @MessagePattern({ cmd: 'add_comment' })
  addComment(@Payload() { recipeId, userId, text }: AddCommentMessage) {
    return this.commentsService.addComment(recipeId, userId, text);
  }

  @MessagePattern({ cmd: 'get_comments_by_recipe' })
  getCommentsByRecipe(
    @Payload() { recipeId, limit, offset }: RecipeCommentsMessage,
  ) {
    return this.commentsService.getCommentsByRecipe(recipeId, limit, offset);
  }

  @MessagePattern({ cmd: 'get_comments_by_user' })
  getCommentsByUser(@Payload() { userId, limit, offset }: UserCommentsMessage) {
    return this.commentsService.getCommentsByUser(userId, limit, offset);
  }

  @MessagePattern({ cmd: 'update_comment' })
  updateComment(@Payload() { commentId, userId, text }: UpdateCommentMessage) {
    return this.commentsService.updateComment(commentId, userId, text);
  }

  @MessagePattern({ cmd: 'delete_comment' })
  deleteComment(@Payload() { commentId, userId }: DeleteCommentMessage) {
    return this.commentsService.deleteComment(commentId, userId);
  }

  @MessagePattern({ cmd: 'purge_recipe_social' })
  purgeRecipe(@Payload() { recipeId }: RecipeIdMessage) {
    return this.socialsService.purgeRecipe(recipeId);
  }
}
