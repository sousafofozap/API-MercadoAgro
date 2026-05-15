import { Module } from '@nestjs/common';

import { AnunciosController } from './anuncios.controller';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  controllers: [ListingsController, AnunciosController],
  providers: [ListingsService],
})
export class ListingsModule {}
