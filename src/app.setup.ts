import {
  INestMicroservice,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

const mensajes = (errores: ValidationError[]): string[] =>
  errores.flatMap((e) => [
    ...Object.values(e.constraints ?? {}),
    ...mensajes(e.children ?? []),
  ]);

export const configurarApp = (app: INestMicroservice) => {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errores) =>
        new RpcException({ status: 400, message: mensajes(errores) }),
    }),
  );
  return app;
};
