import { validarEntorno } from './env';

describe('validarEntorno', () => {
  it('aplica valores por defecto', () => {
    const env = validarEntorno({});
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.AMQP_URI).toBe('amqp://localhost:5672');
    expect(env.SOCIALS_QUEUE).toBe('socials_queue');
  });

  it('respeta los valores indicados', () => {
    const env = validarEntorno({
      REDIS_URL: 'redis://cache:6379/2',
      SOCIALS_QUEUE: 'otra',
    });
    expect(env.REDIS_URL).toBe('redis://cache:6379/2');
    expect(env.SOCIALS_QUEUE).toBe('otra');
  });

  it('rechaza un entorno desconocido', () => {
    expect(() => validarEntorno({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
