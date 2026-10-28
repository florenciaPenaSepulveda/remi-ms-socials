import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

const textoLibre = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RecipeIdMessage {
  @IsMongoId({ message: 'ID de receta inválido' })
  recipeId: string;
}

export class RateMessage {
  @IsMongoId({ message: 'ID de receta inválido' })
  recipeId: string;

  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;

  @IsMongoId({ message: 'ID de autor inválido' })
  authorId: string;

  @IsInt({ message: 'La puntuación debe ser un número entero' })
  @Min(1, { message: 'La puntuación mínima es 1' })
  @Max(5, { message: 'La puntuación máxima es 5' })
  stars: number;
}

export class UnrateMessage {
  @IsMongoId({ message: 'ID de receta inválido' })
  recipeId: string;

  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;

  @IsMongoId({ message: 'ID de autor inválido' })
  authorId: string;
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

export class CreatorsStatsMessage {
  @IsArray({ message: 'Los creadores deben ser una lista' })
  @ArrayMaxSize(100, { message: 'Se admiten hasta 100 creadores por consulta' })
  @IsMongoId({ each: true, message: 'ID de usuario inválido' })
  userIds: string[];
}

export class UserIdMessage {
  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;
}

export class PurgeMessage {
  @IsMongoId({ message: 'ID de receta inválido' })
  recipeId: string;

  @IsMongoId({ message: 'ID de autor inválido' })
  authorId: string;
}

export class AddCommentMessage {
  @IsMongoId({ message: 'ID de receta inválido' })
  recipeId: string;

  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;

  @Transform(textoLibre)
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

  @Transform(textoLibre)
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

export class UserHistoryMessage extends PageMessage {
  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;
}

export class CreateListMessage {
  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;

  @Transform(recortar)
  @IsString({ message: 'El nombre de la lista es obligatorio' })
  @Length(1, 40, {
    message: 'El nombre de la lista debe tener entre 1 y 40 caracteres',
  })
  name: string;
}

export class ListMessage {
  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;

  @IsUUID('4', { message: 'ID de lista inválido' })
  listId: string;
}

export class RenameListMessage extends ListMessage {
  @Transform(recortar)
  @IsString({ message: 'El nombre de la lista es obligatorio' })
  @Length(1, 40, {
    message: 'El nombre de la lista debe tener entre 1 y 40 caracteres',
  })
  name: string;
}

export class ListRecipeMessage extends ListMessage {
  @IsMongoId({ message: 'ID de receta inválido' })
  recipeId: string;
}

export class MarkCookedMessage {
  @IsMongoId({ message: 'ID de receta inválido' })
  recipeId: string;

  @IsMongoId({ message: 'ID de usuario inválido' })
  userId: string;

  @IsMongoId({ message: 'ID de autor inválido' })
  authorId: string;

  @IsInt({ message: 'Los gramos deben ser un número entero' })
  @Min(0, { message: 'Los gramos no pueden ser negativos' })
  @Max(20000, { message: 'Los gramos exceden lo razonable para una receta' })
  grams: number;

  @IsBoolean({ message: '"usedPantry" debe ser verdadero o falso' })
  usedPantry: boolean;

  @IsOptional()
  @Transform(textoLibre)
  @IsString({ message: 'La nota debe ser texto' })
  @MaxLength(300, { message: 'La nota admite hasta 300 caracteres' })
  note?: string;
}
