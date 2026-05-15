import { Module } from '@nestjs/common';

import { ReviewsModule } from '../reviews/reviews.module';
import { UsuariosController } from './usuarios.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ReviewsModule],
  controllers: [UsersController, UsuariosController],
  providers: [UsersService],
})
export class UsersModule {}
