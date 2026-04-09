import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'seller@mercadoagro.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Seller@123456' })
  @IsString()
  @MinLength(8)
  password!: string;
}
