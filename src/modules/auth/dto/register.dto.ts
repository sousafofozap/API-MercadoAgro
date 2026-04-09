import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Pedro Lucas Muniz' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'pedro@mercadoagro.com.br' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Senha@123',
    description:
      'Minimo de 8 caracteres com letra maiuscula, minuscula e numero.',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'A senha deve conter ao menos uma letra minuscula, uma maiuscula e um numero.',
  })
  password!: string;

  @ApiPropertyOptional({ example: '+55 99 99999-9999' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
