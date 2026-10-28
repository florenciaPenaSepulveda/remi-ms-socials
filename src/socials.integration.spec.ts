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
const AUTORA = '707f1f77bcf86cd799439031';
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
  const puntuar = (userId: string, stars: number, recipeId = RECETA) =>
    enviar('rate_recipe', { recipeId, userId, authorId: AUTORA, stars });

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

  describe('puntuaciones', () => {
    it('registra una puntuación y calcula el promedio', async () => {
      expect(await puntuar(ANA, 5)).toEqual({
        average: 5,
        count: 1,
        myRating: 5,
      });
      expect(await puntuar(BETO, 4)).toEqual({
        average: 4.5,
        count: 2,
        myRating: 4,
      });
    });

    it('cambiar la puntuación reemplaza la anterior sin sumar otra', async () => {
      await puntuar(ANA, 2);
      const resumen = await puntuar(ANA, 5);
      expect(resumen).toEqual({ average: 5, count: 1, myRating: 5 });
    });

    it('quitar la puntuación la descuenta', async () => {
      await puntuar(ANA, 4);
      await puntuar(BETO, 2);
      const resumen = await enviar('unrate_recipe', {
        recipeId: RECETA,
        userId: ANA,
        authorId: AUTORA,
      });
      expect(resumen).toEqual({ average: 2, count: 1, myRating: null });
      const otra = await enviar('unrate_recipe', {
        recipeId: RECETA,
        userId: ANA,
        authorId: AUTORA,
      });
      expect(otra.count).toBe(1);
    });

    it('solo admite enteros de 1 a 5', async () => {
      for (const stars of [0, 6, 3.5, '4']) {
        const error = await fallo('rate_recipe', {
          recipeId: RECETA,
          userId: ANA,
          authorId: AUTORA,
          stars,
        });
        expect(error.status).toBe(400);
      }
    });

    it('valida los identificadores', async () => {
      const error = await fallo('rate_recipe', {
        recipeId: 'x',
        userId: ANA,
        authorId: AUTORA,
        stars: 3,
      });
      expect(error.status).toBe(400);
    });
  });

  describe('reputación del creador', () => {
    it('promedia las puntuaciones de todas sus recetas', async () => {
      await puntuar(ANA, 5, RECETA);
      await puntuar(BETO, 3, OTRA_RECETA);
      const mapa = await enviar('get_creators_stats', {
        userIds: [AUTORA, ANA],
      });
      expect(mapa[AUTORA]).toEqual({
        average: 4,
        ratings: 2,
        cookedByOthers: 0,
      });
      expect(mapa[ANA]).toEqual({ average: 0, ratings: 0, cookedByOthers: 0 });
    });

    it('un cambio de puntuación actualiza el promedio del creador', async () => {
      await puntuar(ANA, 1);
      await puntuar(ANA, 5);
      const mapa = await enviar('get_creators_stats', { userIds: [AUTORA] });
      expect(mapa[AUTORA]).toMatchObject({ average: 5, ratings: 1 });
    });

    it('cuenta las veces que otras personas cocinaron sus recetas', async () => {
      await enviar('mark_cooked', {
        recipeId: RECETA,
        userId: ANA,
        authorId: AUTORA,
        grams: 500,
        usedPantry: false,
      });
      await enviar('mark_cooked', {
        recipeId: RECETA,
        userId: AUTORA,
        authorId: AUTORA,
        grams: 500,
        usedPantry: false,
      });
      const mapa = await enviar('get_creators_stats', { userIds: [AUTORA] });
      expect(mapa[AUTORA].cookedByOthers).toBe(1);
    });

    it('responde vacío sin creadores', async () => {
      expect(await enviar('get_creators_stats', { userIds: [] })).toEqual({});
    });
  });

  describe('cociné esto e impacto', () => {
    const cocinar = (extra: Record<string, unknown> = {}) =>
      enviar('mark_cooked', {
        recipeId: RECETA,
        userId: ANA,
        authorId: AUTORA,
        grams: 800,
        usedPantry: true,
        ...extra,
      });

    it('registra la receta cocinada con la nota', async () => {
      const entrada = await cocinar({ note: '  Quedó espectacular ' });
      expect(entrada).toMatchObject({
        recipeId: RECETA,
        userId: ANA,
        grams: 800,
        usedPantry: true,
        note: 'Quedó espectacular',
      });
      const historial = await enviar('get_cooked_history', { userId: ANA });
      expect(historial.total).toBe(1);
      expect(historial.items[0].id).toBe(entrada.id);
    });

    it('suma al impacto solo lo cocinado con lo que había en la despensa', async () => {
      await cocinar();
      await cocinar({ recipeId: OTRA_RECETA, grams: 300, usedPantry: false });
      expect(await enviar('get_impact')).toEqual({
        cooked: 2,
        pantryCooked: 1,
        grams: 800,
      });
      expect(await enviar('get_user_stats', { userId: ANA })).toEqual({
        cooked: 2,
        grams: 800,
      });
    });

    it('no permite registrar la misma receta dos veces el mismo día', async () => {
      await cocinar();
      const error = await fallo('mark_cooked', {
        recipeId: RECETA,
        userId: ANA,
        authorId: AUTORA,
        grams: 800,
        usedPantry: true,
      });
      expect(error.status).toBe(409);
      expect((await enviar('get_impact')).cooked).toBe(1);
    });

    it('otra persona sí puede registrar la misma receta', async () => {
      await cocinar();
      await cocinar({ userId: BETO });
      expect((await enviar('get_impact')).cooked).toBe(2);
    });

    it('muestra el historial más reciente primero y con paginación', async () => {
      await cocinar({ recipeId: RECETA });
      await new Promise((r) => setTimeout(r, 5));
      await cocinar({ recipeId: OTRA_RECETA });
      const pagina = await enviar('get_cooked_history', {
        userId: ANA,
        limit: 1,
      });
      expect(pagina.items[0].recipeId).toBe(OTRA_RECETA);
      expect(pagina).toMatchObject({ total: 2, limit: 1, offset: 0 });
    });

    it('valida los datos', async () => {
      expect((await fallo('mark_cooked', { recipeId: RECETA })).status).toBe(
        400,
      );
      expect((await cocinarInvalido({ grams: -5 })).status).toBe(400);
      expect((await cocinarInvalido({ grams: 99999 })).status).toBe(400);
      expect((await cocinarInvalido({ note: 'x'.repeat(301) })).status).toBe(
        400,
      );
    });

    const cocinarInvalido = (extra: Record<string, unknown>) =>
      fallo('mark_cooked', {
        recipeId: RECETA,
        userId: ANA,
        authorId: AUTORA,
        grams: 100,
        usedPantry: true,
        ...extra,
      });

    it('el impacto empieza en cero', async () => {
      expect(await enviar('get_impact')).toEqual({
        cooked: 0,
        pantryCooked: 0,
        grams: 0,
      });
      expect(await enviar('get_user_stats', { userId: BETO })).toEqual({
        cooked: 0,
        grams: 0,
      });
    });
  });

  describe('listas del recetario', () => {
    it('crea la lista de favoritas la primera vez', async () => {
      const listas = await enviar<any[]>('get_lists', { userId: ANA });
      expect(listas).toEqual([
        {
          id: expect.any(String),
          name: 'Favoritas',
          isDefault: true,
          count: 0,
          recipeIds: [],
        },
      ]);
      const otra = await enviar<any[]>('get_lists', { userId: ANA });
      expect(otra[0].id).toBe(listas[0].id);
    });

    it('crea listas con nombre único por persona', async () => {
      const lista = await enviar('create_list', {
        userId: ANA,
        name: '  Cenas   rápidas ',
      });
      expect(lista).toMatchObject({ name: 'Cenas rápidas', isDefault: false });
      expect(
        (await fallo('create_list', { userId: ANA, name: 'cenas rápidas' }))
          .status,
      ).toBe(409);
      expect(
        (await fallo('create_list', { userId: ANA, name: 'Favoritas' })).status,
      ).toBe(409);
      await enviar('create_list', { userId: BETO, name: 'Cenas rápidas' });
    });

    it('ordena con las favoritas primero', async () => {
      await enviar('create_list', { userId: ANA, name: 'Postres' });
      const listas = await enviar<any[]>('get_lists', { userId: ANA });
      expect(listas.map((l) => l.name as string)).toEqual([
        'Favoritas',
        'Postres',
      ]);
    });

    it('limita el número de listas', async () => {
      for (let i = 0; i < 19; i++) {
        await enviar('create_list', { userId: ANA, name: `Lista ${i}` });
      }
      expect(
        (await fallo('create_list', { userId: ANA, name: 'Una más' })).status,
      ).toBe(409);
    });

    it('agrega y quita recetas sin duplicar', async () => {
      const [favoritas] = await enviar<any[]>('get_lists', { userId: ANA });
      const datos = { userId: ANA, listId: favoritas.id, recipeId: RECETA };
      await enviar('add_to_list', datos);
      const lista = await enviar('add_to_list', datos);
      expect(lista).toMatchObject({ count: 1, recipeIds: [RECETA] });
      const guardados = await enviar('get_recipes_stats', {
        recipeIds: [RECETA],
      });
      expect(guardados[RECETA].savedCount).toBe(1);
      const vacia = await enviar('remove_from_list', datos);
      expect(vacia.count).toBe(0);
      await enviar('remove_from_list', datos);
      const despues = await enviar('get_recipes_stats', {
        recipeIds: [RECETA],
      });
      expect(despues[RECETA].savedCount).toBe(0);
    });

    it('muestra las recetas más recientes primero', async () => {
      const [favoritas] = await enviar<any[]>('get_lists', { userId: ANA });
      await enviar('add_to_list', {
        userId: ANA,
        listId: favoritas.id,
        recipeId: RECETA,
      });
      await new Promise((r) => setTimeout(r, 5));
      await enviar('add_to_list', {
        userId: ANA,
        listId: favoritas.id,
        recipeId: OTRA_RECETA,
      });
      const lista = await enviar('get_list', {
        userId: ANA,
        listId: favoritas.id,
      });
      expect(lista.recipeIds).toEqual([OTRA_RECETA, RECETA]);
    });

    it('renombra una lista', async () => {
      const lista = await enviar('create_list', {
        userId: ANA,
        name: 'Postres',
      });
      const nueva = await enviar('rename_list', {
        userId: ANA,
        listId: lista.id,
        name: 'Dulces',
      });
      expect(nueva.name).toBe('Dulces');
      await enviar('create_list', { userId: ANA, name: 'Postres' });
      await enviar('create_list', { userId: ANA, name: 'Otra' });
      const choque = await fallo('rename_list', {
        userId: ANA,
        listId: lista.id,
        name: 'otra',
      });
      expect(choque.status).toBe(409);
    });

    it('elimina una lista y descuenta los guardados', async () => {
      const lista = await enviar('create_list', {
        userId: ANA,
        name: 'Temporal',
      });
      await enviar('add_to_list', {
        userId: ANA,
        listId: lista.id,
        recipeId: RECETA,
      });
      expect(
        await enviar('delete_list', { userId: ANA, listId: lista.id }),
      ).toEqual({ id: lista.id, deleted: true });
      const stats = await enviar('get_recipes_stats', { recipeIds: [RECETA] });
      expect(stats[RECETA].savedCount).toBe(0);
      expect(
        (await fallo('get_list', { userId: ANA, listId: lista.id })).status,
      ).toBe(404);
    });

    it('no elimina la lista de favoritas', async () => {
      const [favoritas] = await enviar<any[]>('get_lists', { userId: ANA });
      expect(
        (await fallo('delete_list', { userId: ANA, listId: favoritas.id }))
          .status,
      ).toBe(400);
    });

    it('solo la dueña modifica su lista', async () => {
      const lista = await enviar('create_list', { userId: ANA, name: 'Mía' });
      for (const cmd of ['get_list', 'delete_list']) {
        expect(
          (await fallo(cmd, { userId: BETO, listId: lista.id })).status,
        ).toBe(403);
      }
      expect(
        (
          await fallo('add_to_list', {
            userId: BETO,
            listId: lista.id,
            recipeId: RECETA,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await fallo('rename_list', {
            userId: BETO,
            listId: lista.id,
            name: 'Robada',
          })
        ).status,
      ).toBe(403);
    });

    it('valida los identificadores y nombres', async () => {
      expect(
        (await fallo('get_list', { userId: ANA, listId: 'x' })).status,
      ).toBe(400);
      expect(
        (await fallo('get_list', { userId: ANA, listId: UUID_AJENO })).status,
      ).toBe(404);
      expect(
        (await fallo('create_list', { userId: ANA, name: '   ' })).status,
      ).toBe(400);
      expect(
        (await fallo('create_list', { userId: ANA, name: 'x'.repeat(41) }))
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
      for (const text of ['   ', 'a'.repeat(1001)]) {
        expect(
          (await fallo('add_comment', { recipeId: RECETA, userId: ANA, text }))
            .status,
        ).toBe(400);
      }
    });

    it('lista y pagina los comentarios, los más nuevos primero', async () => {
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
      expect(
        await enviar('get_comments_by_recipe', { recipeId: OTRA_RECETA }),
      ).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
    });

    it('lista los comentarios de una persona', async () => {
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
      expect(
        (await enviar('get_comments_by_user', { userId: ANA })).total,
      ).toBe(2);
    });

    it('solo quien lo escribió lo edita o elimina', async () => {
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
      expect(
        (
          await fallo('update_comment', {
            commentId: id,
            userId: BETO,
            text: 'x',
          })
        ).status,
      ).toBe(403);
      expect(
        (await fallo('delete_comment', { commentId: id, userId: BETO })).status,
      ).toBe(403);
      expect(
        await enviar('delete_comment', { commentId: id, userId: ANA }),
      ).toEqual({ id, deleted: true });
      expect(
        (await enviar('get_comments_by_recipe', { recipeId: RECETA })).total,
      ).toBe(0);
    });

    it('informa un comentario inexistente o un ID inválido', async () => {
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
        (await fallo('delete_comment', { commentId: 'raro', userId: ANA }))
          .status,
      ).toBe(400);
    });
  });

  describe('estadísticas y limpieza', () => {
    it('resume varias recetas en una consulta', async () => {
      await puntuar(ANA, 4);
      await puntuar(BETO, 5);
      await enviar('add_comment', {
        recipeId: RECETA,
        userId: ANA,
        text: 'hola',
      });
      await enviar('mark_cooked', {
        recipeId: RECETA,
        userId: ANA,
        authorId: AUTORA,
        grams: 100,
        usedPantry: false,
      });
      const mapa = await enviar('get_recipes_stats', {
        recipeIds: [RECETA, OTRA_RECETA],
        userId: ANA,
      });
      expect(mapa[RECETA]).toEqual({
        average: 4.5,
        count: 2,
        myRating: 4,
        cookedCount: 1,
        savedCount: 0,
        commentsCount: 1,
      });
      expect(mapa[OTRA_RECETA]).toEqual({
        average: 0,
        count: 0,
        myRating: null,
        cookedCount: 0,
        savedCount: 0,
        commentsCount: 0,
      });
      const anonimo = await enviar('get_recipes_stats', {
        recipeIds: [RECETA],
      });
      expect(anonimo[RECETA].myRating).toBeNull();
      expect(await enviar('get_recipes_stats', { recipeIds: [] })).toEqual({});
    });

    it('entrega las estadísticas de una receta', async () => {
      await puntuar(ANA, 3);
      expect(
        await enviar('get_recipe_social_stats', { recipeId: RECETA }),
      ).toMatchObject({ average: 3, count: 1 });
    });

    it('al purgar una receta se borra todo y se corrige al creador', async () => {
      await puntuar(ANA, 5, RECETA);
      await puntuar(BETO, 3, RECETA);
      await puntuar(ANA, 1, OTRA_RECETA);
      await enviar('add_comment', { recipeId: RECETA, userId: ANA, text: 'a' });
      await enviar('add_comment', {
        recipeId: RECETA,
        userId: BETO,
        text: 'b',
      });
      await enviar('mark_cooked', {
        recipeId: RECETA,
        userId: ANA,
        authorId: AUTORA,
        grams: 100,
        usedPantry: false,
      });
      const resultado = await enviar('purge_recipe_social', {
        recipeId: RECETA,
        authorId: AUTORA,
      });
      expect(resultado).toMatchObject({
        ratingsRemoved: 2,
        commentsRemoved: 2,
      });
      const mapa = await enviar('get_creators_stats', { userIds: [AUTORA] });
      expect(mapa[AUTORA]).toEqual({
        average: 1,
        ratings: 1,
        cookedByOthers: 0,
      });
      const stats = await enviar('get_recipes_stats', {
        recipeIds: [RECETA, OTRA_RECETA],
      });
      expect(stats[RECETA]).toMatchObject({
        count: 0,
        commentsCount: 0,
        cookedCount: 0,
      });
      expect(stats[OTRA_RECETA].count).toBe(1);
    });
  });
});
