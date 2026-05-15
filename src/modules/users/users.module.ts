import { Module } from '@nestjs/common';

import { UsuariosController } from './usuarios.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, UsuariosController],
  providers: [UsersService],
})
export class UsersModule {}
