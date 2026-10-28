import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';
import { validarEntorno } from './config/env';

async function bootstrap() {
  const env = validarEntorno(process.env);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [env.AMQP_URI],
        queue: env.SOCIALS_QUEUE,
        queueOptions: { durable: false },
      },
    },
  );
  configurarApp(app);
  app.enableShutdownHooks();
  await app.listen();
  new Logger('Socials').log(`Escuchando la cola ${env.SOCIALS_QUEUE}`);
}
void bootstrap();
