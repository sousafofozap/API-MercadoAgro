import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

function validateWhenCanonicalOrAliasMissing(
  canonicalKey: string,
  aliasKey: string,
) {
  return (object: Record<string, unknown>) =>
    object[canonicalKey] !== undefined || object[aliasKey] === undefined;
}

function validateWhenAliasOrCanonicalMissing(
  canonicalKey: string,
  aliasKey: string,
) {
  return (object: Record<string, unknown>) =>
    object[aliasKey] !== undefined || object[canonicalKey] === undefined;
}

export class RegisterDto {
  @ApiProperty({ example: 'Pedro Lucas Muniz' })
  @ValidateIf(validateWhenCanonicalOrAliasMissing('fullName', 'nome'))
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({
    example: 'Pedro Lucas Muniz',
    description: 'Alias em PT-BR para fullName',
  })
  @ValidateIf(validateWhenAliasOrCanonicalMissing('fullName', 'nome'))
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nome?: string;

  @ApiProperty({ example: 'pedro@mercadoagro.com.br' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Senha@123',
    description:
      'Minimo de 8 caracteres com letra maiuscula, minuscula e numero.',
  })
  @ValidateIf(validateWhenCanonicalOrAliasMissing('password', 'senha'))
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'A senha deve conter ao menos uma letra minuscula, uma maiuscula e um numero.',
  })
  password?: string;

  @ApiPropertyOptional({
    example: 'Senha@123',
    description: 'Alias em PT-BR para password',
  })
  @ValidateIf(validateWhenAliasOrCanonicalMissing('password', 'senha'))
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'A senha deve conter ao menos uma letra minuscula, uma maiuscula e um numero.',
  })
  senha?: string;

  @ApiPropertyOptional({ example: '+55 99 99999-9999' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    example: '+55 99 99999-9999',
    description: 'Alias em PT-BR para phone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string;

  @ApiPropertyOptional({
    example: '12345678900',
    description: 'CPF ou CNPJ (somente digitos)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cpfCnpj?: string;

  @ApiPropertyOptional({
    example: '12345678900',
    description: 'Alias em PT-BR para cpfCnpj',
  })
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cpf_cnpj?: string;

  @ApiProperty({
    example: true,
    description: 'Aceite dos termos de uso (obrigatorio)',
  })
  @ValidateIf(
    validateWhenCanonicalOrAliasMissing('termsAccepted', 'aceite_termos'),
  )
  @IsBoolean()
  @Equals(true, { message: 'Voce deve aceitar os termos de uso.' })
  termsAccepted?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Alias em PT-BR para termsAccepted',
  })
  @ValidateIf(
    validateWhenAliasOrCanonicalMissing('termsAccepted', 'aceite_termos'),
  )
  @IsBoolean()
  @Equals(true, { message: 'Voce deve aceitar os termos de uso.' })
  aceite_termos?: boolean;

  @ApiProperty({
    example: true,
    description: 'Aceite da politica de privacidade (obrigatorio)',
  })
  @ValidateIf(
    validateWhenCanonicalOrAliasMissing(
      'privacyAccepted',
      'aceite_privacidade',
    ),
  )
  @IsBoolean()
  @Equals(true, { message: 'Voce deve aceitar a politica de privacidade.' })
  privacyAccepted?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Alias em PT-BR para privacyAccepted',
  })
  @ValidateIf(
    validateWhenAliasOrCanonicalMissing(
      'privacyAccepted',
      'aceite_privacidade',
    ),
  )
  @IsBoolean()
  @Equals(true, { message: 'Voce deve aceitar a politica de privacidade.' })
  aceite_privacidade?: boolean;

  @ApiPropertyOptional({
    example: 'anunciante',
    description: 'Perfil funcional do app mobile',
  })
  @IsOptional()
  @IsString()
  @IsIn(['anunciante', 'comprador', 'usuario', 'user', 'USER'])
  perfil?: string;
}
