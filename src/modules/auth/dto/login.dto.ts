import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, ValidateIf } from 'class-validator';

function validatePassword(object: LoginDto) {
  return object.password !== undefined || object.senha === undefined;
}

function validateSenha(object: LoginDto) {
  return object.senha !== undefined || object.password === undefined;
}

export class LoginDto {
  @ApiProperty({ example: 'seller@mercadoagro.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Seller@123456' })
  @ValidateIf(validatePassword)
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    example: 'Seller@123456',
    description: 'Alias em PT-BR para password',
  })
  @ValidateIf(validateSenha)
  @IsString()
  @MinLength(8)
  senha?: string;
}
