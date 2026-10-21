import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'redis-om';

@Injectable()
export class RedisClient implements OnModuleInit {
  private client: Client;

  async onModuleInit() {
    this.client = new Client();
    await this.client.open(process.env.REDIS_URI || 'redis://localhost:6379');
  }

  getClient() {
    return this.client;
  }
}
