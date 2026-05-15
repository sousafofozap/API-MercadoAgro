import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

function validatePassword(object: ResetPasswordDto) {
  return object.password !== undefined || object.senha === undefined;
}

function validateSenha(object: ResetPasswordDto) {
  return object.senha !== undefined || object.password === undefined;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recebido por e-mail' })
  @IsString()
  @IsUUID('4')
  token!: string;

  @ApiProperty({
    example: 'NovaSenha@123',
    description:
      'Minimo de 8 caracteres com letra maiuscula, minuscula e numero.',
  })
  @ValidateIf(validatePassword)
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'A senha deve conter ao menos uma letra minuscula, uma maiuscula e um numero.',
  })
  password?: string;

  @ApiPropertyOptional({
    example: 'NovaSenha@123',
    description: 'Alias em PT-BR para password',
  })
  @ValidateIf(validateSenha)
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'A senha deve conter ao menos uma letra minuscula, uma maiuscula e um numero.',
  })
  senha?: string;
}
