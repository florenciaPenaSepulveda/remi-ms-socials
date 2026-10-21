import { Schema } from 'redis-om';

export interface Comment {
  id: string;
  recipeId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export const commentSchema = new Schema('comment', {
  recipeId: { type: 'string' },
  userId: { type: 'string' },
  text: { type: 'text' },
  createdAt: { type: 'string' },
});
