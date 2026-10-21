import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisClient } from './redis.client'; // <--- 1. Importa esto

@Module({
  providers: [
    RedisService, 
    RedisClient // <--- 2. Agrega esto aquí
  ],
  exports: [RedisService],
})
export class RedisModule {}