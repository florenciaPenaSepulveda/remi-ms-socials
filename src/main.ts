import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const configService = appContext.get(ConfigService);
  const amqpUri = configService.get<string>('AMQP_URI') || 'amqp://localhost:5672';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [amqpUri],
        queue: 'socials_queue',
        queueOptions: { durable: false },
      },
    },
  );

  await app.listen();
  console.log(`🚀 Users microservice is listening via LavinMQ`);
}
bootstrap();
