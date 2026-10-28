import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from './config/env';
import { RedisModule } from './redis/redis.module';
import { SocialsModule } from './socials/socials.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno }),
    RedisModule,
    SocialsModule,
  ],
})
export class AppModule {}
