export class AddLikeDto {
  recipeId: string;
  userId: string;
}

export class AddDislikeDto {
  recipeId: string;
  userId: string;
}

export class IncrementLikeDto {
  recipeId: string;
}

export class IncrementDislikeDto {
  recipeId: string;
}
