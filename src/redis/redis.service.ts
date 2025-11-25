import { Injectable } from '@nestjs/common';
import { RedisClient } from './redis.client';
import { Client } from 'redis-om';

@Injectable()
export class RedisService {
  constructor(private readonly redisClient: RedisClient) {}

  getClient(): Client {
    return this.redisClient.getClient();
  }
}