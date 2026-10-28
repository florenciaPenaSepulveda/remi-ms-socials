import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { LikesService } from './likes.service';
import { SocialsController } from './socials.controller';
import { SocialsService } from './socials.service';

@Module({
  controllers: [SocialsController],
  providers: [SocialsService, LikesService, CommentsService],
})
export class SocialsModule {}
