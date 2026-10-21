import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SocialsService } from './socials.service';
import { AddLikeDto, AddDislikeDto, IncrementLikeDto, IncrementDislikeDto } from './dto/create-social.dto';
import { AddCommentDto, UpdateCommentDto } from './dto/update-social.dto';

@Controller()
export class SocialsController {
  constructor(private readonly socialsService: SocialsService) {}

  // ========== LIKES/DISLIKES - USUARIOS REGISTRADOS ==========

  @MessagePattern({ cmd: 'add_like' })
  addLike(@Payload() dto: AddLikeDto) {
    console.log('📩 Usuario dio like a receta:', dto.recipeId);
    return this.socialsService.addLike(dto.recipeId, dto.userId);
  }

  @MessagePattern({ cmd: 'remove_like' })
  removeLike(@Payload() dto: AddLikeDto) {
    console.log('📩 Usuario removió like de receta:', dto.recipeId);
    return this.socialsService.removeLike(dto.recipeId, dto.userId);
  }

  @MessagePattern({ cmd: 'add_dislike' })
  addDislike(@Payload() dto: AddDislikeDto) {
    console.log('📩 Usuario dio dislike a receta:', dto.recipeId);
    return this.socialsService.addDislike(dto.recipeId, dto.userId);
  }

  @MessagePattern({ cmd: 'remove_dislike' })
  removeDislike(@Payload() dto: AddDislikeDto) {
    console.log('📩 Usuario removió dislike de receta:', dto.recipeId);
    return this.socialsService.removeDislike(dto.recipeId, dto.userId);
  }

  // ========== LIKES/DISLIKES - INVITADOS ==========

  @MessagePattern({ cmd: 'increment_likes' })
  incrementLikes(@Payload() dto: IncrementLikeDto) {
    console.log('📩 Invitado incrementó like en receta:', dto.recipeId);
    return this.socialsService.incrementLikes(dto.recipeId);
  }

  @MessagePattern({ cmd: 'decrement_likes' })
  decrementLikes(@Payload() dto: IncrementLikeDto) {
    console.log('📩 Invitado decrementó like en receta:', dto.recipeId);
    return this.socialsService.decrementLikes(dto.recipeId);
  }

  @MessagePattern({ cmd: 'increment_dislikes' })
  incrementDislikes(@Payload() dto: IncrementDislikeDto) {
    console.log('📩 Invitado incrementó dislike en receta:', dto.recipeId);
    return this.socialsService.incrementDislikes(dto.recipeId);
  }

  @MessagePattern({ cmd: 'decrement_dislikes' })
  decrementDislikes(@Payload() dto: IncrementDislikeDto) {
    console.log('📩 Invitado decrementó dislike en receta:', dto.recipeId);
    return this.socialsService.decrementDislikes(dto.recipeId);
  }

  // ========== CONSULTAS LIKES/DISLIKES ==========

  @MessagePattern({ cmd: 'get_recipe_stats' })
  getStats(@Payload() recipeId: string) {
    console.log('📩 Obteniendo stats de receta:', recipeId);
    return this.socialsService.getStats(recipeId);
  }

  @MessagePattern({ cmd: 'get_user_reaction' })
  getUserReaction(@Payload() payload: { recipeId: string; userId: string }) {
    console.log('📩 Obteniendo reacción de usuario en receta:', payload.recipeId);
    return this.socialsService.getUserReaction(payload.recipeId, payload.userId);
  }

  // ========== COMENTARIOS ==========

  @MessagePattern({ cmd: 'add_comment' })
  addComment(@Payload() dto: AddCommentDto) {
    console.log('📩 Usuario agregó comentario a receta:', dto.recipeId);
    return this.socialsService.addComment(dto.recipeId, dto.userId, dto.text);
  }

  @MessagePattern({ cmd: 'get_comments_by_recipe' })
  getCommentsByRecipe(@Payload() recipeId: string) {
    console.log('📩 Obteniendo comentarios de receta:', recipeId);
    return this.socialsService.getCommentsByRecipe(recipeId);
  }

  @MessagePattern({ cmd: 'update_comment' })
  updateComment(@Payload() dto: UpdateCommentDto) {
    console.log('📩 Actualizando comentario:', dto.commentId);
    return this.socialsService.updateComment(dto.commentId, dto.text);
  }

  @MessagePattern({ cmd: 'delete_comment' })
  deleteComment(@Payload() commentId: string) {
    console.log('📩 Eliminando comentario:', commentId);
    return this.socialsService.deleteComment(commentId);
  }

  @MessagePattern({ cmd: 'get_comments_by_user' })
  getCommentsByUser(@Payload() userId: string) {
    console.log('📩 Obteniendo comentarios de usuario:', userId);
    return this.socialsService.getCommentsByUser(userId);
  }

  // ========== ESTADÍSTICAS COMPLETAS ==========

  @MessagePattern({ cmd: 'get_recipe_social_stats' })
  getRecipeSocialStats(@Payload() recipeId: string) {
    console.log('📩 Obteniendo estadísticas sociales completas de receta:', recipeId);
    return this.socialsService.getRecipeSocialStats(recipeId);
  }
}