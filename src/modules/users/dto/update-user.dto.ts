import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Pedro Lucas Muniz' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({
    example: 'Pedro Lucas Muniz',
    description: 'Alias em PT-BR para fullName',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nome?: string;

  @ApiPropertyOptional({ example: '+55 99 99999-9999', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({
    example: '+55 99 99999-9999',
    nullable: true,
    description: 'Alias em PT-BR para phone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.mercadoagro.com.br/avatars/uuid.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_tld: true, require_protocol: true })
  @MaxLength(500)
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.mercadoagro.com.br/avatars/uuid.jpg',
    nullable: true,
    description: 'Alias em PT-BR para avatarUrl',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_tld: true, require_protocol: true })
  @MaxLength(500)
  avatar_url?: string | null;

  @ApiPropertyOptional({ example: 'comprador', enum: ['anunciante', 'comprador'] })
  @IsOptional()
  @IsString()
  @IsIn(['anunciante', 'comprador'])
  perfil?: string;
}
