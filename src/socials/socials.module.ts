import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CookbookService } from './cookbook.service';
import { CookedService } from './cooked.service';
import { RatingsService } from './ratings.service';
import { SocialsController } from './socials.controller';
import { SocialsService } from './socials.service';

@Module({
  controllers: [SocialsController],
  providers: [
    SocialsService,
    RatingsService,
    CommentsService,
    CookbookService,
    CookedService,
  ],
})
export class SocialsModule {}
