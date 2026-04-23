import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUrl, MaxLength, Min } from 'class-validator';

export class AddPhotoDto {
  @ApiProperty({ example: 'https://cdn.mercadoagro.com.br/fotos/uuid.jpg' })
  @IsUrl({ protocols: ['https'], require_tld: true, require_protocol: true })
  @MaxLength(500)
  url!: string;

  @ApiPropertyOptional({ example: 0, description: 'Ordem de exibicao (0 = capa)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}
