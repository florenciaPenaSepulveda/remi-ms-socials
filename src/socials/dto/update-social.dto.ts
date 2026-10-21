export class AddCommentDto {
  recipeId: string;
  userId: string;
  text: string;
}

export class UpdateCommentDto {
  commentId: string;
  text: string;
}
