import { INestMicroservice } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { firstValueFrom } from 'rxjs';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';
import { REDIS } from './redis/redis.module';

const PUERTO = 4874;
const RECETA = '507f1f77bcf86cd799439011';
const OTRA_RECETA = '507f1f77bcf86cd799439012';
const ANA = '607f1f77bcf86cd799439021';
const BETO = '607f1f77bcf86cd799439022';
const UUID_AJENO = '3f8a4a52-6d6c-4b1e-9f0e-5a3c8f2b7d11';

describe('Servicio social', () => {
  let app: INestMicroservice;
  let cliente: ClientProxy;
  let redis: Redis;

  const enviar = <T = any>(cmd: string, datos: unknown = {}) =>
    firstValueFrom(cliente.send<T>({ cmd }, datos));
  const fallo = async (cmd: string, datos: unknown = {}) => {
    try {
      await enviar(cmd, datos);
    } catch (error) {
      return error as { status: number; message: string | string[] };
    }
    throw new Error('Se esperaba un error');
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configurarApp(
      modulo.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: PUERTO },
      }),
    );
    await app.listen();
    cliente = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: PUERTO },
    });
    await cliente.connect();
    redis = app.get<Redis>(REDIS);
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.flushdb();
    cliente.close();
    await app.close();
  });

  describe('me gusta y no me gusta', () => {
    it('registra un me gusta y devuelve el resumen', async () => {
      const resumen = await enviar('add_like', {
        recipeId: RECETA,
        userId: ANA,
      });
      expect(resumen).toEqual({ likes: 1, dislikes: 0, reaction: 'like' });
    });

    it('un segundo me gusta de la misma persona no suma', async () => {
      await enviar('add_like', { recipeId: RECETA, userId: ANA });
      const resumen = await enviar('add_like', {
        recipeId: RECETA,
        userId: ANA,
      });
      expect(resumen.likes).toBe(1);
    });

    it('cambiar de me gusta a no me gusta mueve el voto', async () => {
      await enviar('add_like', { recipeId: RECETA, userId: ANA });
      const resumen = await enviar('add_dislike', {
        recipeId: RECETA,
        userId: ANA,
      });
      expect(resumen).toEqual({ likes: 0, dislikes: 1, reaction: 'dislike' });
    });

    it('quitar la reacción deja el contador exacto', async () => {
      await enviar('add_like', { recipeId: RECETA, userId: ANA });
      await enviar('add_like', { recipeId: RECETA, userId: BETO });
      const resumen = await enviar('remove_like', {
        recipeId: RECETA,
        userId: ANA,
      });
      expect(resumen).toEqual({ likes: 1, dislikes: 0, reaction: null });
      const otro = await enviar('remove_like', {
        recipeId: RECETA,
        userId: ANA,
      });
      expect(otro.likes).toBe(1);
    });

    it('quitar un no me gusta', async () => {
      await enviar('add_dislike', { recipeId: RECETA, userId: ANA });
      const resumen = await enviar('remove_dislike', {
        recipeId: RECETA,
        userId: ANA,
      });
      expect(resumen).toEqual({ likes: 0, dislikes: 0, reaction: null });
    });

    it('consulta los totales y la reacción de una persona', async () => {
      await enviar('add_like', { recipeId: RECETA, userId: ANA });
      await enviar('add_dislike', { recipeId: RECETA, userId: BETO });
      expect(await enviar('get_recipe_stats', { recipeId: RECETA })).toEqual({
        likes: 1,
        dislikes: 1,
      });
      expect(
        await enviar('get_user_reaction', { recipeId: RECETA, userId: ANA }),
      ).toBe('like');
      expect(
        await enviar('get_user_reaction', { recipeId: RECETA, userId: BETO }),
      ).toBe('dislike');
      expect(
        await enviar('get_user_reaction', {
          recipeId: OTRA_RECETA,
          userId: ANA,
        }),
      ).toBeNull();
    });

    it('resume varias recetas de una vez, con la reacción de quien consulta', async () => {
      await enviar('add_like', { recipeId: RECETA, userId: ANA });
      await enviar('add_comment', {
        recipeId: RECETA,
        userId: BETO,
        text: 'Rica',
      });
      const mapa = await enviar('get_recipes_stats', {
        recipeIds: [RECETA, OTRA_RECETA],
        userId: ANA,
      });
      expect(mapa[RECETA]).toEqual({
        likes: 1,
        dislikes: 0,
        reaction: 'like',
        commentsCount: 1,
      });
      expect(mapa[OTRA_RECETA]).toEqual({
        likes: 0,
        dislikes: 0,
        reaction: null,
        commentsCount: 0,
      });
      const anonimo = await enviar('get_recipes_stats', {
        recipeIds: [RECETA],
      });
      expect(anonimo[RECETA].reaction).toBeNull();
      expect(anonimo[RECETA].likes).toBe(1);
      expect(await enviar('get_recipes_stats', { recipeIds: [] })).toEqual({});
    });

    it('valida los identificadores', async () => {
      expect(
        (await fallo('add_like', { recipeId: 'x', userId: ANA })).status,
      ).toBe(400);
      expect(
        (await fallo('add_like', { recipeId: RECETA, userId: 'y' })).status,
      ).toBe(400);
      expect(
        (await fallo('add_like', { recipeId: RECETA, userId: ANA, n: 1 }))
          .status,
      ).toBe(400);
    });
  });

  describe('comentarios', () => {
    it('agrega un comentario y lo devuelve', async () => {
      const comentario = await enviar('add_comment', {
        recipeId: RECETA,
        userId: ANA,
        text: '  Quedó deliciosa  ',
      });
      expect(comentario).toEqual({
        id: expect.any(String),
        recipeId: RECETA,
        userId: ANA,
        text: 'Quedó deliciosa',
        createdAt: expect.any(String),
      });
    });

    it('valida el texto', async () => {
      expect(
        (
          await fallo('add_comment', {
            recipeId: RECETA,
            userId: ANA,
            text: '   ',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await fallo('add_comment', {
            recipeId: RECETA,
            userId: ANA,
            text: 'a'.repeat(1001),
          })
        ).status,
      ).toBe(400);
    });

    it('lista los comentarios de una receta, los más nuevos primero', async () => {
      for (const text of ['primero', 'segundo', 'tercero']) {
        await enviar('add_comment', { recipeId: RECETA, userId: ANA, text });
        await new Promise((r) => setTimeout(r, 5));
      }
      const pagina = await enviar('get_comments_by_recipe', {
        recipeId: RECETA,
      });
      expect(pagina.total).toBe(3);
      expect(pagina.items.map((c: { text: string }) => c.text)).toEqual([
        'tercero',
        'segundo',
        'primero',
      ]);
    });

    it('pagina los comentarios', async () => {
      for (const text of ['a', 'b', 'c']) {
        await enviar('add_comment', { recipeId: RECETA, userId: ANA, text });
        await new Promise((r) => setTimeout(r, 5));
      }
      const pagina = await enviar('get_comments_by_recipe', {
        recipeId: RECETA,
        limit: 2,
        offset: 1,
      });
      expect(pagina.items.map((c: { text: string }) => c.text)).toEqual([
        'b',
        'a',
      ]);
      expect(pagina).toMatchObject({ total: 3, limit: 2, offset: 1 });
      expect(
        (
          await fallo('get_comments_by_recipe', {
            recipeId: RECETA,
            limit: 500,
          })
        ).status,
      ).toBe(400);
    });

    it('devuelve una página vacía si no hay comentarios', async () => {
      expect(
        await enviar('get_comments_by_recipe', { recipeId: RECETA }),
      ).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
    });

    it('lista los comentarios de una persona en varias recetas', async () => {
      await enviar('add_comment', {
        recipeId: RECETA,
        userId: ANA,
        text: 'uno',
      });
      await enviar('add_comment', {
        recipeId: OTRA_RECETA,
        userId: ANA,
        text: 'dos',
      });
      await enviar('add_comment', {
        recipeId: RECETA,
        userId: BETO,
        text: 'tres',
      });
      const pagina = await enviar('get_comments_by_user', { userId: ANA });
      expect(pagina.total).toBe(2);
    });

    it('solo quien lo escribió lo edita', async () => {
      const { id } = await enviar('add_comment', {
        recipeId: RECETA,
        userId: ANA,
        text: 'original',
      });
      const editado = await enviar('update_comment', {
        commentId: id,
        userId: ANA,
        text: 'editado',
      });
      expect(editado.text).toBe('editado');
      expect(editado.updatedAt).toEqual(expect.any(String));
      const ajeno = await fallo('update_comment', {
        commentId: id,
        userId: BETO,
        text: 'hackeado',
      });
      expect(ajeno.status).toBe(403);
      const pagina = await enviar('get_comments_by_recipe', {
        recipeId: RECETA,
      });
      expect(pagina.items[0].text).toBe('editado');
    });

    it('solo quien lo escribió lo elimina', async () => {
      const { id } = await enviar('add_comment', {
        recipeId: RECETA,
        userId: ANA,
        text: 'borrame',
      });
      expect(
        (await fallo('delete_comment', { commentId: id, userId: BETO })).status,
      ).toBe(403);
      expect(
        await enviar('delete_comment', { commentId: id, userId: ANA }),
      ).toEqual({ id, deleted: true });
      expect(
        (await enviar('get_comments_by_recipe', { recipeId: RECETA })).total,
      ).toBe(0);
      expect(
        (await enviar('get_comments_by_user', { userId: ANA })).total,
      ).toBe(0);
    });

    it('informa un comentario inexistente', async () => {
      expect(
        (
          await fallo('update_comment', {
            commentId: UUID_AJENO,
            userId: ANA,
            text: 'x',
          })
        ).status,
      ).toBe(404);
      expect(
        (await fallo('delete_comment', { commentId: UUID_AJENO, userId: ANA }))
          .status,
      ).toBe(404);
      expect(
        (await fallo('delete_comment', { commentId: 'raro', userId: ANA }))
          .status,
      ).toBe(400);
    });
  });

  describe('estadísticas y limpieza', () => {
    it('entrega me gusta, no me gusta y comentarios de una receta', async () => {
      await enviar('add_like', { recipeId: RECETA, userId: ANA });
      await enviar('add_dislike', { recipeId: RECETA, userId: BETO });
      await enviar('add_comment', {
        recipeId: RECETA,
        userId: ANA,
        text: 'hola',
      });
      expect(
        await enviar('get_recipe_social_stats', { recipeId: RECETA }),
      ).toEqual({ likes: 1, dislikes: 1, commentsCount: 1 });
    });

    it('al purgar una receta se borra todo lo asociado', async () => {
      await enviar('add_like', { recipeId: RECETA, userId: ANA });
      await enviar('add_comment', { recipeId: RECETA, userId: ANA, text: 'a' });
      await enviar('add_comment', {
        recipeId: RECETA,
        userId: BETO,
        text: 'b',
      });
      await enviar('add_comment', {
        recipeId: OTRA_RECETA,
        userId: ANA,
        text: 'queda',
      });
      const resultado = await enviar('purge_recipe_social', {
        recipeId: RECETA,
      });
      expect(resultado).toEqual({ recipeId: RECETA, commentsRemoved: 2 });
      expect(
        await enviar('get_recipe_social_stats', { recipeId: RECETA }),
      ).toEqual({ likes: 0, dislikes: 0, commentsCount: 0 });
      expect(
        (await enviar('get_comments_by_user', { userId: ANA })).total,
      ).toBe(1);
      expect(await redis.dbsize()).toBe(3);
    });
  });
});
