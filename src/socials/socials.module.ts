import { Module } from '@nestjs/common';
import { SocialsController } from './socials.controller';
import { SocialsService } from './socials.service';
import { LikesService } from './likes.service';
import { CommentsService } from './comments.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [SocialsController],
  providers: [SocialsService, LikesService, CommentsService],
  exports: [SocialsService],
})
export class SocialsModule {}
