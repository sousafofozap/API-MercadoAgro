import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUrl, MaxLength, Min } from 'class-validator';

export class AddFotoAnuncioDto {
  @ApiPropertyOptional({
    example: 'https://cdn.mercadoagro.com.br/fotos/uuid.jpg',
    description: 'Alias em PT-BR para url',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_tld: true, require_protocol: true })
  @MaxLength(500)
  foto_url?: string;

  @ApiProperty({
    example: 'https://cdn.mercadoagro.com.br/fotos/uuid.jpg',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_tld: true, require_protocol: true })
  @MaxLength(500)
  url?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ordem?: number;
}
