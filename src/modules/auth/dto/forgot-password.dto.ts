import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'pedro@mercadoagro.com.br' })
  @IsEmail()
  email!: string;
}
