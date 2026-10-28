import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RecipeIdMessage {
  @IsMongoId({ message: 'ID de receta inválido' })
  recipeId: string;
}

export class ReactionMessage {
  @IsMongoId({ message: 'ID de receta inválido' })
  recipeId: string;

  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;
}

export class RecipesStatsMessage {
  @IsArray({ message: 'Las recetas deben ser una lista' })
  @ArrayMaxSize(200, { message: 'Se admiten hasta 200 recetas por consulta' })
  @IsMongoId({ each: true, message: 'ID de receta inválido' })
  recipeIds: string[];

  @IsOptional()
  @IsMongoId({ message: 'ID de usuario inválido' })
  userId?: string;
}

export class AddCommentMessage extends ReactionMessage {
  @Transform(recortar)
  @IsString({ message: 'El comentario es obligatorio' })
  @Length(1, 1000, {
    message: 'El comentario debe tener entre 1 y 1000 caracteres',
  })
  text: string;
}

export class UpdateCommentMessage {
  @IsUUID('4', { message: 'ID de comentario inválido' })
  commentId: string;

  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;

  @Transform(recortar)
  @IsString({ message: 'El comentario es obligatorio' })
  @Length(1, 1000, {
    message: 'El comentario debe tener entre 1 y 1000 caracteres',
  })
  text: string;
}

export class DeleteCommentMessage {
  @IsUUID('4', { message: 'ID de comentario inválido' })
  commentId: string;

  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;
}

class PageMessage {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(100, { message: 'El límite máximo es 100' })
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El desfase debe ser un número entero' })
  @Min(0, { message: 'El desfase no puede ser negativo' })
  offset?: number;
}

export class RecipeCommentsMessage extends PageMessage {
  @IsMongoId({ message: 'ID de receta inválido' })
  recipeId: string;
}

export class UserCommentsMessage extends PageMessage {
  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;
}
